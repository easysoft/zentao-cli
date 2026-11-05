import { expect, test } from 'bun:test';
import { createClient } from '../src/api/index';
import { executeModuleCommand } from '../src/modules/executor';
import { getModule } from '../src/modules/helper';
import { DEFAULT_CONFIG } from '../src/config/defaults';
import { login } from '../src/auth/login';

test('CLI executor auto-selects v1, renders Bug steps and maps personal pagination', async () => {
  const paths: string[] = [];
  const server = Bun.serve({ port: 0, fetch(req) {
    const url = new URL(req.url);
    if (url.searchParams.has('mode')) return Response.json({ version: '21.2' });
    paths.push(url.pathname);
    if (url.pathname.endsWith('/user')) return Response.json({ profile: { account: 'fixture-user' }, bug: { total: 1, bugs: [{ id: 7, title: 'Fixture' }] } });
    return Response.json({ id: 7, title: 'Fixture', steps: '<p>Reproduce</p>', status: 'active' });
  } });
  try {
    const client = createClient(server.url.toString(), 'fixture-token', { apiVersion: 'auto' });
    const bug = await executeModuleCommand(client, getModule('bug')!, 'get', ['7'], { format: 'json' }, DEFAULT_CONFIG);
    expect(bug.data).toMatchObject({ id: 7, title: 'Fixture', steps: 'Reproduce' });
    const mine = await executeModuleCommand(client, getModule('my')!, 'bugs', [], { format: 'json', page: '1', recPerPage: '5' }, DEFAULT_CONFIG);
    expect(mine.data).toEqual([{ id: 7, title: 'Fixture' }]);
    expect(mine.pager).toEqual({ recTotal: 1, pageID: 1, recPerPage: 5 });
    expect(paths).toEqual(['/api.php/v1/bugs/7','/api.php/v1/user']);
    await expect(executeModuleCommand(client,getModule('story')!,'getGrades',[],{},DEFAULT_CONFIG)).rejects.toMatchObject({ code: '2009' });
  } finally { server.stop(true); }
});

test('CLI native v1 login posts tokens and verifies the Token with v1 user pagination', async () => {
  const calls: string[] = [];
  const server = Bun.serve({ port: 0, fetch(req) {
    const u = new URL(req.url);
    if (u.searchParams.has('mode')) return Response.json({ version: '21.2' });
    calls.push(u.pathname + u.search);
    if (u.pathname.endsWith('/tokens')) return Response.json({ token: 'fixture-login-token' }, { status: 201 });
    expect(req.headers.get('Token')).toBe('fixture-login-token');
    return Response.json({ users: [{ id: 1, account: 'fixture-user' }] });
  } });
  try {
    const r = await login(server.url.toString(),'fixture-user','fixture-password');
    expect(r.token).toBe('fixture-login-token');
    expect(r.user?.account).toBe('fixture-user');
    expect(calls).toEqual(['/api.php/v1/tokens','/api.php/v1/users?browse=inside&limit=100']);
  } finally { server.stop(true); }
});

test.each(['auto','v1'])('CLI argv --api-version %s reaches a v1 Bug endpoint', async apiVersion => {
  let requested = '';
  const server = Bun.serve({ port: 0, fetch(req) {
    const u = new URL(req.url);
    if (u.searchParams.has('mode')) return Response.json({ version: '21.2' });
    requested = u.pathname;
    return Response.json({ id: 7, title: 'Fixture', steps: '<p>Reproduce</p>' });
  } });
  try {
    const child = Bun.spawn({ cmd: [process.execPath, '--no-env-file', 'src/index.ts','--api-version',apiVersion,'bug','7','--format','json'], env: { ...process.env, ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'fixture-user', ZENTAO_TOKEN: 'fixture-token', ZENTAO_PASSWORD: '' }, stdout: 'pipe', stderr: 'pipe' });
    const [stdout,stderr,code] = await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
    expect(JSON.parse(stdout)).toMatchObject({ id: 7, title: 'Fixture', steps: 'Reproduce' });
    expect(requested).toBe('/api.php/v1/bugs/7');
  } finally { server.stop(true); }
});
