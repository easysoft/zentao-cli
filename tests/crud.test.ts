import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('CLI command entry points', () => {
    let directory: string;
    let configFile: string;
    let server: ReturnType<typeof Bun.serve>;
    let requests: Array<{ method: string; path: string; query: Record<string, string>; body?: unknown }>;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'zentao-cli-crud-'));
        configFile = join(directory, 'config.json');
        requests = [];
        server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            async fetch(request) {
                const url = new URL(request.url);
                if (url.searchParams.get('mode') === 'getconfig') {
                    return Response.json({ version: '22.7' });
                }
                const path = url.pathname.replace('/api.php/v2', '');
                requests.push({ method: request.method, path, query: Object.fromEntries(url.searchParams),
                    ...(request.method === 'POST' ? { body: await request.json() } : {}) });
                if (path.endsWith('/deliverable-options')) return Response.json({ deliverables: { 3: '开发说明', 8: '验收报告' } });
                if (path.endsWith('/deliverables')) return Response.json({ deliverables: [{ id: 7, name: '开发说明' }], pager: { pageID: 2, recPerPage: 10, recTotal: 21 } });
                return Response.json({
                    status: 'success',
                    product: { id: Number(path.split('/').at(-1)), name: 'Product' },
                    products: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }],
                    bugs: [],
                    rows: [],
                    id: 7,
                    resourceCalendars: { developer: { tasks: [] } },
                });
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

    async function run(args: string[]) {
        const child = Bun.spawn({
            cmd: [process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, '--format=json', ...args],
            env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_PASSWORD: '', ZENTAO_TOKEN: '' },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        return { stdout, stderr, exitCode };
    }

    test('explicit batch IDs are deduplicated and routed in order', async () => {
        const result = await run(['product', 'delete', '--ids=1,2,1', '--yes']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([
            { method: 'DELETE', path: '/products/1' }, { method: 'DELETE', path: '/products/2' },
        ]);
        expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, meta: { success: 2, failed: 0 } });
    });

    test.each([['product', 'delete', '1,2'], ['delete', 'product', '1'], ['do', 'product', 'get', '1'], ['product', '1'], ['ls', 'product']])(
        'removed implicit syntax is rejected before HTTP: %j', async (...args) => {
            const result = await run(args as string[]);
            expect(result.exitCode).toBe(2);
            expect(requests).toEqual([]);
        },
    );

    test.each(['delete', 'get'])('routes one positional target for %s', async action => {
        const result = await run(['product', action, '1', '--yes']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(requests.map(({ path }) => path)).toEqual(['/products/1']);
    });

    test('list separates server page size from local maximum and field selection', async () => {
        const result = await run(['product', 'list', '--page=2', '--page-size=10', '--fields=id', '--max-items=1', '--order-by=id_desc']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout).data).toEqual([{ id: 1 }]);
        expect(requests[0].query).toMatchObject({ pageID: '2', recPerPage: '10', orderBy: 'id_desc' });
    });

    test('scope aliases route scoped list actions', async () => {
        const result = await run(['bug', 'list', '--product=1']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(requests.map(({ path }) => path)).toEqual(['/products/1/bugs']);
    });

    test('get without a target supports schema-typed query options', async () => {
        const result = await run(['resourcecalendar', 'get', '--type=person', '--project-id=1', '--accounts=developer']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout).data).toEqual({ developer: { tasks: [] } });
        expect(requests).toEqual([{ method: 'GET', path: '/resourcecalendars', query: { type: 'person', mode: 'wait', projectID: '1', accounts: 'developer' } }]);
    });

    test('get requires its declared target', async () => {
        const result = await run(['product', 'get']);
        expect(result.exitCode).toBe(2);
        expect(JSON.parse(result.stderr).error.code).toBe('2003');
        expect(requests).toEqual([]);
    });

    test('request bodies preserve numeric arrays and explicit false SQL count', async () => {
        const repo = { space: 10, product: [12, 13], name: 'demo_repo' };
        expect((await run(['repo', 'create', '--data', JSON.stringify(repo)])).exitCode).toBe(0);
        expect(requests[0]).toMatchObject({ method: 'POST', path: '/repos', body: repo });
        const query = { sql: 'SELECT id, account FROM zt_user', page: 1, limit: 20, count: false };
        const result = await run(['db', 'query', '--data', JSON.stringify(query)]);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(requests[1]).toMatchObject({ method: 'POST', path: '/db/query', body: query });
    });

    test('deliverable options stay an object and list metadata retains its pager', async () => {
        const options = await run(['deliverable', 'options', '--project-id=2']);
        expect(options.exitCode, options.stderr).toBe(0);
        expect(JSON.parse(options.stdout).data).toEqual({ 3: '开发说明', 8: '验收报告' });
        const list = await run(['deliverable', 'list', '--project-id=2', '--browse-type=reviewing', '--page=2', '--page-size=10']);
        expect(list.exitCode, list.stderr).toBe(0);
        expect(JSON.parse(list.stdout)).toMatchObject({ ok: true, data: [{ id: 7, name: '开发说明' }], meta: { page: 2, pageSize: 10, total: 21 } });
        expect(requests[1]).toMatchObject({ path: '/projects/2/deliverables', query: { browseType: 'reviewing', pageID: '2', recPerPage: '10' } });
    });

    test('relation unlink accepts only its relation ID with confirmation', async () => {
        for (const args of [['--relation-id=8'], ['8']]) {
            const result = await run(['relation', 'unlink', ...args, '--yes']);
            expect(result.exitCode, result.stderr).toBe(0);
            expect(requests.at(-1)).toEqual({ method: 'DELETE', path: '/relations/8', query: {} });
        }
        expect(requests).toHaveLength(2);
    });

    test.each([['--object-id=42'], ['--id=8'], ['--relation-id=8', '--object-id=42']])('relation unlink rejects unsupported selectors: %j', async (...args) => {
        const result = await run(['relation', 'unlink', ...(args as string[]), '--yes']);
        expect(result.exitCode).toBe(2);
        expect(requests).toEqual([]);
    });

    test('unlink requires a relation ID and explicit deletion confirmation', async () => {
        const missing = await run(['relation', 'unlink', '--yes']);
        expect(missing.exitCode).toBe(2);
        expect(JSON.parse(missing.stderr).error.code).toBe('2003');
        const unconfirmed = await run(['relation', 'unlink', '--relation-id=8']);
        expect(unconfirmed.exitCode).toBe(2);
        expect(JSON.parse(unconfirmed.stderr).error.message).toContain('--yes');
        expect(requests).toEqual([]);
    });
});
