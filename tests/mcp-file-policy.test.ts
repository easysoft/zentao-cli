import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createClient } from '../src/api/index.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import { createMcpServer } from '../src/mcp/server.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('remote MCP blocks server file uploads before authentication while stdio preserves local uploads', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zentao-mcp-file-policy-'));
    const file = join(dir, 'harmless-fixture.txt');
    const sentinel = 'harmless-mcp-local-file-policy-fixture';
    writeFileSync(file, sentinel);
    const body = { file, objectType: 'story', objectID: 1 };
    let requests = 0;
    let authentications = 0;
    const upstream = Bun.serve({
        hostname: '127.0.0.1', port: 0,
        fetch() { requests++; return Response.json({ version: '22.5', id: 1 }); },
    });
    try {
        for (const splitTools of [false, true]) {
            const server = createMcpServer({
                async getContext() {
                    authentications++;
                    return {
                        client: createClient(upstream.url.toString(), 'test-token'),
                        config: DEFAULT_CONFIG,
                        identity: { server: upstream.url.toString() },
                    };
                },
            }, { modules: ['file'], allowLocalFiles: false, splitTools });
            const client = new Client({ name: 'remote-file-policy-test', version: '0.0.0' });
            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
            try {
                await server.connect(serverTransport);
                await client.connect(clientTransport);
                const name = splitTools ? 'zentao_file_write' : 'zentao_file';
                const { tools } = await client.listTools();
                const tool = tools.find(tool => tool.name === name)!;
                expect((tool.inputSchema.properties!.action as { enum: string[] }).enum).not.toContain('create');
                const help = toolData(await client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'create' } }));
                expect(help.available).toBe(false);
                expect(help.unavailableReason).toContain('HTTP MCP 不支持通过本地路径上传服务端文件');
                for (const params of [body, { data: body }]) {
                    const result = await client.callTool({ name, arguments: { action: 'create', params } });
                    expect(result.isError).toBe(true);
                    expect(JSON.stringify(result)).not.toContain(sentinel);
                }
                expect(authentications).toBe(0);
                expect(requests).toBe(0);
            } finally {
                await client.close();
                await server.close();
            }
        }

        const extras: Array<FormDataEntryValue | null> = [];
        const stdio = await createMcpTestClient(async req => {
            if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
            expect(req.method).toBe('POST');
            expect(req.headers.get('ZenTao-Action-Assistant')).toBe('AI <upload>');
            expect(new URL(req.url).pathname).toBe('/api.php/v2/files');
            const form = await req.formData();
            expect(await (form.get('file') as File).text()).toBe(sentinel);
            extras.push(form.get('extra'));
            expect(form.get('objectType')).toBe('story');
            expect(form.get('objectID')).toBe('1');
            expect(form.has('assistant')).toBe(false);
            return Response.json({ id: 42 });
        }, ['--modules', 'file']);
        try {
            const help = toolData(await stdio.client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'create' } }));
            expect(help.available).toBe(true);
            for (const data of [{ ...body, extra: '' }, body]) {
                const result = await stdio.client.callTool({ name: 'zentao_file', arguments: { action: 'create', assistant: 'AI <upload>', params: { data } } });
                expect(result.isError).not.toBe(true);
            }
            expect(extras).toEqual(['', 'editor']);
        } finally {
            await stdio.close();
        }
    } finally {
        upstream.stop(true);
        rmSync(dir, { recursive: true, force: true });
    }
}, { timeout: 10_000 });

test('HTTP MCP blocks local images in submitted and auto-filled HTML and preserves relative links', async () => {
    const localImage = '<img src="file:///__zentao_cli_missing_fixture__/image.png">';
    const relativeImage = '<p><img src="../images/preview.png" alt="预览"></p>';
    const api = createClient('https://zentao.example.test', 'test-token');
    const calls: Array<{ method?: string; path: string; body?: unknown }> = [];
    api.fetch = async (url, options) => {
        const { pathname, searchParams } = new URL(url);
        if (searchParams.get('mode') === 'getconfig') return { version: '23.0' };
        calls.push({ method: options.method, path: pathname, body: options.body });
        const data = options.method === 'GET'
            ? { product: { id: 1, name: '测试产品', desc: localImage } }
            : { status: 'success', id: 1 };
        return options.responseType === 'response' ? Response.json(data) : data;
    };
    let authentications = 0;
    const server = createMcpServer({
        async getContext() {
            authentications++;
            return { client: api, config: DEFAULT_CONFIG, identity: { server: api.siteUrl } };
        },
    }, { modules: ['product'], allowLocalFiles: false });
    const client = new Client({ name: 'rich-text-policy-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const call = (action: string, params: Record<string, unknown>) =>
            client.callTool({ name: 'zentao_product', arguments: { action, params } });
        for (const [action, params] of [
            ['create', { name: '测试产品', uid: 'apiv2' }],
            ['create', { name: '测试产品', uid: 'first', data: { uid: 'second' } }],
            ['create', { name: '测试产品', data: { uid: 'valid_batch', unexpected: true } }],
            ['list', { uid: 'valid_batch' }],
        ] as const) {
            expect(await call(action, params)).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
        }
        expect(authentications).toBe(0);
        expect(calls).toEqual([]);
        const blocked = {
            isError: true,
            structuredContent: { error: { code: 'E2009', message: expect.stringContaining('HTTP MCP') } },
        };
        const blockedCreate = await call('create', { data: { name: '测试产品', desc: localImage } });
        expect(blockedCreate).toMatchObject(blocked);
        expect(blockedCreate).not.toHaveProperty('structuredContent.error.details');
        expect(JSON.stringify(blockedCreate.content)).not.toContain('fileWarnings');
        for (const src of ['file:./image.png', 'file:../image.png', 'file:~/imgs/image.png']) {
            const result = await call('create', { name: '测试产品', desc: '<img src="' + src + '">' });
            expect(result).toMatchObject(blocked);
        }
        expect(calls).toEqual([]);
        expect(await call('update', { productID: 1, name: '改名' })).toMatchObject(blocked);
        expect(calls).toEqual([expect.objectContaining({ method: 'GET', path: '/api.php/v2/products/1' })]);

        const created = await call('create', { name: '测试产品', desc: relativeImage });
        expect(created.isError, JSON.stringify(created.content)).not.toBe(true);
        expect(calls.slice(1)).toEqual([{
            method: 'POST', path: '/api.php/v2/products', body: expect.objectContaining({ desc: relativeImage }),
        }]);
    } finally {
        await client.close();
        await server.close();
    }
});
