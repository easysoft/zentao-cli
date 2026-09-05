import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('config set validation', () => {
    let tempDir: string;
    let configFile: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-config-'));
        configFile = join(tempDir, 'zentao.json');
        writeFileSync(configFile, JSON.stringify({
            currentProfile: 'admin@https://zentao.example.com',
            profiles: [{
                server: 'https://zentao.example.com',
                account: 'admin',
                token: 'token',
                loginTime: '2026-08-24T00:00:00.000Z',
                lastUsedTime: '2026-08-24T00:00:00.000Z',
            }],
        }));
    });

    afterEach(() => {
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    });

    async function setConfig(key: string, value: string): Promise<number> {
        const proc = Bun.spawn({
            cmd: [process.execPath, 'src/index.ts', '--config', configFile, 'config', 'set', key, value],
            cwd: process.cwd(),
            env: process.env,
            stdout: 'ignore',
            stderr: 'ignore',
        });
        return proc.exited;
    }

    test('persists a valid typed value', async () => {
        expect(await setConfig('timeout', '2500')).toBe(0);
        const data = JSON.parse(readFileSync(configFile, 'utf-8'));
        expect(data.profiles[0].config.timeout).toBe(2500);
    });

    test('rejects invalid values without changing the profile', async () => {
        expect(await setConfig('insecure', 'yes')).toBe(1);
        const data = JSON.parse(readFileSync(configFile, 'utf-8'));
        expect(data.profiles[0].config).toBeUndefined();
    });
});
