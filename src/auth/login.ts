import { ZentaoClient, createClient, getServerConfig } from '../api/index.js';
import type { ApiResponse, ServerConfig } from '../types/index.js';
import { ZentaoError, mapSdkError } from '../errors.js';

/** 密码登录成功后的结果 */
export interface LoginResult {
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

/**
 * 使用账号密码登录获取 Token，并尽力拉取当前账号的用户详情与服务端配置。
 * 用户列表拉取失败不视为致命错误（Token 仍然有效）。
 */
export async function login(
    serverUrl: string,
    account: string,
    password: string,
    options?: { insecure?: boolean; timeout?: number },
): Promise<LoginResult> {
    const client = createClient(serverUrl, undefined, options);

    let token: string;
    try {
        token = await client.login(account, password);
    } catch (error) {
        throw mapSdkError(error);
    }

    let user: Record<string, unknown> | undefined;
    let serverConfig: ServerConfig | undefined;
    try {
        ({ serverConfig, user } = await verifyToken(client, account));
    } catch {
        // Token valid but couldn't fetch user details - not fatal
    }

    return { token, user, serverConfig };
}

/**
 * 拉取服务器配置与用户列表，用于验证 Token 是否可用。
 * - 服务端配置失败抛 E1002（服务不可达）
 * - /users 401 由 SDK 映射为 E1004（Token 失效）
 * - /users 返回空列表也按 E1004 处理
 */
export async function verifyToken(
    client: ZentaoClient,
    account: string,
): Promise<{ serverConfig: ServerConfig; user?: Record<string, unknown> }> {
    try {
        const serverConfig = await getServerConfig(client);
        const usersResp = await client.get<ApiResponse>('/users', {
            query: { browseType: 'inside', recPerPage: 100 },
        });
        const users = usersResp.users as Array<Record<string, unknown>> | undefined;
        if (!users?.length) {
            throw new ZentaoError('E1004');
        }
        const user = users.find((u) => u.account === account);
        return { serverConfig, user };
    } catch (error) {
        throw mapSdkError(error);
    }
}

/** 读取 `ZENTAO_URL` / `ZENTAO_ACCOUNT` / `ZENTAO_PASSWORD` / `ZENTAO_TOKEN` */
export function getEnvCredentials(): EnvCredentials {
    return {
        url: process.env.ZENTAO_URL,
        account: process.env.ZENTAO_ACCOUNT,
        password: process.env.ZENTAO_PASSWORD,
        token: process.env.ZENTAO_TOKEN,
    };
}
