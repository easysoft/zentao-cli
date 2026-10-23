import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCliWithoutAuth } from './helpers';

describe('CLI write argument regressions', () => {
    let directory: string;
    let configFile: string;
    let server: ReturnType<typeof Bun.serve>;
    let requests: Array<{ method: string; path: string; query: Record<string, string>; body: Record<string, unknown> }>;
    let task: Record<string, unknown>;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'zentao-cli-write-arguments-'));
        configFile = join(directory, 'config.json');
        requests = [];
        task = { id: 123, name: 'Existing task', type: 'devel', story: 1, deadline: '2026-09-18', desc: 'Old description' };
        server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            async fetch(request) {
                const url = new URL(request.url);
                if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: 'max8.3' });
                const path = url.pathname.replace('/api.php/v2', '');
                const body = request.method === 'GET' ? {} : await request.json() as Record<string, unknown>;
                requests.push({ method: request.method, path, query: Object.fromEntries(url.searchParams), body });
                if (path === '/bugs' && request.method === 'POST') {
                    // Model the reported server variant that only reads productID from the query.
                    const productID = url.searchParams.get('productID');
                    if (!productID) return Response.json({ status: 'fail', message: 'Missing required parameter: productID.' }, { status: 400 });
                    return Response.json({ id: 101, product: Number(productID), title: body.title });
                }
                if (path === '/tasks/123') {
                    if (request.method === 'PUT') task = { ...task, ...body };
                    return Response.json({ task });
                }
                if (/^\/(stories|requirements|epics)(\/7\/change)?$/.test(path)) {
                    return Response.json({ status: 'success', id: 7 });
                }
                return Response.json({ status: 'fail', message: 'Unexpected request' }, { status: 404 });
            },
        });
        const address = `http://127.0.0.1:${server.port}`;
        writeFileSync(configFile, JSON.stringify({
            currentProfile: `test@${address}`,
            profiles: [{ server: address, account: 'test', token: 'test-token' }],
        }));
    });

    afterEach(() => {
        server.stop(true);
        rmSync(directory, { recursive: true, force: true });
    });

    async function run(args: string[], input = '') {
        const child = Bun.spawn({
            cmd: [process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, '--format=json', ...args],
            env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_PASSWORD: '', ZENTAO_TOKEN: '' },
            stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
        });
        child.stdin.write(input);
        child.stdin.end();
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        return { stdout, stderr, exitCode };
    }

    test.each(['story', 'requirement', 'epic'].flatMap(module => ['create', 'change'].map(action => ({ module, action }))))(
        '$module/$action keeps requirement review defaults and explicit statuses', async ({ module, action }) => {
            const base = action === 'create' ? [module, action, '--product-id=1'] : [module, action, '7'];
            const collection = module === 'story' ? 'stories' : `${module}s`;
            const cases: Array<{ args: string[]; input?: string; status: string }> = [
                { args: [], status: 'active' },
                { args: ['--data={"status":"draft"}'], status: 'draft' },
                { args: ['--status=closed'], status: 'closed' },
                { args: ['--reviewer='], status: 'active' },
                { args: ['--data={"reviewer":[" ",""],"status":""}'], status: 'active' },
                { args: ['--reviewer=admin', '--data={"status":"draft"}'], status: 'reviewing' },
            ];
            for (const { args, input, status } of cases) {
                const result = await run([...base, '--title=Review policy regression', ...args], input);
                expect(result.exitCode, result.stderr).toBe(0);
                const sent = requests.at(-1)!;
                expect(sent).toMatchObject({
                    method: action === 'create' ? 'POST' : 'PUT',
                    path: `/${collection}${action === 'change' ? '/7/change' : ''}`,
                    body: { title: 'Review policy regression', status },
                });
                if (status === 'reviewing') {
                    expect(sent.body.reviewer).toEqual(['admin']);
                    expect(sent.body).not.toHaveProperty('needNotReview');
                } else {
                    expect(sent.body.needNotReview).toBe('1');
                }
            }
            expect(requests).toHaveLength(cases.length);
        },
    );

    test.each([
        { label: 'product alias', args: ['--product=77'] },
        { label: 'registered option with a separate value', args: ['--product', '77'] },
        { label: 'canonical productID', args: ['--product-id=77'] },
        { label: 'equivalent product IDs', args: ['--product=077', '--product-id=77'] },
        { label: 'data', args: ['--data={"productID":77}'] },
        { label: 'explicit stdin', args: ['--data=@-'], input: '{"productID":77}' },
    ])('creates a bug with $label and sends matching query/body IDs', async ({ args, input }) => {
        const result = await run(['bug', 'create', ...args, '--title=Regression bug', '--opened-build=trunk'], input);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        expect(requests).toEqual([{
            method: 'POST', path: '/bugs', query: { productID: '77' },
            body: { productID: 77, title: 'Regression bug', openedBuild: ['trunk'] },
        }]);
        expect(JSON.parse(result.stdout).data.product).toBe(77);
    });

    test.each([
        ['create', 'bug'], ['do', 'bug', 'create'],
    ].map(args => ({ args })))('rejects removed root shortcuts through %j', async ({ args }) => {
        const result = await run([...args, '--product=77', '--title=Regression bug', '--opened-build=trunk']);
        expect(result.exitCode).toBe(2);
        expect(requests).toEqual([]);
    });

    test.each([
        { args: ['--product=77', '--data={"productID":88}'] },
        { args: ['--product-id=77', '--data={"productID":88}'] },
        { args: ['--product=77', '--product-id=77', '--data=@-'], input: '{"productID":88}' },
    ])('rejects conflicting body and flag IDs before HTTP: %j', async ({ args, input }) => {
        const result = await run(['bug', 'create', ...args, '--title=Regression bug', '--opened-build=trunk'], input);
        expect(result.exitCode).toBe(2);
        expect(requests).toEqual([]);
    });

    test.each([
        ['--product=77', '--product-id=88'],
        ['--product=77', '--product-id=88', '--data={"productID":99}'],
    ].map(args => ({ args })))('rejects conflicting aliases before sending a write: %j', async ({ args }) => {
        const result = await run(['bug', 'create', ...args, '--title=Regression bug', '--opened-build=trunk']);
        expect(result.exitCode).toBe(2);
        expect(result.stdout + result.stderr).toContain('2009');
        expect(result.stdout + result.stderr).toContain('productID');
        expect(requests).toEqual([]);
    });

    test('still requires a product ID', async () => {
        const result = await run(['bug', 'create', '--title=Regression bug', '--opened-build=trunk']);
        expect(result.exitCode).toBe(2);
        expect(result.stdout + result.stderr).toContain('2003');
        expect(requests).toEqual([]);
    });

    test.each([0, 1, 2])('preserves multiline descriptions at argument position %i and the other updates', async (position) => {
        const desc = '第一行=a\r\n第二行=b\r\n';
        const args = ['--story=1794', '--data-deadline=2026-09-19'];
        args.splice(position, 0, `--desc=${desc}`);
        const result = await run(['task', 'update', '123', ...args]);
        expect(result.exitCode).toBe(0);
        expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([
            { method: 'GET', path: '/tasks/123' }, { method: 'PUT', path: '/tasks/123' },
        ]);
        expect(requests[1].body).toMatchObject({ desc, story: 1794, deadline: '2026-09-19', name: 'Existing task' });
        const readback = await run(['task', 'get', '123', '--format=raw']);
        expect(readback.exitCode).toBe(0);
        expect(JSON.parse(readback.stdout).task).toMatchObject({ desc, story: 1794, deadline: '2026-09-19' });
    });

    test('rejects conflicting JSON descriptions and flat fields', async () => {
        const desc = '第一行\n第二行\n';
        const result = await run(['task', 'update', '123', '--desc=ignored', `--data=${JSON.stringify({ desc, story: 1794, deadline: '2026-09-19' })}`]);
        expect(result.exitCode).toBe(2);
        expect(requests).toEqual([]);
    });

    test('explains the bug create alias in offline help', async () => {
        const result = await runCliWithoutAuth(['bug', 'create', '--help']);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/--product\s+<id>.*productID.*别名/);
    });
});
