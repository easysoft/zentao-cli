import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
let dir: string;
let server: ReturnType<typeof Bun.serve>;
let calls: Array<{ path: string; body?: unknown; query: Record<string, string> }>;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zentao-contract-'));
    calls = [];
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), ...(req.method === 'POST' ? { body: await req.json() } : {}) });
        if (url.searchParams.has('mode')) return Response.json({ version: '22.7' });
        return Response.json({ status: 'success', id: 1, products: [], data: [], rows: [], fields: [] });
    } });
    const url = `http://127.0.0.1:${server.port}`;
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ currentProfile: `test@${url}`, profiles: [{ server: url, account: 'test', token: 'test-token' }] }));
});
afterEach(() => { server.stop(true); rmSync(dir, { recursive: true, force: true }); });
async function run(args: string[], stdin = '') {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--config', join(dir, 'config.json'), ...args], {
        env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '' },
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    });
    child.stdin.write(stdin);
    child.stdin.end();
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { stdout, stderr, exitCode };
}
test('typed flags preserve string values and accept space/equal syntax', async () => {
    const result = await run(['product', 'create', '--name', '007', '--desc=true', '--format=json']);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls.at(-1)?.body).toMatchObject({ name: '007', desc: 'true' });
});
test('invalid input and conflicts fail before all HTTP, including authentication', async () => {
    for (const args of [
        ['product', 'list', '--paeg=2'], ['product', 'list', '--page=-2'],
        ['product', 'list', '--params=[]'], ['product', 'create', '--name=x', '--data={broken'],
        ['product', 'create', '--name=x', '--data={"name":"y"}'],
        ['bug', 'list', '--product=1', '--project=2'],
        ['product', 'get', '1', '--product-id=2'],
        ['product', 'create', '--ids=1,2', '--name=x'],
        ['product', 'delete', '--ids=1,x,2', '--yes'],
        ['knowledge', 'search', '--keywords=test', '--lib-ids=1', '--page-size=101'],
        ['knowledge', 'search', '--keywords=test', '--data={"libIDs":["1"]}'],
    ]) {
        const result = await run(args);
        expect(result.exitCode, `${args.join(' ')}: ${result.stderr}`).not.toBe(0);
        expect(calls, args.join(' ')).toHaveLength(0);
    }
});
test('POST query bodies accept explicit stdin and boolean negation', async () => {
    for (const args of [ ['--data=@-'], ['--sql', 'select 1', '--no-count'] ]) {
        const result = await run(['db', 'query', ...args, '--format=json'], '{"sql":"select 1","count":false}');
        expect(result.exitCode, result.stderr).toBe(0);
        expect(calls.at(-1)?.body).toMatchObject({ sql: 'select 1', count: false });
    }
});
test('explicit actions, arbitrary path targets, and repeated typed arrays', async () => {
    const noAction = await run(['product']);
    expect(noAction.stdout).toContain('list');
    expect(calls).toHaveLength(0);
    for (const args of [['get', 'product', '1'], ['product', '1'], ['do', 'bug', 'resolve', '1']]) {
        expect((await run(args)).exitCode).not.toBe(0);
    }
    expect(calls).toHaveLength(0);
    expect((await run(['db', 'table', 'zt_user'])).exitCode).toBe(0);
    expect(calls.at(-1)?.path).toContain('zt_user');
    const result = await run(['knowledge', 'search', '--keywords=a', '--keywords=b', '--lib-ids=1', '--lib-ids=2', '--page=3', '--format=json']);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls.at(-1)?.body).toMatchObject({ keywords: ['a', 'b'], libIDs: [1, 2], pageID: 3 });
});
