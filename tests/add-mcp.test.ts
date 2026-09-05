import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SECRET_TOKEN = 'secret-token-that-must-not-be-logged';

describe('add-mcp credentials', () => {
    let tempDir: string;
    let configFile: string;
    let cursorConfig: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-add-mcp-'));
        configFile = join(tempDir, 'zentao.json');
        cursorConfig = join(tempDir, '.cursor', 'mcp.json');
        mkdirSync(join(tempDir, '.cursor'), { recursive: true });
        writeFileSync(configFile, JSON.stringify({
            currentProfile: 'admin@https://zentao.example.com',
            profiles: [{
                server: 'https://zentao.example.com',
                account: 'admin',
                token: SECRET_TOKEN,
                loginTime: '2026-08-24T00:00:00.000Z',
                lastUsedTime: '2026-08-24T00:00:00.000Z',
            }],
        }));
    });

    afterEach(() => {
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    });

    async function runAddMcp(agent: string, silent = false) {
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            HOME: tempDir,
            ZENTAO_CONFIG_FILE: configFile,
            ZENTAO_URL: '',
            ZENTAO_ACCOUNT: '',
            ZENTAO_PASSWORD: '',
            ZENTAO_TOKEN: '',
        };

        const proc = Bun.spawn({
            cmd: [process.execPath, 'src/index.ts', ...(silent ? ['--silent'] : []), 'add-mcp', agent],
            cwd: process.cwd(),
            env,
            stdin: 'ignore',
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        return { stdout, stderr, exitCode };
    }

    test('replaces stored password with profile token and tightens existing file permissions', async () => {
        writeFileSync(cursorConfig, JSON.stringify({
            mcpServers: {
                'zentao-cli': {
                    env: { ZENTAO_PASSWORD: 'legacy-password' },
                },
            },
        }));
        chmodSync(cursorConfig, 0o644);

        const result = await runAddMcp('cursor', true);
        const written = readFileSync(cursorConfig, 'utf-8');
        const config = JSON.parse(written) as Record<string, unknown>;
        const servers = config.mcpServers as Record<string, Record<string, unknown>>;
        const env = servers['zentao-cli'].env as Record<string, string>;

        expect(result).toMatchObject({ exitCode: 0 });
        expect(env.ZENTAO_TOKEN).toBe(SECRET_TOKEN);
        expect(env.ZENTAO_PASSWORD).toBeUndefined();
        expect(servers['zentao-cli'].command).toBe('zentao');
        expect(servers['zentao-cli'].args).toEqual(['mcp']);
        expect(statSync(cursorConfig).mode & 0o777).toBe(0o600);
        expect(result.stdout + result.stderr).not.toContain(SECRET_TOKEN);
        expect(result.stdout + result.stderr).not.toContain('legacy-password');
    });

    test('Cherry Studio instructions never print the saved token', async () => {
        const result = await runAddMcp('cherry-studio');

        expect(result).toMatchObject({ exitCode: 0 });
        expect(result.stdout).toContain('zentao-cli');
        expect(result.stdout + result.stderr).not.toContain(SECRET_TOKEN);
        expect(result.stdout + result.stderr).not.toContain('ZENTAO_PASSWORD');
        expect(result.stdout + result.stderr).not.toContain('ZENTAO_TOKEN');
    });

    test('Codex TOML removes password, keeps token private, and calls installed CLI', async () => {
        const codexConfig = join(tempDir, '.codex', 'config.toml');
        mkdirSync(join(tempDir, '.codex'), { recursive: true });
        writeFileSync(codexConfig, [
            '[mcp_servers.zentao-cli]',
            'command = "npx"',
            'args = ["-y", "zentao-cli", "mcp"]',
            'env = { ZENTAO_PASSWORD = "legacy-password" }',
            '',
            '[projects."/tmp/existing"]',
            'trust_level = "trusted"',
            '',
        ].join('\r\n'));
        chmodSync(codexConfig, 0o644);

        const result = await runAddMcp('codex', true);
        const written = readFileSync(codexConfig, 'utf-8');

        expect(result).toMatchObject({ exitCode: 0 });
        expect(written).toContain('command = "zentao"');
        expect(written).toContain('args = ["mcp"]');
        expect(written).toContain(`ZENTAO_TOKEN = "${SECRET_TOKEN}"`);
        expect(written).not.toContain('ZENTAO_PASSWORD');
        expect(written).toContain('[projects."/tmp/existing"]');
        expect(written).toContain('trust_level = "trusted"');
        expect(statSync(codexConfig).mode & 0o777).toBe(0o600);
        expect(result.stdout + result.stderr).not.toContain(SECRET_TOKEN);
    });

    test('Codex TOML ignores a commented-out section header', async () => {
        const codexConfig = join(tempDir, '.codex', 'config.toml');
        mkdirSync(join(tempDir, '.codex'), { recursive: true });
        writeFileSync(codexConfig, [
            '# [mcp_servers.zentao-cli]',
            '# command = "disabled"',
            '',
            '[projects."/tmp/example"]',
            'trust_level = "trusted"',
            '',
        ].join('\n'));

        const result = await runAddMcp('codex', true);
        const written = readFileSync(codexConfig, 'utf-8');

        expect(result.exitCode).toBe(0);
        expect(written).toContain('# [mcp_servers.zentao-cli]');
        expect(written.match(/^\[mcp_servers\.zentao-cli\]$/gm)).toHaveLength(1);
        expect(written).toContain('[projects."/tmp/example"]');
        expect(written).toContain(`ZENTAO_TOKEN = "${SECRET_TOKEN}"`);
    });

    test('Codex TOML preserves following tables with brackets in quoted keys', async () => {
        const codexConfig = join(tempDir, '.codex', 'config.toml');
        const followingTables = [
            '[projects."/tmp/repo[work]"] # keep this project',
            'trust_level = "trusted"',
            '',
            "[projects.'/tmp/repo[personal]']",
            'trust_level = "untrusted"',
            '',
            '[[profiles."test]env"]]',
            'name = "keep this profile"',
            '',
        ].join('\r\n');
        mkdirSync(dirname(codexConfig), { recursive: true });
        writeFileSync(codexConfig, '[mcp_servers.zentao-cli]\r\ncommand = "npx"\r\n\r\n' + followingTables);

        const result = await runAddMcp('codex', true);
        const written = readFileSync(codexConfig, 'utf-8');

        expect(result.exitCode).toBe(0);
        expect(written.endsWith(followingTables)).toBe(true);
        expect(Bun.TOML.parse(written)).toMatchObject({
            projects: {
                '/tmp/repo[work]': { trust_level: 'trusted' },
                '/tmp/repo[personal]': { trust_level: 'untrusted' },
            },
            profiles: { 'test]env': [{ name: 'keep this profile' }] },
        });
    });

    test('refuses to destroy JSONC comments', async () => {
        const vscodeConfig = process.platform === 'darwin'
            ? join(tempDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json')
            : process.platform === 'win32'
                ? join(tempDir, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json')
                : join(tempDir, '.config', 'Code', 'User', 'mcp.json');
        const original = '{\n  // keep this comment\n  "servers": {}\n}\n';
        mkdirSync(dirname(vscodeConfig), { recursive: true });
        writeFileSync(vscodeConfig, original);

        const result = await runAddMcp('vscode', true);

        expect(result.exitCode).toBe(1);
        expect(readFileSync(vscodeConfig, 'utf-8')).toBe(original);
        expect(result.stderr).toContain('无法安全更新');
        expect(result.stdout + result.stderr).not.toContain(SECRET_TOKEN);
    });

    test('refuses a non-object JSON root without changing the file', async () => {
        const original = '[]\n';
        writeFileSync(cursorConfig, original);

        const result = await runAddMcp('cursor', true);

        expect(result.exitCode).toBe(1);
        expect(readFileSync(cursorConfig, 'utf-8')).toBe(original);
        expect(result.stderr).toContain('无法安全更新');
        expect(result.stdout + result.stderr).not.toContain(SECRET_TOKEN);
    });
});
