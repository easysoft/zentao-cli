import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __resetConfigStoreForTests } from '../src/config/store';
import type { Profile } from '../src/types/config';

/** Shared profile fixture for tests */
export const mockProfile: Profile = {
    server: 'https://zentao.example.com',
    account: 'admin',
    token: 'test-token',
    loginTime: '2026-04-10T10:00:00Z',
    lastUsedTime: '2026-04-10T10:00:00Z',
};

/** Reset config store between tests */
export function resetConfigStore(): void {
    __resetConfigStoreForTests();
}

export function stripAnsi(value: string): string {
    return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

/** Run a local-only CLI command against an empty config and without ZenTao credentials. */
export async function runCliWithoutAuth(args: string[]): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}> {
    const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-offline-test-'));
    const configFile = join(dir, 'zentao.json');

    try {
        writeFileSync(configFile, JSON.stringify({ profiles: [] }));

        const env = {
            ...process.env,
            // Empty values prevent Bun child processes from reloading credentials from .env.test.
            ZENTAO_URL: '',
            ZENTAO_ACCOUNT: '',
            ZENTAO_PASSWORD: '',
            ZENTAO_TOKEN: '',
        };

        const proc = Bun.spawn({
            cmd: [process.execPath, 'src/index.ts', '--config', configFile, ...args],
            cwd: process.cwd(),
            stdin: 'ignore',
            stdout: 'pipe',
            stderr: 'pipe',
            env,
        });

        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);

        return {
            stdout: stripAnsi(stdout),
            stderr: stripAnsi(stderr),
            exitCode,
        };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
