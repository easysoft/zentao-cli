import { describe, test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getAllModules } from '../src/modules';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = getAllModules();

describe('MCP server (stdio e2e smoke)', () => {
    test(
        'discovers all module actions and provides their parameters without authentication',
        async () => {
            const transport = new StdioClientTransport({
                command: 'bun',
                args: ['--no-env-file', 'run', join(repoRoot, 'src/index.ts'), 'mcp'],
                cwd: repoRoot,
            });

            const client = new Client({ name: 'zentao-cli-e2e', version: '0.0.0' });
            try {
                await client.connect(transport);
                const { tools } = await client.listTools();

                expect(tools.length).toBe(MODULES.length + 3);
                const names = new Set(tools.map(t => t.name));
                expect(names.has('zentao_profile')).toBe(true);
                expect(names.has('zentao_switch_profile')).toBe(true);
                expect(names.has('zentao_action_help')).toBe(true);
                const help = await client.callTool({ name: 'zentao_action_help', arguments: { module: 'doc', action: 'createMyDoc' } });
                expect(help.isError).not.toBe(true);
                const definition = JSON.parse((help.content as Array<{ text: string }>)[0].text);
                expect(definition).toMatchObject({
                    module: 'doc', action: 'createMyDoc', path: '/doc/my/spaces/{spaceID}/libs/{libID}/docs',
                    minVersion: ['22.5', 'biz13.5', 'max8.5', 'ipd5.5'],
                });
                expect(definition.parameters).toEqual(expect.arrayContaining([
                    expect.objectContaining({ name: 'spaceID', role: 'path', required: true }),
                    expect.objectContaining({ name: 'libID', role: 'path', required: true }),
                    expect.objectContaining({ name: 'content', role: 'body', required: true }),
                ]));
                const invalid = await client.callTool({ name: 'zentao_action_help', arguments: { module: 'doc', action: 'missing' } });
                expect(invalid).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining('E2005:') }] });
                for (const mod of MODULES) {
                    expect(names.has(`zentao_${mod.name}`)).toBe(true);
                    const tool = tools.find((tool) => tool.name === `zentao_${mod.name}`)!;
                    const action = tool.inputSchema.properties?.action as { enum: string[]; description: string };
                    expect(action.enum).toEqual(mod.actions.map((action) => action.name));
                    for (const definition of mod.actions) {
                        expect(action.description).toContain(`${definition.name}:`);
                        expect(action.description).toContain(definition.minVersion.join(' / '));
                    }
                }
                for (const t of tools) {
                    expect(t.inputSchema).toBeDefined();
                    expect(t.inputSchema?.type).toBe('object');
                }

                const bugTool = tools.find(t => t.name === 'zentao_bug');
                expect(bugTool?.annotations?.readOnlyHint).toBe(false);
                expect(bugTool?.annotations?.destructiveHint).toBe(true);
                expect(tools.find((tool) => tool.name === 'zentao_my')?.annotations?.readOnlyHint).toBe(true);
            } finally {
                await client.close();
            }
        },
        { timeout: 20_000 },
    );

    test('explicit profile switching overrides environment credentials for subsequent requests', async () => {
        const requests: Array<{ path: string; token: string | null }> = [];
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(req) {
                const url = new URL(req.url);
                requests.push({ path: url.pathname, token: req.headers.get('Token') });
                if (url.searchParams.get('mode') === 'getconfig') {
                    return Response.json({ version: url.pathname === '/a/' ? '22.0' : 'biz13.5' });
                }
                if (url.pathname.endsWith('/storygrades')) {
                    return Response.json({ grades: [{ grade: 1, name: '一级' }] });
                }
                return Response.json({ status: 'success', product: { id: 1, name: 'Test product' } });
            },
        });
        const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-mcp-switch-'));
        const configFile = join(dir, 'config.json');
        const profiles = ['a', 'b'].map((id) => ({
            server: new URL(id, server.url).toString(),
            account: `account-${id}`,
            token: `test-token-${id}`,
            loginTime: '',
            lastUsedTime: '',
        }));
        const selectedKey = `account-b@${profiles[1].server}`;
        writeFileSync(configFile, JSON.stringify({ currentProfile: selectedKey, profiles }));
        const transport = new StdioClientTransport({
            command: process.execPath,
            args: ['--no-env-file', join(repoRoot, 'src/index.ts'), '--config', configFile, 'mcp'],
            cwd: repoRoot,
            env: {
                ...process.env,
                ZENTAO_URL: profiles[0].server,
                ZENTAO_ACCOUNT: profiles[0].account,
                ZENTAO_TOKEN: profiles[0].token,
                ZENTAO_PASSWORD: '',
            },
        });
        const client = new Client({ name: 'zentao-cli-switch-test', version: '0.0.0' });
        const getProduct = () => client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } });
        const getGrades = () => client.callTool({ name: 'zentao_story', arguments: { action: 'getGrades' } });

        try {
            await client.connect(transport);
            expect((await getProduct()).isError).not.toBe(true);
            const unsupported = await getGrades();
            expect(unsupported).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining('E2010:') }] });
            const switched = await client.callTool({
                name: 'zentao_switch_profile', arguments: { profileKey: 'account-b' },
            });
            expect(switched).toMatchObject({
                content: [{ type: 'text', text: JSON.stringify({ status: 'success', currentProfile: selectedKey }, null, 2) }],
            });
            expect((await getProduct()).isError).not.toBe(true);
            expect(await getGrades()).toMatchObject({ content: [{ type: 'text', text: expect.stringContaining('一级') }] });

            const rejected = await client.callTool({
                name: 'zentao_switch_profile', arguments: { profileKey: 'missing-account' },
            });
            expect(rejected.isError).toBe(true);
            expect((await getProduct()).isError).not.toBe(true);
            expect(requests).toEqual([
                { path: '/a/', token: null },
                { path: '/a/api.php/v2/products/1', token: 'test-token-a' },
                { path: '/b/', token: null },
                { path: '/b/api.php/v2/products/1', token: 'test-token-b' },
                { path: '/b/api.php/v2/storygrades', token: 'test-token-b' },
                { path: '/b/api.php/v2/products/1', token: 'test-token-b' },
            ]);
            expect(JSON.parse(readFileSync(configFile, 'utf-8')).currentProfile).toBe(selectedKey);
        } finally {
            await client.close();
            server.stop(true);
            rmSync(dir, { recursive: true, force: true });
        }
    }, { timeout: 20_000 });

    test('follows external profile, token and client option changes without mixing identities', async () => {
        const requests: Array<{ path: string; token: string | null; recPerPage: string | null }> = [];
        let delayProduct = false;
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            async fetch(req) {
                const url = new URL(req.url);
                requests.push({ path: url.pathname, token: req.headers.get('Token'), recPerPage: url.searchParams.get('recPerPage') });
                if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
                const account = url.pathname.startsWith('/a/') ? 'account-a' : 'account-b';
                if (url.pathname.endsWith('/users')) return Response.json({ users: [{ account }] });
                if (url.pathname.endsWith('/products')) return Response.json({ products: [{ id: 1, name: account }] });
                if (delayProduct) await Bun.sleep(200);
                return Response.json({ product: { id: 1, name: account } });
            },
        });
        const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-mcp-external-switch-'));
        const configFile = join(dir, 'config.json');
        const profiles = ['a', 'b'].map((id) => ({
            server: new URL(id, server.url).toString(),
            account: `account-${id}`,
            token: `test-token-${id}`,
            loginTime: '',
            lastUsedTime: '',
            config: { defaultRecPerPage: id === 'a' ? 13 : 27, timeout: 1000, insecure: false },
        }));
        const selectedKey = `account-b@${profiles[1].server}`;
        const writeConfig = () => writeFileSync(configFile, JSON.stringify({ currentProfile: selectedKey, profiles }));
        writeConfig();
        const env = {
            ...process.env,
            ZENTAO_URL: profiles[0].server,
            ZENTAO_ACCOUNT: profiles[0].account,
            ZENTAO_TOKEN: profiles[0].token,
            ZENTAO_PASSWORD: '',
        };
        const transport = new StdioClientTransport({
            command: process.execPath,
            args: ['--no-env-file', join(repoRoot, 'src/index.ts'), '--config', configFile, 'mcp'],
            cwd: dir,
            env,
        });
        const client = new Client({ name: 'zentao-cli-external-switch-test', version: '0.0.0' });
        const getProduct = () => client.callTool({ name: 'zentao_product', arguments: { action: 'get', id: 1 } });
        const getConfigRequestCount = () => requests.filter(({ path }) => path === '/a/' || path === '/b/').length;

        try {
            await client.connect(transport);
            expect(await getProduct()).toMatchObject({ content: [{ text: expect.stringContaining('account-a') }] });
            const switched = Bun.spawnSync({
                cmd: [process.execPath, '--no-env-file', join(repoRoot, 'src/index.ts'), '--config', configFile, 'profile', 'account-b'],
                cwd: dir,
                env,
            });
            expect(switched.exitCode).toBe(0);

            const currentProfile = await client.callTool({ name: 'zentao_profile', arguments: {} });
            expect(currentProfile).toMatchObject({ content: [{ text: JSON.stringify({ account: 'account-b' }, null, 2) }] });
            expect(requests.at(-1)).toMatchObject({ path: '/b/api.php/v2/users', token: 'test-token-b' });
            expect(await getProduct()).toMatchObject({ content: [{ text: expect.stringContaining('account-b') }] });
            expect(requests.at(-1)).toMatchObject({ path: '/b/api.php/v2/products/1', token: 'test-token-b' });

            const configRequests = getConfigRequestCount();
            profiles[1].config.defaultRecPerPage = 31;
            writeConfig();
            expect((await client.callTool({ name: 'zentao_product', arguments: { action: 'list' } })).isError).not.toBe(true);
            expect(requests.at(-1)).toMatchObject({ path: '/b/api.php/v2/products', token: 'test-token-b', recPerPage: '31' });
            expect(getConfigRequestCount()).toBe(configRequests);

            profiles[1].token = 'test-token-b-refreshed';
            writeConfig();
            expect((await getProduct()).isError).not.toBe(true);
            expect(requests.at(-1)).toMatchObject({ path: '/b/api.php/v2/products/1', token: 'test-token-b-refreshed' });

            profiles[1].config.insecure = true;
            writeConfig();
            const beforeInsecureChange = getConfigRequestCount();
            expect((await getProduct()).isError).not.toBe(true);
            expect(getConfigRequestCount()).toBe(beforeInsecureChange + 1);

            delayProduct = true;
            profiles[1].config.timeout = 30;
            writeConfig();
            expect(await getProduct()).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('E5001:') }] });

            const beforeLogout = requests.length;
            writeFileSync(configFile, JSON.stringify({ profiles: [] }));
            expect(await getProduct()).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('E1006:') }] });
            expect(requests).toHaveLength(beforeLogout);
        } finally {
            await client.close();
            server.stop(true);
            rmSync(dir, { recursive: true, force: true });
        }
    }, { timeout: 20_000 });
});
