import { expect, test } from 'bun:test';
import { getModuleActionParams } from 'zentao-api';
import { getAction, getModule } from '../src/modules/helper.js';
import { normalizeToolParams } from '../src/mcp/params.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test.each(['story', 'requirement', 'epic'].flatMap(module => ['create', 'change'].map(action => ({ module, action }))))(
    'MCP $module/$action keeps requirement review defaults and explicit statuses', async ({ module, action }) => {
        const requests: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
        const mcp = await createMcpTestClient(async req => {
            const url = new URL(req.url);
            if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.7' });
            requests.push({ method: req.method, path: url.pathname.replace('/api.php/v2', ''), body: await req.json() });
            return Response.json({ status: 'success', id: 7 });
        });
        try {
            const cases = [
                { params: {}, status: 'active' },
                { params: { reviewer: [] }, status: 'active' },
                { params: { data: { status: 'draft' } }, status: 'draft' },
                { params: { status: 'closed' }, status: 'closed' },
                { params: { data: { reviewer: [' ', ''], status: '' } }, status: 'active' },
                { params: { data: { reviewer: ['admin'], status: 'draft' } }, status: 'reviewing' },
            ];
            for (const { params, status } of cases) {
                const result = await mcp.client.callTool({
                    name: `zentao_${module}`, arguments: {
                        action, ...(action === 'change' ? { id: 7 } : {}),
                        params: { ...(action === 'create' ? { productID: 1 } : {}), title: 'Review policy regression', ...params },
                    },
                });
                expect(result.isError, JSON.stringify(result)).not.toBe(true);
                const collection = module === 'story' ? 'stories' : `${module}s`;
                const sent = requests.at(-1)!;
                expect(sent).toMatchObject({
                    method: action === 'create' ? 'POST' : 'PUT',
                    path: `/${collection}${action === 'change' ? '/7/change' : ''}`,
                    body: { title: 'Review policy regression', status },
                });
                if (status === 'reviewing') {
                    expect(sent.body.reviewer).toEqual(['admin']);
                    expect(sent.body).not.toHaveProperty('needNotReview');
                } else {
                    expect(sent.body.needNotReview).toBe('1');
                }
            }
            expect(requests).toHaveLength(cases.length);
        } finally {
            await mcp.close();
        }
    },
);

test('MCP rejects invalid requirement statuses and unrelated body fields before HTTP', async () => {
    let calls = 0;
    const mcp = await createMcpTestClient(() => { calls++; return Response.json({ version: '22.7', id: 7 }); });
    try {
        for (const module of ['story', 'requirement', 'epic']) {
            for (const action of ['create', 'change']) {
                for (const data of [{ status: 1 }, { status: null }, { status: [] }, { status: false }, { status: 'draft', statusTypo: 'active' }]) {
                    const result = await mcp.client.callTool({
                        name: `zentao_${module}`, arguments: {
                            action, ...(action === 'change' ? { id: 7 } : {}),
                            params: { ...(action === 'create' ? { productID: 1 } : {}), title: 'Invalid status', data },
                        },
                    });
                    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
                }
            }
        }
        expect(calls).toBe(0);
    } finally {
        await mcp.close();
    }
});

test('MCP scope shortcuts never replace array fields', async () => {
    let requests = 0;
    const mcp = await createMcpTestClient(() => { requests++; return Response.json({}); });
    try {
        const { tools } = await mcp.client.listTools();
        expect(tools.find(tool => tool.name === 'zentao_repo')!.inputSchema.properties).not.toHaveProperty('product');
        expect(tools.find(tool => tool.name === 'zentao_task')!.inputSchema.properties).toHaveProperty('execution');
        for (const [name, actionName, alias, params] of [
            ['repo', 'create', { product: 12 }, { space: 10, name: 'demo' }],
            ['auditplan', 'batchCreate', { execution: 3 }, { projectID: 1, process: ['117'], objectID: ['475'], checkDate: ['2026-10-16'] }],
            ['opportunity', 'batchCreate', { execution: 3 }, { projectID: 1, name: ['Opportunity'] }],
        ] as const) {
            const mod = getModule(name)!;
            expect(() => normalizeToolParams(mod, getAction(mod, actionName)!, { ...alias, params })).toThrow();
            expect((await mcp.client.callTool({ name: `zentao_${name}`, arguments: { action: actionName, ...alias, params } })).isError).toBe(true);
        }
        expect(requests).toBe(0);
    } finally {
        await mcp.close();
    }
});

test('MCP validates SDK body constraints before authentication, including JSON data and array elements', async () => {
    let requests = 0;
    const mcp = await createMcpTestClient(() => { requests++; return Response.json({ version: '22.7', id: 1 }); });
    try {
        for (const patch of [
            { space: 0.5 }, { space: 0 }, { space: Number.MAX_SAFE_INTEGER + 1 },
            { product: [] }, { product: ['12'] }, { product: [0] }, { product: [1.5] },
            { name: '' }, { name: 'bad name' }, { members: [''] }, { members: [1] },
        ]) {
            const body = { space: 10, product: [12], name: 'demo', ...patch };
            for (const params of [body, { data: body }]) {
                const result = await mcp.client.callTool({ name: 'zentao_repo', arguments: { action: 'create', params } });
                expect(result, JSON.stringify(params)).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
            }
        }
        for (const params of [{ name: 'bad name', publicKey: 'ssh-ed25519 mock' }, { name: 'coder', publicKey: '' }]) {
            const result = await mcp.client.callTool({ name: 'zentao_my', arguments: { action: 'createSSH', params } });
            expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
        }
        expect(requests).toBe(0);
    } finally {
        await mcp.close();
    }
});

test('SDK requests preserve numeric arrays, public keys, relation IDs, autofill and false', async () => {
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    const mcp = await createMcpTestClient(async req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.7' });
        const path = url.pathname.replace('/api.php/v2', '');
        requests.push({ method: req.method, path, ...(req.method === 'POST' || req.method === 'PUT' ? { body: await req.json() } : {}) });
        return Response.json({ status: 'success', id: 7, rows: [{ id: 7 }], flow: { id: 5, name: 'Original', navigator: 'primary', position: 'after', positionModule: 'main', readOnlyField: 'excluded' } });
    });
    try {
        const publicKey = 'ssh-ed25519 <mock-public-key> developer@example.com';
        for (const [name, args] of [
            ['repo', { action: 'create', params: { data: { space: 10, product: [12, 13], name: 'demo_repo', acl: 'private', members: ['developer'] } } }],
            ['my', { action: 'createSSH', params: { name: 'coder', publicKey } }],
            ['relation', { action: 'unlink', id: 8 }],
            ['workflow', { action: 'updateFlow', id: 5, params: { name: 'Renamed' } }],
            ['db', { action: 'query', params: { sql: 'SELECT id FROM zt_user', count: false } }],
        ] as const) {
            const result = await mcp.client.callTool({ name: `zentao_${name}`, arguments: args });
            expect(result.isError, `${name}/${args.action}: ${JSON.stringify(result)}`).not.toBe(true);
        }
        expect(requests).toEqual([
            { method: 'POST', path: '/repos', body: { space: 10, product: [12, 13], name: 'demo_repo', acl: 'private', members: ['developer'], desc: '' } },
            { method: 'POST', path: '/my/sshkeys', body: { name: 'coder', publicKey } },
            { method: 'DELETE', path: '/relations/8' },
            { method: 'GET', path: '/workflows/5' },
            { method: 'PUT', path: '/workflows/5', body: { name: 'Renamed', navigator: 'primary', position: 'after', positionModule: 'main' } },
            { method: 'POST', path: '/db/query', body: { sql: 'SELECT id FROM zt_user', count: false } },
        ]);
    } finally {
        await mcp.close();
    }
});

test('MCP unlinks by the returned relation ID and rejects legacy selectors before HTTP', async () => {
    const requests: Array<{ method: string; path: string }> = [];
    const relation = { id: 43, relationID: 8, relationKey: 'related', relationType: 'custom' };
    let calls = 0;
    const mcp = await createMcpTestClient(req => {
        calls++;
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.7' });
        requests.push({ method: req.method, path: url.pathname.replace('/api.php/v2', '') });
        return Response.json({ status: 'success', relations: [relation] });
    });
    try {
        const legacy = { objectType: 'story', objectID: 42, relatedObjectType: 'bug', relatedObjectID: 43, relationName: 'related' };
        for (const args of [{ params: legacy }, { id: 42, params: legacy }, { params: { relationID: 8, objectID: 42 } }]) {
            expect(await mcp.client.callTool({ name: 'zentao_relation', arguments: { action: 'unlink', ...args } }))
                .toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
        }
        expect(calls).toBe(0);
        const listed = await mcp.client.callTool({ name: 'zentao_relation', arguments: { action: 'list', id: 42, params: { objectType: 'story' } } });
        expect(listed.isError).not.toBe(true);
        expect(toolData(listed).data).toEqual([relation]);
        const unlinked = await mcp.client.callTool({ name: 'zentao_relation', arguments: { action: 'unlink', params: { relationID: toolData(listed).data[0].relationID } } });
        expect(unlinked.isError).not.toBe(true);
        expect(requests).toEqual([{ method: 'GET', path: '/relations/story/42' }, { method: 'DELETE', path: '/relations/8' }]);
    } finally {
        await mcp.close();
    }
});

test('read-only MCP preserves deliverable option maps, new filters and detail strings', async () => {
    const requests: Array<{ path: string; query: Record<string, string> }> = [];
    const options = { 3: '开发说明', 8: '验收报告' };
    const deliverable = { id: 7, name: '开发说明', docInfo: '交付文档说明' };
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.7' });
        requests.push({ path: url.pathname.replace('/api.php/v2', ''), query: Object.fromEntries(url.searchParams) });
        if (url.pathname.endsWith('/deliverable-options')) return Response.json({ deliverables: options });
        if (url.pathname.endsWith('/deliverables/7')) return Response.json({ deliverable });
        return Response.json({ deliverables: [deliverable], pager: { pageID: 2, recPerPage: 10, recTotal: 21 } });
    }, ['--read-only', '--modules', 'deliverable']);
    try {
        const selected = await mcp.client.callTool({ name: 'zentao_deliverable', arguments: { action: 'options', project: 2 } });
        expect(selected.isError).not.toBe(true);
        expect(selected.structuredContent).toEqual({ data: options });
        expect(requests[0]).toEqual({ path: '/projects/2/deliverable-options', query: {} });
        for (const browseType of ['normal', 'wait', 'mine', 'reviewing', 'pending', 'submitbyme']) {
            const listed = await mcp.client.callTool({ name: 'zentao_deliverable', arguments: { action: 'list', project: 2, params: { browseType }, page: 2, recPerPage: 10 } });
            expect(listed.isError, browseType).not.toBe(true);
            expect(listed.structuredContent).toMatchObject({ data: [deliverable], pager: { pageID: 2, recPerPage: 10, recTotal: 21 } });
            expect(requests.at(-1)).toMatchObject({ path: '/projects/2/deliverables', query: { browseType, pageID: '2', recPerPage: '10' } });
        }
        const detail = await mcp.client.callTool({ name: 'zentao_deliverable', arguments: { action: 'get', id: 7 } });
        expect(detail.structuredContent).toEqual({ data: deliverable });
    } finally {
        await mcp.close();
    }
});

test('MCP keeps all personal search parameters and unfinished todo status after the SDK update', async () => {
    const requests: Array<{ path: string; query: Record<string, string> }> = [];
    const searchActions = ['bugs', 'epics', 'issues', 'requirements', 'reviewIssues', 'risks', 'stories', 'tasks', 'testcases', 'testtasks'];
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.7' });
        requests.push({ path: url.pathname.replace('/api.php/v2', ''), query: Object.fromEntries(url.searchParams) });
        return Response.json(Object.fromEntries([...searchActions, 'todos'].map(name => [name.toLowerCase(), []])));
    }, ['--read-only', '--modules', 'my']);
    try {
        for (const action of searchActions) {
            const browseType = action === 'testtasks' ? 'bySearch' : 'bysearch';
            const result = await mcp.client.callTool({ name: 'zentao_my', arguments: { action, params: { browseType, param: '12' } } });
            expect(result.isError, action).not.toBe(true);
            expect(requests.at(-1)).toMatchObject({ path: `/my/${action.toLowerCase()}`, query: { browseType, param: '12' } });
        }
        const todos = await mcp.client.callTool({ name: 'zentao_my', arguments: { action: 'todos', params: { browseType: 'undone', status: 'undone' } } });
        expect(todos.isError).not.toBe(true);
        expect(requests.at(-1)).toMatchObject({ path: '/my/todos', query: { browseType: 'undone', status: 'undone' } });
        expect(requests).toHaveLength(11);
    } finally {
        await mcp.close();
    }
});

test('audit plan defaults match their enum without weakening case-sensitive task filters', () => {
    const mod = getModule('my')!;
    const auditPlans = getAction(mod, 'auditPlans')!;
    const browseType = getModuleActionParams('my', 'auditPlans').find(param => param.name === 'browseType')!;
    expect(browseType.defaultValue).toBe('mychecking');
    expect(() => normalizeToolParams(mod, auditPlans, { params: { browseType: browseType.defaultValue } })).not.toThrow();
    expect(() => normalizeToolParams(mod, getAction(mod, 'tasks')!, { params: { browseType: 'assignedto' } })).toThrow();
});
