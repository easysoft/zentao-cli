import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createClient } from '../src/api/index.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import { createMcpServer } from '../src/mcp/server.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP file/get accepts a Base64 gid as one URL segment and keeps other file IDs numeric', async () => {
    const gid = '+/8=';
    const paths: string[] = [];
    const file = { id: 42, gid, title: 'example.png' };
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
        paths.push(url.pathname);
        return Response.json({ file });
    }, ['--modules', 'file']);
    try {
        for (const action of ['read', 'update', 'delete']) {
            const params = { fileID: gid, ...(action === 'update' ? { fileName: 'new.png' } : {}) };
            const result = await mcp.client.callTool({ name: 'zentao_file', arguments: { action, params } });
            expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009', action } } });
        }
        expect(paths).toEqual([]);
        for (const input of [
            { action: 'get', url: '/file-read-42.png', id: 42 },
            { action: 'get', url: '/file-read-42.png', params: { id: 42 } },
            { action: 'read', url: '/file-read-42.png', params: { fileID: 42 } },
            { action: 'get', url: '/file-download-0.html' },
            { action: 'read', url: 'https://other.example/file-read-42.png' },
            { action: 'delete', url: '/file-read-42.png' },
        ]) {
            const result = await mcp.client.callTool({ name: 'zentao_file', arguments: input });
            expect(result.structuredContent).toMatchObject({ error: { code: 'E2009' } });
        }
        expect(paths).toEqual([]);
        const cases = [
            { input: { params: { fileID: gid } }, segment: '%2B%2F8%3D' },
            { input: { params: { fileID: '1e03' } }, segment: '1e03' },
            { input: { params: { fileID: 42 } }, segment: '42' },
            { input: { id: 42 }, segment: '42' },
            { input: { url: '/file-download-42.html' }, segment: '42' },
            { input: { url: mcp.siteUrl + '?m=file&f=read&fileID=42' }, segment: '42' },
        ];
        for (const { input, segment } of cases) {
            const result = await mcp.client.callTool({ name: 'zentao_file', arguments: { action: 'get', ...input } });
            expect(result.structuredContent).toEqual({ data: file, resultObjectType: 'file' });
            expect(paths.splice(0)).toEqual([`/api.php/v2/files/${segment}`]);
        }
    } finally {
        await mcp.close();
    }
});

test('MCP validates file renames before authentication and sends only the requested PUT', async () => {
    const requests: Array<{ method: string; path: string; body: unknown }> = [];
    let authCalls = 0;
    let configCalls = 0;
    const upstream = Bun.serve({
        hostname: '127.0.0.1', port: 0,
        async fetch(req) {
            const url = new URL(req.url);
            if (url.searchParams.get('mode') === 'getconfig') {
                configCalls++;
                return Response.json({ version: '22.5' });
            }
            requests.push({ method: req.method, path: url.pathname, body: req.method === 'PUT' ? await req.json() : null });
            return Response.json({ status: 'success' });
        },
    });
    const api = createClient(upstream.url.href, 'test-token');
    const server = createMcpServer({
        async getContext() {
            authCalls++;
            return { client: api, config: DEFAULT_CONFIG, identity: { server: api.siteUrl } };
        },
    }, { modules: ['file'] });
    const client = new Client({ name: 'file-rename-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const help = toolData(await client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'update' } }));
        expect(help.autoFill).toBe(false);
        expect(help.parameters).toContainEqual(expect.objectContaining({ name: 'fileName', required: true }));
        const rename = (params: Record<string, unknown>) => client.callTool({ name: 'zentao_file', arguments: { action: 'update', id: 42, params } });
        const missing = await rename({});
        expect(missing).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2003', message: expect.stringContaining('fileName') } } });
        expect(authCalls).toBe(0);
        expect(configCalls).toBe(0);
        expect(requests).toEqual([]);

        const renamed = await rename({ fileName: 'new.png' });
        expect(renamed.isError, JSON.stringify(renamed.content)).not.toBe(true);
        expect(authCalls).toBe(1);
        expect(requests).toEqual([{ method: 'PUT', path: '/api.php/v2/files/42', body: { fileName: 'new.png' } }]);
    } finally {
        await client.close();
        await server.close();
        upstream.stop(true);
    }
});

test('MCP file/read returns labelled Base64 for binary and empty files in either transport format', async () => {
    const calls: Array<{ path: string; stream: string | null }> = [];
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
        const stream = url.searchParams.get('stream');
        calls.push({ path: url.pathname, stream });
        const bytes = url.pathname.endsWith('/7/read') ? Buffer.from([0, 255, 128, 65]) : Buffer.alloc(0);
        return new Response(stream === '1' ? bytes.toString('base64') : bytes);
    }, ['--modules', 'file', '--split-tools', '--read-only']);
    try {
        const help = await mcp.client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'read' } });
        expect(toolData(help).description).toContain('encoding: "base64"');
        expect(toolData(help).example.arguments).toEqual({ action: 'read', url: '/file-read-298.png' });
        const name = 'zentao_file_read';
        const invalid = await mcp.client.callTool({ name, arguments: { action: 'read', id: 7, pick: 'content' } });
        expect(invalid.structuredContent).toMatchObject({ error: { code: 'E2009', action: 'read' } });
        expect(calls).toEqual([]);

        for (const id of [7, 8]) {
            for (const stream of [undefined, 0, 1]) {
                const target = stream === 0 ? { url: mcp.siteUrl + `file-download-${id}-left.html?session=private-query` } : { id };
                const result = await mcp.client.callTool({ name, arguments: { action: 'read', ...target, params: { stream } } });
                const expected = { encoding: 'base64', content: id === 7 ? 'AP+AQQ==' : '' };
                expect(result.isError).not.toBe(true);
                expect(result.structuredContent).toEqual({ data: expected });
                expect(toolData(result)).toEqual(expected);
                expect(calls.splice(0)).toEqual([{ path: `/api.php/v2/files/${id}/read`, stream: String(stream ?? 0) }]);
            }
        }
    } finally {
        await mcp.close();
    }
});

test('MCP binds a qualified URL to the client selected after a profile switch', async () => {
    const paths: string[] = [];
    const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        paths.push(new URL(req.url).pathname);
        return Response.json({ version: '23.0', file: { id: 42 } });
    } });
    const beforeSwitch = new URL('first', upstream.url).href;
    const afterSwitch = new URL('second', upstream.url).href;
    const server = createMcpServer({
        getSiteUrl: () => beforeSwitch,
        async getContext() { return { client: createClient(afterSwitch, 'test-token'), config: DEFAULT_CONFIG, identity: { server: afterSwitch } }; },
    }, { modules: ['file'] });
    const client = new Client({ name: 'file-url-test', version: '0.0.0' });
    const [caller, service] = InMemoryTransport.createLinkedPair();
    try {
        await server.connect(service);
        await client.connect(caller);
        const result = await client.callTool({ name: 'zentao_file', arguments: { action: 'get', url: beforeSwitch + '/file-read-42.png' } });
        expect(result.structuredContent).toMatchObject({ error: { code: 'E2009' } });
        expect(paths).toEqual([]);
    } finally {
        await client.close();
        await server.close();
        upstream.stop(true);
    }
});
