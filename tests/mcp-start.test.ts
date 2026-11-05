import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { request } from 'node:http';
import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { startMcpHttpServer } from '../src/mcp/http.js';
import { mcpAgentPrompt, mcpClientConfig, mcpStartGuides, renderMcpStartPage } from '../src/mcp/start-page.js';

let buildDir: string;
beforeAll(async () => {
    // Keep external package resolution identical to the published Node build.
    buildDir = mkdtempSync(resolve('node_modules/.mcp-start-test-'));
    const build = await Bun.build({ entrypoints: ['src/mcp/http.ts'], outdir: buildDir, target: 'node', packages: 'external', minify: true });
    if (!build.success) throw new Error('Could not build the Node HTTP test entrypoint');
});
afterAll(() => rmSync(buildDir, { recursive: true, force: true }));

async function fixture(runtime: string, handler: (request: Request) => Response | Promise<Response>, timeout = 200) {
    const api = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler });
    const site = `${api.url.origin}/zentao`;
    let base: URL;
    let close: () => Promise<void>;
    const logs: string[] = [];
    if (runtime === 'node') {
        const directory = mkdtempSync(join(buildDir, 'profile-'));
        const configFile = join(directory, 'config.json');
        const original = '{"profiles":[{"server":"https://saved.example.com","account":"saved","token":"saved-secret"}]}';
        writeFileSync(configFile, original);
        const child = Bun.spawn({
            cmd: ['node', '--input-type=module', '-e', `
                import { startMcpHttpServer } from ${JSON.stringify(join(buildDir, 'http.js'))};
                const running = await startMcpHttpServer({ url: process.env.MCP_TEST_SITE, port: 0, timeout: ${timeout}, modules: ['product'], readOnly: true });
                console.log(running.url.href);
                process.once('SIGTERM', () => { void running.close(); });
            `],
            env: { ...process.env, MCP_TEST_SITE: site, ZENTAO_CONFIG_FILE: configFile, XDG_CONFIG_HOME: join(directory, 'xdg'), ZENTAO_TOKEN: 'environment-secret' },
            stdout: 'pipe', stderr: 'pipe',
        });
        const output = new Response(child.stderr).text();
        const reader = child.stdout.getReader();
        const watchdog = setTimeout(() => child.kill('SIGKILL'), 10_000);
        const first = await reader.read();
        if (!first.value) throw new Error('Node HTTP test server failed to start');
        base = new URL(new TextDecoder().decode(first.value).trim());
        close = async () => {
            child.kill('SIGTERM');
            await child.exited;
            clearTimeout(watchdog);
            logs.push(await output);
            expect(readFileSync(configFile, 'utf8')).toBe(original);
            api.stop(true);
        };
    } else {
        const server = await startMcpHttpServer({ url: site, port: 0, timeout, modules: ['product'], readOnly: true });
        base = server.url;
        close = async () => { await server.close(); api.stop(true); };
    }
    const page = await fetch(new URL('/start', base));
    const html = await page.text();
    const key = html.match(/"key":"([a-f0-9]+)"/)![1];
    const headers = { 'Content-Type': 'application/json', Origin: base.origin, 'X-Zentao-Start': key };
    return {
        base, api, site, close, logs, page, html, headers,
        post(body: unknown = { account: 'alice', password: 'private-password' }, extra: Record<string, string> = {}, suffix = '') {
            // Independent connections also exercise early rejection of unread bodies.
            return new Promise<Response>((resolve, reject) => {
                const req = request(new URL('/start/token' + suffix, base), { method: 'POST', agent: false, headers: { ...headers, ...extra } }, res => {
                    const chunks: Buffer[] = [];
                    res.on('data', chunk => chunks.push(Buffer.from(chunk)));
                    res.on('end', () => resolve(new Response(Buffer.concat(chunks), {
                        status: res.statusCode, headers: res.headers as Record<string, string>,
                    })));
                    res.on('error', reject);
                });
                req.on('error', reject);
                req.end(JSON.stringify(body));
            });
        },
    };
}

for (const runtime of ['bun', 'node']) {
    test(`${runtime}: start page and concurrent token requests use only the fixed site without local credentials`, async () => {
        const seen: unknown[] = [];
        const f = await fixture(runtime, async req => {
            const body = await req.json() as { account: string; password: string };
            seen.push({ path: new URL(req.url).pathname, body, token: req.headers.get('token') });
            await Bun.sleep(body.account === 'alice' ? 20 : 1);
            return Response.json({ status: 'success', token: `${body.account}-token` });
        });
        try {
            expect(f.page.status).toBe(200);
            expect(f.page.headers.get('cache-control')).toBe('no-store');
            expect(f.page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
            expect(f.html).toContain('仅开放查询 · product');
            expect(f.html).toContain(f.site);
            expect(f.html).not.toContain('environment-secret');
            const responses = await Promise.all(['alice', 'bob'].map(account => f.post({ account, password: 'private-password' })));
            expect(await Promise.all(responses.map(res => res.json()))).toEqual([{ token: 'alice-token' }, { token: 'bob-token' }]);
            expect(responses.every(res => res.headers.get('cache-control') === 'no-store')).toBe(true);
            expect(seen).toEqual(['alice', 'bob'].map(account => ({ path: '/zentao/api.php/v2/users/login', body: { account, password: 'private-password' }, token: null })));
            // The dedicated browser endpoint does not relax the MCP Origin policy.
            expect((await fetch(f.base, { method: 'POST', headers: { token: 'alice-token', Origin: f.base.origin }, body: '{}' })).status).toBe(403);
        } finally { await f.close(); }
        for (const secret of ['private-password', 'alice-token', 'bob-token', 'environment-secret']) expect(f.logs.join('')).not.toContain(secret);
    });

    test(`${runtime}: browser login rejects other origins, unsafe requests and site overrides before touching upstream`, async () => {
        let calls = 0;
        const f = await fixture(runtime, () => { calls++; return Response.json({}); });
        try {
            const rejectedHeaders: Array<Record<string, string>> = [
                { Origin: 'https://evil.example.com' }, { Origin: 'null' }, { Origin: '' },
                { 'X-Zentao-Start': 'wrong' }, { 'Sec-Fetch-Site': 'cross-site' },
                { Origin: 'https://evil.example.com', 'X-Forwarded-Host': 'evil.example.com' },
            ];
            for (const headers of rejectedHeaders) expect((await f.post(undefined, headers)).status).toBe(403);
            expect((await f.post(undefined, { 'Content-Type': 'text/plain' })).status).toBe(415);
            for (const body of [null, [], {}, { account: 'alice', password: '' }, { account: 1, password: 'secret' },
                { account: 'alice', password: 'secret', server: 'https://evil.example.com' }]) {
                expect((await f.post(body)).status).toBe(400);
            }
            expect((await f.post(undefined, {}, '?token=query-secret')).status).toBe(400);
            expect((await f.post({ account: 'alice', password: 'x'.repeat(17_000) })).status).toBe(413);
            expect((await fetch(new URL('/start/token', f.base))).status).toBe(405);
            expect((await fetch(new URL('/start?token=secret', f.base))).status).toBe(400);
            expect((await fetch(new URL('/start/', f.base))).status).toBe(200);
            expect(calls).toBe(0);
        } finally { await f.close(); }
    });

    test(`${runtime}: same-origin HTTPS proxy works without trusting forwarded headers`, async () => {
        const f = await fixture(runtime, () => Response.json({ status: 'success', token: 'proxy-token' }));
        try {
            const response = await f.post(undefined, { Host: 'mcp.example.com:8443', Origin: 'https://mcp.example.com:8443' });
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ token: 'proxy-token' });
            expect((await f.post(undefined, { Host: 'mcp.example.com', Origin: 'http://mcp.example.com' })).status).toBe(403);
        } finally { await f.close(); }
    });

    test(`${runtime}: failed login and timeout stay redacted and can be retried`, async () => {
        let attempt = 0;
        const f = await fixture(runtime, async () => {
            attempt++;
            if (attempt === 1) return Response.json({ status: 'fail', error: 'private-password upstream-secret' });
            if (attempt === 2) { await Bun.sleep(100); return Response.json({ status: 'success', token: 'too-late' }); }
            return Response.json({ status: 'success', token: 'new-token' });
        }, 30);
        try {
            const failure = await f.post();
            expect(failure.status).toBe(401);
            const failedBody = await failure.json() as { error: string; errorCode: string };
            expect(failedBody.error).not.toContain('private-password');
            expect(failedBody.errorCode).toBe('invalidCredentials');
            const timeout = await f.post();
            expect(timeout.status).toBe(504);
            const timeoutBody = await timeout.json() as { error: string; errorCode: string };
            expect(timeoutBody.error).toContain('超时');
            expect(timeoutBody.errorCode).toBe('timeout');
            expect(await (await f.post()).json()).toEqual({ token: 'new-token' });
        } finally { await f.close(); }
        expect(f.logs.join('')).not.toContain('upstream-secret');
    });

    test(`${runtime}: disconnect cancels an in-flight login request`, async () => {
        let started!: () => void;
        let aborted!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        const cancelled = new Promise<void>(resolve => { aborted = resolve; });
        const f = await fixture(runtime, async req => {
            await req.json();
            req.signal.addEventListener('abort', aborted, { once: true });
            started();
            await cancelled;
            return Response.json({ status: 'success', token: 'never-delivered' });
        }, 2000);
        const req = request(new URL('/start/token', f.base), { method: 'POST', agent: false, headers: f.headers });
        req.on('error', () => {});
        try {
            req.end(JSON.stringify({ account: 'alice', password: 'private-password' }));
            await ready;
            req.destroy();
            await Promise.race([cancelled, Bun.sleep(1000).then(() => { throw new Error('Upstream login was not cancelled'); })]);
        } finally { req.destroy(); aborted(); await f.close(); }
    });

    test(`${runtime}: bounded concurrent logins recover after pending requests finish`, async () => {
        let release!: () => void;
        let full!: () => void;
        let count = 0;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const saturated = new Promise<void>(resolve => { full = resolve; });
        const f = await fixture(runtime, async () => {
            if (++count === 8) full();
            await gate;
            return Response.json({ status: 'success', token: 'test-token' });
        }, 2000);
        const pending = Array.from({ length: 8 }, () => f.post());
        try {
            await saturated;
            const rejected = await f.post();
            expect(rejected.status).toBe(429);
            expect(rejected.headers.get('retry-after')).toBe('5');
            release();
            expect((await Promise.all(pending)).every(response => response.status === 200)).toBe(true);
            expect((await f.post()).status).toBe(200);
        } finally { release(); await Promise.all(pending); await f.close(); }
    });
}

test('manual configuration serializers use client-specific schemas and preserve URL/token values', () => {
    const url = 'https://mcp.example.com/company/mcp';
    const token = 'test-token_+/==';
    for (const guide of mcpStartGuides) {
        const config = mcpClientConfig(guide.id, url, token);
        if (guide.id === 'codex') {
            expect(getStaticTOMLValue(parseTOML(config))).toEqual({ mcp_servers: { 'zentao-remote': { url, http_headers: { token } } } });
        } else if (guide.id === 'cherry') {
            expect(config).toContain(`URL：${url}`);
            expect(config).toContain(`token: ${token}`);
        } else {
            const parsed = JSON.parse(config);
            const entry = (parsed.mcpServers ?? parsed.servers ?? parsed.mcp)['zentao-remote'];
            expect(entry.headers).toEqual({ token });
            expect(entry.url ?? entry.httpUrl).toBe(url);
            if (guide.id === 'gemini') expect(entry.url).toBeUndefined();
            if (guide.id === 'cline') expect(entry.type).toBe('streamableHttp');
            if (guide.id === 'opencode') expect(entry.oauth).toBe(false);
        }
    }
    expect(mcpAgentPrompt('https://zentao.example.com', url, '<your-zentao-token>')).toContain('保留已有服务');
    expect(mcpAgentPrompt('https://zentao.example.com', url, token)).toContain('请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。');
    expect(mcpAgentPrompt('https://zentao.example.com', url, token, 'en')).toContain('Show only their IDs and names.');
    expect(mcpClientConfig('cherry', url, token, 'en')).toContain('Authentication: Personal token (no OAuth)');
});

test('page escapes server content and includes no external scripts or credential storage', () => {
    const html = renderMcpStartPage({ url: 'https://example.com/</script><img src=x>', nonce: 'test-nonce', key: 'test-key' });
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/sessionStorage|document\.cookie/);
    expect(html).toContain('novalidate');
    const scripts = [...html.matchAll(/<script nonce="test-nonce">([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(2);
    for (const [, script] of scripts) expect(() => new Function(script)).not.toThrow();
});
