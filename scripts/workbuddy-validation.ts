import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import mcp from '../connectors/workbuddy/mcp.json';
import meta from '../connectors/workbuddy/connector-meta.json';
import schema from '../connectors/workbuddy/token-schema.json';
import emptyConfig from '../connectors/workbuddy/empty-config.json';
import pkg from '../package.json';

export function verifyWorkbuddyConfiguration(configuration = mcp): void {
    assert.equal(meta.type, 'mcp');
    assert.equal(meta.auth_mode, 'token');
    assert.equal(meta.minWorkbuddyVersion, '5.0.0');
    assert.deepEqual(Object.keys(configuration.mcpServers), [meta.source]);
    const server = Object.values(configuration.mcpServers)[0];
    assert.equal(server.type, 'stdio');
    assert.equal(server.command, 'npx');
    assert.deepEqual(server.args.slice(0, 2), ['--yes', `zentao-cli@${pkg.version}`]);
    assert.deepEqual(server.runtime, { type: 'node', version: '22' });
    assert.ok(server.args.includes('--no-input'));
    assert.ok(server.args.includes('--config'));
    for (const argument of server.args) {
        const value = argument.startsWith('--') && argument.includes('=') ? argument.slice(argument.indexOf('=') + 1) : argument;
        assert.ok(!posix.isAbsolute(value) && !win32.isAbsolute(value) && !/^~(?:[/\\]|$)/.test(value),
            'stdio args must not contain host paths; use ${PLUGIN_ROOT} for bundled files');
    }
    assert.equal(server.args[server.args.indexOf('--config') + 1], '${PLUGIN_ROOT}/empty-config.json');
    assert.deepEqual(emptyConfig, { profiles: [] }, 'The bundled fallback must not contain credentials');
    assert.equal(server.args[server.args.indexOf('--transport') + 1], 'stdio');
    assert.ok(server.disabledTools.includes('zentao_switch_profile'));
    assert.equal(new Set(schema.fields.map(field => field.key)).size, schema.fields.length);
    assert.deepEqual(schema.fields.map(field => field.key).sort(), Object.keys(server.env).sort());
    for (const field of schema.fields) {
        const credential = ['ZENTAO_PASSWORD', 'ZENTAO_TOKEN'].includes(field.key);
        assert.equal(field.type, credential ? 'password' : 'text');
        assert.equal(field.required, !credential);
        if (credential) assert.equal(field.defaultValue, '');
        assert.equal(server.env[field.key as keyof typeof server.env], '${' + field.key + '}');
    }
}

/** Resolve the documented native form defaults and env placeholders. */
export function workbuddyEnvironment(values: Record<string, string>): Record<string, string> {
    return Object.fromEntries(schema.fields.map(field => [field.key, values[field.key] ?? field.defaultValue ?? '']));
}

/** Expand the plugin root as WorkBuddy does, replacing only the npm launcher with its installed entry. */
export function workbuddyArguments(entry: string, pluginRoot: string): string[] {
    return [entry, ...Object.values(mcp.mcpServers)[0].args.slice(2).map(argument => argument.replaceAll('${PLUGIN_ROOT}', pluginRoot))];
}

/** Exercise real stdio processes against a local API fixture; never use saved credentials. */
export async function verifyWorkbuddyLifecycle(executable: string, entry: string) {
    verifyWorkbuddyConfiguration();
    const directory = mkdtempSync(join(tmpdir(), 'zentao-workbuddy-validation-'));
    const pluginRoot = join(directory, 'plugin with spaces');
    mkdirSync(pluginRoot);
    const config = join(pluginRoot, 'empty-config.json');
    copyFileSync(new URL('../connectors/workbuddy/empty-config.json', import.meta.url), config);
    const originalConfig = readFileSync(config, 'utf8');
    const unrelated = join(directory, 'ordinary.json');
    const sentinel = 'Existing CLI configuration must not be read or changed';
    writeFileSync(unrelated, sentinel);
    const password = 'fixture-password-never-print';
    const tokens = new Set<string>(['fixture-direct-token']);
    const counts = { login: 0, config: 0, products: 0 };
    const checks: string[] = [];
    const durations: Record<string, number> = {};
    const active = new Set<Awaited<ReturnType<typeof connect>>>();
    const server = Bun.serve({
        hostname: '127.0.0.1', port: 0,
        async fetch(request) {
            const url = new URL(request.url);
            if (url.searchParams.get('mode') === 'getconfig') {
                counts.config++;
                return Response.json({ version: '22.5' });
            }
            if (url.pathname === '/api.php/v2/users/login') {
                counts.login++;
                const body = await request.json() as { account: string; password: string };
                if (body.account !== 'review' || body.password !== password) return new Response('Unauthorized', { status: 401 });
                // Make concurrent callers overlap so a duplicate login would be observable.
                await Bun.sleep(25);
                const token = `fixture-login-token-${counts.login}`;
                tokens.add(token);
                return Response.json({ status: 'success', token });
            }
            if (!tokens.has(request.headers.get('Token') ?? '')) return new Response('Expired', { status: 401 });
            if (url.pathname === '/api.php/v2/users') return Response.json({ users: [{ id: 1, account: 'review' }] });
            if (url.pathname === '/api.php/v2/products') {
                counts.products++;
                return Response.json({ products: [{ id: 1, name: 'Fixture product' }] });
            }
            return new Response('Not found', { status: 404 });
        },
    });

    async function connect(values: Record<string, string> = {}) {
        const start = performance.now();
        const client = new Client({ name: 'workbuddy-validation', version: '1.0.0' });
        const transport = new StdioClientTransport({
            command: executable, args: workbuddyArguments(entry, pluginRoot), cwd: directory, stderr: 'pipe',
            env: { ...process.env, ...workbuddyEnvironment({ ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'review', ...values }),
                ZENTAO_CONFIG_FILE: unrelated },
        });
        let stderr = '';
        transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
        const connection = {
            client,
            async call(name = 'zentao_product', args: Record<string, unknown> = { action: 'list' }) {
                const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 10_000 }) as CallToolResult;
                assert.ok(!JSON.stringify(result).includes(password), 'Tool responses must not expose passwords');
                assert.ok(!JSON.stringify(result).includes('fixture-login-token-'), 'Tool responses must not expose login tokens');
                assert.ok(!JSON.stringify(result).includes('fixture-direct-token'), 'Tool responses must not expose supplied tokens');
                return result;
            },
            async close() {
                await client.close();
                active.delete(connection);
                assert.ok(!stderr.includes(password) && !stderr.includes('fixture-login-token-') && !stderr.includes('fixture-direct-token'), 'stderr must not expose credentials');
            },
        };
        active.add(connection);
        await client.connect(transport);
        durations.connect = Math.max(durations.connect ?? 0, Math.round(performance.now() - start));
        return connection;
    }
    function success(result: CallToolResult) {
        assert.notEqual(result.isError, true, JSON.stringify(result));
        assert.deepEqual(result.structuredContent?.data, [{ id: 1, name: 'Fixture product' }]);
    }
    function failure(result: CallToolResult, code: string) {
        assert.equal(result.isError, true);
        assert.equal((result.structuredContent?.error as { code: string }).code, code);
    }

    try {
        const empty = await connect();
        const tools = (await empty.client.listTools()).tools.map(tool => tool.name);
        assert.ok(tools.includes('zentao_product') && tools.includes('zentao_profile') && tools.includes('zentao_action_help'));
        assert.notEqual((await empty.call('zentao_action_help', { module: 'product', action: 'list' })).isError, true);
        assert.deepEqual(counts, { login: 0, config: 0, products: 0 });
        failure(await empty.call(), 'E1001');
        await empty.close();
        checks.push('offline-discovery', 'missing-credentials');

        const blank = await connect({ ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_PASSWORD: '', ZENTAO_TOKEN: '' });
        failure(await blank.call(), 'E1006');
        await blank.close();
        checks.push('portable-config-path', 'empty-form-no-profile-fallback');

        const authenticated = await connect({ ZENTAO_PASSWORD: password });
        const started = performance.now();
        for (const result of await Promise.all([authenticated.call(), authenticated.call()])) success(result);
        success(await authenticated.call());
        durations.passwordQueries = Math.round(performance.now() - started);
        assert.deepEqual(counts, { login: 1, config: 1, products: 3 }, 'Reuse one login and server configuration across requests');
        checks.push('password-login', 'concurrent-login-sharing', 'cached-authentication');

        tokens.delete('fixture-login-token-1');
        failure(await authenticated.call(), 'E1004');
        assert.equal(counts.login, 1, 'Expired cached sessions require reconnecting');
        await authenticated.close();
        const reconnected = await connect({ ZENTAO_PASSWORD: password });
        success(await reconnected.call());
        assert.equal(counts.login, 2);
        await reconnected.close();
        checks.push('expired-session', 'password-reconnect');

        const direct = await connect({ ZENTAO_TOKEN: 'fixture-direct-token' });
        success(await direct.call());
        await direct.close();
        const both = await connect({ ZENTAO_PASSWORD: 'wrong-password', ZENTAO_TOKEN: 'fixture-direct-token' });
        success(await both.call());
        assert.equal(counts.login, 2, 'Token authentication must not attempt password login');
        tokens.delete('fixture-direct-token');
        failure(await both.call(), 'E1004');
        assert.equal(counts.login, 2, 'Expired Tokens must not silently fall back to a password');
        await both.close();
        checks.push('direct-token', 'token-precedence', 'expired-token-no-fallback');

        tokens.add('fixture-replacement-token');
        const replaced = await connect({ ZENTAO_TOKEN: 'fixture-replacement-token' });
        success(await replaced.call());
        await replaced.close();
        checks.push('token-reconnect');

        const wrong = await connect({ ZENTAO_PASSWORD: 'wrong-password' });
        failure(await wrong.call(), 'E1004');
        await wrong.close();
        const corrected = await connect({ ZENTAO_PASSWORD: password });
        success(await corrected.call());
        await corrected.close();
        checks.push('invalid-password', 'corrected-password');

        const loginCount = counts.login;
        for (const key of ['ZENTAO_URL', 'ZENTAO_ACCOUNT']) {
            const incomplete = await connect({ ZENTAO_TOKEN: 'fixture-replacement-token', [key]: '' });
            failure(await incomplete.call(), 'E1001');
            await incomplete.close();
        }
        assert.equal(counts.login, loginCount);
        assert.equal(readFileSync(config, 'utf8'), originalConfig);
        assert.equal(readFileSync(unrelated, 'utf8'), sentinel);
        checks.push('incomplete-environment', 'config-isolation', 'credential-redaction');
        return { transport: 'stdio', platform: process.platform, checks, maximumMilliseconds: durations };
    } finally {
        try { await Promise.all([...active].map(connection => connection.close())); }
        finally { server.stop(true); rmSync(directory, { recursive: true, force: true }); }
    }
}
