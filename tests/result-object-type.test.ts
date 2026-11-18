import { expect, test } from 'bun:test';
import { actionContract } from '../src/modules/contract.js';
import { getAction, getModule } from '../src/modules/helper.js';
import { executeModuleCommand } from '../src/modules/executor.js';
import type { ZentaoClient } from '../src/api/index.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';

test('discovery preserves static, dynamic and mixed result declarations', () => {
    const relation = getModule('relation')!;
    expect(actionContract(relation, getAction(relation, 'candidates')!).resultObjectType).toEqual({
        param: 'relatedObjectType', map: { projectdeliverable: 'deliverable' },
    });
    expect(actionContract(relation, getAction(relation, 'list')!).resultObjectType).toBeNull();
    const my = getModule('my')!;
    const bugs = actionContract(my, getAction(my, 'bugs')!);
    expect(bugs.resultObjectType).toBe('bug');
    expect(bugs.defaultFields).toContain('severity');
});

test('paginated lists keep only a common result type and leave non-record rows intact', async () => {
    const first = { id: 1, name: 'First' };
    const cases = [
        { pages: [[first], []], type: 'product', data: [first] },
        { pages: [[first], null], type: undefined, data: [first] },
        { pages: [[first], [2, 'three', null]], type: undefined, data: [first, 2, 'three', null] },
    ];
    for (const { pages, type, data } of cases) {
        let count = 0;
        const client = { getZentaoConfig: async () => ({ version: '23.0' }), request: async () => {
            const products = pages[count++];
            return { products, pager: { pageID: count, recPerPage: 1, recTotal: 2 } };
        } } as unknown as ZentaoClient;
        const result = await executeModuleCommand(client, getModule('product')!, 'list', [], { all: true, recPerPage: '1', format: 'table' }, DEFAULT_CONFIG);
        expect(count).toBe(2);
        expect(result.data).toEqual(data);
        expect(result.resultObjectType).toBe(type);
        if (!type) expect(result.fields).toBeUndefined();
    }
});

test('CLI uses resolved types for compact tables and JSON metadata without extra requests', async () => {
    const bug = { id: 17, title: 'Issue', severity: 2, customField: 'custom value' };
    const user = { id: 4, account: 'tester', realname: 'Test User', dept: 2, role: 'qa', customField: 'custom value' };
    const calls: string[] = [];
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        const url = new URL(req.url);
        if (url.searchParams.has('mode')) return Response.json({ version: '23.0' });
        const path = url.pathname.replace('/api.php/v2', '');
        calls.push(path);
        if (path === '/my/bugs') return Response.json({ bugs: [bug] });
        if (path === '/users') return Response.json({ users: [user] });
        if (path.endsWith('/candidates/user')) return Response.json({ objects: [user] });
        if (path.endsWith('/candidates/projectdeliverable')) return Response.json({ objects: [] });
        if (path.startsWith('/relations/')) return Response.json({ relations: [{ id: 2, sourceKind: 'bug', targetKind: 'story' }] });
        return new Response('aGk=');
    } });
    const run = async (args: string[], format: string) => {
        const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', ...args, `--format=${format}`], {
            env: { ...process.env, ZENTAO_URL: server.url.href, ZENTAO_TOKEN: 'fixture', ZENTAO_ACCOUNT: 'tester', ZENTAO_PASSWORD: '' },
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        });
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
        expect(code, stderr).toBe(0);
        expect(calls.splice(0)).toHaveLength(1);
        return stdout;
    };
    try {
        const bugs = ['my', 'bugs'];
        const compact = await run(bugs, 'table');
        expect(compact).toContain('severity');
        expect(compact).not.toContain('customField');
        expect(await run([...bugs, '--fields=customField'], 'table')).toContain('custom value');
        expect(await run(bugs, 'markdown')).toContain('customField');
        expect(JSON.parse(await run(bugs, 'json'))).toMatchObject({ data: [bug], meta: { resultObjectType: 'bug' } });
        expect(JSON.parse(await run(bugs, 'raw'))).toEqual({ bugs: [bug] });
        const candidates = ['relation', 'candidates', '--object-type=task', '--object-id=1'];
        const people = await run([...candidates, '--related-object-type=user'], 'table');
        expect(people).toContain('account');
        expect(people).toContain('realname');
        expect(people).not.toContain('customField');
        const empty = JSON.parse(await run([...candidates, '--related-object-type=projectdeliverable'], 'json'));
        expect(empty).toMatchObject({ data: [], meta: { resultObjectType: 'deliverable' } });
        const mixed = ['relation', 'list', '--object-type=task', '--object-id=1'];
        expect(await run(mixed, 'table')).toContain('sourceKind');
        expect(JSON.parse(await run(mixed, 'json')).meta).not.toHaveProperty('resultObjectType');
        expect(JSON.parse(await run(['file', 'read', '7', '--stream=1'], 'json'))).toEqual({ ok: true, data: 'aGk=', meta: {} });
    } finally { server.stop(true); }
});
