import { expect, test } from 'bun:test';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('cancelling an update aborts prefetch and prevents PUT without cancelling another request', async () => {
    const writes: string[] = [];
    let notifyPrefetch!: () => void;
    let releaseReads!: () => void;
    const prefetchStarted = new Promise<void>(resolve => { notifyPrefetch = resolve; });
    const gate = new Promise<void>(resolve => { releaseReads = resolve; });
    const mcp = await createMcpTestClient(async req => {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
        if (req.method !== 'GET') writes.push(req.method);
        if (req.method === 'GET') {
            if (url.pathname.endsWith('/products/1')) notifyPrefetch();
            await gate;
        }
        return Response.json({ product: { id: 1, name: 'Preserved' } });
    });
    try {
        const controller = new AbortController();
        let cancelled = false;
        const send = mcp.transport.send.bind(mcp.transport);
        mcp.transport.send = async (message) => {
            if ('method' in message && message.method === 'notifications/cancelled') cancelled = true;
            return send(message);
        };
        const update = mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'update', id: 1, params: { name: 'Cancelled' } } }, undefined, { signal: controller.signal }).catch(error => error);
        await prefetchStarted;
        const other = mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 2 } });
        controller.abort();
        expect(await update).toBeInstanceOf(Error);
        expect(cancelled).toBe(true);
        await Bun.sleep(30);
        releaseReads();
        const result = await other;
        expect(result.isError).not.toBe(true);
        expect(toolData(result).name).toBe('Preserved');
        await Bun.sleep(30);
        expect(writes).toEqual([]);
    } finally {
        releaseReads();
        await mcp.close();
    }
}, { timeout: 10_000 });
