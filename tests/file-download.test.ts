import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directory: string;
let target: string;
let version: string;
let upstream: (request: Request) => Response;
let calls: string[];
let server: ReturnType<typeof Bun.serve>;

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zentao-download-test-'));
    target = join(directory, 'attachment.bin');
    version = '23.0';
    calls = [];
    upstream = () => new Response(null, { status: 204 });
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
        const url = new URL(request.url);
        calls.push(url.pathname + url.search);
        return url.searchParams.has('mode') ? Response.json({ version }) : upstream(request);
    } });
});
afterEach(() => { server.stop(true); rmSync(directory, { recursive: true, force: true }); });

async function download(identifier = '7', ...flags: string[]) {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--format=json',
        'file', 'read', identifier, '--output', target, ...flags], {
        env: { ...process.env, ZENTAO_URL: server.url.href, ZENTAO_TOKEN: 'download-token', ZENTAO_ACCOUNT: 'tester', ZENTAO_PASSWORD: '' },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { stdout, stderr, code };
}

test('streams chunks before EOF and atomically replaces the target', async () => {
    writeFileSync(target, 'old');
    const first = new Uint8Array(128 * 1024).fill(0xff);
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
    let headers: Headers | undefined;
    upstream = request => {
        headers = request.headers;
        return new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; controller.enqueue(first); } }));
    };
    const pending = download(server.url.href + 'file-download-7.html?session=private-query', '--assistant=test-downloader');
    let stagedBytes = 0;
    for (let attempt = 0; attempt < 300 && stagedBytes < first.length; attempt++) {
        const staged = readdirSync(directory).find(name => name.startsWith('.zentao-download-'));
        if (staged) stagedBytes = statSync(join(directory, staged)).size;
        if (stagedBytes < first.length) await Bun.sleep(10);
    }
    const oldContent = readFileSync(target, 'utf8');
    stream?.enqueue(new Uint8Array([0, 10, 0x80]));
    stream?.close();
    const result = await pending;
    expect(result.code, result.stderr).toBe(0);
    expect(stagedBytes).toBe(first.length);
    expect(oldContent).toBe('old');
    expect(headers?.get('Token')).toBe('download-token');
    expect(headers?.get('ZenTao-Action-Assistant')).toBe('test-downloader');
    expect(calls).toEqual(['/?mode=getconfig', '/api.php/v2/files/7/read?stream=0']);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, data: { path: target, bytes: first.length + 3 }, meta: {} });
    expect(readFileSync(target)).toEqual(Buffer.concat([first, new Uint8Array([0, 10, 0x80])]));
    expect(readdirSync(directory)).toEqual(['attachment.bin']);
});

test('saves an empty attachment and preserves the target on HTTP and version errors', async () => {
    const empty = await download('7', '--stream=0');
    expect(empty.code, empty.stderr).toBe(0);
    expect(statSync(target).size).toBe(0);
    writeFileSync(target, 'old');
    upstream = () => Response.json({ status: 'fail' }, { status: 403 });
    const denied = await download();
    expect(JSON.parse(denied.stderr).error.code).toBe('2006');
    expect(denied.stdout).toBe('');
    version = '22.7';
    calls = [];
    const unsupported = await download();
    expect(JSON.parse(unsupported.stderr).error.code).toBe('2010');
    expect(calls).toEqual(['/?mode=getconfig']);
    expect(readFileSync(target, 'utf8')).toBe('old');
    expect(readdirSync(directory)).toEqual(['attachment.bin']);
});

test.each(['--deadline=500', '--timeout=500'])('cleans a stalled download on %s', async limit => {
    writeFileSync(target, 'old');
    upstream = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32768)); } }));
    const result = await download('7', limit);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).error.code).toBe('5001');
    expect(result.stdout).toBe('');
    expect(calls).toContain('/api.php/v2/files/7/read?stream=0');
    expect(readFileSync(target, 'utf8')).toBe('old');
    expect(readdirSync(directory)).toEqual(['attachment.bin']);
});

test('removes partial data after a broken connection', async () => {
    writeFileSync(target, 'old');
    upstream = () => new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new Uint8Array(32768));
        setTimeout(() => server.stop(true), 40);
    } }));
    const broken = await download('/file-read-7.png');
    expect(broken.code, broken.stdout).toBe(1);
    expect(JSON.parse(broken.stderr).error.code).toBe('1002');
    expect(readFileSync(target, 'utf8')).toBe('old');
    expect(readdirSync(directory)).toEqual(['attachment.bin']);
    expect(calls).toEqual(['/?mode=getconfig', '/api.php/v2/files/7/read?stream=0']);
});

test('reports the destination path when the parent directory is missing', async () => {
    target = join(directory, 'missing', 'attachment.bin');
    const result = await download();
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).error).toMatchObject({ code: '5005', message: expect.stringContaining(target) });
    expect(readdirSync(directory)).toEqual([]);
});

test('rejects incompatible output options before authentication', async () => {
    for (const flag of ['--stream=1', '--ids=7,8', '--format=raw', '--fields=id', '--html-to-markdown', '--batch-fail-fast']) {
        const result = await download('7', flag);
        expect(result.code, flag).toBe(2);
        expect(JSON.parse(result.stderr).error.code).toBe('2009');
    }
    expect(calls).toHaveLength(0);
    expect(readdirSync(directory)).toEqual([]);
});
