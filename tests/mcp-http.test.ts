import { expect, test, spyOn } from 'bun:test';
import { request } from 'node:http';
import { connect } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startMcpHttpServer, type McpHttpOptions } from '../src/mcp/http.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

async function fixture(handler: (req: Request) => Response | Promise<Response> = () => Response.json({ version: '22.5' }), options: Partial<McpHttpOptions> = {}) {
    const api = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler });
    const http = await startMcpHttpServer({ url: api.url.toString(), port: 0, modules: ['product'], ...options });
    const url = http.url;
    const clients: Client[] = [];
    return {
        ...http, api, url,
        async connect(headers = { token: 'test-token' } as Record<string, string>) {
            const client = new Client({ name: 'http-test', version: '1.0.0' });
            clients.push(client);
            const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers } });
            await client.connect(transport);
            return { client, transport };
        },
        async close() { await Promise.all(clients.map(client => client.close())); await http.close(); api.stop(true); },
    };
}

const headers = { token: 'test-token', 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

test('HTTP file URLs use the fixed ZenTao site and the calling user’s token', async () => {
    const requests: Array<[string, string | null]> = [];
    const f = await fixture(req => {
        const url = new URL(req.url);
        requests.push([url.pathname + url.search, req.headers.get('token')]);
        if (url.searchParams.has('mode')) return Response.json({ version: '23.0' });
        return new Response(Uint8Array.from([0, 255, 128]));
    }, { modules: ['file'], readOnly: true });
    try {
        const { client } = await f.connect({ token: 'reader-token' });
        const read = (target: { url: string } | { id: number }) => client.callTool({ name: 'zentao_file', arguments: { action: 'read', ...target } });
        const wrongSite = await read({ url: new URL('/file-download-298.html', f.url).href });
        expect(wrongSite.structuredContent).toMatchObject({ error: { code: 'E2009' } });
        expect(requests).toEqual([]);
        for (const target of [{ id: 298 }, { url: new URL('/file-download-298.html?session=private-query', f.api.url).href }]) {
            const result = await read(target);
            expect(result.structuredContent).toEqual({ data: { encoding: 'base64', content: 'AP+A' } });
            expect(requests.splice(0)).toEqual([['/?mode=getconfig', null], ['/api.php/v2/files/298/read?stream=0', 'reader-token']]);
        }
    } finally { await f.close(); }
});

const call = (id = 7, action = 'get') => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'zentao_product', arguments: { action, id: 1 } } });
function sseResult(text: string): any {
    return JSON.parse(text.split('\n').find(line => line.startsWith('data: '))!.slice(6));
}

function rawRequest(url: URL, rawHeaders: string[], body: string | string[] = '{}'): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = request(url, { method: 'POST', headers: rawHeaders }, res => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { text += chunk; });
            res.on('end', () => resolve({ status: res.statusCode!, body: text }));
            res.on('error', reject);
        });
        req.on('error', reject);
        if (Array.isArray(body)) for (const chunk of body) req.write(chunk);
        else req.write(body);
        req.end();
    });
}

test('HTTP tool discovery is offline and profile resolves the caller Token on supported servers', async () => {
    const requests: string[] = [];
    let status = 200;
    const f = await fixture(req => {
        const url = new URL(req.url);
        requests.push(url.pathname + url.search);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
        expect(req.headers.get('token')).toBe('test-token');
        if (status !== 200) return Response.json({ error: 'identity unavailable' }, { status });
        return Response.json({ user: { id: 17, account: 'remote', realname: 'Remote', role: 'dev', dept: 3, phone: 'private-phone' } });
    });
    const stdio = await createMcpTestClient(() => Response.json({}), ['--modules', 'product']);
    try {
        const { client, transport } = await f.connect();
        expect(transport.sessionId).toBeUndefined();
        const { tools } = await client.listTools();
        expect(tools.map(tool => tool.name)).toEqual(['zentao_action_help', 'zentao_profile', 'zentao_product', 'zentao_link']);
        const localTools = await stdio.client.listTools();
        expect(tools.find(tool => tool.name === 'zentao_product')).toEqual(localTools.tools.find(tool => tool.name === 'zentao_product'));
        expect(requests).toEqual([]);
        const profile = await client.callTool({ name: 'zentao_profile', arguments: {} });
        expect(toolData(profile)).toEqual({
            server: f.api.url.origin, account: 'remote', userFound: true,
            user: { id: 17, account: 'remote', realname: 'Remote', role: 'dev', dept: 3 },
        });
        expect(JSON.stringify(profile)).not.toContain('private-phone');
        expect((await client.callTool({ name: 'zentao_switch_profile', arguments: { profileKey: 'local-user' } })).isError).toBe(true);
        expect(requests).toEqual(['/?mode=getconfig', '/api.php/v2/my/profile']);
        for (const [failure, code] of [[401, 'E1004'], [403, 'E2006'], [404, 'E2002']] as const) {
            status = failure;
            requests.length = 0;
            const denied = await client.callTool({ name: 'zentao_profile', arguments: {} });
            expect(denied).toMatchObject({ isError: true, structuredContent: { error: { code } } });
            expect(requests.filter(path => !path.includes('getconfig'))).toEqual(['/api.php/v2/my/profile']);
        }
    } finally { await stdio.close(); await f.close(); }
});

test('concurrent requests with identical RPC IDs keep Token credentials and responses isolated', async () => {
    const seen: string[] = [];
    const f = await fixture(async req => {
        if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        const token = req.headers.get('token')!;
        seen.push(token);
        await Bun.sleep(token === 'alice' ? 40 : 5);
        return Response.json({ product: { id: 1, name: token } });
    });
    try {
        const responses = await Promise.all(['alice', 'bob'].map(token => fetch(f.url, { method: 'POST', headers: { ...headers, token }, body: JSON.stringify(call()) })));
        const results = await Promise.all(responses.map(async res => sseResult(await res.text())));
        expect(results.map(result => result.id)).toEqual([7, 7]);
        expect(results.map(result => toolData(result.result).name)).toEqual(['alice', 'bob']);
        expect(seen.sort()).toEqual(['alice', 'bob']);
    } finally { await f.close(); }
});

test('read-only HTTP links use one anonymous routing config across tokens and never fetch the input page', async () => {
    const visits: string[] = [];
    const external = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) { visits.push(req.url); return new Response(); } });
    const calls: Array<{ path: string; token: string | null; marker: string | null }> = [];
    const f = await fixture(async req => {
        const url = new URL(req.url);
        calls.push({ path: url.pathname + url.search, token: req.headers.get('token'), marker: req.headers.get('ZenTao-Action-Assistant') });
        await Bun.sleep(15);
        return Response.json({ version: '23.0', requestType: 'PATH_INFO', requestFix: '-', moduleVar: 'm', methodVar: 'f' });
    }, { readOnly: true });
    try {
        const { client } = await f.connect({ token: 'user-a' });
        const { client: other } = await f.connect({ token: 'user-b' });
        const target = new URL('/release.html', external.url).href;
        const input = { action: 'create', module: 'bug', method: 'view', vars: ['bugID=42'] };
        const link = (args: Record<string, unknown>) => client.callTool({ name: 'zentao_link', arguments: args });
        expect(toolData(await link({ action: 'parse', url: target }))).toEqual({ url: target, external: true });
        for (const args of [{ ...input, server: target }, { action: 'parse', url: target, relative: true }, { action: 'create', url: target }]) {
            expect((await link(args)).isError).toBe(true);
        }
        expect(calls).toEqual([]);
        const [relative, full] = await Promise.all([link({ ...input, relative: true }), other.callTool({ name: 'zentao_link', arguments: input })]);
        expect(toolData(relative)).toBe('/bug-view-42.html');
        expect(toolData(full)).toBe(new URL('/bug-view-42.html', f.api.url).href);
        expect(toolData(await link({ action: 'parse', url: toolData(full) }))).toMatchObject({ moduleName: 'bug', methodName: 'view', params: { $1: '42' } });
        expect(calls).toEqual([{ path: '/?mode=getconfig', token: null, marker: null }]);
        expect(visits).toEqual([]);
    } finally { await f.close(); external.stop(true); }
});

test('accepts Bearer credentials and maps upstream invalid-token and permission errors without retries', async () => {
    const seen: string[] = [];
    const f = await fixture(req => {
        if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        const token = req.headers.get('token')!;
        seen.push(token);
        if (token === 'expired') return Response.json({ error: 'Token has expired' }, { status: 401 });
        if (token === 'denied') return Response.json({ error: 'Permission denied' }, { status: 403 });
        return Response.json({ product: { id: 1, name: token } });
    });
    try {
        for (const token of ['valid', 'expired', 'denied']) {
            const { client } = await f.connect({ Authorization: `Bearer ${token}` });
            const result = await client.callTool(call().params);
            if (token === 'valid') expect(toolData(result).name).toBe('valid');
            else expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining(token === 'expired' ? 'E1004:' : 'E2006:') }] });
        }
        expect(seen).toEqual(['valid', 'expired', 'denied']);
    } finally { await f.close(); }
});

test('rejects missing, malformed, duplicate and query credentials, and rejects Origin even when empty', async () => {
    const f = await fixture();
    try {
        for (const credentials of [[], ['token', ''], ['token', 'a b'], ['token', 'a,b'], ['Authorization', 'Basic abc'], ['Authorization', 'Bearer'], ['token', 'a', 'Token', 'b'], ['Authorization', 'Bearer a', 'authorization', 'Bearer b'], ['token', 'a', 'Authorization', 'Bearer b']]) {
            expect((await rawRequest(f.url, credentials)).status).toBe(401);
        }
        expect((await rawRequest(new URL(`${f.url}?token=secret`), ['token', 'valid'])).status).toBe(401);
        expect((await rawRequest(f.url, ['token', 'valid', 'Origin', ''])).status).toBe(403);
        expect((await fetch(new URL('/healthz', f.url))).status).toBe(200);
        for (const method of ['GET', 'DELETE', 'PATCH']) {
            const response = await fetch(f.url, { method });
            expect(response.status).toBe(405);
            expect(response.headers.get('allow')).toBe('POST');
        }
    } finally { await f.close(); }
});

test('limits actual chunked body bytes and rejects invalid JSON', async () => {
    const f = await fixture();
    try {
        expect((await rawRequest(f.url, ['token', 'valid', 'Content-Type', 'application/json'], '{bad')).status).toBe(400);
        const response = await rawRequest(f.url, ['token', 'valid', 'Transfer-Encoding', 'chunked', 'Content-Type', 'application/json'], ['"', 'x'.repeat(1024 * 1024), '"']);
        expect(response.status).toBe(413);
        // Check listener health independently of the rejected request's connection.
        const health = await new Promise<number>((resolve, reject) => {
            const req = request(new URL('/healthz', f.url), { agent: false }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
            req.on('error', reject); req.end();
        });
        expect(health).toBe(200);
    } finally { await f.close(); }
});

test('module filtering, read-only and split tools remain enforced remotely', async () => {
    let requests = 0;
    const f = await fixture(() => { requests++; return Response.json({}); }, { readOnly: true, splitTools: true });
    try {
        const { client } = await f.connect();
        expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['zentao_action_help', 'zentao_profile', 'zentao_product_read', 'zentao_link']);
        for (const [name, action] of [['zentao_product_read', 'delete'], ['zentao_product_write', 'delete'], ['zentao_bug_read', 'get']]) {
            expect((await client.callTool({ name, arguments: { action, id: 1 } })).isError).toBe(true);
        }
        expect(requests).toBe(0);
    } finally { await f.close(); }
});

test('upstream timeout is returned through the existing tool error contract', async () => {
    const f = await fixture(async req => {
        if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        await Bun.sleep(100);
        return Response.json({ product: { id: 1 } });
    }, { timeout: 20 });
    try {
        const { client } = await f.connect();
        expect(await client.callTool(call().params)).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining('E5001:') }] });
    } finally { await f.close(); }
});

test('client disconnect cancels an update prefetch without affecting another client or sending PUT', async () => {
    const writes: string[] = [];
    let started!: () => void;
    const prefetch = new Promise<void>(resolve => { started = resolve; });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const f = await fixture(async req => {
        if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        if (req.method !== 'GET') writes.push(req.method);
        if (req.headers.get('token') === 'cancel-me') { started(); await gate; }
        return Response.json({ product: { id: 1, name: req.headers.get('token') } });
    });
    try {
        const pending = connect(Number(f.url.port), f.url.hostname);
        pending.on('error', () => {});
        const body = JSON.stringify({ ...call(), params: { name: 'zentao_product', arguments: { action: 'update', id: 1, params: { name: 'Changed' } } } });
        pending.write(`POST /mcp HTTP/1.1\r\nHost: localhost\r\nToken: cancel-me\r\nContent-Type: application/json\r\nAccept: application/json, text/event-stream\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
        await prefetch;
        pending.destroy();
        await Bun.sleep(20);
        const { client } = await f.connect({ token: 'other' });
        expect(toolData(await client.callTool(call().params)).name).toBe('other');
        release();
        await Bun.sleep(40);
        expect(writes).toEqual([]);
    } finally { release(); await f.close(); }
});


function shortenDeadlines(...durations: number[]) {
    const original = globalThis.setTimeout;
    return spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number, ...args: unknown[]) => original(callback, durations.includes(delay ?? 0) ? 30 : delay, ...args)) as typeof setTimeout);
}

test('receive deadline rejects stalled bodies and raw mid-body disconnects do not poison the service', async () => {
    const f = await fixture();
    const timers = shortenDeadlines(30_000);
    try {
        const response = new Promise<number>((resolve, reject) => {
            const req = request(f.url, { method: 'POST', headers: { token: 'valid', 'Content-Length': '100' } }, res => {
                res.resume();
                res.on('end', () => resolve(res.statusCode!));
            });
            req.on('error', reject);
            req.write('{');
        });
        expect(await response).toBe(408);
        const socket = connect(Number(f.url.port), f.url.hostname);
        socket.on('error', () => {});
        socket.write('POST /mcp HTTP/1.1\r\nHost: localhost\r\nToken: valid\r\nContent-Length: 100\r\n\r\n{');
        await Bun.sleep(10);
        socket.destroy();
        await Bun.sleep(10);
        const health = await new Promise<number>((resolve, reject) => {
            const req = request(new URL('/healthz', f.url), { agent: false }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
            req.on('error', reject); req.end();
        });
        expect(health).toBe(200);
    } finally { timers.mockRestore(); await f.close(); }
});

test('overall deadline closes the response and cancels upstream work before a write', async () => {
    const writes: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const f = await fixture(async req => {
        if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        if (req.method !== 'GET') writes.push(req.method);
        await gate;
        return Response.json({ product: { id: 1, name: 'Original' } });
    });
    const timers = shortenDeadlines(60_000);
    try {
        const response = await fetch(f.url, { method: 'POST', headers, body: JSON.stringify({ ...call(), params: { name: 'zentao_product', arguments: { action: 'update', id: 1, params: { name: 'New' } } } }) });
        await response.text().catch(() => 'closed');
        release();
        await Bun.sleep(20);
        expect(writes).toEqual([]);
        expect((await fetch(new URL('/healthz', f.url))).status).toBe(200);
    } finally { timers.mockRestore(); release(); await f.close(); }
});

test('shutdown drains boundedly, aborts unfinished writes, and close is idempotent', async () => {
    const writes: string[] = [];
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const prefetch = new Promise<void>(resolve => { started = resolve; });
    const f = await fixture(async req => {
        if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        if (req.method !== 'GET') writes.push(req.method);
        started(); await gate;
        return Response.json({ product: { id: 1, name: 'Original' } });
    });
    const timers = shortenDeadlines(5_000);
    try {
        const response = fetch(f.url, { method: 'POST', headers, body: JSON.stringify({ ...call(), params: { name: 'zentao_product', arguments: { action: 'update', id: 1, params: { name: 'New' } } } }) }).then(res => res.text()).catch(() => 'closed');
        await prefetch;
        await Promise.all([f.close(), f.close()]);
        await response;
        release();
        await Bun.sleep(20);
        expect(writes).toEqual([]);
        const stopped = await new Promise<boolean>(resolve => {
            const req = request(new URL('/healthz', f.url), { agent: false }, res => { res.resume(); resolve(false); });
            req.on('error', () => resolve(true)); req.end();
        });
        expect(stopped).toBe(true);
    } finally { timers.mockRestore(); release(); await f.close(); }
});

test('logs do not expose Token values, query strings, request bodies or upstream errors', async () => {
    const output: string[] = [];
    const write = spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => { output.push(String(chunk)); return true; }) as typeof process.stderr.write);
    const f = await fixture(() => Response.json({ error: 'upstream-secret' }, { status: 500 }));
    try {
        await fetch(new URL(`${f.url}?token=query-secret`), { method: 'POST', headers: { token: 'header-secret' }, body: 'body-secret' });
        const { client } = await f.connect({ token: 'header-secret' });
        await client.callTool(call().params);
        const logs = output.join('');
        expect(logs).toContain('[mcp-http] POST /mcp');
        for (const secret of ['query-secret', 'header-secret', 'body-secret', 'upstream-secret']) expect(logs).not.toContain(secret);
    } finally { await f.close(); write.mockRestore(); }
});


test('rejects invalid HTTP startup URLs, empty hosts and out-of-range timeouts before listening', async () => {
    const options: Array<Partial<McpHttpOptions>> = [
        ...['', 'not-a-url', 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com#fragment'].map(url => ({ url })),
        { host: '' }, { host: '   ' },
        ...[0, -1, 0.5, NaN, Infinity, 2_147_483_648].map(timeout => ({ timeout })),
    ];
    for (const invalid of options) {
        await expect(startMcpHttpServer({ url: 'https://zentao.example.com', port: 0, ...invalid })).rejects.toMatchObject({ code: '2009' });
    }
    await expect(startMcpHttpServer({ url: 'https://zentao.example.com', port: 0, modules: ['missing-module'] })).rejects.toMatchObject({ code: '2001' });
});

test('HTTP always denies server-local uploads even if a caller enables local files', async () => {
    let requests = 0;
    const f = await fixture(() => { requests++; return Response.json({ version: '22.5' }); }, { modules: ['file'], allowLocalFiles: true });
    try {
        const { client } = await f.connect();
        const result = await client.callTool({ name: 'zentao_file', arguments: {
            action: 'create', params: { file: '/tmp/mcp-remote-must-not-read.txt', objectType: 'story', objectID: 1 },
        } });
        expect(result.isError).toBe(true);
        const help = await client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'create' } });
        expect(toolData(help).available).toBe(false);
        expect(requests).toBe(0);
    } finally { await f.close(); }
});
