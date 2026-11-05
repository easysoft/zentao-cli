import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { runCliWithoutAuth } from './helpers.js';
import { toolData } from './mcp-helpers.js';

test.each([
    ['mcp', '--transport', 'sse'],
    ['mcp', '--host', '127.0.0.1'],
    ['mcp', '--transport', 'http'],
    ['mcp-server'],
    ['mcp-server', ''],
    ...['https://zentao.example.com', 'https://another.example.com'].map(url => [
        'mcp-server', 'https://zentao.example.com', '--url', url,
    ]),
    ...['0', '65536', '1e3', 'abc'].flatMap(port => [
        ['mcp', '--transport', 'http', '--url', 'https://zentao.example.com', '--port', port],
        ['mcp-server', 'https://zentao.example.com', '--port', port],
    ]),
    ...['invalid', 'ftp://zentao.example.com', 'https://user:password@zentao.example.com',
        'https://zentao.example.com?token=secret', 'https://zentao.example.com#fragment']
        .map(url => ['mcp-server', url]),
])('MCP CLI rejects invalid startup arguments %j', async (...args) => {
    const result = await runCliWithoutAuth(args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('E2009');
    expect(result.stdout).toBe('');
});

test.each(['http', 'stdio'])('mcp-server rejects --transport %s', async transport => {
    const result = await runCliWithoutAuth(['mcp-server', '--transport', transport]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown option '--transport'");
});

test.each([['--help'], ['mcp-server', '--help'], ['help', 'mcp-server']].map(args => ({ args })))('MCP shortcut is discoverable via $args', async ({ args }) => {
    const result = await runCliWithoutAuth(args);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('mcp-server [options] [url]');
    if (args.includes('mcp-server')) {
        for (const option of ['--url', '--host', '--port', '--read-only', '--modules', '--split-tools']) {
            expect(result.stdout).toContain(option);
        }
        expect(result.stdout).toContain('ZENTAO_URL');
        expect(result.stdout).not.toContain('--transport');
    }
});

test.each([
    { command: 'mcp', source: 'env', signal: 'SIGINT', restricted: false },
    { command: 'mcp', source: 'option', signal: 'SIGTERM', restricted: false },
    { command: 'mcp-server', source: 'env', signal: 'SIGINT', restricted: false },
    { command: 'mcp-server', source: 'option', signal: 'SIGTERM', restricted: false },
    { command: 'mcp-server', source: 'positional', signal: 'SIGTERM', restricted: true },
] as const)('$command resolves its site from $source and shuts down on $signal without changing local credentials', async ({ command, source, signal, restricted }) => {
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
    const siteArgs = source === 'positional' ? [upstream.url.origin]
        : source === 'option' ? ['--url', upstream.url.origin] : [];
    const child = Bun.spawn({
        cmd: [process.execPath, '--no-env-file', resolve('src/index.ts'), '--config', configFile,
            '--timeout', '1500', '--insecure', command, ...(command === 'mcp' ? ['--transport', 'http'] : []),
            ...siteArgs, '--port', String(port), '--modules', 'product',
            ...(restricted ? ['--host', '127.0.0.1', '--read-only', '--split-tools'] : [])],
        cwd: dir, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        env: {
            ...process.env,
            ZENTAO_URL: source === 'env' ? upstream.url.origin : 'https://ignored.example.com',
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
        expect((await fetch(new URL('/start', endpoint))).status).toBe(200);
        const unauthenticated = await fetch(endpoint, { method: 'POST', body: '{}' });
        expect(unauthenticated.status).toBe(401);
        await unauthenticated.text();
        await client.connect(new StreamableHTTPClientTransport(endpoint, {
            requestInit: { headers: { token: 'client-secret' } },
        }));
        const { tools } = await client.listTools();
        const productTool = restricted ? 'zentao_product_read' : 'zentao_product';
        expect(tools.map(tool => tool.name).sort()).toEqual(['zentao_action_help', productTool, 'zentao_profile']);
        if (restricted) {
            expect((await client.callTool({ name: productTool, arguments: { action: 'update', id: 1 } })).isError).toBe(true);
        }
        expect(toolData(await client.callTool({ name: 'zentao_profile', arguments: {} })))
            .toMatchObject({ server: upstream.url.origin, account: null, userFound: false });
        expect(toolData(await client.callTool({ name: productTool, arguments: { action: 'get', id: 1 } })))
            .toMatchObject({ id: 1, name: 'client-secret' });
        await client.close();
        child.kill(signal);
        expect(await child.exited).toBe(0);
        const output = await logs;
        expect(output).toContain(`用户接入页面：${new URL('/start', endpoint).href}`);
        expect(output).toContain('Codex（~/.codex/config.toml）：');
        expect(output).toContain('Claude Code / Cursor（JSON）：');
        expect(output).toContain('Claude Code：~/.claude.json');
        expect(output).toContain('Cursor：~/.cursor/mcp.json（或项目内 .cursor/mcp.json）');
        const codexConfig = output.match(/^\[mcp_servers\.zentao-remote\][\s\S]*?\n\n/m)?.[0];
        expect(codexConfig).toBeDefined();
        expect(getStaticTOMLValue(parseTOML(codexConfig!))).toEqual({
            mcp_servers: {
                'zentao-remote': {
                    url: endpoint.href,
                    http_headers: { token: '<your-zentao-token>' },
                },
            },
        });
        const jsonConfig = output.match(/^\{\n[\s\S]*?^\}/m)?.[0];
        expect(jsonConfig).toBeDefined();
        expect(JSON.parse(jsonConfig!)).toEqual({
            mcpServers: {
                'zentao-remote': {
                    type: 'http',
                    url: endpoint.href,
                    headers: { token: '<your-zentao-token>' },
                },
            },
        });
        expect(output.indexOf(codexConfig!)).toBeLessThan(output.indexOf(jsonConfig!));
        expect(output).toContain('Authorization');
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
