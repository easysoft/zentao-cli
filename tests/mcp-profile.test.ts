import { expect, test } from 'bun:test';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('MCP profile pages beyond 100 users, limits identity fields and never masks remote errors', async () => {
    let scenario = 'paged';
    const pages: number[] = [];
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        expect(url.pathname).toBe('/api.php/v2/users');
        expect(url.searchParams.get('filters[0][field]')).toBe('account');
        expect(url.searchParams.get('filters[0][value]')).toBe('audit');
        const pageID = Number(url.searchParams.get('pageID'));
        pages.push(pageID);
        if (scenario === 'fail') return Response.json({ status: 'fail', message: 'Permission denied' });
        if (scenario === '401' || scenario === '403') return Response.json({ error: 'Denied' }, { status: Number(scenario) });
        if (scenario === 'missing') return Response.json({ users: [], pager: { pageID, recPerPage: 100, recTotal: 0 } });
        const users = pageID === 1 || scenario === 'stuck'
            ? Array.from({ length: 100 }, (_, id) => ({ id, account: `user${id}` }))
            : [{ id: 101, account: 'audit', realname: 'Audit', resetToken: 'private-reset-token', phone: 'private-phone' }];
        return Response.json({ users, pager: { pageID, recPerPage: 100, recTotal: 101 } });
    });
    try {
        const profile = await mcp.client.callTool({ name: 'zentao_profile', arguments: {} });
        expect(profile.isError).not.toBe(true);
        expect(toolData(profile)).toMatchObject({ account: 'audit', userFound: true, user: { id: 101, account: 'audit', realname: 'Audit' } });
        expect(toolData(profile).server).toStartWith('http://127.0.0.1:');
        expect(JSON.stringify(profile)).not.toContain('private-');
        expect(pages).toEqual([1, 2]);

        scenario = 'missing';
        const missing = await mcp.client.callTool({ name: 'zentao_profile', arguments: {} });
        expect(missing.isError).not.toBe(true);
        expect(toolData(missing)).toMatchObject({ account: 'audit', userFound: false, user: null });
        for (const [mode, code] of [['fail', 'E2008'], ['401', 'E1004'], ['403', 'E2006'], ['stuck', 'E2008']]) {
            scenario = mode;
            expect(await mcp.client.callTool({ name: 'zentao_profile', arguments: {} })).toMatchObject({
                isError: true, content: [{ text: expect.stringContaining(`${code}:`) }],
            });
        }
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });
