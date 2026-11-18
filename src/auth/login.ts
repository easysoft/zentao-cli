import { brandText } from '../brand.js';
import { findCurrentUser, supportsCurrentUserInfo } from './user.js';
import { ZentaoClient, createClient, getServerConfig, type ClientOptions } from '../api/index.js';
import type { ServerConfig } from '../types/index.js';
import { ZentaoError, mapSdkError } from '../errors.js';

/** 密码登录成功后的结果 */
export interface LoginResult {
    client: ZentaoClient;
    token: string;
    user?: Record<string, unknown>;
    serverConfig?: ServerConfig;
}

/** 从环境变量读取的凭证片段（任一字段可能缺失） */
export interface EnvCredentials {
    url?: string;
    account?: string;
    password?: string;
    token?: string;
}

/** Authenticate with a password and retrieve the current user's profile. */
export async function login(
    serverUrl: string,
    account: string,
    password: string,
    options?: ClientOptions & { signal?: AbortSignal },
): Promise<LoginResult> {
    const client = createClient(serverUrl, undefined, options);
    const originalFetch = client.fetch;
    if (options?.signal) {
        // This client belongs to this login attempt; cover every SDK request, including config loading.
        client.fetch = (url, request, token, fetchOptions) => {
            if (options.signal?.aborted) throw new ZentaoError('E5003');
            return originalFetch.call(client, url, { ...request, signal: options.signal }, token, fetchOptions);
        };
    }

    try {
        let token: string;
        try {
            token = await client.login(account, password);
        } catch (error) {
            throw mapSdkError(error);
        }

        let user: Record<string, unknown> | undefined;
        const serverConfig = await getServerConfig(client);
        try {
            ({ user } = await findCurrentUser(client, account));
        } catch (error) {
            // Legacy deployments may restrict directory access even after a successful login.
            if (supportsCurrentUserInfo(serverConfig.version)) throw mapSdkError(error);
        }

        if (options?.signal?.aborted) throw new ZentaoError('E5003');
        return { client, token, user, serverConfig };
    } finally {
        client.fetch = originalFetch;
    }
}

/** Verify the token owner's identity, or look up the provided account on legacy servers. */
export async function verifyToken(
    client: ZentaoClient,
    account: string,
): Promise<{ serverConfig: ServerConfig; user?: Record<string, unknown> }> {
    try {
        const serverConfig = await getServerConfig(client);
        const { user, hadUsers } = await findCurrentUser(client, account);
        if (!hadUsers) throw new ZentaoError('E1004');
        return { serverConfig, user };
    } catch (error) {
        throw mapSdkError(error);
    }
}

/** 读取 `ZENTAO_URL` / `ZENTAO_ACCOUNT` / `ZENTAO_PASSWORD` / `ZENTAO_TOKEN` */
export function getEnvCredentials(): EnvCredentials {
    return {
        url: process.env[brandText('ZENTAO_URL')],
        account: process.env[brandText('ZENTAO_ACCOUNT')],
        password: process.env[brandText('ZENTAO_PASSWORD')],
        token: process.env[brandText('ZENTAO_TOKEN')],
    };
}
