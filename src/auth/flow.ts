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
 * 确保当前进程具备可用的禅道凭证。
 *
 * 解析顺序：
 * 1. 读取完整的 `ZENTAO_*` 环境变量：优先 Token，其次账号密码登录
 * 2. 否则读取本地 `currentProfile`，若 Token 可用则直接复用并刷新 `lastUsedTime`
 * 3. 均失败时抛出 {@link ZentaoError} `E1006`
 */
export async function ensureAuth(options?: { insecure?: boolean; timeout?: number }): Promise<AuthContext> {
    const env = getEnvCredentials();
    if (env.url && env.account && (env.token || env.password)) {
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
                client: createClient(server, result.token, clientOpts),
                profile,
            };
        }
    }

    const currentProfile = getCurrentProfile();
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
