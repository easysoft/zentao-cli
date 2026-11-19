import { expect, test } from 'bun:test';
import { actionContract } from '../src/modules/contract.js';
import { prepareCliParams } from '../src/modules/cli-input.js';
import { getAction, getModule } from '../src/modules/helper.js';
import { normalizeToolParams } from '../src/mcp/params.js';
import { createMcpTestClient, toolData } from './mcp-helpers.js';

const file = getModule('file')!;
const get = getAction(file, 'get')!;
const gid = 'Zy0+Pz8/eA==';

async function runFile(server: URL, args: readonly string[], token = 'test-token') {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', 'file', ...args, '--format=json'], {
        env: { ...process.env, ZENTAO_URL: server.href, ZENTAO_ACCOUNT: 'test', ZENTAO_TOKEN: token, ZENTAO_PASSWORD: 'fixture-password' },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { stdout, stderr, code };
}

test('CLI sends literal gids from both input forms, including number-like Base64', async () => {
    const paths: string[] = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        const url = new URL(req.url);
        if (url.searchParams.has('mode')) return Response.json({ version: '22.5' });
        paths.push(url.pathname);
        return Response.json({ file: { id: 7 } });
    } });
    try {
        for (const [identifier, flags] of [
            [gid, [gid, '--file-id', gid]], ['//8=', ['//8=']], ['1e03', ['--file-id=1e03']], ['+123', ['+123']], ['7', ['007', '--file-id=7']],
        ] as const) {
            const { stdout, stderr, code } = await runFile(server.url, ['get', ...flags]);
            expect(code, stderr).toBe(0);
            expect(JSON.parse(stdout).data).toEqual({ id: 7 });
            expect(paths.splice(0)).toEqual([`/api.php/v2/files/${encodeURIComponent(identifier)}`]);
        }
    } finally { server.stop(true); }
});

test('CLI file URLs resolve inside the selected installation and make the same requests as an ID', async () => {
    const paths: string[] = [];
    const metadata = { id: 298, title: 'image.png', size: 3 };
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        const url = new URL(req.url);
        paths.push(url.pathname + url.search);
        if (url.searchParams.has('mode')) return Response.json({ version: '23.0' });
        return url.pathname.endsWith('/read') ? new Response(Uint8Array.from([0, 255, 65])) : Response.json({ file: metadata });
    } });
    const site = new URL('zentao/', server.url);
    const link = site.href + 'file-download-298-left.html?session=private-query';
    try {
        for (const action of ['get', 'read']) {
            for (const target of ['298', link, '/sub-path/?module=file&amp;method=read&amp;fileID=298']) {
                const result = await runFile(site, [action, target]);
                expect(result.code, result.stderr).toBe(0);
                expect(JSON.parse(result.stdout).data).toEqual(action === 'get' ? metadata : 'AP9B');
                expect(paths.splice(0)).toEqual(['/zentao/?mode=getconfig', '/zentao/api.php/v2/files/298' + (action === 'read' ? '/read?stream=0' : '')]);
            }
            for (const flags of [
                [link, '--file-id=298'], [link, '--ids=298'], ['https://other.example/file-read-298.png?session=private-query'],
                [new URL('/zentao-old/file-read-298.png', site).href], ['/file-download-0.html'], ['/file-delete-298.html'],
            ]) {
                // With only a password, even an authentication attempt would hit the mock.
                const result = await runFile(site, [action, ...flags], '');
                expect(result.code).toBe(2);
                expect(JSON.parse(result.stderr).error.code).toBe('2009');
                expect(result.stderr).not.toContain('private-query');
                expect(paths).toEqual([]);
            }
        }
    } finally { server.stop(true); }
}, { timeout: 20_000 });

test('CLI requires the new attachment name before login and renames with one PUT', async () => {
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        requests.push({ method: req.method, path: url.pathname + url.search, ...(req.method === 'PUT' ? { body: await req.json() } : {}) });
        if (url.searchParams.has('mode')) return Response.json({ version: '22.5' });
        // This account may rename files without viewing attachment metadata.
        if (req.method !== 'PUT') return Response.json({ status: 'fail' }, { status: 403 });
        return Response.json({ status: 'success' });
    } });
    try {
        const missing = await runFile(server.url, ['update', '7'], '');
        expect(missing.code).toBe(2);
        expect(JSON.parse(missing.stderr).error).toMatchObject({ code: '2003', message: expect.stringContaining('fileName') });
        expect(requests).toEqual([]);

        for (const flags of [['--file-name', 'renamed.txt'], ['--data={"fileName":"renamed.txt"}']]) {
            const result = await runFile(server.url, ['update', '7', ...flags]);
            expect(result.code, result.stderr).toBe(0);
            expect(JSON.parse(result.stdout).ok).toBe(true);
            expect(requests.splice(0)).toEqual([
                { method: 'GET', path: '/?mode=getconfig' },
                { method: 'PUT', path: '/api.php/v2/files/7', body: { fileName: 'renamed.txt' } },
            ]);
        }
    } finally { server.stop(true); }
});

test('MCP exposes both file/get identifier types and preserves gids for SDK routing', async () => {
    const paths: string[] = [];
    const mcp = await createMcpTestClient(req => {
        const url = new URL(req.url);
        if (url.searchParams.has('mode')) return Response.json({ version: '22.5' });
        paths.push(url.pathname);
        return Response.json({ file: { id: 7 } });
    }, ['--modules', 'file']);
    try {
        const help = await mcp.client.callTool({ name: 'zentao_action_help', arguments: { module: 'file', action: 'get' } });
        expect(toolData(help).parameters).toContainEqual(expect.objectContaining({ name: 'fileID', type: ['integer', 'string'] }));
        for (const fileID of [gid, 'aGk', '1e03', '+123', 7, '7']) {
            const result = await mcp.client.callTool({ name: 'zentao_file', arguments: { action: 'get', params: { fileID } } });
            expect(toolData(result)).toEqual({ id: 7 });
            expect(paths.splice(0)).toEqual([`/api.php/v2/files/${encodeURIComponent(fileID)}`]);
        }
    } finally { await mcp.close(); }
});

test('invalid identifiers and conflicting sources stop before transport', async () => {
    for (const url of ['https://[', 'https://example.com/bug-view-42.html', 'https://example.com/file-download-0.html']) {
        const result = prepareCliParams(file, get, url, {}, {}, () => { throw new Error('Unexpected credential lookup'); });
        await expect(result).rejects.toMatchObject({ code: '2009' });
    }
    for (const fileID of ['', ' ', 'abc?', 'a', 'a===', 'abc==', 'NaN%', -1, 7.5, 2 ** 54, null, [], {}]) {
        expect(() => normalizeToolParams(file, get, { params: { fileID } })).toThrow();
    }
    expect(() => normalizeToolParams(file, get, { id: 7, params: { fileID: gid } })).toThrow();
    expect(() => normalizeToolParams(file, get, { id: 7, params: { fileID: [7] } })).toThrow();
    await expect(prepareCliParams(file, get, gid, {}, { fileID: '1e03' })).rejects.toThrow();
    await expect(prepareCliParams(file, get, undefined, { ids: gid }, {})).rejects.toThrow();
    for (const name of ['read', 'update', 'delete']) {
        const action = getAction(file, name)!;
        expect(actionContract(file, action).parameters.find(p => p.name === 'fileID')?.type).toBe('integer');
        expect(() => normalizeToolParams(file, action, { params: { fileID: gid } })).toThrow();
        await expect(prepareCliParams(file, action, gid, {}, {})).rejects.toThrow();
    }
});
