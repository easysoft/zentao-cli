import { expect, test } from 'bun:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { registerModuleTools } from '../src/mcp/tools.js';
import { getAllModules } from '../src/modules/helper.js';
import { createMcpTestClient } from './mcp-helpers.js';

test('read-only mode restricts discovery and rejects writes and unselected modules before HTTP', async () => {
    const requests: string[] = [];
    const mcp = await createMcpTestClient(req => {
        requests.push(req.url);
        return Response.json({ version: '22.5', product: { id: 1 } });
    }, ['--read-only', '--modules', 'product,task']);
    try {
        const { tools } = await mcp.client.listTools();
        expect(tools.map(tool => tool.name).sort()).toEqual(['zentao_action_help', 'zentao_product', 'zentao_profile', 'zentao_task']);
        expect(tools.every(tool => tool.annotations?.readOnlyHint && !tool.annotations.destructiveHint)).toBe(true);
        for (const name of ['zentao_product', 'zentao_task']) {
            expect((tools.find(tool => tool.name === name)!.inputSchema.properties!.action as { enum: string[] }).enum).not.toContain('update');
        }
        for (const [name, args] of [
            ['zentao_product', { action: 'update', id: 1, params: { name: 'Blocked' } }],
            ['zentao_bug', { action: 'list', product: 1 }],
            ['zentao_switch_profile', { profileKey: 'another' }],
        ] as const) {
            expect((await mcp.client.callTool({ name, arguments: args })).isError).toBe(true);
        }
        expect(requests).toEqual([]);
        expect((await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } })).isError).not.toBe(true);
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });

test('split tools preserve every action exactly once and accurately mark reads and writes', async () => {
    const requests: string[] = [];
    const mcp = await createMcpTestClient(req => {
        requests.push(req.method);
        return Response.json({ version: '22.5', product: { id: 1, name: 'Original' }, id: 1 });
    }, ['--split-tools']);
    try {
        const { tools } = await mcp.client.listTools();
        for (const mod of getAllModules()) {
            const groups = tools.filter(tool => tool.name === `zentao_${mod.name}_read` || tool.name === `zentao_${mod.name}_write`);
            const actions = groups.flatMap(tool => (tool.inputSchema.properties!.action as { enum: string[] }).enum);
            expect(actions.sort()).toEqual(mod.actions.map(action => action.name).sort());
            for (const tool of groups) expect(tool.annotations?.readOnlyHint).toBe(tool.name.endsWith('_read'));
        }
        expect(tools.find(tool => tool.name === 'zentao_risk_write')?.annotations?.destructiveHint).toBe(true);
        expect(tools.find(tool => tool.name === 'zentao_issue_write')?.annotations?.destructiveHint).toBe(false);
        expect((await mcp.client.callTool({ name: 'zentao_product_read', arguments: { action: 'update', id: 1 } })).isError).toBe(true);
        expect(requests).toEqual([]);
        expect((await mcp.client.callTool({ name: 'zentao_product_read', arguments: { action: 'get', id: 1 } })).isError).not.toBe(true);
        expect((await mcp.client.callTool({ name: 'zentao_product_write', arguments: { action: 'create', params: { name: 'Mock only' } } })).isError).not.toBe(true);
        expect(requests).toEqual(['GET', 'GET', 'POST']);
        expect((await mcp.client.callTool({ name: 'zentao_product_write', arguments: { action: 'update', id: 1, params: { desc: 'Mock update with autoFill' } } })).isError).not.toBe(true);
        expect(requests.slice(-2)).toEqual(['GET', 'PUT']);
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });

test('read-only handlers enforce the action subset even without input schema validation', async () => {
    let authenticated = false;
    type Handler = (input: unknown, extra: { signal: AbortSignal }) => Promise<CallToolResult>;
    const callbacks = new Map<string, Handler>();
    const server = { registerTool(name: string, _config: unknown, handler: Handler) { callbacks.set(name, handler); } } as unknown as McpServer;
    const auth = { async getContext(): Promise<never> { authenticated = true; throw new Error('Unexpected authentication'); } };
    registerModuleTools(server, auth, { readOnly: true, modules: ['product'], splitTools: true });
    const result = await callbacks.get('zentao_product_read')!({ action: 'update', id: 1 }, { signal: new AbortController().signal });
    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2006' } } });
    expect(authenticated).toBe(false);
    expect(() => registerModuleTools(server, auth, { modules: ['unknown'] })).toThrow('未找到指定的模块 unknown');
    expect(() => registerModuleTools(server, auth, { modules: [] })).toThrow('至少指定一个模块');
});
