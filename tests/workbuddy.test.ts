import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import cli from '../connectors/workbuddy/cli.json';

test.skipIf(process.platform === 'win32')('WorkBuddy callbacks isolate credentials and recover state across processes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'zentao-workbuddy-test-'));
    const configDir = join(directory, '.config', 'zentao');
    const configFile = join(configDir, 'workbuddy.json');
    const defaultConfig = join(configDir, 'zentao.json');
    const preload = join(directory, 'homedir.cjs');
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const shellCli = `${quote(process.execPath)} ${quote(resolve('src/index.ts'))}`;
    const statusPattern = new RegExp(cli.statusMatch);

    // Redirect only the child process home lookup; never touch real user credentials.
    writeFileSync(preload, `require('node:os').homedir = () => ${JSON.stringify(directory)};\n`);

    async function run(action: 'auth' | 'status' | 'unAuth') {
        const command = cli[action].darwin
            .replace(/^zentao /, `${shellCli} `)
            .replace('~/.config/zentao/workbuddy.json', configFile);
        const child = Bun.spawn(['/bin/sh', '-c', command], {
            env: { ...process.env, ...cli.env, NODE_OPTIONS: `--require=${preload}` },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        return { stdout, stderr, exitCode };
    }

    try {
        const missing = await run('status');
        expect(missing.exitCode).not.toBe(0);
        expect(statusPattern.test(missing.stdout)).toBe(false);
        expect(existsSync(configFile)).toBe(false);
        const auth = await run('auth');
        expect(auth.exitCode).toBe(1);
        expect(auth.stderr).toContain('交互终端');

        mkdirSync(configDir, { recursive: true });
        writeFileSync(defaultConfig, 'unrelated CLI credentials');
        const profiles = ['first', 'second'].map((account) => ({
            account, server: 'https://zentao.example.com', token: 'fixture-secret-never-print',
        }));
        writeFileSync(configFile, JSON.stringify({ currentProfile: 'first@https://zentao.example.com', profiles }));
        const original = readFileSync(configFile);
        const modifiedTime = statSync(configFile).mtimeMs;
        for (let attempt = 0; attempt < 2; attempt++) {
            const status = await run('status');
            expect(status.exitCode).toBe(0);
            expect(statusPattern.test(status.stdout)).toBe(true);
            expect(status.stdout + status.stderr).not.toContain('fixture-secret-never-print');
            expect(readFileSync(configFile)).toEqual(original);
            expect(statSync(configFile).mtimeMs).toBe(modifiedTime);
        }

        writeFileSync(configFile, JSON.stringify({ currentProfile: '', profiles }));
        expect(statusPattern.test((await run('status')).stdout)).toBe(false);
        expect((await run('unAuth')).exitCode).toBe(0);
        expect(existsSync(configFile)).toBe(false);
        expect(readFileSync(defaultConfig, 'utf8')).toBe('unrelated CLI credentials');
        expect((await run('unAuth')).exitCode).toBe(0);
        expect((await run('status')).exitCode).not.toBe(0);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
