import { expect, test } from 'bun:test';
import { createAuthProvider } from '../src/mcp/server.js';

test.each([false, true])('authentication cancellation preserves other callers: allCancelled=%p', async (allCancelled) => {
    let release!: () => void; let notify!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { notify = resolve; });
    const calls: string[] = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url); calls.push(url.pathname + url.search);
        if (url.pathname.endsWith('/users/login')) { notify(); await gate; return Response.json({ status: 'success', token: 'shared-token' }); }
        if (url.searchParams.has('mode')) return Response.json({ version: '22.7' });
        return Response.json({ users: [{ id: 1, account: 'test' }] });
    } });
    const values = { ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'test', ZENTAO_PASSWORD: 'password', ZENTAO_TOKEN: '' };
    const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    Object.assign(process.env, values);
    try {
        const provider = createAuthProvider(); const a = new AbortController(); const b = new AbortController();
        const one = provider.getContext(a.signal).catch(error => error);
        const two = provider.getContext(b.signal).catch(error => error);
        await started; a.abort(); if (allCancelled) b.abort();
        expect((await one).code).toBe('5003');
        if (allCancelled) expect((await two).code).toBe('5003');
        release();
        if (!allCancelled) expect((await two).identity.account).toBe('test');
        await Bun.sleep(30);
        expect(calls.filter(path => path.includes('/users/login'))).toHaveLength(1);
        if (allCancelled) expect(calls).toHaveLength(1);
    } finally {
        release(); server.stop(true);
        for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
});
