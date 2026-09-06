import type { Profile } from '../types/index.js';
import { ZentaoClient, createClient } from '../api/index.js';
import { ZentaoError } from '../errors.js';
import { getCurrentProfile, getProfile, saveProfile, getProfileConfig, buildProfile, normalizeServerUrl } from '../config/store.js';
import { login, getEnvCredentials } from './login.js';

/** 已通过鉴权后的运行时上下文，供命令层发起 API 调用 */
export interface AuthContext {
    client: ZentaoClient;
    profile: Profile;
}

/**
 * An explicitly selected profile overrides all other credential sources.
 * Otherwise, prefer complete environment credentials, then the current saved
 * profile. Throw E1006 when the selected source has no usable credentials.
 */
export async function ensureAuth(options?: { insecure?: boolean; timeout?: number; profile?: Profile }): Promise<AuthContext> {
    const env = getEnvCredentials();
    if (!options?.profile && env.url && env.account && (env.token || env.password)) {
        const server = normalizeServerUrl(env.url);
        const existingProfile = getProfile(env.account, server);
        const config = existingProfile ? getProfileConfig(existingProfile) : undefined;
        const clientOpts = {
            insecure: options?.insecure ?? config?.insecure,
            timeout: options?.timeout ?? config?.timeout,
        };
        if (env.token) {
            const profile = buildProfile(server, env.account, env.token, undefined, undefined, existingProfile);
            saveProfile(profile);
            return {
                client: createClient(server, env.token, clientOpts),
                profile,
            };
        }

        if (env.password) {
            const result = await login(server, env.account, env.password, clientOpts);
            const profile = buildProfile(server, env.account, result.token, result.serverConfig, result.user, existingProfile);
            saveProfile(profile);
            return {
                client: result.client,
                profile,
            };
        }
    }

    const currentProfile = options?.profile ?? getCurrentProfile();
    if (currentProfile?.token) {
        const config = getProfileConfig(currentProfile);
        const clientOpts = {
            insecure: options?.insecure ?? config.insecure,
            timeout: options?.timeout ?? config.timeout,
        };
        currentProfile.lastUsedTime = new Date().toISOString();
        saveProfile(currentProfile);
        return {
            client: createClient(currentProfile.server, currentProfile.token, clientOpts),
            profile: currentProfile,
        };
    }

    throw new ZentaoError('E1006');
}
