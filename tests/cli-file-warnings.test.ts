import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let directory: string;
let server: ReturnType<typeof Bun.serve>;
let html: string;
let nextFileID: number;
let waitForSave: boolean;
let saveStarted: () => void;
let saving: Promise<void>;
const success = { status: 'success', id: 1, message: 'saved' };

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zentao-attachment-report-'));
    const present = join(directory, 'image.png');
    writeFileSync(present, 'image fixture');
    html = [present, join(directory, 'missing.png')].map(path => `<img src="${pathToFileURL(path).href}">`).join('');
    nextFileID = 70;
    waitForSave = false;
    saving = new Promise(resolve => { saveStarted = resolve; });
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        if (url.searchParams.has('mode')) return Response.json({ version: '23.0' });
        if (url.pathname.endsWith('/files')) return Response.json({ id: ++nextFileID, url: '/sample.png' });
        if (req.method === 'GET') return Response.json({ product: { id: 1, name: 'Sample' } });
        saveStarted();
        if (waitForSave) await new Promise(resolve => setTimeout(resolve, 200));
        return Response.json(url.pathname.endsWith('/2') ? {} : success);
    } });
});
afterEach(() => { server.stop(true); rmSync(directory, { recursive: true, force: true }); });

function run(format: string, ids?: string) {
    const args = ids ? ['update', `--ids=${ids}`] : ['create', '--name=Sample'];
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', 'product', ...args, '--desc', html, `--format=${format}`], {
        env: { ...process.env, ZENTAO_URL: server.url.href, ZENTAO_TOKEN: 'fixture', ZENTAO_ACCOUNT: 'tester', ZENTAO_PASSWORD: '' },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    return { child, result: Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]) };
}

test.each(['json', 'raw', 'table'])('shows an upload warning once and preserves %s output', async format => {
    const [code, out, err] = await run(format).result;
    expect(code, err).toBe(0);
    if (format === 'json') {
        const result = JSON.parse(out);
        expect(result.meta.fileWarnings).toEqual([expect.objectContaining({ field: 'desc', stage: 'upload', code: 'E_UPLOAD_FILE_NOT_FOUND' })]);
        expect(err).toBe('');
    } else {
        expect(err.match(/附件警告/g)).toHaveLength(1);
        expect(err).toContain('missing.png');
        expect(out).not.toContain('missing.png');
        if (format === 'raw') expect(JSON.parse(out)).toEqual(success);
    }
});

test.each(['json', 'table'])('associates batch warnings and uncertain writes with their targets in %s', async format => {
    const [code, out, err] = await run(format, '1,2').result;
    expect(code).toBe(1);
    if (format === 'json') {
        const { data } = JSON.parse(out);
        expect(data[0]).toMatchObject({ objectID: 1, ok: true, meta: { fileWarnings: [expect.objectContaining({ objectID: 1 })] } });
        expect(data[1]).toMatchObject({ objectID: 2, ok: false, error: { code: '2016', details: {
            uid: expect.any(String), fileIDs: [72], fileWarnings: [expect.objectContaining({ objectID: 2 })],
        } } });
        expect(err).toBe('');
    } else {
        expect(err).toContain('对象 1 附件警告');
        expect(out).toContain('2: Error(E2016)');
        expect(out).toContain('uid=');
        expect(out).toContain('fileIDs=72');
    }
});

test('interrupting a batch save retains the in-flight file IDs and upload UID', async () => {
    waitForSave = true;
    const { child, result } = run('json', '1,2');
    await saving;
    child.kill('SIGINT');
    const [code, out, err] = await result;
    expect(code).toBe(130);
    expect(out).toBe('');
    expect(JSON.parse(err)).toMatchObject({ error: { code: '5003', details: {
        uid: expect.any(String), fileIDs: [71], fileWarnings: [expect.objectContaining({ objectID: 1 })],
    } } });
});
