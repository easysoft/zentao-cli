import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, withRequestSignal } from '../src/api/index.js';
import { buildParams } from '../src/modules/args.js';
import { getCliVersion } from '../src/utils/version.js';

const defaultMarker = `ZenTao CLI <zentao-cli ${getCliVersion()}>`;
const customMarker = 'AI <codex 0.164.0, model: gpt-6.1-sol>';
let directory: string;
let configFile: string;
let server: ReturnType<typeof Bun.serve>;
let calls: Array<{ path: string; method: string; assistant: string | null; query: Record<string, string>; body?: unknown }>;
let revoked: boolean;

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'zentao-assistant-'));
    configFile = join(directory, 'config.json');
    calls = [];
    revoked = false;
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        const body = req.headers.get('content-type')?.includes('multipart/form-data')
            ? Object.fromEntries(await req.formData()) : req.method === 'GET' ? undefined : await req.json();
        calls.push({ path: url.pathname, method: req.method, assistant: req.headers.get('ZenTao-Action-Assistant'),
            query: Object.fromEntries(url.searchParams), body });
        if (url.searchParams.has('mode')) return Response.json({ version: '22.7' });
        if (url.pathname.endsWith('/users/login')) return Response.json({ status: 'success', token: 'fixture-token' });
        if (url.pathname.endsWith('/users/logout')) { revoked = true; return Response.json({ status: 'success' }); }
        if (url.pathname.endsWith('/v1/user')) return revoked ? new Response('', { status: 401 }) : Response.json({ profile: { account: 'test' } });
        const pageID = Number(url.searchParams.get('pageID') ?? 1);
        return Response.json({ status: 'success', id: 1, product: { id: 1, name: 'Original', desc: 'Original' },
            users: [{ id: 1, account: 'test' }], products: [{ id: pageID, name: `Product ${pageID}` }],
            pager: { pageID, recPerPage: Number(url.searchParams.get('recPerPage') ?? 20), recTotal: 2 } });
    } });
    writeFileSync(configFile, JSON.stringify({ currentProfile: `test@${server.url.origin}`,
        profiles: [{ server: server.url.origin, account: 'test', token: 'fixture-token' }] }));
});
afterEach(() => { server.stop(true); rmSync(directory, { recursive: true, force: true }); });

async function run(args: string[], env: Record<string, string> = {}) {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, '--format=json', ...args], {
        env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '', ...env },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(exitCode, stderr).toBe(0);
    return JSON.parse(stdout);
}

function expectMarkers(marker: string | null, businessCount: number) {
    const business = calls.filter(call => !('mode' in call.query));
    expect(business).toHaveLength(businessCount);
    expect(business.map(call => call.assistant)).toEqual(Array(businessCount).fill(marker));
    for (const call of calls.filter(call => 'mode' in call.query)) expect(call.assistant).toBeNull();
    for (const call of business) {
        expect(call.query).not.toHaveProperty('assistant');
        expect(call.body ?? {}).not.toHaveProperty('assistant');
        expect(call.body ?? {}).not.toHaveProperty('actionAssistant');
    }
}

test('CLI default, explicit and empty markers never change saved configuration', async () => {
    const original = readFileSync(configFile, 'utf8');
    for (const [args, marker] of [[[], defaultMarker], [['--assistant', customMarker], customMarker],
        [['--assistant', ''], null], [['--assistant='], null], [[], defaultMarker]] as const) {
        calls.length = 0;
        await run(['product', 'list', ...args]);
        expectMarkers(marker, 1);
        expect(calls).toHaveLength(2);
        expect(readFileSync(configFile, 'utf8')).toBe(original);
    }
    expect(buildParams({ assistant: customMarker }, 'list')).not.toHaveProperty('assistant');
});

test('option-like assistant values cannot select configuration or change error formatting', async () => {
    const original = readFileSync(configFile, 'utf8');
    for (const args of [
        ['--assistant', '--config=/private/tmp/not-the-selected-profile.json', '--format=json', 'config', 'path'],
        ['--assistant', '--config', '--format=json', 'config', 'path'],
        ['--assistant', '--format=json', 'unknown'],
        ['--assistant', '--format=raw', '--format=json', 'unknown'],
        ['--assistant', 'bad\nheader', '--format=json', 'product', 'list'],
    ]) {
        const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', ...args], {
            env: { ...process.env, ZENTAO_CONFIG_FILE: configFile, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '' },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
        if (args.at(-1) === 'path') {
            expect(code, err).toBe(0);
            expect(JSON.parse(out).data.path).toBe(configFile);
        } else {
            expect(code).toBe(2);
            expect(out).toBe('');
            if (args[1] === '--format=json') expect(err).toStartWith('Error(E2009):');
            else expect(JSON.parse(err).error.code).toBe('2009');
        }
    }
    expect(calls).toHaveLength(0);
    expect(readFileSync(configFile, 'utf8')).toBe(original);
});

test('profile switch is typed, defaults on, and permits explicit runtime overrides', async () => {
    expect((await run(['config', 'get', 'autoAssistant'])).data).toMatchObject({ value: true, source: 'default' });
    await run(['config', 'set', 'autoAssistant', 'false']);
    expect((await run(['config', 'list'])).data).toContainEqual({ key: 'autoAssistant', value: false, source: 'profile' });
    for (const [args, marker] of [[[], null], [['--assistant', customMarker], customMarker]] as const) {
        calls.length = 0;
        await run([...args, 'product', 'list']);
        expectMarkers(marker, 1);
    }
    expect(JSON.parse(readFileSync(configFile, 'utf8')).profiles[0].config).toEqual({ autoAssistant: false });
    await run(['config', 'unset', 'autoAssistant']);
    calls.length = 0;
    await run(['product', 'list']);
    expectMarkers(defaultMarker, 1);
});

test('invalid markers and invalid profile switches fail before HTTP or persistence', async () => {
    const original = readFileSync(configFile, 'utf8');
    for (const args of [['--assistant', 'AI <中文>', 'product', 'list'], ['--assistant', 'a\nb', 'product', 'list'],
        ['config', 'set', 'autoAssistant', 'yes']]) {
        const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, '--format=json', ...args], {
            env: { ...process.env, ZENTAO_URL: server.url.origin, ZENTAO_ACCOUNT: 'test', ZENTAO_PASSWORD: 'fixture-password', ZENTAO_TOKEN: '' },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
        expect(code).toBe(2);
        expect(out).toBe('');
        expect(JSON.parse(err).error.code).toBe(args[0] === 'config' ? '2004' : '2009');
    }
    expect(calls).toHaveLength(0);
    expect(readFileSync(configFile, 'utf8')).toBe(original);
});

test('batch updates, automatic prefetch, pagination and multipart uploads inherit the marker', async () => {
    await run(['--assistant', customMarker, 'product', 'update', '--ids', '1,2', '--desc', 'Changed']);
    expectMarkers(customMarker, 4);
    expect(calls.filter(call => !('mode' in call.query)).map(call => call.method)).toEqual(['GET', 'PUT', 'GET', 'PUT']);
    expect(calls.filter(call => 'mode' in call.query)).toHaveLength(1);
    calls.length = 0;
    await run(['--assistant', '', 'product', 'list', '--all', '--page-size', '1']);
    expectMarkers(null, 2);
    expect(calls).toHaveLength(3);
    calls.length = 0;
    const file = join(directory, 'attachment.txt');
    writeFileSync(file, 'fixture attachment');
    await run(['--assistant', customMarker, 'file', 'create', '--file', file, '--object-type', 'bug', '--object-id', '1']);
    expectMarkers(customMarker, 1);
    expect(await ((calls.at(-1)!.body as { file: Blob }).file).text()).toBe('fixture attachment');
});

test('environment password login inherits runtime attribution without reading profiles', async () => {
    writeFileSync(configFile, 'invalid config must remain unread');
    await run(['--assistant', customMarker, 'product', 'list'], {
        ZENTAO_URL: server.url.origin, ZENTAO_ACCOUNT: 'test', ZENTAO_PASSWORD: 'fixture-password',
    });
    expectMarkers(customMarker, 3);
    expect(calls).toHaveLength(4);
    expect(readFileSync(configFile, 'utf8')).toBe('invalid config must remain unread');
});

test('MCP installation login uses the CLI marker without persisting it', async () => {
    const original = readFileSync(configFile, 'utf8');
    for (const [args, marker] of [[[], defaultMarker], [['--assistant', customMarker], customMarker], [['--assistant='], null]] as const) {
        calls.length = 0;
        const result = await run([...args, 'mcp', 'install', 'cherry-studio'], {
            ZENTAO_URL: server.url.origin, ZENTAO_ACCOUNT: 'test', ZENTAO_PASSWORD: 'fixture-password',
        });
        expectMarkers(marker, 2);
        expect(calls).toHaveLength(3);
        expect(result.data[0].manual.args).toEqual(['mcp', 'serve']);
        expect(readFileSync(configFile, 'utf8')).toBe(original);
    }
});

test('explicit login, temporary tokens, verification and revocation carry their effective markers', async () => {
    await run(['--assistant', customMarker, 'auth', 'login', '--server', server.url.origin, '--user', 'test', '--password', 'fixture-password']);
    expectMarkers(customMarker, 2);
    expect(readFileSync(configFile, 'utf8')).not.toContain(customMarker);
    calls.length = 0;
    await run(['--assistant=', 'token', '--server', server.url.origin, '--user', 'test', '--password', 'fixture-password']);
    expectMarkers(null, 1);
    expect(calls).toHaveLength(1);
    calls.length = 0;
    await run(['config', 'set', 'autoAssistant', 'false']);
    await run(['auth', 'status', '--verify']);
    expectMarkers(null, 1);
    calls.length = 0;
    await run(['--assistant', customMarker, 'auth', 'logout', '--revoke']);
    expectMarkers(customMarker, 2);
});

test('SDK object markers and request cancellation wrapper retain per-request precedence', async () => {
    const client = withRequestSignal(createClient(server.url.origin, 'fixture-token', { actionAssistant: { name: 'AI', info: 'fixture' } }), new AbortController().signal);
    await client.get('/products');
    await client.get('/products', { actionAssistant: '' });
    await client.get('/products');
    expect(calls.map(call => call.assistant)).toEqual(['AI <fixture>', null, 'AI <fixture>']);
});
