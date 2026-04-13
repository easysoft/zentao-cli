import { ZentaoClient } from '../api/client.js';
import type { LoginResponse, ApiResponse } from '../types/index.js';
import { ZentaoError } from '../errors.js';

/** 密码登录成功后的结果 */
export interface LoginResult {
    token: string;
    user?: Record<string, unknown>;
}

/** 从环境变量读取的凭证片段（任一字段可能缺失） */
export interface EnvCredentials {
    url?: string;
    account?: string;
    password?: string;
    token?: string;
}

/**
 * 使用账号密码调用 `/users/login` 获取 Token，并尽力拉取当前账号的用户详情。
 * 用户列表拉取失败不视为致命错误（Token 仍然有效）。
 */
export async function login(
    serverUrl: string,
    account: string,
    password: string,
    options?: { insecure?: boolean; timeout?: number },
): Promise<LoginResult> {
    const url = serverUrl.replace(/\/+$/, '');
    const baseUrl = `${url}/api.php/v2`;

    const controller = new AbortController();
    const timeout = options?.timeout ?? 10000;
    const timer = setTimeout(() => controller.abort(), timeout);

    if (options?.insecure) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    try {
        const response = await fetch(`${baseUrl}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account, password }),
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new ZentaoError('E1003');
            }
            throw new ZentaoError('E1002', { url });
        }

        const data = await response.json() as LoginResponse;
        if (data.status !== 'success' || !data.token) {
            throw new ZentaoError('E1003');
        }

        const client = new ZentaoClient(url, data.token, options);
        let user: Record<string, unknown> | undefined;
        try {
            const usersResp = await client.get<ApiResponse>('/users', { browseType: 'inside', recPerPage: 100 });
            const users = usersResp.users as Array<Record<string, unknown>> | undefined;
            user = users?.find((u) => u.account === account);
        } catch {
            // Token valid but couldn't fetch user details - not fatal
        }

        return { token: data.token, user };
    } catch (error) {
        clearTimeout(timer);
        if (error instanceof ZentaoError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new ZentaoError('E5001');
        }
        const msg = (error as Error).message ?? '';
        if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
            throw new ZentaoError('E1002', { url });
        }
        throw error;
    } finally {
        if (options?.insecure) {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
    }
}

/**
 * 通过一次轻量 GET（用户列表，仅取 1 条）探测 Token 是否仍然有效。
 * 任意异常均返回 `false`，由调用方决定是否回退到环境变量或交互登录。
 */
export async function validateToken(
    serverUrl: string,
    token: string,
    options?: { insecure?: boolean; timeout?: number },
): Promise<boolean> {
    try {
        const client = new ZentaoClient(serverUrl, token, options);
        await client.get('/users', { browseType: 'inside', recPerPage: 1 });
        return true;
    } catch {
        return false;
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
