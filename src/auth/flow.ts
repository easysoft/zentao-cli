import type { Profile } from '../types/index.js';
import { ZentaoClient } from '../api/client.js';
import { ZentaoError } from '../errors.js';
import { getCurrentProfile, getProfile, saveProfile, getProfileConfig, buildProfile } from '../config/store.js';
import { login, validateToken, getEnvCredentials } from './login.js';

/** 已通过鉴权后的运行时上下文，供命令层发起 API 调用 */
export interface AuthContext {
    client: ZentaoClient;
    profile: Profile;
}

function shouldValidateToken(lastUsedTime?: string): boolean {
    if (!lastUsedTime) {
        return true;
    }

    const lastUsedAt = new Date(lastUsedTime).getTime();
    if (Number.isNaN(lastUsedAt)) {
        return true;
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    return Date.now() - lastUsedAt > ONE_DAY_MS;
}

/**
 * 确保当前进程具备可用的禅道凭证。
 *
 * 解析顺序：
 * 1. 读取本地 `currentProfile`，若 Token 可用则直接复用并刷新 `lastUsedTime`
 * 2. 否则读取 `ZENTAO_*` 环境变量：优先 Token 校验，其次账号密码登录
 * 3. 均失败时抛出 {@link ZentaoError} `E1006`
 */
export async function ensureAuth(options?: { insecure?: boolean; timeout?: number }): Promise<AuthContext> {
    const currentProfile = getCurrentProfile();
    if (currentProfile?.token) {
        const config = getProfileConfig(currentProfile);
        const clientOpts = {
            insecure: options?.insecure ?? config.insecure,
            timeout: options?.timeout ?? config.timeout,
        };
        const needValidateToken = shouldValidateToken(currentProfile.lastUsedTime);

        if (!needValidateToken || (await validateToken(currentProfile.server, currentProfile.token, clientOpts))) {
            currentProfile.lastUsedTime = new Date().toISOString();
            saveProfile(currentProfile);
            return {
                client: new ZentaoClient(currentProfile.server, currentProfile.token, clientOpts),
                profile: currentProfile,
            };
        }
    }

    const env = getEnvCredentials();

    if (env.url && env.account && env.token) {
        const clientOpts = { insecure: options?.insecure, timeout: options?.timeout };
        const normalizedServer = env.url.replace(/\/+$/, '');
        const existingProfile = getProfile(env.account, normalizedServer);
        const needValidateToken = shouldValidateToken(existingProfile?.lastUsedTime);

        if (!needValidateToken || (await validateToken(env.url, env.token, clientOpts))) {
            const profile = buildProfile(env.url, env.account, env.token, undefined, undefined, existingProfile);
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
        const profile = buildProfile(env.url, env.account, result.token, undefined, result.user);
        saveProfile(profile);
        return {
            client: new ZentaoClient(env.url, result.token, clientOpts),
            profile,
        };
    }

    throw new ZentaoError('E1006');
}
