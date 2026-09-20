import { expect, test } from 'bun:test';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP aliases resolve actual paths, reject conflicts and preserve JSON write bodies', async () => {
    const requests: Array<{ path: string; body?: unknown }> = [];
    const mcp = await createMcpTestClient(async req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        requests.push({ path: url.pathname, ...(req.method !== 'GET' ? { body: await req.json() } : {}) });
        return Response.json({ status: 'success', tasks: [], plans: [], stories: [], docs: [], id: 1 });
    });
    try {
        const cases = [
            { name: 'zentao_task', arguments: { action: 'list', execution: 3 }, path: '/executions/3/tasks' },
            { name: 'zentao_productplan', arguments: { action: 'list', product: 2 }, path: '/products/2/productplans' },
            { name: 'zentao_story', arguments: { action: 'list', product: 2 }, path: '/products/2/stories' },
            { name: 'zentao_doc', arguments: { action: 'myDocs', id: 6, params: { libID: 7 } }, path: '/doc/my/spaces/6/libs/7/docs' },
        ];
        for (const { name, arguments: args, path } of cases) {
            const result = await mcp.client.callTool({ name, arguments: args });
            expect(result.isError).not.toBe(true);
            expect(requests.at(-1)?.path).toBe(`/api.php/v2${path}`);
        }
        const before = requests.length;
        for (const args of [
            { action: 'list', execution: 3, params: { executionID: 4 } },
            { action: 'get', id: 3, params: { taskID: 4 } },
            { action: 'list', execution: 3, page: 1, params: { pageID: 2 } },
        ]) {
            expect((await mcp.client.callTool({ name: 'zentao_task', arguments: args })).isError).toBe(true);
        }
        expect(requests).toHaveLength(before);
        const created = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'create', params: { name: 'Line 1\nLine 2', data: { desc: '<p>JSON body</p>' } } } });
        expect(created.isError).not.toBe(true);
        expect(toolData(created).id).toBe(1);
        expect(requests.at(-1)?.body).toMatchObject({ name: 'Line 1\nLine 2', desc: '<p>JSON body</p>' });
        const invalid = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'create', params: { data: '@-' } } });
        expect(invalid.isError).toBe(true);
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });
