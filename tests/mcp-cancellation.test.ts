import { expect, test } from 'bun:test';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

test('cancelling a profile lookup aborts my/profile while other tool calls remain usable', async () => {
    let started!: () => void;
    let aborted!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const cancelled = new Promise<void>(resolve => { aborted = resolve; });
    const paths: string[] = [];
    const mcp = await createMcpTestClient(async req => {
        const url = new URL(req.url);
        if (url.searchParams.has('mode')) return Response.json({ version: '23.0' });
        paths.push(url.pathname);
        if (url.pathname.endsWith('/my/profile')) {
            req.signal.addEventListener('abort', aborted, { once: true });
            started();
            await cancelled;
            return Response.json({ user: { account: 'audit' } });
        }
        return Response.json({ product: { id: 2 } });
    }, ['--modules', 'product']);
    const controller = new AbortController();
    try {
        const profile = mcp.client.callTool({ name: 'zentao_profile', arguments: {} }, undefined, { signal: controller.signal }).catch(error => error);
        await ready;
        const other = mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 2 } });
        controller.abort();
        expect(await profile).toBeInstanceOf(Error);
        await Promise.race([cancelled, Bun.sleep(1000).then(() => { throw new Error('Profile request was not cancelled'); })]);
        expect(toolData(await other)).toEqual({ id: 2 });
        expect(paths).toEqual(['/api.php/v2/my/profile', '/api.php/v2/products/2']);
    } finally {
        controller.abort();
        aborted();
        await mcp.close();
    }
}, { timeout: 10_000 });

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
