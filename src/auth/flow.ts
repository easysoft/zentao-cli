import type { Profile } from '../types/index.js';
import { ZentaoClient } from '../api/client.js';
import { ZentaoError } from '../errors.js';
import { getCurrentProfile, saveProfile, getProfileConfig, profileKey } from '../config/store.js';
import { login, validateToken, getEnvCredentials } from './login.js';

export interface AuthContext {
    client: ZentaoClient;
    profile: Profile;
}

export async function ensureAuth(options?: { insecure?: boolean; timeout?: number }): Promise<AuthContext> {
    // Step 1: Check config file for current profile
    const currentProfile = getCurrentProfile();
    if (currentProfile?.token) {
        const config = getProfileConfig(currentProfile);
        const clientOpts = {
            insecure: options?.insecure ?? config.insecure,
            timeout: options?.timeout ?? config.timeout,
        };

        // Step 3: Validate existing token
        const valid = await validateToken(currentProfile.server, currentProfile.token, clientOpts);
        if (valid) {
            currentProfile.lastUsedTime = new Date().toISOString();
            saveProfile(currentProfile);
            return {
                client: new ZentaoClient(currentProfile.server, currentProfile.token, clientOpts),
                profile: currentProfile,
            };
        }
    }

    // Step 2 & 4: Try env vars
    const env = getEnvCredentials();

    if (env.url && env.account && env.token) {
        const clientOpts = { insecure: options?.insecure, timeout: options?.timeout };
        const valid = await validateToken(env.url, env.token, clientOpts);
        if (valid) {
            const profile = buildProfile(env.url, env.account, env.token);
            saveProfile(profile);
            return {
                client: new ZentaoClient(env.url, env.token, clientOpts),
                profile,
            };
        }
    }

    if (env.url && env.account && env.password) {
        const clientOpts = { insecure: options?.insecure, timeout: options?.timeout };
        const result = await login(env.url, env.account, env.password, clientOpts);
        const profile = buildProfile(env.url, env.account, result.token, result.user);
        saveProfile(profile);
        return {
            client: new ZentaoClient(env.url, result.token, clientOpts),
            profile,
        };
    }

    // Step 5: Cannot authenticate
    throw new ZentaoError('E1006');
}

function buildProfile(server: string, account: string, token: string, user?: Record<string, unknown>): Profile {
    const now = new Date().toISOString();
    return {
        server: server.replace(/\/+$/, ''),
        account,
        token,
        user,
        loginTime: now,
        lastUsedTime: now,
    };
}
