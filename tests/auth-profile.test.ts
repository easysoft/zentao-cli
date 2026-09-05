import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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

    test('complete environment token overrides current profile without duplicating profiles', async () => {
        const envProfile: Profile = {
            ...mockProfile,
            account: 'env-user',
            token: 'old-env-token',
            config: { timeout: 4321 },
        };
        saveProfile(envProfile);
        saveProfile({
            ...mockProfile,
            server: 'https://current.example.com',
            account: 'current-user',
            token: 'current-token',
        });

        process.env.ZENTAO_URL = `${envProfile.server}/`;
        process.env.ZENTAO_ACCOUNT = envProfile.account;
        process.env.ZENTAO_TOKEN = 'new-env-token';

        const { profile } = await ensureAuth();

        expect(profile.account).toBe(envProfile.account);
        expect(profile.server).toBe(envProfile.server);
        expect(profile.token).toBe('new-env-token');
        expect(profile.config).toEqual(envProfile.config);
        expect(getCurrentProfile()?.account).toBe(envProfile.account);
        expect(getAllProfiles()).toHaveLength(2);
    });
});
