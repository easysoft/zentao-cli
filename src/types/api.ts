/** 禅道 API 返回的分页信息 */
export interface Pager {
    /** 总记录数 */
    recTotal: number;
    /** 每页记录数 */
    recPerPage: number;
    /** 总页数 */
    pageTotal: number;
    /** 当前页码 */
    pageID: number;
}

/** 禅道 API 通用响应结构 */
export interface ApiResponse {
    /** 请求结果状态 */
    status: 'success' | 'fail';
    /** 允许携带任意附加字段（如 products, bugs 等） */
    [key: string]: unknown;
}

/** 禅道 API 列表响应结构，包含分页信息 */
export interface ApiListResponse extends ApiResponse {
    /** 分页信息（由禅道服务端返回） */
    pager?: Pager;
}

/** 登录请求参数 */
export interface LoginRequest {
    account: string;
    password: string;
}

/** 登录响应结构 */
export interface LoginResponse extends ApiResponse {
    /** 登录成功后返回的 API Token */
    token: string;
}

/** API 请求选项 */
export interface RequestOptions {
    /** URL 查询参数 */
    params?: Record<string, string | number>;
    /** 请求体（自动序列化为 JSON） */
    body?: unknown;
    /** 单次请求的超时时间（毫秒），覆盖客户端默认值 */
    timeout?: number;
}
