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
export function resolveAuthSource(profile?: Profile) {
    const env = getEnvCredentials();
    if (!profile && env.url && env.account && (env.token || env.password)) {
        return {
            source: 'environment' as const,
            server: normalizeServerUrl(env.url), account: env.account,
            token: env.token, password: env.password,
        };
    }

    const currentProfile = profile ?? getCurrentProfile();
    if (currentProfile?.token) {
        return {
            source: 'profile' as const,
            server: currentProfile.server, account: currentProfile.account,
            token: currentProfile.token, profile: currentProfile,
        };
    }
    throw new ZentaoError('E1006');
}

/** Resolve credentials first; only environment password authentication requires a login request. */
export async function ensureAuth(options?: { insecure?: boolean; timeout?: number; profile?: Profile }): Promise<AuthContext> {
    const auth = resolveAuthSource(options?.profile);
    if (auth.source === 'environment') {
        const { server, account, token, password } = auth;
        if (token) {
            return {
                client: createClient(server, token, options),
                profile: buildProfile(server, account, token),
            };
        }

        const result = await login(server, account, password!, options);
        return {
            client: result.client,
            profile: buildProfile(server, account, result.token, result.serverConfig, result.user),
        };
    }

    const config = getProfileConfig(auth.profile);
    const clientOpts = {
        insecure: options?.insecure ?? config.insecure,
        timeout: options?.timeout ?? config.timeout,
    };
    return {
        client: createClient(auth.server, auth.token, clientOpts),
        profile: auth.profile,
    };
}
