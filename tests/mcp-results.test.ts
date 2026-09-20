import { expect, test } from 'bun:test';
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
        expect(single.structuredContent).toEqual({ data: { id: 1, name: 'Product' } });
        expect(toolData(single)).toEqual({ id: 1, name: 'Product' });
        const list = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'list', page: 2, recPerPage: 1, filter: ['status=active'] } });
        expect(list.isError).not.toBe(true);
        expect(list.structuredContent).toEqual({
            data: [], pager: { pageID: 2, recPerPage: 1, recTotal: 10 },
            meta: { processingScope: 'page', returnedCount: 0, totalScope: 'serverBeforeLocalProcessing' },
        });
        expect(toolData(list)).toEqual(list.structuredContent);
        fail = true;
        const failed = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } });
        expect(failed.isError).toBe(true);
        expect(failed.structuredContent).toMatchObject({ error: {
            code: 'E1004', module: 'product', action: 'get', message: expect.any(String),
            help: { tool: 'zentao_action_help', arguments: { module: 'product', action: 'get' } },
        } });
        const invalid = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'list', params: { browseType: 'invalid' } } });
        expect(invalid.structuredContent).toMatchObject({ error: { code: 'E2009', module: 'product', action: 'list' } });
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });
