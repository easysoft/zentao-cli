export interface Pager {
    recTotal: number;
    recPerPage: number;
    pageTotal: number;
    pageID: number;
}

export interface ApiResponse {
    status: 'success' | 'fail';
    [key: string]: unknown;
}

export interface ApiListResponse extends ApiResponse {
    pager?: Pager;
}

export interface LoginRequest {
    account: string;
    password: string;
}

export interface LoginResponse extends ApiResponse {
    token: string;
}

export interface RequestOptions {
    params?: Record<string, string | number>;
    body?: unknown;
    timeout?: number;
}
