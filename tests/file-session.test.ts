import { expect, test } from 'bun:test';
import { request } from 'zentao-api';
import { createClient, withRequestSignal } from '../src/api/index.js';

const batch = 'file-session-test';

function mockSite(changeSessionAt?: string) {
    const client = createClient('https://zentao.example.test', 'first-token');
    const calls: Array<{ path: string; token?: string; signal?: AbortSignal }> = [];
    client.fetch = async (url, options, token) => {
        const { pathname, searchParams } = new URL(url);
        if (searchParams.get('mode') === 'getconfig') return { version: '23.0' };
        const path = pathname.slice('/api.php/v2'.length);
        calls.push({ path, token, signal: options.signal });
        if (path === changeSessionAt) await client.login('second-user', 'test-password');
        let result: unknown = { status: 'success', id: 1 };
        if (path === '/users/login') result = { status: 'success', token: 'second-token' };
        if (path === '/files') result = { status: 'success', id: 49, url: '/file-read-49.png' };
        if (path === '/bugs/7') result = { status: 'success', bug: { status: 'active', assignedTo: 'qa', type: 'codeerror', pri: 2, deadline: '', mailto: [] } };
        return options.responseType === 'response' ? Response.json(result) : result;
    };
    return { client, calls };
}

function createWithImage(client: ReturnType<typeof createClient>) {
    return request('product/create', { uid: batch, name: 'Product', desc: '<img src="fixture">' }, {
        client,
        fileResolver: { fixture: { blob: new Blob(['image bytes'], { type: 'image/png' }), name: 'fixture.png' } },
    });
}

for (const withSignal of [false, true]) {
    const mode = withSignal ? 'with a signal' : 'without a signal';
    test(`pre-uploads and saves in the same session ${mode}`, async () => {
        const { client, calls } = mockSite();
        const signal = withSignal ? new AbortController().signal : undefined;
        await createWithImage(withRequestSignal(client, signal));
        expect(calls).toEqual([
            { path: '/files', token: 'first-token', signal },
            { path: '/products', token: 'first-token', signal },
        ]);
    });

    test(`stops saving or cleaning up a rich-text upload after the session changes ${mode}`, async () => {
        const { client, calls } = mockSite('/files');
        const scoped = withRequestSignal(client, withSignal ? new AbortController().signal : undefined);
        await expect(createWithImage(scoped)).rejects.toMatchObject({
            code: 'E_FILE_SESSION_CHANGED', details: { uid: batch, fileIDs: [49] },
        });
        expect(calls.map(call => call.path)).toEqual(['/files', '/users/login']);
    });
}

test('stops a save with an existing batch when the session changes during the Bug prefetch', async () => {
    const { client, calls } = mockSite('/bugs/7');
    const scoped = withRequestSignal(client, new AbortController().signal);
    await expect(request('bug/confirm', { id: 7, uid: batch }, { client: scoped })).rejects.toMatchObject({
        code: 'E_FILE_SESSION_CHANGED', details: { uid: batch, fileIDs: [] },
    });
    expect(calls.map(call => call.path)).toEqual(['/bugs/7', '/users/login']);
});

test('logging in through nested signal scopes updates the shared client and preserves each call signal', async () => {
    const { client, calls } = mockSite();
    const outerSignal = new AbortController().signal;
    const innerSignal = new AbortController().signal;
    const outer = withRequestSignal(client, outerSignal);
    const inner = withRequestSignal(outer, innerSignal);
    expect(await inner.login('second-user', 'test-password')).toBe('second-token');
    await client.get('/products');
    await outer.get('/products');
    await inner.get('/products');
    expect(calls.map(call => call.path)).toEqual(['/users/login', '/products', '/products', '/products']);
    expect(calls.map(call => call.token)).toEqual(['first-token', 'second-token', 'second-token', 'second-token']);
    expect(calls[0].signal).toBe(innerSignal);
    expect(calls[1].signal).toBeUndefined();
    expect(calls[2].signal).toBe(outerSignal);
    expect(calls[3].signal).toBe(innerSignal);
});
