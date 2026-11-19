import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMcpTestClient } from './mcp-helpers.js';

const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const first = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSb0AAAAASUVORK5CYII=', 'base64');
const second = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP4DwABAQEAG7buVgAAAABJRU5ErkJggg==', 'base64');
const uploadedUrl = '/zentao/read.png?size=full&v=1';
const htmlUrl = uploadedUrl.replace('&', '&amp;');
const create = ['bug', 'create', '--product', '12', '--opened-build', 'trunk', '--title', 'bug title'];
let directory: string, cwd: string, userDirectory: string, oldSteps: string;
let server: ReturnType<typeof Bun.serve>;
const uploads: Array<{ name: string; type: string; bytes: Buffer; uid: string | null; extra: string | null; token: string | null }> = [];
const saves: Array<{ path: string; token: string | null; body: Record<string, string> }> = [];

async function mockApi(req: Request) {
    const url = new URL(req.url);
    if (url.searchParams.has('mode')) return Response.json({ version: '23.0', requestType: 'PATH_INFO', requestFix: '-' });
    const path = url.pathname.replace('/api.php/v2', '');
    const token = req.headers.get('token');
    if (path === '/files' && req.method === 'POST') {
        const form = await req.formData();
        const file = form.get('file') as File;
        uploads.push({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()), token,
            uid: url.searchParams.get('uid'), extra: url.searchParams.get('extra') });
        if (file.name === 'rejected.png') return Response.json({ status: 'fail', message: '文件被拒绝' });
        return Response.json(uploads.length === 1 ? { id: 81, url: uploadedUrl } : { id: 80 + uploads.length });
    }
    if (req.method === 'GET') {
        if (path.startsWith('/bugs/')) return Response.json({ bug: { id: 329, title: 'old', steps: oldSteps } });
        if (path.startsWith('/weeklies/')) return Response.json({ report: { title: 'weekly' } });
        throw new Error('Unexpected GET ' + path);
    }
    saves.push({ path, token, body: await req.json() });
    return Response.json({ status: 'success', id: 329 });
}

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zentao-rich-images-'));
    cwd = join(directory, 'work');
    userDirectory = join(directory, 'user');
    mkdirSync(cwd);
    mkdirSync(join(userDirectory, 'imgs'), { recursive: true });
    writeFileSync(join(cwd, 'screenshot-1.png'), first);
    writeFileSync(join(userDirectory, 'imgs/screenshot-2.png'), second);
    oldSteps = '';
    uploads.length = saves.length = 0;
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: mockApi });
});
afterEach(() => { server.stop(true); rmSync(directory, { recursive: true, force: true }); });

async function run(args: string[], stdin = '') {
    const child = Bun.spawn([process.execPath, '--no-env-file', entry, '--format=json', ...args], {
        cwd, env: { ...process.env, HOME: userDirectory, USERPROFILE: userDirectory, ZENTAO_URL: server.url.href,
            ZENTAO_TOKEN: 'fixture-token', ZENTAO_ACCOUNT: 'tester', ZENTAO_PASSWORD: '' },
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    });
    child.stdin.write(stdin);
    child.stdin.end();
    const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    expect(code, err || out).toBe(0);
    expect(err).toBe('');
    return JSON.parse(out);
}

test('creates a Bug with two editor uploads, retaining HTML, disk names and the shared session', async () => {
    const other = '<a href="file:./manual.pdf">链接</a><!--<img src="file:./missing.png">--><img src="../site.png">';
    const tag1 = '<IMG class="first" SRC = \'file:./screenshot-1.png\' alt="复现截图1">';
    const tag2 = '<img src="file:~/imgs/screenshot-2.png" alt="复现截图2" width="80">';
    await run([...create, '--steps', tag1 + other + tag2]);
    const uid = saves[0].body.uid;
    expect(uid).toBeTruthy();
    expect(uploads).toEqual([
        { name: 'screenshot-1.png', type: 'image/png', bytes: first, uid, token: 'fixture-token', extra: 'editor' },
        { name: 'screenshot-2.png', type: 'image/png', bytes: second, uid, token: 'fixture-token', extra: 'editor' },
    ]);
    expect(saves).toEqual([{ path: '/bugs', token: 'fixture-token', body: expect.objectContaining({
        steps: tag1.replace('file:./screenshot-1.png', htmlUrl) + other + tag2.replace('file:~/imgs/screenshot-2.png', '/file-read-82.png'),
    }) }]);
});

test('uploads inline Markdown images in a Bug update and leaves links and code as authored', async () => {
    const input = '![复现截图1](file:./screenshot-1.png "第一步") [链接](file:./missing.png) `![示例](file:./absent.png)`';
    await run(['bug', 'update', '329', '--markdown', '--steps', input]);
    expect(uploads).toHaveLength(1);
    expect(saves[0].body.steps).toBe('<img src="' + htmlUrl + '" alt="复现截图1" title="第一步"> [链接](file:./missing.png) <code>![示例](file:./absent.png)</code>');
});

test('uses the command cwd for JSON files and shares one upload across fields, spellings and captions', async () => {
    const file = '截 图#100%.png';
    writeFileSync(join(cwd, file), first);
    const json = join(directory, 'input.json');
    writeFileSync(json, JSON.stringify({
        spec: '<img src="file:./' + file + '" alt="第一处"><img src="file:42">',
        verify: '<img src="file:../work/' + file + '" alt="第二处"><img src="' + pathToFileURL(join(cwd, file)).href + '">',
    }));
    await run(['story', 'change', '7', '--data', '@' + json]);
    expect(uploads.map(item => item.name)).toEqual([file]);
    expect(saves[0].body.spec).toBe('<img src="' + htmlUrl + '" alt="第一处"><img src="/file-read-42.png">');
    expect(saves[0].body.verify).toBe('<img src="' + htmlUrl + '" alt="第二处"><img src="' + htmlUrl + '">');
});

test('saves successful images and escaped failure captions, including when every upload fails', async () => {
    const failed = '<img src="file:~/imgs/missing.png" alt="&lt;缺失 &amp; 截图&gt;">';
    const input = '<p>前' + failed + '后</p><img src="file:./screenshot-1.png" alt="正常">';
    const result = await run([...create, '--data', '@-'], JSON.stringify({ steps: input }));
    expect(result.meta.fileWarnings).toEqual([expect.objectContaining({ field: 'steps', stage: 'upload', code: 'E_UPLOAD_FILE_NOT_FOUND' })]);
    expect(saves[0].body.steps).toBe('<p>前图片未上传：&lt;缺失 &amp; 截图&gt;后</p><img src="' + htmlUrl + '" alt="正常">');
    writeFileSync(join(cwd, 'rejected.png'), first);
    const allFailed = await run([...create, '--steps', failed + '<img src="file:./rejected.png" alt=" ">']);
    expect(allFailed.meta.fileWarnings).toHaveLength(2);
    expect(saves[1].body.steps).toBe('图片未上传：&lt;缺失 &amp; 截图&gt;图片未上传：rejected.png');
    expect(allFailed.meta.fileWarnings[1].message).toContain('文件被拒绝');
});

test('keeps fetched HTML unchanged and uses a separate batch for each explicit target', async () => {
    oldSteps = '<img src="' + pathToFileURL(join(cwd, 'screenshot-1.png')).href + '"><img src="file:./screenshot-1.png">';
    await run(['bug', 'update', '329', '--title', 'renamed']);
    expect(uploads).toHaveLength(0);
    expect(saves[0].body.steps).toBe(oldSteps);
    expect(saves[0].body.uid).toBeUndefined();
    await run(['bug', 'update', '--ids', '329,330', '--steps', '<img src="file:./screenshot-1.png">']);
    expect(uploads).toHaveLength(2);
    expect(new Set(uploads.map(item => item.uid)).size).toBe(2);
    expect(saves.slice(1).map(item => item.body.uid)).toEqual(uploads.map(item => item.uid!));
});

test('applies the HTML field contract to documents and weekly reports', async () => {
    const content = '<img src="file:./screenshot-1.png" alt="本周进展">';
    const doc = ['doc', 'create-my-doc', '--space-id=1', '--lib-id=2', '--title=文档', '--content', content];
    await run(doc);
    expect(uploads).toHaveLength(0);
    expect(saves[0].body.content).toBe(content);
    await run([...doc, '--content-type=html']);
    await run(['weekly', 'update', '3', '--content', content]);
    expect(uploads).toHaveLength(2);
    expect(saves[1].body.content).toBe('<img src="' + htmlUrl + '" alt="本周进展">');
    expect(saves[2].body.content).toBe('<img src="/file-read-82.png" alt="本周进展">');
});

test('stdio MCP uploads an explicitly referenced relative image through the same request path', async () => {
    const mcp = await createMcpTestClient(mockApi, ['--modules', 'product']);
    try {
        const src = 'file:../' + basename(directory) + '/work/screenshot-1.png';
        const result = await mcp.client.callTool({ name: 'zentao_product', arguments: { action: 'create',
            params: { data: { name: '产品', desc: '<img src="' + src + '" alt="效果">' } } } });
        expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
        expect(uploads).toHaveLength(1);
        expect(saves[0].body).toMatchObject({ desc: '<img src="' + htmlUrl + '" alt="效果">', uid: uploads[0].uid });
    } finally { await mcp.close(); }
});
