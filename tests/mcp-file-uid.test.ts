import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startMcpHttpServer } from '../src/mcp/http.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP binds a pre-uploaded image through stdio or HTTP with the same Token and uid', async () => {
    const requests: Array<{ path: string; token: string | null; uid: string | null }> = [];
    let fileID = 41;
    const stdio = await createMcpTestClient(async req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0', requestType: 'PATH_INFO', requestFix: '-' });
        const token = req.headers.get('token');
        expect(req.method).toBe('POST');
        if (url.pathname.endsWith('/files')) {
            const form = await req.formData();
            expect([...form.keys()]).toEqual(['file']);
            expect(await (form.get('file') as File).text()).toBe('fixture');
            expect(url.searchParams.get('extra')).toBe('editor');
            requests.push({ path: url.pathname, token, uid: url.searchParams.get('uid') });
            return Response.json({ id: ++fileID });
        }
        const body = await req.json();
        expect(url.searchParams.has('uid')).toBe(false);
        expect(body.desc).toContain(`/file-read-${fileID}.png`);
        requests.push({ path: url.pathname, token, uid: body.uid });
        return Response.json({ status: 'success', id: 17 });
    }, ['--modules', 'product,file']);
    const http = await startMcpHttpServer({ url: stdio.siteUrl, port: 0, modules: ['product', 'file'] });
    const remote = new Client({ name: 'uid-binding-test', version: '0.0.0' });
    const dir = mkdtempSync(join(tmpdir(), 'zentao-mcp-uid-'));
    try {
        await remote.connect(new StreamableHTTPClientTransport(http.url, { requestInit: { headers: { token: 'test-token' } } }));
        const file = join(dir, 'fixture.png');
        writeFileSync(file, 'fixture');
        const help = async (module: string, action: string) => toolData(await stdio.client.callTool({ name: 'zentao_action_help', arguments: { module, action } }));
        expect((await help('file', 'create')).parameters).toContainEqual(expect.objectContaining({ name: 'uid', role: 'query' }));
        expect((await help('product', 'create')).parameters).toContainEqual(expect.objectContaining({ name: 'uid', role: 'body', required: false }));
        expect((await help('file', 'update')).parameters.map((p: { name: string }) => p.name)).not.toContain('uid');
        for (const [client, uid] of [[stdio.client, 'stdio-batch_1'], [remote, 'http-batch_2']] as const) {
            const uploaded = await stdio.client.callTool({ name: 'zentao_file', arguments: { action: 'create', params: { file, uid } } });
            expect(uploaded.isError, JSON.stringify(uploaded.content)).not.toBe(true);
            const data = { name: '测试产品', desc: `<img src="file:${toolData(uploaded).id}" alt="fixture.png">`, uid };
            const saved = await client.callTool({ name: 'zentao_product', arguments: { action: 'create', params: client === remote ? { data } : data } });
            expect(saved.isError, JSON.stringify(saved.content)).not.toBe(true);
            expect(requests.splice(0)).toEqual([
                { path: '/api.php/v2/files', token: 'test-token', uid },
                { path: '/api.php/v2/products', token: 'test-token', uid },
            ]);
        }
        const blocked = await remote.callTool({ name: 'zentao_product', arguments: { action: 'create', params: {
            name: '测试产品', uid: 'http-local-image', desc: `<img src="${pathToFileURL(file).href}">`,
        } } });
        expect(blocked).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009', message: expect.stringContaining('HTTP MCP') } } });
        const unknown = await remote.callTool({ name: 'zentao_product', arguments: { action: 'create', params: {
            data: { name: '测试产品', uid: 'http-other-field', unexpected: 'value' },
        } } });
        expect(unknown).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009', message: expect.stringContaining('unexpected') } } });
        expect(requests).toEqual([]);
    } finally {
        await remote.close();
        await http.close();
        await stdio.close();
        rmSync(dir, { recursive: true, force: true });
    }
});
