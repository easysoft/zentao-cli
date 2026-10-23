import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeModuleCommand } from '../src/modules/executor.js';
import { getModule } from '../src/modules/helper.js';
import { normalizeToolParams } from '../src/mcp/params.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { ZentaoClient } from '../src/api/index.js';

test('POST queries parse JSON objects and files, and share the MCP body contract', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zentao-body-'));
    try {
        for (const [module, actionName, body] of [
            ['db', 'query', { sql: 'select 1', page: 2, limit: 3 }],
            ['knowledge', 'search', { keywords: ['test'], libIDs: [1], pageID: 2 }],
            ['knowledge', 'embeddingsSearch', { keyword: 'test', libIDs: [1] }],
        ] as const) {
            const requests: unknown[] = [];
            const client = {
                getZentaoConfig: async () => ({ version: '22.7' }),
                request: async (_path: string, options: { body?: unknown; responseType?: string }) => { requests.push(options.body); return options.responseType === 'response' ? Response.json({ rows: [], data: [] }) : { rows: [], data: [] }; },
            } as unknown as ZentaoClient;
            const mod = getModule(module)!;
            const action = mod.actions.find(item => item.name === actionName)!;
            writeFileSync(join(dir, 'body.json'), JSON.stringify(body));
            for (const data of [JSON.stringify(body), `@${join(dir, 'body.json')}`]) {
                await executeModuleCommand(client, mod, actionName, [], { data, format: 'json' }, DEFAULT_CONFIG);
                expect(requests.at(-1)).toMatchObject(body);
            }
            expect(normalizeToolParams(mod, action, { params: { data: body } }).data).toEqual(body);
            requests.length = 0;
            for (const data of ['{broken', '[]', 'null', '"text"']) {
                await expect(executeModuleCommand(client, mod, actionName, [], { data }, DEFAULT_CONFIG)).rejects.toMatchObject({ code: '2007' });
            }
            expect(requests).toHaveLength(0);
        }
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
