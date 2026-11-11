import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startMcpHttpServer } from '../src/mcp/http.js';
import { createClient } from '../src/api/index.js';

// Run explicitly: bun --env-file=.env.test scripts/verify-live.ts
// This creates disposable objects and retains a small set for manual acceptance.
const site = process.env.ZENTAO_URL?.replace(/\/+$/, '');
const account = process.env.ZENTAO_ACCOUNT;
assert(site && account && (process.env.ZENTAO_PASSWORD || process.env.ZENTAO_TOKEN), 'Provide the complete test environment explicitly.');
const directory = mkdtempSync(join(tmpdir(), 'zentao-live-'));
const config = join(directory, 'config.json');
writeFileSync(config, '{"profiles":[]}');
const entry = resolve('bin/zentao.js');
const nodeExecutable = process.env.ZENTAO_LIVE_NODE ?? 'node';
let testedRuntime = '';
const tag = `CLI_OPT_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const cleanEnv = { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_PASSWORD: '', ZENTAO_TOKEN: '' };
let key = '';
let token = '';
const records: Array<Record<string, unknown>> = [];
const fixtures: Record<string, number> = {};
let serverVersion = '';
const secrets = [process.env.ZENTAO_PASSWORD, process.env.ZENTAO_TOKEN].filter(Boolean) as string[];
function sanitize(value: string): string {
    for (const secret of secrets) value = value.split(secret).join('[redacted]');
    return value.split(directory).join('<run-directory>').split(key || '\0').join('<test-profile>');
}
let commands: string[] = [];
async function cli(args: string[], options: { env?: NodeJS.ProcessEnv; input?: string; code?: number; plain?: boolean; unselected?: boolean } = {}): Promise<any> {
    commands.push(`zentao ${args.map(arg => /^[A-Za-z0-9_./:@=,-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\"'\"'")}'`).join(' ')}`);
    const child = Bun.spawn([nodeExecutable, entry, '--config', config, '--no-input', '--deadline=30000',
        ...(key && !options.unselected ? ['--profile', key] : []), ...(!options.plain ? ['--format=json'] : []), ...args], {
        env: options.env ?? cleanEnv, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    });
    child.stdin.write(options.input ?? '');
    child.stdin.end();
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    assert.equal(code, options.code ?? 0, sanitize(stderr || stdout));
    if (options.plain) return stdout;
    const body = JSON.parse(stdout || stderr);
    if ((options.code ?? 0) === 0) { assert.equal(body.ok, true); assert(Object.hasOwn(body, 'data')); assert(Object.hasOwn(body, 'meta')); }
    return body;
}
async function check(name: string, run: () => Promise<unknown>, requires: string[] = []) {
    commands = [];
    const start = performance.now();
    try {
        if (requires.some(name => !fixtures[name])) throw new Error(`Missing test fixture: ${requires.join(', ')}`);
        const detail = await run();
        records.push({ name, status: 'pass', detail, commands: [...commands], ms: Math.round(performance.now() - start) });
        console.log(`PASS ${name}`);
    } catch (error) {
        const message = sanitize(error instanceof Error ? error.message : String(error));
        records.push({ name, status: 'fail', detail: message.slice(0, 1600), commands: [...commands], ms: Math.round(performance.now() - start) });
        console.log(`FAIL ${name}: ${message.slice(0, 800)}`);
    }
    writeReport();
}
function writeReport() {
    const report = { generatedAt: new Date().toISOString(), tag, environment: 'Configured .env.test', serverVersion,
        runtime: `${testedRuntime} built npm entry`, fixtures, summary: { pass: records.filter(r => r.status === 'pass').length, fail: records.filter(r => r.status === 'fail').length }, records };
    writeFileSync('docs/optimization-live-results.json', sanitize(JSON.stringify(report, null, 2)) + '\n');
}
function id(result: any): number { const value = Number(result.data?.id ?? result.data?.ID); assert(Number.isSafeInteger(value) && value > 0, `Create did not return an ID: ${JSON.stringify(result.data)}`); return value; }
async function status(resource: string, target: number, expected: string) { const result = await cli([resource, 'get', String(target)]); assert.equal(result.data.status, expected); return expected; }
try {
    await check('Offline version and shared machine help', async () => {
        const version = await cli(['version']); testedRuntime = version.data.runtime;
        const help = await cli(['help', 'knowledge', 'search']);
        assert.equal(help.data.readOnly, true); assert(help.data.requestBody);
        return { version: version.data, bodySearchIsReadOnly: true };
    });
    await check('Password authentication saves without selecting a default', async () => {
        await cli(['auth', 'login', '--use-env'], { env: process.env, unselected: true });
        const saved = JSON.parse(readFileSync(config, 'utf8'));
        assert.equal(saved.currentProfile, undefined); assert.equal(saved.profiles.length, 1);
        token = saved.profiles[0].token; secrets.push(token); key = `${account}@${site}`;
        const client = createClient(site!, token);
        serverVersion = String((await client.getZentaoConfig()).version);
        return { savedProfiles: 1, selected: false, serverVersion };
    });
    if (!token) throw new Error('Authentication failed; dependent live tests cannot run.');
    await check('Profile choice, online verification and environment precedence', async () => {
        await cli(['profile', 'use', key]);
        const verified = await cli(['auth', 'status', '--verify']); assert.equal(verified.data.verified, true);
        const explicit = await cli(['auth', 'status'], { env: { ...cleanEnv, ZENTAO_URL: 'https://incomplete.invalid' } });
        assert.equal(explicit.data.source, 'profile');
        const partial = await cli(['auth', 'status'], { env: { ...cleanEnv, ZENTAO_URL: site }, unselected: true, code: 1 });
        assert.equal(partial.error.code, '1001');
        return { verified: true, explicitOverridesPartialEnvironment: true, partialEnvironmentCode: partial.error.code };
    });
    await check('Config set/get/unset retains identity and exposes source', async () => {
        await cli(['config', 'set', 'timeout', '12345']);
        const value = await cli(['config', 'get', 'timeout']); assert.equal(value.data.value, 12345); assert.equal(value.data.source, 'profile');
        await cli(['config', 'unset', 'timeout']);
        assert.equal((await cli(['config', 'get', 'timeout'])).data.source, 'default');
        return { typedValue: 12345, restoredDefault: true };
    });
    await check('Product create with string and HTML fidelity', async () => {
        fixtures.product = id(await cli(['product', 'create', '--name', tag, '--desc', '<p>007</p><p>true</p>']));
        const read = await cli(['product', 'get', String(fixtures.product)]);
        assert.equal(read.data.name, tag); assert.match(read.data.desc, /<p>007<\/p>/);
        return { id: fixtures.product, htmlPreserved: true };
    });
    await check('Product update autofills its required fields', async () => {
        await cli(['product', 'update', String(fixtures.product), '--desc', '<p>Updated</p>']);
        const read = await cli(['product', 'get', String(fixtures.product)]);
        assert.equal(read.data.name, tag); assert.match(read.data.desc, /Updated/);
        return { id: fixtures.product, namePreserved: true };
    }, ['product']);
    await check('JSON file creates a second product', async () => {
        const path = join(directory, 'body.json'); writeFileSync(path, JSON.stringify({ name: `${tag}_delete`, desc: 'true' }));
        fixtures.deleteProduct = id(await cli(['product', 'create', '--data', `@${path}`]));
        return { id: fixtures.deleteProduct };
    });
    await check('Explicit batch deduplicates and preserves target order', async () => {
        const result = await cli(['product', 'get', '--ids', `${fixtures.product},${fixtures.deleteProduct},${fixtures.product}`]);
        assert.deepEqual(result.data.map((row: any) => row.objectID), [fixtures.product, fixtures.deleteProduct]);
        return result.meta;
    }, ['product', 'deleteProduct']);
    await check('Partial batch failure and fail-fast have per-target results', async () => {
        const result = await cli(['product', 'get', '--ids', `${fixtures.product},2147483647,${fixtures.deleteProduct}`, '--batch-fail-fast'], { code: 1 });
        assert.equal(result.ok, false); assert.equal(result.meta.success, 1); assert.equal(result.meta.failed, 1); assert.equal(result.meta.skipped, 1);
        return result.meta;
    }, ['product', 'deleteProduct']);
    await check('Bug creates support explicit stdin and repeated array flags', async () => {
        fixtures.bug = id(await cli(['bug', 'create', '--data=@-'], { input: JSON.stringify({ productID: fixtures.product, title: `${tag}_bug`, openedBuild: ['trunk'], steps: '<p>001</p>', assignedTo: account }) }));
        fixtures.secondBug = id(await cli(['bug', 'create', '--product', String(fixtures.product), '--title', '007', '--opened-build', 'trunk']));
        assert.equal((await cli(['bug', 'get', String(fixtures.secondBug)])).data.title, '007');
        return { ids: [fixtures.bug, fixtures.secondBug], stringTitle: '007' };
    }, ['product']);
    await check('All pages aggregate before sorting and max-items', async () => {
        const result = await cli(['bug', 'list', '--product', String(fixtures.product), '--all', '--page-size=1', '--sort=id:desc', '--max-items=1', '--fields=id,title']);
        assert.equal(result.data.length, 1); assert.equal(result.data[0].id, fixtures.secondBug);
        assert.equal(result.meta.fetched, 2); assert.equal(result.meta.processingScope, 'all'); assert.equal(result.meta.truncated, true);
        return result.meta;
    }, ['bug', 'secondBug']);
    await check('Filtered empty first page retains hasMore', async () => {
        const result = await cli(['bug', 'list', '--product', String(fixtures.product), '--page-size=1', '--filter=id=2147483647']);
        assert.deepEqual(result.data, []); assert.equal(result.meta.hasMore, true);
        return result.meta;
    }, ['bug', 'secondBug']);
    await check('Table and Markdown render while raw preserves server structure', async () => {
        const args = ['bug', 'list', '--product', String(fixtures.product)];
        const table = await cli([...args, '--format=table'], { plain: true }); assert.match(table, /id/);
        const md = await cli([...args, '--format=markdown'], { plain: true }); assert.match(md, /\|/);
        const raw = JSON.parse(await cli(['bug', 'get', String(fixtures.bug), '--format=raw'], { plain: true }));
        assert(Object.hasOwn(raw, 'bug') || Object.hasOwn(raw, 'id'));
        return { table: true, markdown: true, rawKeys: Object.keys(raw) };
    }, ['bug']);
    await check('Bug resolve, close and activate are confirmed by readback', async () => {
        await cli(['bug', 'resolve', String(fixtures.bug), '--resolution=fixed', '--resolved-build=trunk']); await status('bug', fixtures.bug, 'resolved');
        await cli(['bug', 'close', String(fixtures.bug), '--comment=CLI acceptance']); await status('bug', fixtures.bug, 'closed');
        await cli(['bug', 'activate', String(fixtures.bug), '--opened-build=trunk']); await status('bug', fixtures.bug, 'active');
        return { id: fixtures.bug, transitions: ['resolved', 'closed', 'active'] };
    }, ['bug']);
    await check('Story create and change preserve explicit review status', async () => {
        fixtures.story = id(await cli(['story', 'create', '--product', String(fixtures.product), '--title', `${tag}_story`, '--spec', '<p>Acceptance</p>', '--status=draft']));
        assert.equal((await cli(['story', 'get', String(fixtures.story)])).data.status, 'draft');
        await cli(['story', 'change', String(fixtures.story), '--title', `${tag}_changed`, '--status=active']);
        await status('story', fixtures.story, 'active');
        return { id: fixtures.story, status: 'active' };
    }, ['product']);
    await check('SQL POST body preserves false, strings and literal dotted columns', async () => {
        const result = await cli(['db', 'query', '--data=@-'], { input: JSON.stringify({ sql: "SELECT '007' AS code, 'true' AS flag, 1 AS `a.b`", count: false, page: 1, limit: 1 }) });
        assert.equal(result.data[0].code, '007'); assert.equal(result.data[0].flag, 'true'); assert.equal(result.data[0]['a.b'], 1);
        const table = await cli(['db', 'query', '--sql', 'SELECT 1 AS `a.b`', '--no-count', '--format=table'], { plain: true });
        assert.match(table, /a\.b/); assert.match(table, /1/);
        return { code: '007', flag: 'true', dottedColumn: true };
    });
    await check('Project and execution create with schema-typed arrays', async () => {
        const groups = await cli(['workflowgroup', 'list']);
        const group = groups.data.find((item: any) => item.id && (!item.status || item.status === 'normal' || item.status === 'enabled')) ?? groups.data[0];
        assert(group?.id, 'No project workflow group is available');
        fixtures.workflowGroup = Number(group.id);
        fixtures.project = id(await cli(['project', 'create', '--data', JSON.stringify({ name: `${tag}_project`, model: 'scrum', begin: '2026-10-23', end: '2026-12-31', workflowGroup: fixtures.workflowGroup, products: [String(fixtures.product)] })]));
        fixtures.execution = id(await cli(['execution', 'create', '--project', String(fixtures.project), '--name', `${tag}_execution`, '--begin=2026-10-23', '--end=2026-12-31', '--products', String(fixtures.product)]));
        return { project: fixtures.project, execution: fixtures.execution };
    }, ['product']);
    await check('Task deadline flag coexists with command deadline and autofill', async () => {
        fixtures.task = id(await cli(['task', 'create', '--execution-id', String(fixtures.execution), '--name', `${tag}_task`, '--type=devel', '--estimate=2', '--assigned-to', account!, '--data-deadline=2026-12-20']));
        await cli(['task', 'update', String(fixtures.task), '--desc', 'line1=a\r\nline2=b\r\n', '--data-deadline=2026-12-21']);
        const read = await cli(['task', 'get', String(fixtures.task)]); assert.equal(read.data.deadline, '2026-12-21'); assert.match(read.data.desc, /line2=b/);
        return { id: fixtures.task, deadline: read.data.deadline };
    }, ['execution']);
    await check('Task start, finish and close are confirmed by readback', async () => {
        await cli(['task', 'start', String(fixtures.task), '--real-started=2026-10-23 09:00:00', '--left=2']); await status('task', fixtures.task, 'doing');
        await cli(['task', 'finish', String(fixtures.task), '--current-consumed=2', '--real-started=2026-10-23 09:00:00', '--finished-date=2026-10-23 10:00:00']); await status('task', fixtures.task, 'done');
        await cli(['task', 'close', String(fixtures.task)]); await status('task', fixtures.task, 'closed');
        return { id: fixtures.task, transitions: ['doing', 'done', 'closed'] };
    }, ['task']);
    await check('Document library, document create and update use explicit actions', async () => {
        fixtures.lib = id(await cli(['doc', 'create-product-lib', String(fixtures.product), '--name', `${tag}_library`]));
        fixtures.doc = id(await cli(['doc', 'create-product-doc', '--product-id', String(fixtures.product), '--lib-id', String(fixtures.lib), '--data', JSON.stringify({ title: `${tag}_doc`, content: '# 007\n\ntrue', contentType: 'doc' })]));
        await cli(['doc', 'update-lib', String(fixtures.lib), '--name', `${tag}_library_updated`]);
        assert.equal((await cli(['doc', 'get-lib', String(fixtures.lib)])).data.name, `${tag}_library_updated`);
        return { lib: fixtures.lib, doc: fixtures.doc };
    }, ['product']);
    await check('Multipart file upload uses only the explicit local fixture', async () => {
        const path = join(directory, 'acceptance.txt'); writeFileSync(path, `${tag}\n007\ntrue\n`);
        const result = await cli(['file', 'create', '--file', path, '--object-type=bug', '--object-id', String(fixtures.bug)]);
        return { uploaded: result.data != null, responseKeys: Object.keys(result.data ?? {}) };
    }, ['bug']);
    await check('Discover an accessible published AI knowledge library', async () => {
        const result = await cli(['knowledgelib', 'list', '--page-size=100']);
        assert(Array.isArray(result.data) && result.data.length, 'No published AI knowledge library is available.');
        fixtures.knowledgeLib = Number(result.data[0].id);
        assert(fixtures.knowledgeLib > 0);
        return { available: result.data.length, selectedID: fixtures.knowledgeLib };
    });
    await check('Keyword POST search supports repeated typed arrays and pagination', async () => {
        const result = await cli(['knowledge', 'search', '--keywords', tag, '--keywords=007', '--lib-ids', String(fixtures.knowledgeLib), '--page-size=1']);
        assert(Array.isArray(result.data)); return result.meta;
    }, ['knowledgeLib']);
    await check('Stdio MCP reads live data and classifies POST search as read-only', async () => {
        const mcp = new Client({ name: 'cli-live-acceptance', version: '1.0.0' });
        const transport = new StdioClientTransport({ command: nodeExecutable, args: [entry, '--config', config, '--profile', key, 'mcp', 'serve', '--read-only', '--modules=product,knowledge'], env: cleanEnv });
        try {
            await mcp.connect(transport);
            const list = await mcp.listTools();
            assert(list.tools.some(tool => tool.name === 'zentao_knowledge'));
            const read = await mcp.callTool({ name: 'zentao_product', arguments: { action: 'get', id: fixtures.product } });
            assert(!read.isError, JSON.stringify(read.structuredContent));
            assert.equal(((read.structuredContent as any)?.data)?.id, fixtures.product);
            const search = await mcp.callTool({ name: 'zentao_knowledge', arguments: { action: 'search', params: { keywords: [tag], libIDs: [fixtures.knowledgeLib] } } });
            assert(!search.isError, JSON.stringify(search.structuredContent));
            const invalid = await mcp.callTool({ name: 'zentao_product', arguments: { action: 'create', params: { name: 'forbidden' } } }); assert(invalid.isError);
            return { tools: list.tools.length, productRead: true, keywordSearch: true, writeBlocked: true };
        } finally { await mcp.close(); }
    }, ['product', 'knowledgeLib']);
    await check('HTTP MCP reads live data and hides local file actions', async () => {
        const http = await startMcpHttpServer({ url: site!, port: 0, modules: ['product', 'file'], readOnly: false });
        const mcp = new Client({ name: 'cli-http-acceptance', version: '1.0.0' });
        try {
            await mcp.connect(new StreamableHTTPClientTransport(http.url, { requestInit: { headers: { token } } }));
            const list = await mcp.listTools(); const file = list.tools.find(tool => tool.name === 'zentao_file');
            assert(!(file?.inputSchema.properties?.action as any)?.enum?.includes('create'));
            const read = await mcp.callTool({ name: 'zentao_product', arguments: { action: 'get', id: fixtures.product } });
            assert(!read.isError, JSON.stringify(read.structuredContent)); assert.equal(((read.structuredContent as any)?.data)?.id, fixtures.product);
            return { productRead: true, uploadHidden: true };
        } finally { await mcp.close(); await http.close(); }
    }, ['product']);
    await check('Explicit batch delete removes disposable objects', async () => {
        const result = await cli(['product', 'delete', '--ids', `${fixtures.deleteProduct},${fixtures.deleteProduct}`, '--yes']);
        assert.equal(result.meta.success, 1);
        const read = await cli(['product', 'get', String(fixtures.deleteProduct)], { code: 1 });
        assert.match(read.error.message, /does not exist/);
        return { deleted: fixtures.deleteProduct, deduplicated: true };
    }, ['deleteProduct']);
} finally {
    writeReport(); rmSync(directory, { recursive: true, force: true });
}
if (records.some(record => record.status === 'fail')) process.exitCode = 1;
