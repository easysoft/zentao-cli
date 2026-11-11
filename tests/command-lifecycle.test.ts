import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { completionCandidates } from '../src/commands/autocomplete.js';
import { createProgram } from '../src/cli.js';

test('completion follows real actions and skips preceding global option values', () => {
    const program = createProgram();
    expect(completionCandidates(program, ['--profile', 'admin', 'bug', 'cr'])).toEqual(['create']);
    expect(completionCandidates(program, ['--format=json', 'bug', 'create', '--ass'])).toEqual(['--assigned-to', '--assistant']);
    for (const flags of [['--assistant', 'AI <codex>'], ['--assistant', ''], ['--assistant=']]) {
        expect(completionCandidates(program, [...flags, 'bug', 'cr'])).toEqual(['create']);
    }
    expect(completionCandidates(program, ['--format', 'j'])).toEqual(['json']);
});
test.each(['deadline', 'interrupt'])('%s cancels authentication and prevents later requests', async (mode) => {
    const dir = mkdtempSync(join(tmpdir(), 'zentao-cancel-'));
    const calls: string[] = [];
    let started!: () => void;
    const firstRequest = new Promise<void>(resolve => { started = resolve; });
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url); calls.push(url.pathname); started();
        await new Promise(resolve => setTimeout(resolve, 300));
        return Response.json(url.pathname.endsWith('/tokens') ? { token: 'token' } : { version: '22.7', users: [{ account: 'test' }] });
    } });
    try {
        const path = join(dir, 'config.json'); writeFileSync(path, '{}');
        const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--config', path, '--format=json', ...(mode === 'deadline' ? ['--deadline=120'] : []), 'product', 'list'], {
            env: { ...process.env, ZENTAO_URL: `http://127.0.0.1:${server.port}`, ZENTAO_ACCOUNT: 'test', ZENTAO_PASSWORD: 'password', ZENTAO_TOKEN: '' },
            stdout: 'pipe', stderr: 'pipe', stdin: 'ignore',
        });
        await firstRequest;
        if (mode === 'interrupt') child.kill('SIGINT');
        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
        expect(code, stderr).toBe(mode === 'interrupt' ? 130 : 1);
        expect(stdout).toBe('');
        expect(JSON.parse(stderr).error.code).toBe(mode === 'interrupt' ? '5003' : '5001');
        expect(calls).toHaveLength(1);
    } finally { server.stop(true); rmSync(dir, { recursive: true, force: true }); }
});

test('deadline cancels explicit stdin without waiting for EOF', async () => {
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', 'product', 'create', '--data=@-', '--deadline=60', '--format=json'], {
        env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_TOKEN: '', ZENTAO_PASSWORD: '' },
        stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stdout).toBe('');
    expect(code).toBe(1);
    expect(JSON.parse(stderr).error.code).toBe('5001');
});

test('interrupting a batch stops subsequent targets and returns cancellation', async () => {
    let started!: () => void;
    const first = new Promise<void>(resolve => { started = resolve; });
    const paths: string[] = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
        const url = new URL(req.url);
        if (url.searchParams.has('mode')) return Response.json({ version: '22.7' });
        paths.push(url.pathname); started();
        await new Promise(resolve => setTimeout(resolve, 300));
        return Response.json({ product: { id: 1 } });
    } });
    try {
        const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', 'product', 'get', '--ids=1,2', '--format=json'], {
            env: { ...process.env, ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'test', ZENTAO_TOKEN: 'token', ZENTAO_PASSWORD: '' },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        await first; child.kill('SIGINT');
        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
        expect(stdout).toBe(''); expect(code).toBe(130);
        expect(JSON.parse(stderr).error.code).toBe('5003');
        expect(paths).toEqual(['/api.php/v2/products/1']);
    } finally { server.stop(true); }
});
