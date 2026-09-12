import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('CLI command entry points', () => {
    let directory: string;
    let configFile: string;
    let server: ReturnType<typeof Bun.serve>;
    let requests: Array<{ method: string; path: string; query: Record<string, string> }>;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'zentao-cli-crud-'));
        configFile = join(directory, 'config.json');
        requests = [];
        server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            fetch(request) {
                const url = new URL(request.url);
                if (url.searchParams.get('mode') === 'getconfig') {
                    return Response.json({ version: '22.5' });
                }
                const path = url.pathname.replace('/api.php/v2', '');
                requests.push({ method: request.method, path, query: Object.fromEntries(url.searchParams) });
                return Response.json({
                    status: 'success',
                    product: { id: Number(path.split('/').at(-1)), name: 'Product' },
                    products: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }],
                    bugs: [],
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

    test.each([
        ['product', 'delete', '1,2'],
        ['delete', 'product', '1,2'],
        ['do', 'product', 'delete', '1,2'],
    ].map(args => ({ args })))('preserves positional batch targets through %j', async ({ args }) => {
        const result = await run([...args, '--id=4,5', '--params={"id":3}', '--yes']);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        expect(requests.map(({ method, path }) => ({ method, path }))).toEqual([
            { method: 'DELETE', path: '/products/1' },
            { method: 'DELETE', path: '/products/2' },
        ]);
        expect(JSON.parse(result.stdout).result.success).toEqual([1, 2]);
    });

    test.each([
        ['product', 'delete', '1'], ['delete', 'product', '1'],
        ['product', 'get', '1'], ['get', 'product', '1'], ['product', '1'],
    ].map(args => ({ args })))('preserves a positional target through %j', async ({ args }) => {
        const result = await run([...args, '--params={"id":3}', '--yes']);
        expect(result.exitCode).toBe(0);
        expect(requests.map(({ path }) => path)).toEqual(['/products/1']);
    });

    test('selects the batch from the final merged parameters', async () => {
        const result = await run(['product', 'delete', '--id=4,5', '--params={"id":"1,2"}', '--yes']);
        expect(result.exitCode).toBe(0);
        expect(requests.map(({ path }) => path)).toEqual(['/products/1', '/products/2']);
        expect(JSON.parse(result.stdout).result.success).toEqual([1, 2]);
    });

    test.each(['ls', 'list'])('%s preserves pagination, processing and dynamic options', async (command) => {
        const options = ['--page=2', '--recPerPage=10', '--pick=id', '--limit=1', '--orderBy=id_desc'];
        const direct = await run(['product', ...options]);
        const directRequests = [...requests];
        requests.length = 0;
        const shortcut = await run([command, 'product', ...options]);

        expect(shortcut).toEqual(direct);
        expect(shortcut.exitCode).toBe(0);
        expect(JSON.parse(shortcut.stdout).data).toEqual([{ id: 1 }]);
        expect(requests).toEqual(directRequests);
        expect(requests[0].query).toMatchObject({ pageID: '2', recPerPage: '10', orderBy: 'id_desc' });
    });

    test('ls passes scope options to scoped list actions', async () => {
        const result = await run(['ls', 'bug', '--product=1']);
        expect(result.exitCode).toBe(0);
        expect(requests.map(({ path }) => path)).toEqual(['/products/1/bugs']);
    });

    test('ls refuses unsupported automatic pagination before requesting a page', async () => {
        const result = await run(['ls', 'product', '--all']);
        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.stderr).error.code).toBe('2009');
        expect(requests).toEqual([]);
    });
});
