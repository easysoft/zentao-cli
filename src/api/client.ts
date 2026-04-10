import type { ApiResponse, RequestOptions } from '../types/index.js';
import { ZentaoError } from '../errors.js';

export interface ClientOptions {
    insecure?: boolean;
    timeout?: number;
}

export class ZentaoClient {
    readonly baseUrl: string;
    private token: string;
    private timeout: number;
    private insecure: boolean;

    constructor(serverUrl: string, token: string, options?: ClientOptions) {
        const url = serverUrl.replace(/\/+$/, '');
        this.baseUrl = `${url}/api.php/v2`;
        this.token = token;
        this.timeout = options?.timeout ?? 10000;
        this.insecure = options?.insecure ?? false;
    }

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

    private async handleHttpError(response: Response): Promise<never> {
        let body: Record<string, unknown> | undefined;
        try {
            body = await response.json() as Record<string, unknown>;
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
                throw new ZentaoError('E2008', undefined, body ?? { status: response.status, statusText: response.statusText });
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

    setToken(token: string): void {
        this.token = token;
    }
}

export function createClient(serverUrl: string, token: string, options?: ClientOptions): ZentaoClient {
    return new ZentaoClient(serverUrl, token, options);
}
