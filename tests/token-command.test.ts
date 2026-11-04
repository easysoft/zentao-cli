import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerAllCommands } from '../src/commands/index.js';
import { generateCompletionScript } from '../src/commands/autocomplete.js';
import { mockProfile } from './helpers.js';

describe('token command', () => {
    let directory: string;
    let configFile: string;
    let server: ReturnType<typeof Bun.serve>;
    let respond: () => Response | Promise<Response>;
    let requests: Array<{ path: string; method: string; body: unknown; token: string | null }>;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'zentao-token-'));
        configFile = join(directory, 'config.json');
        requests = [];
        respond = () => Response.json({ status: 'success', token: 'temporary-token' });
        server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            async fetch(request) {
                requests.push({
                    path: new URL(request.url).pathname, method: request.method,
                    body: request.method === 'POST' ? await request.json() : null,
                    token: request.headers.get('Token'),
                });
                return respond();
            },
        });
        writeFileSync(configFile, JSON.stringify({
            currentProfile: `${mockProfile.account}@${mockProfile.server}`,
            profiles: [mockProfile, {
                ...mockProfile, server: server.url.toString().replace(/\/$/, ''),
                account: 'other-user', token: 'other-token',
            }],
        }));
    });

    afterEach(() => {
        server.stop(true);
        if (process.platform !== 'win32') chmodSync(directory, 0o700);
        rmSync(directory, { recursive: true, force: true });
    });

    async function run(args: string[] = [], env: NodeJS.ProcessEnv = {}, command = ['token']) {
        const child = Bun.spawn({
            cmd: [process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, ...command, ...args],
            env: {
                ...process.env, XDG_CONFIG_HOME: join(directory, 'xdg'),
                ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '', ...env,
            },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        return { stdout, stderr, exitCode };
    }

    function credentials() {
        return ['--server', `${server.url}zentao///`, '--user', 'temporary-user', '--password', 'temporary-password'];
    }

    function snapshot() {
        const { mode, mtimeMs } = statSync(configFile);
        return { content: readFileSync(configFile, 'utf8'), mode, mtimeMs };
    }

    test.each(['default', 'markdown', 'json', 'raw'])('reads the current token in %s without changing read-only config', async (format) => {
        if (process.platform !== 'win32') {
            chmodSync(configFile, 0o400);
            chmodSync(directory, 0o500);
        }
        const before = snapshot();
        const result = await run(format === 'default' ? [] : [`--format=${format}`], {
            ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'env-user',
            ZENTAO_TOKEN: 'env-token', ZENTAO_PASSWORD: 'env-password',
        });
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        if (format === 'json' || format === 'raw') {
            expect(JSON.parse(result.stdout)).toEqual({
                status: 'success', server: mockProfile.server, account: mockProfile.account, token: mockProfile.token,
            });
        } else {
            expect(result.stdout).toBe(`${mockProfile.token}\n`);
        }
        expect(requests).toEqual([]);
        expect(snapshot()).toEqual(before);
    });

    test('reads a selected profile using existing key forms without switching or validating it', async () => {
        const before = snapshot();
        for (const key of ['other-user', `other-user@${server.url.hostname}`, `other-user@${server.url.toString().replace(/\/$/, '')}`]) {
            expect(await run([key])).toEqual({ stdout: 'other-token\n', stderr: '', exitCode: 0 });
        }
        expect(requests).toEqual([]);
        expect(snapshot()).toEqual(before);
    });

    test.each(['missing-config', 'missing-current', 'missing-profile', 'empty-token', 'invalid-config'])('reports %s without writing config', async (condition) => {
        if (condition === 'missing-config') rmSync(configFile);
        if (condition === 'missing-current') writeFileSync(configFile, JSON.stringify({ profiles: [mockProfile] }));
        if (condition === 'empty-token') writeFileSync(configFile, JSON.stringify({
            currentProfile: `${mockProfile.account}@${mockProfile.server}`, profiles: [{ ...mockProfile, token: '' }],
        }));
        if (condition === 'invalid-config') writeFileSync(configFile, '{ invalid config');
        const before = existsSync(configFile) ? snapshot() : undefined;
        const result = await run(['--format=json', ...(condition === 'missing-profile' ? ['unknown-user'] : [])]);
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe('');
        expect(JSON.parse(result.stderr).error.code).toBe(
            condition === 'missing-profile' ? '1007' : condition === 'invalid-config' ? '1005' : '1006',
        );
        expect(existsSync(configFile) ? snapshot() : undefined).toEqual(before);
        expect(requests).toEqual([]);
    });

    test.each(['missing', 'invalid', 'readonly'])('obtains a temporary token with %s config and ignores environment credentials', async (condition) => {
        if (condition === 'missing') rmSync(configFile);
        if (condition === 'invalid') writeFileSync(configFile, '{ invalid config');
        if (condition === 'readonly' && process.platform !== 'win32') {
            chmodSync(configFile, 0o400);
            chmodSync(directory, 0o500);
        }
        const before = existsSync(configFile) ? snapshot() : undefined;
        const result = await run(credentials(), {
            ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'env-user',
            ZENTAO_TOKEN: 'env-token', ZENTAO_PASSWORD: 'env-password',
        });
        expect(result).toEqual({ stdout: 'temporary-token\n', stderr: '', exitCode: 0 });
        expect(requests).toEqual([{
            path: '/zentao/api.php/v2/users/login', method: 'POST', token: null,
            body: { account: 'temporary-user', password: 'temporary-password' },
        }]);
        expect(existsSync(configFile) ? snapshot() : undefined).toEqual(before);
        expect(existsSync(join(directory, 'xdg'))).toBe(false);
    });

    test.each(['json', 'raw'])('supports short credential flags and %s output', async (format) => {
        const before = snapshot();
        const result = await run(['-s', `${server.url}zentao/`, '-u', 'temporary-user', '-p', 'temporary-password', `--format=${format}`]);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        expect(JSON.parse(result.stdout)).toEqual({
            status: 'success', server: `${server.url}zentao`, account: 'temporary-user', token: 'temporary-token',
        });
        expect(requests).toHaveLength(1);
        expect(snapshot()).toEqual(before);
    });

    test('rejects incomplete or mixed credentials before reading config or making requests', async () => {
        writeFileSync(configFile, '{ invalid config');
        const before = snapshot();
        const inputs = [
            ['--server', server.url.toString()], ['--user', 'temporary-user'], ['--password', 'temporary-password'],
            ['--server', server.url.toString(), '--user', 'temporary-user'],
            ['--server', server.url.toString(), '--password', 'temporary-password'],
            ['--user', 'temporary-user', '--password', 'temporary-password'],
            [...credentials(), '--password', ''], [...credentials(), '--server', ''], [...credentials(), '--user', ''],
        ];
        for (const args of inputs) {
            const result = await run([...args, '--format=json']);
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toBe('');
            expect(JSON.parse(result.stderr).error.code).toBe('1001');
        }
        for (const args of [['other-user', ...credentials()], ['other-user', '--password', 'temporary-password']]) {
            const result = await run([...args, '--format=json']);
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toBe('');
            expect(JSON.parse(result.stderr).error.code).toBe('2009');
        }
        expect(requests).toEqual([]);
        expect(snapshot()).toEqual(before);
    });

    test.each([
        null, 'not JSON', { status: 'fail', token: 'rejected-token' }, { status: 'success' },
        { status: 'success', token: '' }, { status: 'success', token: '   ' }, { status: 'success', token: 123 },
    ])('rejects unsuccessful or invalid login responses: %j', async (response) => {
        respond = () => Response.json(response);
        const before = snapshot();
        const result = await run([...credentials(), '--format=json']);
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe('');
        expect(JSON.parse(result.stderr).error.code).toBe('1003');
        expect(result.stderr).not.toContain('temporary-password');
        expect(result.stderr).not.toContain('rejected-token');
        expect(requests).toHaveLength(1);
        expect(snapshot()).toEqual(before);
    });

    test('maps HTTP failures and respects the request timeout', async () => {
        const before = snapshot();
        respond = () => new Response('Forbidden', { status: 403 });
        const forbidden = await run([...credentials(), '--format=json']);
        expect(forbidden.exitCode).toBe(1);
        expect(forbidden.stdout).toBe('');
        expect(JSON.parse(forbidden.stderr).error.code).toBe('2006');

        respond = async () => {
            await Bun.sleep(250);
            return Response.json({ status: 'success', token: 'late-token' });
        };
        const timeout = await run([...credentials(), '--timeout', '20', '--format=json']);
        expect(timeout.exitCode).toBe(1);
        expect(timeout.stdout).toBe('');
        expect(JSON.parse(timeout.stderr).error.code).toBe('5001');
        expect(snapshot()).toEqual(before);
    });

    test('silent suppresses tokens but still reports failures', async () => {
        expect(await run(['--silent'])).toEqual({ stdout: '', stderr: '', exitCode: 0 });
        expect(await run([...credentials(), '--silent', '--format=json'])).toEqual({ stdout: '', stderr: '', exitCode: 0 });
        respond = () => Response.json({ status: 'fail' });
        const failed = await run([...credentials(), '--silent']);
        expect(failed.exitCode).toBe(1);
        expect(failed.stdout).toBe('');
        expect(failed.stderr).toContain('E1003');
    });

    test('exposes help and root completion without credentials', async () => {
        rmSync(configFile);
        for (const command of [['token', '--help'], ['help', 'token']]) {
            const result = await run([], {}, command);
            expect(result.exitCode).toBe(0);
            expect(result.stderr).toBe('');
            expect(result.stdout).toContain('token [options] [profileKey]');
            for (const option of ['--server', '--user', '--password']) expect(result.stdout).toContain(option);
        }
        const program = new Command();
        registerAllCommands(program);
        for (const shell of ['bash', 'zsh', 'fish']) {
            expect(generateCompletionScript(shell, program)).toMatch(/\btoken\b/);
        }
        expect(requests).toEqual([]);
        expect(existsSync(configFile)).toBe(false);
    });
});
