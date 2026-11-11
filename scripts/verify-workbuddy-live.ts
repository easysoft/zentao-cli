import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import cli from '../connectors/workbuddy/cli.json';
import { createClient } from '../src/api/index.js';
import { verifySession, revokeSession } from '../src/auth/session.js';
import type { Profile } from '../src/types/index.js';

// Explicitly run with a test account: bun --env-file=.env.test scripts/verify-workbuddy-live.ts
const site = process.env.ZENTAO_URL, account = process.env.ZENTAO_ACCOUNT, password = process.env.ZENTAO_PASSWORD;
assert(site && account && password, 'Provide the test site, account and password through environment variables.');
const artifact = JSON.parse(readFileSync('release/workbuddy-preview/validation.json', 'utf8'));
rmSync('release/workbuddy-preview/live-validation.json', { force: true });
assert.equal(createHash('sha256').update(readFileSync('dist/index.js')).digest('hex'), artifact.artifactSha256, 'Validate the current npm artifact with build:workbuddy --local first.');
const node = Bun.which('node')!;
assert.match(Bun.spawnSync([node, '--version']).stdout.toString(), /^v22\./);
const directory = mkdtempSync(join(tmpdir(), 'zentao-workbuddy-live-'));
const config = join(directory, 'workbuddy.json');
const entry = resolve('bin/zentao.js');
const platform = process.platform as 'darwin' | 'linux' | 'win32';
const environment = { ...process.env, ...cli.env, CI: '1' };
const sessions = new Map<string, Profile>();
const records: Array<{ step: string; milliseconds: number }> = [];
const quote = (text: string) => process.platform === 'win32' ? `"${text}"` : `'${text.replaceAll("'", "'\\''")}'`;

async function run(action: 'auth' | 'status' | 'unAuth', expected: number) {
    const command = cli[action][platform].replace(/^zentao(?:\.cmd)?\s+/, `${quote(node)} ${quote(entry)} `)
        .replace('"~/.config/zentao/workbuddy.json"', quote(config));
    const start = performance.now();
    const child = Bun.spawn(process.platform === 'win32' ? ['cmd.exe', '/d', '/s', '/c', command] : ['/bin/sh', '-c', `exec ${command}`], {
        cwd: directory, env: environment, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    const timer = setTimeout(() => child.kill(), 25_000);
    let output = '', submitted = false;
    try {
        const readError = async () => {
            for await (const chunk of child.stderr) {
                output += new TextDecoder().decode(chunk);
                const link = output.match(/http:\/\/127\.0\.0\.1:\d+\/#\w+/)?.[0];
                if (action === 'auth' && link && !submitted) {
                    submitted = true;
                    const url = new URL(link);
                    const response = await fetch(new URL('/login', url), {
                        method: 'POST', keepalive: false,
                        headers: { Origin: url.origin, 'X-Zentao-Login': url.hash.slice(1), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ server: site, account, password }),
                    });
                    assert.equal(response.status, 200, 'Live browser login failed (credentials omitted).');
                    await response.arrayBuffer();
                }
            }
        };
        const [stdout, , code] = await Promise.all([new Response(child.stdout).text(), readError(), child.exited]);
        assert.equal(code, expected, `Unexpected exit code for ${action}; credential-bearing output is deliberately omitted.`);
        assert.ok(!stdout.includes(password!) && !output.includes(password!));
        if (action === 'auth') {
            const profile = JSON.parse(readFileSync(config, 'utf8')).profiles[0];
            sessions.set(profile.token, profile);
        }
        records.push({ step: `${action}:${expected}`, milliseconds: Math.round(performance.now() - start) });
        return stdout;
    } finally { clearTimeout(timer); child.kill(); }
}
try {
    await run('status', 1);
    await run('auth', 0);
    const first = JSON.parse(readFileSync(config, 'utf8')).profiles[0];
    const bytes = readFileSync(config);
    for (let i = 0; i < 2; i++) assert.equal(JSON.parse(await run('status', 0)).data.verified, true);
    assert.deepEqual(readFileSync(config), bytes);
    // Invalidate only the disposable token created above to exercise expiry detection.
    await createClient(site!, first.token).post('/users/logout', {});
    await run('status', 1);
    await run('auth', 0);
    const fresh = JSON.parse(readFileSync(config, 'utf8')).profiles[0];
    await run('status', 0);
    await run('unAuth', 0);
    await assert.rejects(() => verifySession(createClient(site!), fresh), (error: any) => error.code === '1004');
    await run('unAuth', 0);
    await run('status', 1);
} finally {
    if (existsSync(config)) {
        for (const profile of JSON.parse(readFileSync(config, 'utf8')).profiles ?? []) sessions.set(profile.token, profile);
    }
    try {
        for (const profile of sessions.values()) await revokeSession(profile, { timeout: 5000 });
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}
mkdirSync('release/workbuddy-preview', { recursive: true });
writeFileSync('release/workbuddy-preview/live-validation.json', JSON.stringify({ validatedAt: new Date().toISOString(), cliVersion: artifact.cliVersion, artifactSha256: artifact.artifactSha256, platform, records, result: 'pass' }, null, 2) + '\n');
console.log('Live authentication callbacks, status, CLI restart, expiry, reauthentication and remote revocation passed.');
