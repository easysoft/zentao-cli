import type { ApiResponse, RequestOptions } from '../types/index.js';
import { ZentaoError } from '../errors.js';

/** 创建 {@link ZentaoClient} 时的可选行为（TLS、超时等） */
export interface ClientOptions {
    /** 为 true 时跳过 TLS 证书校验（仅在单次请求期间临时设置环境变量） */
    insecure?: boolean;
    /** 默认请求超时（毫秒），可被单次 {@link RequestOptions.timeout} 覆盖 */
    timeout?: number;
}

/**
 * 禅道 REST API v2 的轻量封装。
 * 负责拼接 `.../api.php/v2` 前缀、注入 Token、序列化 JSON，并将 HTTP/网络错误映射为 {@link ZentaoError}。
 */
export class ZentaoClient {
    readonly baseUrl: string;
    private token: string;
    private timeout: number;
    private insecure: boolean;

    /**
     * @param serverUrl 禅道站点根地址，如 `https://zentao.example.com`（末尾 `/` 会被去掉）
     * @param token API Token（请求头 `Token`）
     * @param options 客户端级选项
     */
    constructor(serverUrl: string, token: string, options?: ClientOptions) {
        const url = serverUrl.replace(/\/+$/, '');
        this.baseUrl = `${url}/api.php/v2`;
        this.token = token;
        this.timeout = options?.timeout ?? 10000;
        this.insecure = options?.insecure ?? false;
    }

    /**
     * 发起一次 API 请求。
     * - `status === 'fail'` 的 JSON 响应会抛出 {@link ZentaoError} `E2008`
     * - 超时、证书、连接失败等会映射为对应的 `E5xxx` / `E1002` 等错误
     */
    async request<T extends ApiResponse = ApiResponse>(
        method: string,
        path: string,
        options?: RequestOptions,
    ): Promise<T> {
        let url = `${this.baseUrl}${path}`;
        if (options?.params) {
            const search = new URLSearchParams();
            for (const [key, value] of Object.entries(options.params)) {
                search.set(key, String(value));
            }
            url += `?${search.toString()}`;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

        const headers: Record<string, string> = {
            'Token': this.token,
            'Content-Type': 'application/json',
        };

        const fetchOptions: globalThis.RequestInit = {
            method: method.toUpperCase(),
            headers,
            signal: controller.signal,
        };

        if (options?.body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
            fetchOptions.body = JSON.stringify(options.body);
        }

        // Node 全局 TLS 开关：仅在本次 fetch 期间生效，在 finally 中恢复，避免污染其他并发请求
        if (this.insecure) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        try {
            const response = await fetch(url, fetchOptions);
            clearTimeout(timer);

            if (!response.ok) {
                return this.handleHttpError(response);
            }

            const data = await response.json() as T;
            if (data.status === 'fail') {
                throw new ZentaoError('E2008', undefined, data);
            }
            return data;
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof ZentaoError) throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new ZentaoError('E5001');
            }
            const msg = (error as Error).message ?? '';
            if (msg.includes('SSL') || msg.includes('TLS') || msg.includes('certificate')) {
                throw new ZentaoError('E5002');
            }
            if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
                throw new ZentaoError('E1002', { url: this.baseUrl });
            }
            throw error;
        } finally {
            if (this.insecure) {
                delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
            }
        }
    }

    /** 将 HTTP 状态码映射为 CLI 统一错误（401→Token 失效等） */
    private async handleHttpError(response: Response): Promise<never> {
        let body: string | undefined;
        try {
            body = await response.text();
        } catch {
            // ignore
        }

        switch (response.status) {
            case 401:
                throw new ZentaoError('E1004');
            case 403:
                throw new ZentaoError('E2006');
            case 404:
                throw new ZentaoError('E2002', { object: response.url });
            default:
                throw new ZentaoError('E2008', undefined, { url: response.url, status: response.status, statusText: response.statusText, serverResponse: body ?? undefined });
        }
    }

    async get<T extends ApiResponse = ApiResponse>(path: string, params?: Record<string, string | number>): Promise<T> {
        return this.request<T>('GET', path, { params });
    }

    async post<T extends ApiResponse = ApiResponse>(path: string, body?: unknown): Promise<T> {
        return this.request<T>('POST', path, { body });
    }

    async put<T extends ApiResponse = ApiResponse>(path: string, body?: unknown): Promise<T> {
        return this.request<T>('PUT', path, { body });
    }

    async del<T extends ApiResponse = ApiResponse>(path: string): Promise<T> {
        return this.request<T>('DELETE', path);
    }

    /** 在同一线程/进程内复用客户端实例时，用于刷新 Token */
    setToken(token: string): void {
        this.token = token;
    }
}

/** {@link ZentaoClient} 的工厂函数，语义上与 `new ZentaoClient` 等价 */
export function createClient(serverUrl: string, token: string, options?: ClientOptions): ZentaoClient {
    return new ZentaoClient(serverUrl, token, options);
}
