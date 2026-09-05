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
        'listTools returns module tools plus profile tools',
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

                expect(tools.length).toBe(MODULES.length + 2);
                const names = new Set(tools.map(t => t.name));
                expect(names.has('zentao_profile')).toBe(true);
                expect(names.has('zentao_switch_profile')).toBe(true);
                for (const mod of MODULES) {
                    expect(names.has(`zentao_${mod.name}`)).toBe(true);
                }
                for (const t of tools) {
                    expect(t.inputSchema).toBeDefined();
                    expect(t.inputSchema?.type).toBe('object');
                }

                const bugTool = tools.find(t => t.name === 'zentao_bug');
                expect(bugTool?.annotations?.readOnlyHint).toBe(false);
                expect(bugTool?.annotations?.destructiveHint).toBe(true);
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
                requests.push({ path: new URL(req.url).pathname, token: req.headers.get('Token') });
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

        try {
            await client.connect(transport);
            expect((await getProduct()).isError).not.toBe(true);
            const switched = await client.callTool({
                name: 'zentao_switch_profile', arguments: { profileKey: 'account-b' },
            });
            expect(switched).toMatchObject({
                content: [{ type: 'text', text: JSON.stringify({ status: 'success', currentProfile: selectedKey }, null, 2) }],
            });
            expect((await getProduct()).isError).not.toBe(true);

            const rejected = await client.callTool({
                name: 'zentao_switch_profile', arguments: { profileKey: 'missing-account' },
            });
            expect(rejected.isError).toBe(true);
            expect((await getProduct()).isError).not.toBe(true);
            expect(requests).toEqual([
                { path: '/a/api.php/v2/products/1', token: 'test-token-a' },
                { path: '/b/api.php/v2/products/1', token: 'test-token-b' },
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
