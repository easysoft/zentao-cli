import { ZentaoClient } from 'zentao-api';
import { mapSdkError } from '../errors.js';
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
 * Reuse the SDK's token-free config request and 24-hour in-memory cache.
 */
export async function getServerConfig(client: ZentaoClient): Promise<ServerConfig> {
    try {
        return await client.getZentaoConfig();
    } catch (error) {
        throw mapSdkError(error);
    }
}
