import type { Profile } from '../types/index.js';
import { ZentaoClient, createClient, withRequestSignal } from '../api/index.js';
import { ZentaoError } from '../errors.js';
import { getCurrentProfile, getProfileConfig, buildProfile, normalizeServerUrl, findProfileByKey } from '../config/store.js';
import { commandSignal } from '../utils/lifecycle.js';
import { login, getEnvCredentials } from './login.js';
import { resolveAssistant, type AssistantSource } from '../api/assistant.js';

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
export function resolveAuthSource(profile?: Profile | string) {
    if (typeof profile === 'string') {
        const selected = findProfileByKey(profile);
        if (!selected) throw new ZentaoError('E1007');
        profile = selected;
    }
    const env = getEnvCredentials();
    if (!profile && Object.values(env).some(Boolean) && !(env.url && env.account && (env.token || env.password))) {
        throw new ZentaoError('E1001', {}, { reason: 'incomplete_environment' });
    }
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
export async function ensureAuth(options?: { insecure?: boolean; timeout?: number; profile?: Profile | string; signal?: AbortSignal; assistant?: string; assistantSource?: AssistantSource }): Promise<AuthContext> {
    const signal = options?.signal ?? commandSignal();
    if (signal?.aborted) throw new ZentaoError('E5003');
    const auth = resolveAuthSource(options?.profile);
    const config = auth.source === 'profile' ? getProfileConfig(auth.profile) : undefined;
    const clientOpts = {
        insecure: options?.insecure ?? config?.insecure,
        timeout: options?.timeout ?? config?.timeout,
        actionAssistant: resolveAssistant(options?.assistant, config?.autoAssistant, options?.assistantSource),
    };
    if (auth.source === 'environment') {
        const { server, account, token, password } = auth;
        if (token) {
            return {
                client: withRequestSignal(createClient(server, token, clientOpts), signal),
                profile: buildProfile(server, account, token),
            };
        }

        const result = await login(server, account, password!, { ...clientOpts, signal });
        return {
            client: withRequestSignal(result.client, signal),
            profile: buildProfile(server, account, result.token, result.serverConfig, result.user),
        };
    }

    return {
        client: withRequestSignal(createClient(auth.server, auth.token, clientOpts), signal),
        profile: auth.profile,
    };
}
