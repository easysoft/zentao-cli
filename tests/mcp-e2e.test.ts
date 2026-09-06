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
                args: ['run', join(repoRoot, 'src/index.ts'), 'mcp'],
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
            args: [join(repoRoot, 'src/index.ts'), '--config', configFile, 'mcp'],
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
});
