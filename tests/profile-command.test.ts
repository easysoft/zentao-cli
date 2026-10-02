import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mockProfile, stripAnsi } from './helpers.js';

describe('profile --effective', () => {
    let directory: string;
    let configFile: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'zentao-effective-'));
        configFile = join(directory, 'config.json');
        writeFileSync(configFile, JSON.stringify({
            currentProfile: `${mockProfile.account}@${mockProfile.server}`, profiles: [mockProfile],
        }));
    });

    afterEach(() => rmSync(directory, { recursive: true, force: true }));

    async function runProfile(args = ['--effective', '--format=json'], env: NodeJS.ProcessEnv = {}) {
        const child = Bun.spawn({
            cmd: [process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, 'profile', ...args],
            env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '', ...env },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        return { stdout: stripAnsi(stdout), stderr: stripAnsi(stderr), exitCode };
    }

    test.each(['token', 'password'])('reports environment %s without reading config or making requests', async (credentialType) => {
        const original = '{ invalid local config';
        writeFileSync(configFile, original);
        let requests = 0;
        const server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            fetch() { requests++; return new Response('No requests expected', { status: 500 }); },
        });
        try {
            const result = await runProfile(undefined, {
                ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'env-user',
                ZENTAO_TOKEN: credentialType === 'token' ? 'private-token' : '',
                ZENTAO_PASSWORD: 'private-password',
            });
            expect(result.exitCode).toBe(0);
            expect(result.stderr).toBe('');
            expect(JSON.parse(result.stdout)).toEqual({
                status: 'success', source: 'environment', server: server.url.toString().replace(/\/$/, ''),
                account: 'env-user', credentialType, configFile: null, verified: false,
            });
            expect(requests).toBe(0);
            expect(readFileSync(configFile, 'utf8')).toBe(original);
        } finally {
            server.stop(true);
        }
    });

    test.each(['json', 'raw', 'markdown'])('reports saved credentials in %s and preserves a read-only file', async (format) => {
        if (process.platform !== 'win32') chmodSync(configFile, 0o400);
        const original = readFileSync(configFile, 'utf8');
        const before = statSync(configFile);
        const result = await runProfile(['--effective', `--format=${format}`], {
            ZENTAO_URL: 'https://partial.example.com', ZENTAO_TOKEN: 'unused-partial-token',
        });
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        if (format === 'markdown') {
            expect(result.stdout).toContain('本地 Profile');
            expect(result.stdout).toContain(mockProfile.account);
            expect(result.stdout).toContain(configFile);
            expect(result.stdout).toContain('尚未进行网络验证');
        } else {
            expect(JSON.parse(result.stdout)).toEqual({
                status: 'success', source: 'profile', server: mockProfile.server, account: mockProfile.account,
                credentialType: 'token', configFile, verified: false,
            });
        }
        expect(result.stdout).not.toContain(mockProfile.token);
        expect(result.stdout).not.toContain('unused-partial-token');
        expect(readFileSync(configFile, 'utf8')).toBe(original);
        expect(statSync(configFile).mode).toBe(before.mode);
        expect(statSync(configFile).mtimeMs).toBe(before.mtimeMs);
    });

    test('rejects combining inspection and account switching without changing config', async () => {
        const original = readFileSync(configFile, 'utf8');
        const result = await runProfile(['--effective', mockProfile.account, '--format=json']);
        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.stderr).error.code).toBe('2009');
        expect(readFileSync(configFile, 'utf8')).toBe(original);
    });

    test('reports missing credentials without creating a config file', async () => {
        rmSync(configFile);
        const result = await runProfile();
        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.stderr).error.code).toBe('1006');
        expect(existsSync(configFile)).toBe(false);
    });

    test('keeps the local listing separate and preserves config errors', async () => {
        const listed = await runProfile(['--format=json'], {
            ZENTAO_URL: 'https://env.example.com', ZENTAO_ACCOUNT: 'env-user', ZENTAO_TOKEN: 'private-token',
        });
        expect(JSON.parse(listed.stdout).profiles).toEqual([{
            key: `${mockProfile.account}@${mockProfile.server}`, server: mockProfile.server,
            account: mockProfile.account, current: true,
        }]);
        writeFileSync(configFile, '{"profiles":42}');
        const invalid = await runProfile();
        expect(invalid.exitCode).toBe(1);
        expect(JSON.parse(invalid.stderr).error).toMatchObject({ code: '1005', details: { reason: 'invalid_structure' } });
    });
});
