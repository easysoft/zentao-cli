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
                expect((tool.inputSchema.properties!.action as { enum: string[] }).enum).toContain('create');
                const help = toolData(await client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'create' } }));
                expect(help.available).toBe(false);
                expect(help.unavailableReason).toContain('HTTP MCP 不支持通过本地路径上传服务端文件');
                for (const params of [body, { data: body }]) {
                    const result = await client.callTool({ name, arguments: { action: 'create', params } });
                    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
                    expect(JSON.stringify(result)).toContain('请使用本地 CLI 或 stdio MCP');
                    expect(JSON.stringify(result)).not.toContain(sentinel);
                }
                expect(authentications).toBe(0);
                expect(requests).toBe(0);
            } finally {
                await client.close();
                await server.close();
            }
        }

        let uploaded: string | undefined;
        const stdio = await createMcpTestClient(async req => {
            if (new URL(req.url).searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
            expect(req.method).toBe('POST');
            expect(new URL(req.url).pathname).toBe('/api.php/v2/files');
            const form = await req.formData();
            uploaded = await (form.get('file') as File).text();
            expect(form.get('objectType')).toBe('story');
            expect(form.get('objectID')).toBe('1');
            return Response.json({ id: 42 });
        }, ['--modules', 'file']);
        try {
            const help = toolData(await stdio.client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'create' } }));
            expect(help.available).toBe(true);
            const result = await stdio.client.callTool({ name: 'zentao_file', arguments: { action: 'create', params: { data: body } } });
            expect(result.isError).not.toBe(true);
            expect(uploaded).toBe(sentinel);
        } finally {
            await stdio.close();
        }
    } finally {
        upstream.stop(true);
        rmSync(dir, { recursive: true, force: true });
    }
}, { timeout: 10_000 });
