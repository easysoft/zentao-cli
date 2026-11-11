import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type cliConfig from '../connectors/workbuddy/cli.json';

/** Run the declared callbacks in separate processes, against a real HTTP fixture. */
export async function verifyWorkbuddyLifecycle(cli: typeof cliConfig, executable: string, entry: string) {
    const directory = mkdtempSync(join(tmpdir(), 'zentao-workbuddy-validation-'));
    const config = join(directory, 'workbuddy.json');
    const unrelated = join(directory, 'ordinary.json');
    writeFileSync(unrelated, 'ordinary CLI credentials must survive');
    const password = 'fixture-password-never-print';
    const tokens = new Set<string>();
    let tokenNumber = 0, statusRequests = 0;
    let rejectLogout = false, pretendLogout = false, slowStatus = false, emptyStatus = false;
    let refreshOnLogout = false;
    const durations: Record<string, number> = {};
    const server = Bun.serve({
        hostname: '127.0.0.1', port: 0,
        async fetch(request) {
            const url = new URL(request.url);
            const token = request.headers.get('Token') ?? '';
            if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
            if (url.pathname.endsWith('/users/login')) {
                const body = await request.json() as { account: string; password: string };
                if (body.password !== password) return new Response('Unauthorized', { status: 401 });
                const fresh = `fixture-token-${++tokenNumber}`;
                tokens.add(fresh);
                return Response.json({ status: 'success', token: fresh });
            }
            if (url.pathname.endsWith('/users/logout')) {
                if (rejectLogout) return new Response('Unavailable', { status: 503 });
                if (!tokens.has(token)) return new Response('Access not allowed', { status: 403 });
                assert.equal(request.method, 'POST');
                if (!pretendLogout) tokens.delete(token);
                if (refreshOnLogout) {
                    refreshOnLogout = false;
                    const data = JSON.parse(readFileSync(config, 'utf8'));
                    const fresh = `fixture-token-${++tokenNumber}`;
                    tokens.add(fresh);
                    data.profiles[0].token = fresh;
                    writeFileSync(config, JSON.stringify(data));
                }
                return Response.json({ status: 'success' });
            }
            if (url.pathname.endsWith('/v1/user')) {
                statusRequests++;
                if (slowStatus) await Bun.sleep(4000);
                if (emptyStatus) return Response.json({});
                return tokens.has(token) ? Response.json({ profile: { account: 'review' } }) : new Response('Expired', { status: 401 });
            }
            if (url.pathname.endsWith('/users')) return tokens.has(token)
                ? Response.json({ users: [{ id: 1, account: 'review' }] }) : new Response('Expired', { status: 401 });
            return new Response('Not found', { status: 404 });
        },
    });
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    assert.ok(cli.auth[platform], `Unsupported platform: ${platform}`);
    assert.equal(cli.authWaitForExit, true);
    assert.equal(cli.authUrlDomain, '127.0.0.1');
    const quote = (value: string) => process.platform === 'win32' ? `"${value.replaceAll('"', '""')}"` : `'${value.replaceAll("'", "'\\''")}'`;

    async function run(action: 'auth' | 'status' | 'unAuth', onUrl?: (url: URL) => Promise<void>) {
        const command = cli[action][platform]
            .replace(/^zentao(?:\.cmd)?\s+/, `${quote(executable)} ${quote(entry)} `)
            .replace('"~/.config/zentao/workbuddy.json"', quote(config));
        assert.notEqual(command, cli[action][platform]);
        const start = performance.now();
        const child = spawn(process.platform === 'win32' ? command : `exec ${command}`, {
            cwd: directory, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
            env: { ...process.env, ...cli.env, CI: '1', ZENTAO_CONFIG_FILE: unrelated },
            stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
        });
        let stdout = '', stderr = '';
        let callback: Promise<void> | undefined, callbackError: unknown;
        function scan() {
            // WorkBuddy's documented extractor, with explicit loopback-domain filtering.
            const urls = (stdout + stderr).match(/https?:\/\/[^\s\n\r"'<>]+/g) ?? [];
            const url = urls.map(value => new URL(value)).find(value => value.hostname === cli.authUrlDomain);
            if (onUrl && url && !callback) {
                callback = Promise.resolve().then(async () => {
                    assert.ok(performance.now() - start < 10_000, 'auth URL must be ready within 10 seconds');
                    await onUrl(url);
                }).catch(error => { callbackError = error; child.kill(); });
            }
        }
        child.stdout!.on('data', chunk => { stdout += chunk.toString(); scan(); });
        child.stderr!.on('data', chunk => { stderr += chunk.toString(); scan(); });
        const timer = setTimeout(() => child.kill(), action === 'auth' ? 20_000 : 10_000);
        try {
            const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
            await callback;
            if (callbackError) throw callbackError;
            if (onUrl) assert.ok(callback, `auth did not emit a usable URL: ${stderr}`);
            const ms = Math.round(performance.now() - start);
            durations[action] = Math.max(durations[action] ?? 0, ms);
            assert.ok(ms < (action === 'unAuth' ? 30_000 : action === 'auth' ? 300_000 : 10_000));
            assert.ok(!(stdout + stderr).includes(password));
            assert.ok(!/fixture-token-\d+/.test(stdout + stderr));
            return { code, stdout, stderr, connected: code === 0 && new RegExp(cli.statusMatch).test(stdout + stderr) };
        } finally { clearTimeout(timer); child.kill(); }
    }
    async function authenticate(cancel = false) {
        return run('auth', async url => {
            // The short-lived Node server closes each response; do not reuse Bun's pooled sockets.
            assert.equal((await fetch(new URL('/', url), { keepalive: false })).status, 200);
            const headers = { Origin: url.origin, 'X-Zentao-Login': url.hash.slice(1), 'Content-Type': 'application/json' };
            if (cancel) {
                assert.equal((await fetch(new URL('/cancel', url), { method: 'POST', headers, body: '{}', keepalive: false })).status, 200);
                return;
            }
            const body = { server: `${server.url.origin}/zentao`, account: 'review', password };
            const invalid = await fetch(new URL('/login', url), { method: 'POST', headers, body: JSON.stringify({ ...body, password: 'wrong' }), keepalive: false });
            assert.equal(invalid.status, 400, 'Failed passwords leave the browser session retryable');
            await invalid.arrayBuffer();
            const result = await fetch(new URL('/login', url), { method: 'POST', headers, body: JSON.stringify(body), keepalive: false });
            assert.equal(result.status, 200);
            assert.equal((await result.json() as { ok: boolean }).ok, true);
        });
    }
    try {
        assert.equal((await run('status')).connected, false);
        assert.equal(existsSync(config), false);
        assert.equal((await run('unAuth')).code, 0);
        assert.equal((await authenticate(true)).code, 130);
        assert.equal(existsSync(config), false, 'Cancellation must not persist credentials');
        assert.equal((await authenticate()).code, 0);
        const original = readFileSync(config);
        const modifiedTime = statSync(config).mtimeMs;
        for (let i = 0; i < 2; i++) {
            const before = statusRequests;
            const result = await run('status');
            assert.equal(result.connected, true, result.stderr);
            assert.equal(JSON.parse(result.stdout).data.verified, true);
            assert.equal(statusRequests - before, 1, 'One lightweight request per poll');
            assert.deepEqual(readFileSync(config), original);
            assert.equal(statSync(config).mtimeMs, modifiedTime);
        }
        slowStatus = true;
        const timedOut = await run('status');
        assert.equal(timedOut.connected, false);
        assert.equal(JSON.parse(timedOut.stderr).error.code, '5001');
        slowStatus = false;
        tokens.clear();
        assert.equal((await run('status')).connected, false, 'Expired tokens cannot remain connected');
        assert.deepEqual(readFileSync(config), original);
        assert.equal((await run('unAuth')).code, 0, 'An already-expired session can still be disconnected');
        assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')).profiles, []);
        assert.equal((await authenticate()).code, 0);
        const fresh = readFileSync(config);
        rejectLogout = true;
        assert.notEqual((await run('unAuth')).code, 0);
        assert.deepEqual(readFileSync(config), fresh, 'Failed revocation preserves credentials for retry');
        rejectLogout = false;
        pretendLogout = true;
        const mismatched = JSON.parse(fresh.toString());
        mismatched.profiles[0].account = 'wrong-account';
        writeFileSync(config, JSON.stringify(mismatched));
        const falseSuccess = await run('unAuth');
        assert.notEqual(falseSuccess.code, 0);
        assert.equal(JSON.parse(falseSuccess.stderr).error.code, '1012');
        assert.equal(JSON.parse(readFileSync(config, 'utf8')).profiles[0].token, mismatched.profiles[0].token);
        writeFileSync(config, fresh);
        emptyStatus = true;
        const missingIdentity = await run('unAuth');
        assert.notEqual(missingIdentity.code, 0, 'An empty response does not prove token revocation');
        assert.equal(JSON.parse(missingIdentity.stderr).error.code, '1012');
        assert.deepEqual(readFileSync(config), fresh);
        emptyStatus = false;
        pretendLogout = false;
        refreshOnLogout = true;
        const refreshed = await run('unAuth');
        assert.notEqual(refreshed.code, 0, 'A concurrent login cannot be reported as disconnected');
        assert.equal(JSON.parse(refreshed.stderr).error.code, '1012');
        assert.equal((await run('status')).connected, true, 'Keep the concurrent login intact');
        assert.equal((await run('unAuth')).code, 0);
        assert.equal(tokens.size, 0);
        assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')).profiles, []);
        assert.equal((await run('unAuth')).code, 0);
        assert.equal((await run('status')).connected, false);
        assert.equal(readFileSync(unrelated, 'utf8'), 'ordinary CLI credentials must survive');
        return { platform, checks: ['cancel', 'login-retry', 'login', 'restart', 'read-only-status', 'single-request-poll', 'timeout', 'expiry', 'reauth', 'revoke-failure', 'revoke-confirmation', 'revoke-race', 'disconnect', 'idempotency', 'config-isolation'], maximumMilliseconds: durations };
    } finally { server.stop(true); rmSync(directory, { recursive: true, force: true }); }
}
