import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '../src/api/index.js';
import { requestToken } from '../src/auth/token.js';
import { verifySession, revokeSession } from '../src/auth/session.js';
import type { Profile } from '../src/types/index.js';
import { verifyWorkbuddyConfiguration, workbuddyArguments, workbuddyEnvironment } from './workbuddy-validation.js';

// Explicitly run with a test account: bun --env-file=.env.test scripts/verify-workbuddy-live.ts
// Keep disposable tokens outside MCP so every created session can be revoked, even after a failed check.
const site = process.env.ZENTAO_URL, account = process.env.ZENTAO_ACCOUNT, password = process.env.ZENTAO_PASSWORD;
assert(site && account && password, 'Provide the test site, account and password through environment variables.');
verifyWorkbuddyConfiguration();
const artifact = JSON.parse(readFileSync('release/workbuddy-preview/validation.json', 'utf8'));
assert.equal(artifact.transport, 'stdio', 'Validate the stdio connector with build:workbuddy --local first.');
rmSync('release/workbuddy-preview/live-validation.json', { force: true });
assert.equal(createHash('sha256').update(readFileSync('dist/index.js')).digest('hex'), artifact.artifactSha256, 'Validate the current npm artifact with build:workbuddy --local first.');
const node = Bun.which('node')!;
assert.match(Bun.spawnSync([node, '--version']).stdout.toString(), /^v22\./);
const directory = mkdtempSync(join(tmpdir(), 'zentao-workbuddy-live-'));
const config = join(directory, 'empty-config.json');
copyFileSync(new URL('../connectors/workbuddy/empty-config.json', import.meta.url), config);
const originalConfig = readFileSync(config, 'utf8');
const sessions: Profile[] = [];
const records: string[] = [];
const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
let client: Client | undefined;
let stderr = '';

async function token(): Promise<Profile> {
    const value = await requestToken(site!, account!, password!, { timeout: 5000 });
    const now = new Date().toISOString();
    const profile = { server: site!, account: account!, token: value, loginTime: now, lastUsedTime: now };
    sessions.push(profile);
    return profile;
}
async function connect(profile: Profile) {
    client = new Client({ name: 'workbuddy-live-validation', version: '1.0.0' });
    const transport = new StdioClientTransport({
        command: node, args: workbuddyArguments(resolve('bin/zentao.js'), directory), cwd: directory, stderr: 'pipe',
        env: { ...environment, ...workbuddyEnvironment({ ZENTAO_URL: site!, ZENTAO_ACCOUNT: account!, ZENTAO_TOKEN: profile.token }) },
    });
    transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    await client.connect(transport);
}
async function identity(expectedError?: string) {
    const result = await client!.callTool({ name: 'zentao_profile', arguments: {} }, undefined, { timeout: 15_000 }) as CallToolResult;
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(password!) && sessions.every(profile => !serialized.includes(profile.token)), 'MCP response exposed credentials.');
    if (expectedError) {
        assert.equal(result.isError, true);
        assert.equal((result.structuredContent?.error as { code: string }).code, expectedError);
    } else {
        assert.ok(result.isError !== true, 'Live identity query failed; credential-bearing output omitted.');
        assert.ok((result.structuredContent?.data as { account?: string }).account === account, 'Unexpected account.');
    }
}

try {
    const first = await token();
    await connect(first);
    await identity();
    await identity();
    records.push('token-login', 'stdio-identity', 'repeated-query');
    await revokeSession(first, { timeout: 5000 });
    await identity('E1004');
    records.push('expired-token');
    await client!.close();
    client = undefined;
    const fresh = await token();
    await connect(fresh);
    await identity();
    await client!.close();
    client = undefined;
    await verifySession(createClient(site!, fresh.token, { timeout: 5000 }), fresh);
    records.push('replacement-token-reconnect', 'disconnect-does-not-revoke');
    assert.equal(readFileSync(config, 'utf8'), originalConfig, 'MCP must not persist environment credentials.');
    assert.ok(!stderr.includes(password!) && sessions.every(profile => !stderr.includes(profile.token)), 'stderr exposed credentials.');
} finally {
    try { await client?.close(); }
    finally {
        try {
            const cleanup = await Promise.allSettled(sessions.map(profile => revokeSession(profile, { timeout: 5000 })));
            assert.ok(cleanup.every(result => result.status === 'fulfilled'), 'Disposable session revocation failed; live validation is incomplete.');
        } finally { rmSync(directory, { recursive: true, force: true }); }
    }
}
writeFileSync('release/workbuddy-preview/live-validation.json', JSON.stringify({ validatedAt: new Date().toISOString(), cliVersion: artifact.cliVersion,
    artifactSha256: artifact.artifactSha256, transport: 'stdio', platform: process.platform, records, result: 'pass' }, null, 2) + '\n');
console.log('Live stdio Token authentication, read-only identity queries, expiry and reconnect passed; disposable sessions revoked.');
