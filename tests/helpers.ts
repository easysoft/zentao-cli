import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __resetConfigStoreForTests } from '../src/config/store';
import type { Profile, Workspace } from '../src/types/config';

/** Shared workspace fixture for tests */
export const mockWorkspace: Workspace = {
    id: 1,
    product: { id: 1, name: '产品1' },
    project: { id: 2, name: '项目1' },
    execution: { id: 3, name: '执行1' },
};

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
