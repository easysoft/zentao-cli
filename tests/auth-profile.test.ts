import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureAuth } from '../src/auth/flow';
import {
    buildProfile,
    getAllProfiles,
    getCurrentProfile,
    getProfile,
    saveProfile,
    setConfigPath,
} from '../src/config/store';
import type { Profile, ServerConfig } from '../src/types/config';
import { mockProfile, resetConfigStore } from './helpers';

const ENV_KEYS = ['ZENTAO_URL', 'ZENTAO_ACCOUNT', 'ZENTAO_PASSWORD', 'ZENTAO_TOKEN'] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const oldServerConfig: ServerConfig = {
    version: '21.0',
    systemMode: 'ALM',
    sprintConcept: 'sprint',
    requestType: 'PATH_INFO',
    requestFix: '-',
    moduleVar: 'm',
    methodVar: 'f',
    viewVar: 't',
    sessionVar: 'sid',
};

const newServerConfig: ServerConfig = { ...oldServerConfig, version: '22.0' };

describe('Profile authentication resolution', () => {
    let tempDir: string;

    beforeEach(() => {
        resetConfigStore();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-auth-profile-'));
        setConfigPath(join(tempDir, 'config.json'));
        for (const key of ENV_KEYS) delete process.env[key];
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            const value = originalEnv[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        resetConfigStore();
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    });

    test('trailing slash lookup preserves fields and fresh server config wins', () => {
        const oldProfile: Profile = {
            ...mockProfile,
            config: { defaultOutputFormat: 'json' },
            serverConfig: oldServerConfig,
        };
        saveProfile({ ...oldProfile, server: `${oldProfile.server}/` });

        const matched = getProfile(oldProfile.account, `${oldProfile.server}///`);
        const rebuilt = buildProfile(
            `${oldProfile.server}/`,
            oldProfile.account,
            'new-token',
            newServerConfig,
            undefined,
            matched,
        );

        expect(rebuilt.server).toBe(oldProfile.server);
        expect(rebuilt.config).toEqual(oldProfile.config);
        expect(rebuilt.serverConfig).toEqual(newServerConfig);
        saveProfile(rebuilt);
        expect(getAllProfiles()).toHaveLength(1);
    });

    test('saved profile authentication works without writing to its read-only directory', async () => {
        saveProfile(mockProfile);
        const configFile = join(tempDir, 'config.json');
        const original = readFileSync(configFile, 'utf8');
        if (process.platform !== 'win32') chmodSync(tempDir, 0o500);

        try {
            const { profile } = await ensureAuth();
            expect(profile).toEqual(mockProfile);
            expect(readFileSync(configFile, 'utf8')).toBe(original);
        } finally {
            if (process.platform !== 'win32') chmodSync(tempDir, 0o700);
        }
    });

    test('explicit profile authentication preserves the saved default and profile timestamps', async () => {
        saveProfile(mockProfile);
        const configFile = join(tempDir, 'config.json');
        const original = readFileSync(configFile, 'utf8');
        const selected = { ...mockProfile, account: 'selected-user' };

        const { profile } = await ensureAuth({ profile: selected });

        expect(profile).toEqual({ ...mockProfile, account: 'selected-user' });
        expect(selected.lastUsedTime).toBe(mockProfile.lastUsedTime);
        expect(readFileSync(configFile, 'utf8')).toBe(original);
    });

    test('complete environment token ignores saved settings without changing local profiles', async () => {
        const envProfile: Profile = {
            ...mockProfile,
            account: 'env-user',
            token: 'old-env-token',
            config: { timeout: 4321 },
            serverConfig: oldServerConfig,
            user: { account: 'env-user', realname: 'Saved User' },
        };
        saveProfile(envProfile);
        saveProfile({
            ...mockProfile,
            server: 'https://current.example.com',
            account: 'current-user',
            token: 'current-token',
        });
        const configFile = join(tempDir, 'config.json');
        const original = readFileSync(configFile, 'utf8');

        process.env.ZENTAO_URL = `${envProfile.server}/`;
        process.env.ZENTAO_ACCOUNT = envProfile.account;
        process.env.ZENTAO_TOKEN = 'new-env-token';
        process.env.ZENTAO_PASSWORD = 'unused-password';

        const { profile } = await ensureAuth();

        expect(profile.account).toBe(envProfile.account);
        expect(profile.server).toBe(envProfile.server);
        expect(profile.token).toBe('new-env-token');
        expect(profile.config).toBeUndefined();
        expect(profile.serverConfig).toBeUndefined();
        expect(profile.user).toBeUndefined();
        expect(getCurrentProfile()?.account).toBe('current-user');
        expect(readFileSync(configFile, 'utf8')).toBe(original);
    });

    test('environment token authentication does not create a local config', async () => {
        process.env.ZENTAO_URL = mockProfile.server;
        process.env.ZENTAO_ACCOUNT = mockProfile.account;
        process.env.ZENTAO_TOKEN = mockProfile.token;

        expect((await ensureAuth()).profile.token).toBe(mockProfile.token);
        expect(existsSync(join(tempDir, 'config.json'))).toBe(false);
    });

    test.each(['token', 'password'])('business CLI uses environment %s despite invalid local config', async (credential) => {
        const configFile = join(tempDir, 'config.json');
        const original = '{ invalid local config';
        writeFileSync(configFile, original);
        let logins = 0;
        const productTokens: Array<string | null> = [];
        const server = Bun.serve({
            hostname: '127.0.0.1', port: 0,
            async fetch(request) {
                const url = new URL(request.url);
                if (url.searchParams.get('mode') === 'getconfig') return Response.json({ version: '22.5' });
                if (url.pathname === '/api.php/v2/users/login') {
                    logins++;
                    expect(await request.json()).toEqual({ account: 'env-user', password: 'test-password' });
                    return Response.json({ status: 'success', token: 'login-token' });
                }
                if (url.pathname === '/api.php/v2/users') return Response.json({ users: [{ account: 'env-user' }] });
                if (url.pathname === '/api.php/v2/products') {
                    productTokens.push(request.headers.get('Token'));
                    return Response.json({ products: [{ id: 1, name: 'Test Product' }] });
                }
                return new Response('Not found', { status: 404 });
            },
        });

        try {
            const child = Bun.spawn({
                cmd: [process.execPath, '--no-env-file', 'src/index.ts', '--config', configFile, '--format=json', 'product'],
                env: {
                    ...process.env,
                    ZENTAO_URL: server.url.toString(),
                    ZENTAO_ACCOUNT: 'env-user',
                    ZENTAO_TOKEN: credential === 'token' ? 'env-token' : '',
                    ZENTAO_PASSWORD: 'test-password',
                },
                stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
            });
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
            ]);
            expect(stderr).toBe('');
            expect(exitCode).toBe(0);
            expect(JSON.parse(stdout).data).toEqual([{ id: 1, name: 'Test Product' }]);
            expect(productTokens).toEqual([credential === 'token' ? 'env-token' : 'login-token']);
            expect(logins).toBe(credential === 'token' ? 0 : 1);
            expect(readFileSync(configFile, 'utf8')).toBe(original);
        } finally {
            server.stop(true);
        }
    });
});
