import type { Profile } from '../types/index.js';
import { ZentaoClient, createClient } from '../api/index.js';
import { ZentaoError } from '../errors.js';
import { getCurrentProfile, getProfileConfig, buildProfile, normalizeServerUrl } from '../config/store.js';
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
 * Environment credentials never access local profiles, and authentication
 * never persists credentials or changes the saved default profile.
 */
export async function ensureAuth(options?: { insecure?: boolean; timeout?: number; profile?: Profile }): Promise<AuthContext> {
    const env = getEnvCredentials();
    if (!options?.profile && env.url && env.account && (env.token || env.password)) {
        const server = normalizeServerUrl(env.url);
        if (env.token) {
            return {
                client: createClient(server, env.token, options),
                profile: buildProfile(server, env.account, env.token),
            };
        }

        if (env.password) {
            const result = await login(server, env.account, env.password, options);
            return {
                client: result.client,
                profile: buildProfile(server, env.account, result.token, result.serverConfig, result.user),
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
        return {
            client: createClient(currentProfile.server, currentProfile.token, clientOpts),
            profile: currentProfile,
        };
    }

    throw new ZentaoError('E1006');
}
