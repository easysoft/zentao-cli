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

test('MCP rejects invalid fields, values and missing parameters before making HTTP requests', async () => {
    const requests: string[] = [];
    const mcp = await createMcpTestClient(req => {
        requests.push(req.url);
        return Response.json({ version: '22.5', status: 'success', id: 1 });
    });
    try {
        const invalid = [
            { action: 'get', id: -1 },
            { action: 'get', id: 1.5 },
            { action: 'get', params: { productID: 1.5 } },
            { action: 'get' },
            { action: 'list', page: 0 },
            { action: 'list', recPerPage: 1001 },
            { action: 'list', params: { recPerPage: -1 } },
            { action: 'list', params: { pageID: 'two' } },
            { action: 'list', browseType: 'closed' },
            { action: 'list', params: { browseType: 'invalid' } },
            { action: 'list', params: { browseTypo: 'closed' } },
            { action: 'create', params: { name: 123 } },
            { action: 'create', params: { data: { typo: 'value' } } },
            { action: 'create', product: 1, params: { name: 'Name' } },
        ];
        for (const args of invalid) {
            expect((await mcp.client.callTool({ name: 'zentao_product', arguments: args })).isError).toBe(true);
        }
        expect(requests).toEqual([]);
        const valid = await mcp.client.callTool({ name: 'zentao_story', arguments: { action: 'create', params: { productID: 1, title: 'Decimals and root module', estimate: 1.5, module: 0, reviewer: [] } } });
        expect(valid.isError).not.toBe(true);
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });
