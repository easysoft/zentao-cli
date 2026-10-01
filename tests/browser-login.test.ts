import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startBrowserLogin } from '../src/auth/browser-login.js';
import { getAllProfiles, getCurrentProfile, saveProfile, setConfigPath } from '../src/config/store.js';
import { mockProfile, resetConfigStore } from './helpers.js';

type Session = Awaited<ReturnType<typeof startBrowserLogin>>;
const password = 'fake-password-never-persist';
const token = 'fake-token-never-render';
let directory: string;
let configFile: string;
let cleanup: Array<() => void>;

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zentao-browser-login-'));
    configFile = join(directory, 'config.json');
    writeFileSync(configFile, JSON.stringify({ profiles: [] }));
    resetConfigStore();
    setConfigPath(configFile);
    cleanup = [];
});

afterEach(() => {
    for (const close of cleanup.reverse()) close();
    resetConfigStore();
    rmSync(directory, { recursive: true, force: true });
});

async function start(options: Parameters<typeof startBrowserLogin>[0] = {}) {
    const session = await startBrowserLogin({ open: false, ...options });
    cleanup.push(session.cancel);
    return session;
}

function mockZentao(onLogin?: (request: Request) => Response | Promise<Response>) {
    const server = Bun.serve({
        hostname: '127.0.0.1', port: 0,
        fetch(req) {
            const url = new URL(req.url);
            if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
            if (url.pathname.endsWith('/users/login')) {
                return onLogin?.(req) ?? Response.json({ status: 'success', token });
            }
            if (url.pathname.endsWith('/users')) return Response.json({ users: [{ account: 'admin', realname: 'Test Admin' }] });
            return new Response('Not found', { status: 404 });
        },
    });
    cleanup.push(() => server.stop(true));
    return `${server.url.origin}/zentao`;
}

function submit(session: Pick<Session, 'url'>, body: unknown, overrides: Record<string, string | null> = {}, path = '/login') {
    const url = new URL(session.url);
    const headers = new Headers({ Origin: url.origin, 'X-Zentao-Login': url.hash.slice(1), 'Content-Type': 'application/json' });
    for (const [name, value] of Object.entries(overrides)) {
        if (value === null) headers.delete(name);
        else headers.set(name, value);
    }
    return fetch(new URL(path, url), { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

async function runCli(args: string[], credentials: Record<string, string> = {}, onUrl?: (url: string) => Promise<void>) {
    const child = Bun.spawn({
        cmd: [process.execPath, '--no-env-file', resolve('src/index.ts'), '--config', configFile, ...args],
        cwd: directory, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        env: {
            ...process.env, CI: '1', ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_PASSWORD: '', ZENTAO_TOKEN: '',
            ...credentials,
        },
    });
    const timeout = setTimeout(() => child.kill(), 5_000);
    try {
        const readStderr = async () => {
            let output = '';
            let handled = false;
            const decoder = new TextDecoder();
            for await (const chunk of child.stderr) {
                output += decoder.decode(chunk, { stream: true });
                const url = output.match(/http:\/\/127\.0\.0\.1:\d+\/#\w+/)?.[0];
                if (url && onUrl && !handled) {
                    handled = true;
                    await onUrl(url);
                }
            }
            return output + decoder.decode();
        };
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), readStderr(), child.exited,
        ]);
        return { stdout, stderr, exitCode };
    } finally {
        clearTimeout(timeout);
        child.kill();
    }
}

describe('browser login session', () => {
    test('saves an authenticated profile without its password, preserves configuration, and closes the listener', async () => {
        let submitted: unknown;
        const server = mockZentao(async req => {
            submitted = await req.json();
            return Response.json({ status: 'success', token });
        });
        saveProfile({ ...mockProfile, server, config: { defaultRecPerPage: 23 }, user: { oldField: 'preserved' } });
        const session = await start();
        const page = await (await fetch(new URL('/', session.url))).text();
        expect(page).toContain('<p class="intro" id="intro">完成登录后，回到 ZenTao CLI 即可继续使用禅道。</p>');
        const response = await submit(session, { server: `${server}/`, account: ' admin ', password });
        expect(response.status).toBe(200);
        const feedback = await response.text();
        expect(feedback).not.toContain(token);
        expect(feedback).not.toContain(password);
        const profile = await session.result;
        expect(submitted).toEqual({ account: 'admin', password });
        expect(profile).toMatchObject({
            server, account: 'admin', token, config: { defaultRecPerPage: 23 },
            user: { oldField: 'preserved', realname: 'Test Admin' }, serverConfig: { version: '22.5' },
        });
        expect(getAllProfiles()).toHaveLength(1);
        expect(getCurrentProfile()?.token).toBe(token);
        expect(readFileSync(configFile, 'utf8')).not.toContain(password);
        expect(readFileSync(configFile, 'utf8')).not.toContain('"password"');
        await expect(fetch(new URL('/', session.url))).rejects.toThrow();
    });

    test('keeps failed login retryable and never renders upstream error details', async () => {
        let attempts = 0;
        const server = mockZentao(() => ++attempts === 1
            ? new Response(`<script>${password} ${token}</script>`, { status: 500 })
            : Response.json({ status: 'success', token }));
        const session = await start();
        const failure = await submit(session, { server, account: 'admin', password });
        expect(failure.status).toBe(400);
        const message = await failure.text();
        expect(message).not.toContain(password);
        expect(message).not.toContain(token);
        expect(message).not.toContain('<script>');
        expect(getAllProfiles()).toEqual([]);
        expect((await submit(session, { server, account: 'admin', password })).status).toBe(200);
        expect((await session.result).token).toBe(token);
        expect(attempts).toBe(2);
    });

    test('rejects cross-origin, missing capability and rebound host requests before authentication', async () => {
        let attempts = 0;
        const server = mockZentao(() => { attempts++; return Response.json({ status: 'success', token }); });
        const session = await start();
        const invalidHeaders: Array<Record<string, string | null>> = [
            { Origin: null }, { Origin: 'https://attacker.example' },
            { 'X-Zentao-Login': null }, { 'X-Zentao-Login': 'wrong-session' }, { Host: 'attacker.example' },
        ];
        for (const headers of invalidHeaders) {
            expect((await submit(session, { server, account: 'admin', password }, headers)).status).toBe(403);
            expect((await submit(session, {}, headers, '/cancel')).status).toBe(403);
        }
        const missingHost = await new Promise<string>((resolveResponse, reject) => {
            const socket = createConnection({ host: '127.0.0.1', port: Number(new URL(session.url).port) });
            let response = '';
            socket.on('connect', () => socket.write('GET / HTTP/1.1\r\nConnection: close\r\n\r\n'));
            socket.on('data', data => { response += data; });
            socket.on('end', () => resolveResponse(response));
            socket.on('error', reject);
        });
        expect(missingHost).toMatch(/^HTTP\/1\.1 40[03]\b/);
        expect(attempts).toBe(0);
        expect(getAllProfiles()).toEqual([]);
        expect((await fetch(new URL('/', session.url))).status).toBe(200);
    });

    test('rejects malformed, oversized and unsafe login inputs without contacting ZenTao', async () => {
        let attempts = 0;
        const server = mockZentao(() => { attempts++; return Response.json({ status: 'success', token }); });
        const session = await start();
        for (const body of [
            '{', null, [], {}, { server, account: 'admin', password: '' },
            ...['not-a-url', 'file:///etc/passwd', 'https://user:pass@example.com', `${server}?x=1`, `${server}#x`]
                .map(server => ({ server, account: 'admin', password })),
        ]) expect((await submit(session, body)).status).toBe(400);
        expect((await submit(session, { server, account: 'admin', password }, { 'Content-Type': 'text/plain' })).status).toBe(415);
        expect((await submit(session, { server, account: 'admin', password: 'x'.repeat(17_000) })).status).toBe(413);
        expect(attempts).toBe(0);
        expect(getAllProfiles()).toEqual([]);
        expect((await submit(session, { server, account: 'admin', password })).status).toBe(200);
        await session.result;
    });

    test.each(['cancel', 'timeout'])('rejects concurrent submissions and %s prevents a late response from saving credentials', async mode => {
        let release!: () => void;
        let entered!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        const started = new Promise<void>(resolve => { entered = resolve; });
        const server = mockZentao(async () => {
            entered();
            await pending;
            return Response.json({ status: 'success', token });
        });
        cleanup.push(release);
        const session = await start({ waitTimeoutMs: mode === 'timeout' ? 300 : undefined });
        const first = submit(session, { server, account: 'admin', password }).catch(() => undefined);
        await started;
        expect((await submit(session, { server, account: 'admin', password })).status).toBe(409);
        if (mode === 'cancel') expect((await submit(session, {}, {}, '/cancel')).status).toBe(200);
        await expect(session.result).rejects.toMatchObject({ code: mode === 'cancel' ? '1008' : '1009' });
        release();
        await first;
        expect(getAllProfiles()).toEqual([]);
        await expect(fetch(new URL('/', session.url))).rejects.toThrow();
    });

    test('expires and releases its listener without modifying the configuration', async () => {
        const original = readFileSync(configFile, 'utf8');
        const session = await start({ waitTimeoutMs: 20 });
        await expect(session.result).rejects.toMatchObject({ code: '1009' });
        expect(readFileSync(configFile, 'utf8')).toBe(original);
        await expect(fetch(new URL('/', session.url))).rejects.toThrow();
    });

    test('escapes prefilled input and serves a self-contained page without saved credentials or the session key', async () => {
        saveProfile({ ...mockProfile, token });
        const injection = '\"><img src=x onerror="alert(1)">&';
        const session = await start({ server: `https://example.com/${injection}`, account: injection, message: injection });
        const response = await fetch(new URL('/', session.url));
        const page = await response.text();
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('referrer-policy')).toBe('no-referrer');
        const csp = response.headers.get('content-security-policy')!;
        expect(csp).toContain("default-src 'none'");
        expect(csp).toContain("frame-ancestors 'none'");
        const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
        expect(nonce).toBeTruthy();
        expect(page).toContain(`<script nonce="${nonce}">`);
        expect(page).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
        expect(page).toContain('<p class="intro" id="intro">&quot;&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;</p>');
        expect(page).not.toContain(injection);
        expect(page).not.toContain(token);
        expect(page).not.toContain(new URL(session.url).hash.slice(1));
    });
});

describe('CLI login mode selection', () => {
    test.skipIf(!['darwin', 'linux'].includes(process.platform))('falls back when the browser opener is absent and closes the temporary server', async () => {
        const original = readFileSync(configFile, 'utf8');
        const script = `
            import { browserLogin } from ${JSON.stringify(resolve('src/auth/browser-login.ts'))};
            import { setConfigPath } from ${JSON.stringify(resolve('src/config/store.ts'))};
            setConfigPath(${JSON.stringify(configFile)});
            console.log(await browserLogin({ fallbackToTerminal: true }) === undefined ? 'terminal-fallback' : 'unexpected-profile');
        `;
        const child = Bun.spawn({
            cmd: [process.execPath, '--no-env-file', '--eval', script],
            cwd: directory, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
            env: { ...process.env, PATH: '', ZENTAO_CONFIG_FILE: configFile },
        });
        const timeout = setTimeout(() => child.kill(), 5_000);
        try {
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
            ]);
            expect(exitCode).toBe(0);
            expect(stdout.trim()).toBe('terminal-fallback');
            expect(stderr).toContain('改用终端登录');
            const url = stderr.match(/http:\/\/127\.0\.0\.1:\d+\/#\w+/)?.[0];
            expect(url).toBeTruthy();
            await expect(fetch(new URL('/', url!))).rejects.toThrow();
            expect(readFileSync(configFile, 'utf8')).toBe(original);
        } finally {
            clearTimeout(timeout);
            child.kill();
        }
    });

    test('explicit web login flushes a successful cancellation response before the CLI exits with E1008', async () => {
        const original = readFileSync(configFile, 'utf8');
        let loginUrl = '';
        const message = '完成登录后，回到 Codex 即可继续使用禅道。';
        const result = await runCli(['login', '--web', '--message', message], {}, async url => {
            loginUrl = url;
            const page = await (await fetch(new URL('/', url))).text();
            expect(page).toContain(`<p class="intro" id="intro">${message}</p>`);
            const response = await submit({ url }, {}, {}, '/cancel');
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ ok: true });
        });
        expect(loginUrl).toBeTruthy();
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('E1008');
        expect(result.stdout).toBe('');
        expect(readFileSync(configFile, 'utf8')).toBe(original);
        await expect(fetch(new URL('/', loginUrl))).rejects.toThrow();
    });

    test('rejects web conflicts and incomplete secrets before starting an interactive flow', async () => {
        for (const args of [
            ['--web', '--no-browser'], ['--web', '--useEnv'], ['--web', '--password', password], ['--web', '--token', token],
        ]) {
            const result = await runCli(['login', ...args]);
            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('E2009');
            expect(result.stderr).not.toContain('http://127.0.0.1:');
            expect(result.stderr).not.toContain(password);
            expect(result.stderr).not.toContain(token);
        }
        const incomplete = await runCli(['login', '--password', password]);
        expect(incomplete.exitCode).toBe(1);
        expect(incomplete.stderr).toContain('E1001');
    });

    test('returns a login hint promptly in a headless environment or with terminal login and no TTY', async () => {
        for (const args of [[], ['--no-browser']]) {
            const result = await runCli(['login', ...args]);
            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('E1006');
            expect(result.stderr).not.toContain('http://127.0.0.1:');
        }
    });

    test('retains explicit and environment authentication without a browser and respects the selected config file', async () => {
        const server = mockZentao();
        for (const mode of ['password', 'token', 'environment']) {
            const args = mode === 'environment' ? ['login', '--useEnv']
                : ['login', '-s', server, '-u', 'admin', mode === 'password' ? '-p' : '-t', mode === 'password' ? password : token];
            const result = await runCli(args, mode === 'environment'
                ? { ZENTAO_URL: server, ZENTAO_ACCOUNT: 'admin', ZENTAO_PASSWORD: password } : {});
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('登录成功');
            expect(result.stdout + result.stderr).not.toContain(password);
            expect(result.stdout + result.stderr).not.toContain(token);
            expect(result.stderr).not.toContain('浏览器');
            const saved = JSON.parse(readFileSync(configFile, 'utf8'));
            expect(saved.profiles).toHaveLength(1);
            expect(saved.profiles[0]).toMatchObject({ account: 'admin', server, token });
            expect(saved.profiles[0].password).toBeUndefined();
        }
    });
});
