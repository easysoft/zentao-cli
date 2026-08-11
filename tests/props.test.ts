import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function stripAnsi(value: string): string {
    return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

async function runPropsCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-props-test-'));
    const configFile = join(dir, 'zentao.json');

    try {
        writeFileSync(configFile, JSON.stringify({
            profiles: [],
            updateCheck: {
                lastCheck: new Date().toISOString(),
                latestVersion: '0.2.0',
            },
        }));

        const env = { ...process.env };
        delete env.ZENTAO_URL;
        delete env.ZENTAO_ACCOUNT;
        delete env.ZENTAO_PASSWORD;
        delete env.ZENTAO_TOKEN;

        const proc = Bun.spawn({
            cmd: [process.execPath, 'src/index.ts', '--config', configFile, ...args],
            cwd: process.cwd(),
            stdout: 'pipe',
            stderr: 'pipe',
            env,
        });

        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);

        return { stdout, stderr, exitCode };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('zentao <module> props', () => {
    test('prints object property definitions without authentication', async () => {
        const result = await runPropsCommand(['product', 'props', '--format=json']);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        const props = JSON.parse(stripAnsi(result.stdout));
        expect(props.id).toBe('编号');
        expect(props.name).toBe('产品名称');
    });

    test('uses markdown output by default', async () => {
        const result = await runPropsCommand(['bug', 'props']);

        expect(result.exitCode).toBe(0);
        const stdout = stripAnsi(result.stdout);
        expect(stdout).toContain('id: Bug编号');
        expect(stdout).toContain('title: Bug标题');
    });

    test('respects silent mode', async () => {
        const result = await runPropsCommand(['task', 'props', '--silent']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
    });
});
