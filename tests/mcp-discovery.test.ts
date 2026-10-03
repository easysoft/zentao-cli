import { expect, test } from 'bun:test';
import { getAllModules } from '../src/modules/helper.js';
import { normalizeToolParams } from '../src/mcp/params.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('action help examples and processing schemas match every action contract without authentication', async () => {
    let requests = 0;
    const mcp = await createMcpTestClient(() => { requests++; return Response.json({}); }, ['--split-tools']);
    try {
        const { tools } = await mcp.client.listTools();
        const modules = getAllModules();
        for (const mod of modules) for (const action of mod.actions) {
            const result = await mcp.client.callTool({ name: 'zentao_action_help', arguments: { module: mod.name, action: action.name } });
            expect(result.isError).not.toBe(true);
            const help = toolData(result);
            expect(help.available).toBe(true);
            expect(help.minVersion).toEqual(action.minVersion);
            expect(tools.some(tool => tool.name === help.example.name)).toBe(true);
            expect(help.example.arguments.action).toBe(action.name);
            expect(() => normalizeToolParams(mod, action, help.example.arguments)).not.toThrow();
        }
        expect(requests).toBe(0);
        for (const tool of tools.filter(tool => tool.name.endsWith('_write'))) {
            const mod = modules.find(mod => tool.name === `zentao_${mod.name}_write`)!;
            const names = (tool.inputSchema.properties!.action as { enum: string[] }).enum;
            const actions = mod.actions.filter(action => names.includes(action.name));
            // POST actions can return lists while remaining in the write tool group.
            const hasList = actions.some(action => action.type === 'list');
            expect(Object.hasOwn(tool.inputSchema.properties!, 'filter')).toBe(hasList);
            expect(Object.hasOwn(tool.inputSchema.properties!, 'pick')).toBe(hasList || actions.some(action => action.type === 'get'));
            expect(Object.hasOwn(tool.outputSchema?.properties ?? {}, 'pager')).toBe(hasList);
        }
    } finally {
        await mcp.close();
    }
}, { timeout: 15_000 });

test('help marks unavailable actions and rejects irrelevant data processing options', async () => {
    let requests = 0;
    const mcp = await createMcpTestClient(() => { requests++; return Response.json({}); }, ['--read-only', '--modules', 'product']);
    try {
        for (const [module, action, available] of [['product', 'get', true], ['product', 'create', false], ['task', 'list', false]] as const) {
            const result = await mcp.client.callTool({ name: 'zentao_action_help', arguments: { module, action } });
            expect(toolData(result).available).toBe(available);
        }
        const result = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1, filter: ['id=1'] } });
        expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
        expect(requests).toBe(0);
    } finally {
        await mcp.close();
    }
}, { timeout: 10_000 });
