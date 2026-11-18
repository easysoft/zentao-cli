import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir: string;
let config: string;
let server: ReturnType<typeof Bun.serve>;
let requests: Array<{ path: string; token: string | null; assistant: string | null }>;
const routing = { version: '23.0', requestType: 'GET', requestFix: '-', moduleVar: 'm', methodVar: 'f', viewVar: 't' };
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zentao-page-links-'));
    config = join(dir, 'config.json');
    writeFileSync(config, '{}');
    requests = [];
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        requests.push({ path: url.pathname + url.search, token: req.headers.get('Token'), assistant: req.headers.get('ZenTao-Action-Assistant') });
        if (url.pathname.startsWith('/slow/')) await Bun.sleep(200);
        return Response.json(routing);
    } });
});
afterEach(() => { server.stop(true); rmSync(dir, { recursive: true, force: true }); });

async function run(args: string[], environmentSite = '') {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--config', config, ...args], {
        env: { ...process.env, ZENTAO_URL: environmentSite, ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '' },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code, stdout, stderr };
}

test('CLI uses saved routing offline and returns copyable URLs or structured JSON', async () => {
    const current = server.url.origin + '/pms';
    const other = server.url.origin + '/other';
    const contents = JSON.stringify({ currentProfile: `test@${current}`, profiles: [
        { account: 'test', server: current, token: 'unused', serverConfig: routing },
        { account: 'alt', server: other, token: 'unused', serverConfig: { ...routing, requestType: 'PATH_INFO2' } },
    ] });
    writeFileSync(config, contents);
    const created = await run(['link', 'create', 'bug', 'view', '--var', 'id=7', '--var=tab=all']);
    expect(created.code, created.stderr).toBe(0);
    expect(created.stdout).toBe(current + '/index.php?m=bug&f=view&id=7&tab=all\n');
    const parsed = await run(['link', 'parse', created.stdout.trim(), '--format=json']);
    expect(JSON.parse(parsed.stdout)).toMatchObject({ ok: true, data: { moduleName: 'bug', methodName: 'view', params: { id: '7', tab: 'all' } } });
    const selected = await run(['--profile=alt', 'link', 'create', 'bug', 'view', '--var=id=7', '--relative', '--format=json'], server.url.href + 'environment');
    expect(JSON.parse(selected.stdout)).toEqual({ ok: true, data: '/other/index.php/bug-view-7.html', meta: {} });
    expect(requests).toEqual([]);
    expect(readFileSync(config, 'utf8')).toBe(contents);
});

test('explicit and environment sites need only anonymous configuration and bypass local profiles', async () => {
    writeFileSync(config, '{broken');
    const site = server.url.origin + '/explicit';
    const environmentSite = server.url.origin + '/environment';
    const explicit = await run(['link', 'create', 'task', 'view', '--server', site, '--var=id=8'], environmentSite);
    expect(explicit.code, explicit.stderr).toBe(0);
    expect(explicit.stdout.trim()).toBe(site + '/index.php?m=task&f=view&id=8');
    const environment = await run(['link', 'create', 'bug', 'view', '--relative'], environmentSite);
    expect(environment.code, environment.stderr).toBe(0);
    expect(environment.stdout.trim()).toBe('/environment/index.php?m=bug&f=view');
    expect(requests).toEqual(['/explicit/?mode=getconfig', '/environment/?mode=getconfig'].map(path => ({ path, token: null, assistant: null })));
    expect(readFileSync(config, 'utf8')).toBe('{broken');
});

test('a legacy profile loads missing route configuration without its token and honours the command deadline', async () => {
    const site = server.url.origin + '/legacy';
    const contents = JSON.stringify({ currentProfile: `user@${site}`, profiles: [
        { server: site, account: 'user', token: 'unused-secret', serverConfig: { version: '22.7' } },
    ] });
    writeFileSync(config, contents);
    const legacy = await run(['link', 'create', 'bug', 'view', '--relative']);
    expect(legacy.code, legacy.stderr).toBe(0);
    expect(legacy.stdout.trim()).toBe('/legacy/index.php?m=bug&f=view');
    expect(requests).toEqual([{ path: '/legacy/?mode=getconfig', token: null, assistant: null }]);
    expect(readFileSync(config, 'utf8')).toBe(contents);
    const stopped = await run(['link', '--server', server.url.origin + '/slow', 'create', 'bug', 'view', '--deadline=60', '--format=json']);
    expect(stopped.code).toBe(1);
    expect(stopped.stdout).toBe('');
    expect(JSON.parse(stopped.stderr).error.code).toBe('5001');
});

test('requires one site source and rejects conflicting explicit selectors before network access', async () => {
    for (const args of [
        ['link', 'create', 'bug', 'view'],
        ['--profile=missing', 'link', 'create', 'bug', 'view', '--server', server.url.href],
    ]) {
        const error = await run([...args, '--format=json']);
        expect(error.code).toBe(2);
        expect(JSON.parse(error.stderr).error.code).toBe('2009');
    }
    expect(requests).toEqual([]);
});
