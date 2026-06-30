/**
 * 禅道 API 响应相关类型统一从 `zentao-api` SDK 重导出。
 */
export type {
    Pager,
    ApiResponse,
    ApiListResponse,
    LoginResponse,
} from 'zentao-api';

/** 登录请求参数 */
export interface LoginRequest {
    account: string;
    password: string;
}
