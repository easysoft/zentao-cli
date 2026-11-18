import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP returns stable structured data, contextual errors and explicit page processing metadata', async () => {
    let fail = false;
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        if (fail) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (url.pathname.endsWith('/products')) return Response.json({ products: [{ id: 1, status: 'closed' }], pager: { pageID: 2, recPerPage: 1, recTotal: 10 } });
        return Response.json({ product: { id: 1, name: 'Product' } });
    });
    try {
        const { tools } = await mcp.client.listTools();
        expect(tools.every(tool => tool.outputSchema?.type === 'object')).toBe(true);
        const single = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } });
        expect(single.isError).not.toBe(true);
        expect(single.structuredContent).toEqual({ data: { id: 1, name: 'Product' }, resultObjectType: 'product' });
        expect(toolData(single)).toEqual({ id: 1, name: 'Product' });
        const list = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'list', page: 2, recPerPage: 1, filter: ['status=active'] } });
        expect(list.isError).not.toBe(true);
        expect(list.structuredContent).toEqual({
            data: [], resultObjectType: 'product', pager: { pageID: 2, recPerPage: 1, recTotal: 10 },
            meta: { processingScope: 'page', returnedCount: 0, totalScope: 'serverBeforeLocalProcessing' },
        });
        expect(toolData(list)).toEqual(list.structuredContent);
        fail = true;
        const failed = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } });
        expect(failed.isError).toBe(true);
        expect(failed.structuredContent).toMatchObject({ error: {
            code: 'E1004', module: 'product', action: 'get', message: expect.any(String),
        } });
        expect(failed.structuredContent).not.toHaveProperty('resultObjectType');
        const invalid = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'list', params: { browseType: 'invalid' } } });
        expect(invalid.structuredContent).toMatchObject({ error: { code: 'E2009', module: 'product', action: 'list' } });
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });

test('MCP reports partial image uploads and preserves reconciliation details for unconfirmed saves', async () => {
    let confirmSave = true;
    const savedUids: string[] = [];
    const calls: string[] = [];
    const mcp = await createMcpTestClient(async req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0' });
        calls.push(`${req.method} ${url.pathname}`);
        if (url.pathname.endsWith('/files')) {
            return confirmSave
                ? Response.json({ status: 'fail', message: 'upload interrupted' }, { status: 503 })
                : Response.json({ id: 42, url: '/uploads/image.png' });
        }
        const body = await req.json();
        savedUids.push(body.uid);
        return Response.json(confirmSave ? { status: 'success', id: 7 } : { diagnostic: 'private-upstream-detail' });
    }, ['--modules', 'product']);
    const directory = mkdtempSync(join(tmpdir(), 'zentao-mcp-file-results-'));
    try {
        const image = join(directory, 'image.png');
        writeFileSync(image, Buffer.from([137, 80, 78, 71]));
        const call = () => mcp.client.callTool({
            name: 'zentao_product',
            arguments: { action: 'create', params: { name: '测试产品', desc: `<img src="${pathToFileURL(image).href}">` } },
        });
        const partial = await call();
        expect(partial.isError).not.toBe(true);
        expect(savedUids[0]).toEqual(expect.any(String));
        expect(partial.structuredContent).toMatchObject({
            fileWarnings: [{ stage: 'upload', field: 'desc', uid: savedUids[0] }],
        });
        expect(toolData(partial)).toEqual(partial.structuredContent);

        confirmSave = false;
        const uncertain = await call();
        expect(savedUids[1]).toEqual(expect.any(String));
        expect(uncertain).toMatchObject({
            isError: true, structuredContent: { data: null, error: { details: { uid: savedUids[1], fileIDs: [42] } } },
        });
        expect(JSON.stringify(uncertain.content)).toContain(savedUids[1]!);
        expect(JSON.stringify(uncertain.content)).toContain('42');
        expect(JSON.stringify(uncertain)).not.toContain('private-upstream-detail');
        expect(calls).toEqual(['POST /api.php/v2/files', 'POST /api.php/v2/products', 'POST /api.php/v2/files', 'POST /api.php/v2/products']);
    } finally {
        await mcp.close();
        rmSync(directory, { recursive: true, force: true });
    }
}, { timeout: 10_000 });
