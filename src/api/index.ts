import { ZentaoClient } from 'zentao-api';
import { ZentaoError } from '../errors.js';
import type { ServerConfig } from '../types/index.js';

export { ZentaoClient };

/** 创建 {@link ZentaoClient} 时的可选行为（TLS、超时等） */
export interface ClientOptions {
    /** 为 true 时跳过 TLS 证书校验（仅 Node.js 运行时支持） */
    insecure?: boolean;
    /** 默认请求超时（毫秒） */
    timeout?: number;
}

/**
 * 以旧版 `(serverUrl, token, options)` 的位置参数语义创建 SDK 客户端。
 * 内部映射到 `zentao-api` 的对象参数构造器，便于沿用 CLI 既有调用点。
 */
export function createClient(serverUrl: string, token?: string, options?: ClientOptions): ZentaoClient {
    return new ZentaoClient({
        baseUrl: serverUrl,
        token,
        insecure: options?.insecure,
        timeout: options?.timeout,
    });
}

/**
 * 获取禅道服务端配置。
 *
 * SDK 的 {@link ZentaoClient} 不提供该方法，且该接口位于 `/api.php/v2` 之外
 * （`{siteRoot}/?mode=getconfig`），因此这里基于 `client.siteUrl` 直接发起请求。
 */
export async function getServerConfig(client: ZentaoClient): Promise<ServerConfig> {
    const url = `${client.siteUrl}/?mode=getconfig`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ZentaoError('E2008', {
            url,
            status: String(response.status),
            serverResponse: body,
        });
    }
    return await response.json() as ServerConfig;
}
