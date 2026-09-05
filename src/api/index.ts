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
 * 该接口位于 `/api.php/v2` 之外（`{siteRoot}/?mode=getconfig`），通过相对路径
 * 回到站点根目录，以复用 SDK 客户端的超时、TLS 和错误处理。
 */
export async function getServerConfig(client: ZentaoClient): Promise<ServerConfig> {
    try {
        return await client.get<ServerConfig>('../../', {
            query: { mode: 'getconfig' },
            responseType: 'json',
        });
    } catch (error) {
        throw mapSdkError(error);
    }
}
