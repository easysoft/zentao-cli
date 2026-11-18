import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAction, getModule, getModuleActionParams } from '../src/modules/helper.js';
import { prepareCliParams } from '../src/modules/cli-input.js';
import { normalizeToolParams } from '../src/mcp/params.js';

async function run(url: URL, args: string[], token = 'test-token') {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--format=json', ...args], {
        env: { ...process.env, ZENTAO_URL: url.href, ZENTAO_TOKEN: token, ZENTAO_ACCOUNT: 'tester', ZENTAO_PASSWORD: 'test-password' },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code, stdout, stderr };
}

test('CLI binds a pre-uploaded image with the same token and uid', async () => {
    const calls: unknown[] = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '23.0', requestType: 'PATH_INFO', requestFix: '-' });
        const token = req.headers.get('token');
        if (url.pathname.endsWith('/files')) {
            const form = await req.formData();
            calls.push({ path: url.pathname, token, query: Object.fromEntries(url.searchParams), fields: [...form.keys()], file: await (form.get('file') as File).text() });
            return Response.json({ id: 32 });
        }
        calls.push({ path: url.pathname + url.search, token, body: await req.json() });
        return Response.json({ status: 'success', id: 13 });
    } });
    const directory = mkdtempSync(join(tmpdir(), 'zentao-cli-uid-'));
    try {
        const file = join(directory, 'image.png');
        writeFileSync(file, 'fixture');
        const help = await run(server.url, ['help', 'product', 'create']);
        expect(help.code, help.stderr).toBe(0);
        expect(JSON.parse(help.stdout).data.parameters).toContainEqual(expect.objectContaining({ flag: '--uid', name: 'uid', role: 'body', required: false }));
        for (const uid of ['using-flag', 'using_body']) {
            const uploaded = await run(server.url, ['file', 'create', '--file', file, '--uid', uid]);
            expect(uploaded.code, uploaded.stderr).toBe(0);
            const desc = '<img src="file:' + JSON.parse(uploaded.stdout).data.id + '" alt="image.png">';
            const options = uid === 'using-flag' ? ['--uid', uid, '--desc', desc] : ['--data', JSON.stringify({ uid, desc })];
            const saved = await run(server.url, ['product', 'create', '--name=Sample', ...options]);
            expect(saved.code, saved.stderr).toBe(0);
            expect(calls.splice(0)).toEqual([
                { path: '/api.php/v2/files', token: 'test-token', query: { uid, extra: 'editor' }, fields: ['file'], file: 'fixture' },
                { path: '/api.php/v2/products', token: 'test-token', body: expect.objectContaining({ uid, name: 'Sample', desc: expect.stringContaining('/file-read-32.png') }) },
            ]);
        }
    } finally { server.stop(true); rmSync(directory, { recursive: true, force: true }); }
});

test('CLI rejects invalid, conflicting, unsupported and multi-target uids before login', async () => {
    const calls: string[] = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        calls.push(req.url);
        return Response.json({}, { status: 403 });
    } });
    try {
        for (const args of [
            ['file', 'create', '--file=image.png', '--uid=used'],
            ['product', 'create', '--name=Sample', '--uid='],
            ['product', 'create', '--name=Sample', '--uid=one', '--data={"uid":"two"}'],
            ['file', 'update', '12', '--data={"fileName":"image.png","uid":"batch"}'],
            ['product', 'update', '--ids=2,3', '--uid=batch'],
            ['product', 'update', '--ids=2,3', '--data={"uid":"batch"}'],
        ]) {
            const result = await run(server.url, args, '');
            expect(result.code, result.stderr).toBe(2);
            expect(JSON.parse(result.stderr).error).toMatchObject({ code: '2009', message: expect.stringContaining('uid') });
        }
        expect(calls).toEqual([]);
    } finally { server.stop(true); }
});

test('shared uid validation matches SDK values, roles and single-target batch semantics', async () => {
    const product = getModule('product')!;
    const create = getAction(product, 'create')!;
    const update = getAction(product, 'update')!;
    for (const uid of ['', null, 2, '0', '1', 'apiv2', 'used', 'bad uid', 'bad/uid', 'uid\n', 'é']) {
        expect(() => normalizeToolParams(product, create, { params: { name: 'Sample', data: { uid } } })).toThrow();
    }
    const uid = 'Ab-0_1';
    expect(normalizeToolParams(product, create, { params: { name: 'Sample', uid, data: { uid } } }).data).toEqual({ uid });
    expect(await prepareCliParams(product, update, undefined, { ids: '7,07', data: JSON.stringify({ uid }) }, {})).toMatchObject({ data: { uid } });
    expect(getModuleActionParams('file', 'create').filter(p => p.name === 'uid')).toMatchObject([{ role: 'query' }]);
    expect(getModuleActionParams('product', 'update', { roles: ['query'] }).some(p => p.name === 'uid')).toBe(false);
    expect(getModuleActionParams('db', 'query').some(p => p.name === 'uid')).toBe(false);
});
