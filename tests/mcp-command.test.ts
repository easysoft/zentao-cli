import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { runCliWithoutAuth } from './helpers.js';
import { toolData } from './mcp-helpers.js';

test.each([
    ['--transport', 'sse'],
    ['--host', '127.0.0.1'],
    ['--transport', 'http'],
    ...['0', '65536', '1e3', 'abc'].map(port => ['--transport', 'http', '--url', 'https://zentao.example.com', '--port', port]),
])('mcp rejects invalid startup options %j', async (...args) => {
    const result = await runCliWithoutAuth(['mcp', ...args]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('E2009');
    expect(result.stdout).toBe('');
});

test.each(['SIGINT', 'SIGTERM'] as const)('HTTP CLI resolves its site and shuts down on %s without changing local credentials', async signal => {
    const dir = mkdtempSync(join(tmpdir(), 'zentao-mcp-command-'));
    const configFile = join(dir, 'config.json');
    const initialConfig = JSON.stringify({
        currentProfile: 'saved@https://saved.example.com',
        profiles: [{ server: 'https://saved.example.com', account: 'saved', token: 'saved-secret' }],
    });
    writeFileSync(configFile, initialConfig);
    const upstream = Bun.serve({
        hostname: '127.0.0.1', port: 0,
        fetch: req => new URL(req.url).searchParams.has('mode')
            ? Response.json({ version: '22.5' })
            : Response.json({ product: { id: 1, name: req.headers.get('token') } }),
    });
    const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
    const port = reservation.port!;
    reservation.stop(true);
    const explicit = signal === 'SIGTERM';
    const child = Bun.spawn({
        cmd: [process.execPath, '--no-env-file', resolve('src/index.ts'), '--config', configFile,
            'mcp', '--transport', 'http', '--port', String(port), '--modules', 'product',
            ...(explicit ? ['--url', upstream.url.origin] : [])],
        cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        env: {
            ...process.env,
            ZENTAO_URL: explicit ? 'https://ignored.example.com' : upstream.url.origin,
            ZENTAO_ACCOUNT: 'environment-account', ZENTAO_TOKEN: 'environment-secret', ZENTAO_PASSWORD: '',
        },
    });
    const client = new Client({ name: 'http-command-test', version: '1.0.0' });
    let ready!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const logs = (async () => {
        const decoder = new TextDecoder();
        let output = '';
        for await (const chunk of child.stderr) {
            output += decoder.decode(chunk, { stream: true });
            if (output.includes('MCP HTTP 服务已启动')) ready();
        }
        return output + decoder.decode();
    })();
    const watchdog = setTimeout(() => child.kill('SIGKILL'), 8_000);
    try {
        await Promise.race([started, child.exited.then(() => { throw new Error('HTTP process exited before listening'); })]);
        const endpoint = new URL(`http://127.0.0.1:${port}/mcp`);
        expect((await fetch(new URL('/healthz', endpoint))).status).toBe(200);
        const unauthenticated = await fetch(endpoint, { method: 'POST', body: '{}' });
        expect(unauthenticated.status).toBe(401);
        await unauthenticated.text();
        await client.connect(new StreamableHTTPClientTransport(endpoint, {
            requestInit: { headers: { token: 'client-secret' } },
        }));
        expect((await client.listTools()).tools.some(tool => tool.name === 'zentao_switch_profile')).toBe(false);
        expect(toolData(await client.callTool({ name: 'zentao_profile', arguments: {} })))
            .toMatchObject({ server: upstream.url.origin, account: null, userFound: false });
        expect(toolData(await client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } })))
            .toMatchObject({ id: 1, name: 'client-secret' });
        await client.close();
        child.kill(signal);
        expect(await child.exited).toBe(0);
        const output = await logs;
        for (const secret of ['saved-secret', 'environment-secret', 'client-secret']) expect(output).not.toContain(secret);
        expect(await new Response(child.stdout).text()).toBe('');
        expect(readFileSync(configFile, 'utf8')).toBe(initialConfig);
    } finally {
        clearTimeout(watchdog);
        await client.close();
        child.kill('SIGKILL');
        await child.exited;
        await logs;
        upstream.stop(true);
        rmSync(dir, { recursive: true, force: true });
    }
}, { timeout: 10_000 });
