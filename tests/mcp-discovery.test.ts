import { expect, test } from 'bun:test';
import { getAllModules } from '../src/modules/helper.js';
import { normalizeToolParams } from '../src/mcp/params.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('action help examples satisfy every action contract without authentication', async () => {
    let requests = 0;
    const mcp = await createMcpTestClient(() => { requests++; return Response.json({}); }, ['--split-tools']);
    try {
        const { tools } = await mcp.client.listTools();
        for (const mod of getAllModules()) for (const action of mod.actions) {
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
            expect(tool.inputSchema.properties).not.toHaveProperty('filter');
            expect(tool.inputSchema.properties).not.toHaveProperty('pick');
            expect(tool.outputSchema?.properties).not.toHaveProperty('pager');
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
