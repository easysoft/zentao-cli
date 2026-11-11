import { expect, test } from 'bun:test';
import { executeModuleCommand } from '../src/modules/executor.js';
import { getModule } from '../src/modules/helper.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import type { ZentaoClient } from '../src/api/index.js';
test('all pages are fetched once, processed together, then capped independently of page size', async () => {
    const pages: number[] = [];
    const client = { getZentaoConfig: async () => ({ version: '22.7' }), request: async (_path: string, options: { query: { pageID: string; recPerPage: string } }) => {
        const page = Number(options.query.pageID); pages.push(page);
        return { products: [{ id: page * 2 - 1 }, ...(page < 3 ? [{ id: page * 2 }] : [])], pager: { pageID: page, recPerPage: 2, recTotal: 5 } };
    } } as unknown as ZentaoClient;
    const result = await executeModuleCommand(client, getModule('product')!, 'list', [], { all: true, recPerPage: '2', maxItems: '3', sort: 'id:desc' }, DEFAULT_CONFIG);
    expect(pages).toEqual([1, 2, 3]);
    expect(result.data).toEqual([{ id: 5 }, { id: 4 }, { id: 3 }]);
    expect(result.meta).toMatchObject({ returned: 3, fetched: 5, total: 5, hasMore: false, truncated: true, processingScope: 'all' });
});
test('an empty filtered page retains server next-page information', async () => {
    const client = { getZentaoConfig: async () => ({ version: '22.7' }), request: async () => ({ products: [{ id: 1 }], pager: { pageID: 1, recPerPage: 1, recTotal: 2 } }) } as unknown as ZentaoClient;
    const result = await executeModuleCommand(client, getModule('product')!, 'list', [], { filter: ['id=2'] }, DEFAULT_CONFIG);
    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ returned: 0, hasMore: true, total: 2 });
    await expect(executeModuleCommand(client, getModule('product')!, 'list', [], { all: true }, DEFAULT_CONFIG)).rejects.toMatchObject({ code: '2008' });
});
test('native SQL limit never acts as a local cap, and raw rejects processing', async () => {
    const client = { getZentaoConfig: async () => ({ version: '22.7' }), request: async () => Response.json({ rows: [{ x: 1 }, { x: 2 }], total: 2, page: 1, limit: 1 }) } as unknown as ZentaoClient;
    const result = await executeModuleCommand(client, getModule('db')!, 'query', [], { data: '{"sql":"select 1","limit":1}' }, DEFAULT_CONFIG);
    expect(result.data).toHaveLength(2);
    await expect(executeModuleCommand(client, getModule('product')!, 'list', [], { format: 'raw', pick: 'id' }, DEFAULT_CONFIG)).rejects.toMatchObject({ code: '2009' });
});
