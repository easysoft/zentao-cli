import { describe, expect, test } from 'bun:test';
import { handleModuleTool } from '../src/mcp/tools';
import { getModule } from '../src/modules';
import type { AuthProvider } from '../src/mcp/server';

function unusedAuth(): AuthProvider {
    return {
        getClient: async () => {
            throw new Error('authentication should not run for invalid batch input');
        },
        resetClient: () => undefined,
    };
}

describe('MCP module batch validation', () => {
    test('rejects id and ids used together before authentication', async () => {
        await expect(handleModuleTool(
            getModule('bug')!,
            { action: 'get', id: 1, ids: [2, 3] },
            unusedAuth(),
        )).rejects.toMatchObject({
            code: '2009',
            message: expect.stringContaining('不能与 id 或 params.id 同时使用'),
        });
    });

    test('rejects params.id together with ids before authentication', async () => {
        await expect(handleModuleTool(
            getModule('bug')!,
            { action: 'get', ids: [2, 3], params: { id: 1 } },
            unusedAuth(),
        )).rejects.toMatchObject({
            code: '2009',
            message: expect.stringContaining('不能与 id 或 params.id 同时使用'),
        });
    });

    test('rejects ids for actions other than get, update and delete', async () => {
        await expect(handleModuleTool(
            getModule('bug')!,
            { action: 'resolve', ids: [1, 2], params: { resolution: 'fixed' } },
            unusedAuth(),
        )).rejects.toMatchObject({
            code: '2009',
            message: expect.stringContaining('仅 get/update/delete 支持 ids'),
        });
    });

    test('rejects invalid ids before authentication', async () => {
        await expect(handleModuleTool(
            getModule('bug')!,
            { action: 'get', ids: [1, 0] },
            unusedAuth(),
        )).rejects.toMatchObject({
            code: '2009',
            message: expect.stringContaining('正整数数组'),
        });
    });
});
