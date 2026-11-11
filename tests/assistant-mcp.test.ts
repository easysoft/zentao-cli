import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startMcpHttpServer } from '../src/mcp/http.js';
import { createAuthProvider } from '../src/mcp/server.js';
import { __resetConfigStoreForTests, findProfileByKey, setConfigPath, setProfileConfig } from '../src/config/store.js';
import { getCliVersion } from '../src/utils/version.js';
import { createMcpTestClient } from './mcp-helpers.js';

for (const transport of ['stdio', 'http'] as const) for (const assistant of [undefined, 'AI <startup>', '']) {
    test(`${transport}: per-tool attribution overrides startup=${JSON.stringify(assistant)} without leaking across concurrent calls`, async () => {
        const calls: Array<{ path: string; method: string; marker: string | null }> = [];
        const handler = async (req: Request) => {
            const url = new URL(req.url);
            const marker = req.headers.get('ZenTao-Action-Assistant');
            if (url.searchParams.has('mode')) {
                expect(marker).toBeNull();
                return Response.json({ version: '22.7' });
            }
            calls.push({ path: url.pathname, method: req.method, marker });
            expect(url.searchParams.has('assistant')).toBe(false);
            if (req.method === 'PUT') {
                const body = await req.json();
                expect(body).not.toHaveProperty('assistant');
                expect(body).not.toHaveProperty('actionAssistant');
            }
            await Bun.sleep(url.pathname.endsWith('/2') ? 15 : 1);
            return Response.json({ product: { id: Number(url.pathname.split('/').at(-1)), name: 'Original' },
                users: [{ account: 'audit' }], status: 'success' });
        };
        let client: Client;
        let close: () => Promise<void>;
        if (transport === 'stdio') {
            const fixture = await createMcpTestClient(handler, ['--modules', 'product', '--split-tools',
                ...(assistant === undefined ? [] : ['--assistant', assistant])], assistant === undefined ? 'mcp' : 'mcp serve');
            client = fixture.client;
            close = fixture.close;
        } else {
            const api = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler });
            const http = await startMcpHttpServer({ url: api.url.origin, port: 0, modules: ['product'], splitTools: true, assistant });
            client = new Client({ name: 'assistant-test', version: '1.0.0' });
            await client.connect(new StreamableHTTPClientTransport(http.url, { requestInit: { headers: { token: 'fixture-token' } } }));
            close = async () => { await client.close(); await http.close(); api.stop(true); };
        }
        const expectedDefault = assistant === '' ? null : assistant ?? `AI <zentao-cli ${getCliVersion()}, mcp: ${transport}>`;
        try {
            const { tools } = await client.listTools();
            for (const tool of tools.filter(tool => tool.name !== 'zentao_action_help' && tool.name !== 'zentao_switch_profile')) {
                expect(tool.inputSchema.properties).toHaveProperty('assistant');
                expect(tool.inputSchema.required ?? []).not.toContain('assistant');
            }
            for (const name of ['zentao_product_read', 'zentao_profile']) {
                const result = await client.callTool({ name, arguments: { ...(name.includes('product') ? { action: 'get', id: 1 } : {}), assistant: 'bad\nheader' } });
                expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'E2009' } } });
            }
            expect(calls).toHaveLength(0);
            for (const override of [undefined, 'AI <tool>', '', undefined]) {
                const result = await client.callTool({ name: 'zentao_product_read', arguments: { action: 'get', id: 1, ...(override === undefined ? {} : { assistant: override }) } });
                expect(result.isError).not.toBe(true);
                expect(calls.at(-1)?.marker).toBe(override === '' ? null : override ?? expectedDefault);
            }
            const updates = await Promise.all([2, 3].map(id => client.callTool({ name: 'zentao_product_write',
                arguments: { action: 'update', id, assistant: `AI <call-${id}>`, params: { desc: 'Changed' } } })));
            expect(updates.every(result => !result.isError)).toBe(true);
            for (const id of [2, 3]) expect(calls.filter(call => call.path.endsWith(`/${id}`))).toEqual([
                { path: `/api.php/v2/products/${id}`, method: 'GET', marker: `AI <call-${id}>` },
                { path: `/api.php/v2/products/${id}`, method: 'PUT', marker: `AI <call-${id}>` },
            ]);
            expect(calls).toHaveLength(8);
            await client.callTool({ name: 'zentao_product_read', arguments: { action: 'get', id: 1 } });
            expect(calls.at(-1)?.marker).toBe(expectedDefault);
            if (transport === 'stdio') {
                for (const override of ['AI <profile>', '', undefined]) {
                    const result = await client.callTool({ name: 'zentao_profile', arguments: override === undefined ? {} : { assistant: override } });
                    expect(result.isError).not.toBe(true);
                    expect(calls.at(-1)?.marker).toBe(override === '' ? null : override ?? expectedDefault);
                }
            }
        } finally { await close(); }
    });
}

test('stdio refreshes effective attribution on preference changes and profile switches', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'zentao-assistant-profile-'));
    const file = join(directory, 'config.json');
    const markers: Array<string | null> = [];
    const api = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
        markers.push(req.headers.get('ZenTao-Action-Assistant'));
        return Response.json({ products: [] });
    } });
    writeFileSync(file, JSON.stringify({ profiles: [
        { server: api.url.origin, account: 'alice', token: 'alice-token' },
        { server: api.url.origin, account: 'bob', token: 'bob-token', config: { autoAssistant: false } },
    ] }));
    __resetConfigStoreForTests();
    setConfigPath(file);
    try {
        const provider = createAuthProvider({ profile: 'alice' });
        const first = await provider.getContext();
        await first.client.get('/products');
        expect((await provider.getContext()).client).toBe(first.client);
        setProfileConfig(findProfileByKey('alice')!, 'autoAssistant', false);
        const disabled = await provider.getContext();
        expect(disabled.client).not.toBe(first.client);
        await disabled.client.get('/products');
        setProfileConfig(findProfileByKey('alice')!, 'autoAssistant', undefined);
        await (await provider.getContext()).client.get('/products');
        await (await provider.switchProfile!('bob')).client.get('/products');
        const original = readFileSync(file, 'utf8');
        const overridden = createAuthProvider({ profile: 'bob', assistant: 'AI <override>' });
        await (await overridden.getContext()).client.get('/products');
        expect(markers).toEqual([`AI <zentao-cli ${getCliVersion()}, mcp: stdio>`, null,
            `AI <zentao-cli ${getCliVersion()}, mcp: stdio>`, null, 'AI <override>']);
        expect(readFileSync(file, 'utf8')).toBe(original);
    } finally {
        __resetConfigStoreForTests();
        api.stop(true);
        rmSync(directory, { recursive: true, force: true });
    }
});
