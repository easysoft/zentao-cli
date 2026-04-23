/**
 * 错误码与默认消息映射表。
 * 消息模板中的 {key} 占位符会在构造 ZentaoError 时被替换为实际值。
 */
export const ERROR_CODES = {
    // 认证与配置 (10xx)
    E1001: '必须提供有效的禅道服务地址、用户名和密码或 TOKEN',
    E1002: '所提供的禅道服务地址 {url} 无法访问',
    E1003: '当前用户名和密码不正确',
    E1004: '所提供的 Token 已失效，请提供密码重新登录，或提供新的 TOKEN',
    E1005: '配置文件损坏或无法读取，请检查 {path}',
    E1006: '未找到指定的用户配置，请先使用 `zentao login -s <zentao_url> -u <account> -p <password> -t <token>` 登录',
    E1007: '指定的用户配置不存在，请通过 `zentao profile` 查看可用配置',
    E1008: '当前禅道版本不受支持，请使用禅道 22.0 及以上版本',

    // API 调用 (20xx)
    E2001: '未找到指定的模块 {module}，请通过 `zentao help` 查看支持的模块',
    E2002: '未找到指定的对象 {object}，请检查对象 ID 是否正确',
    E2003: '缺少必要参数 {fields}，请通过 `zentao {module} --help` 查看必要参数',
    E2004: '{field} 参数值 {value} 无效，请检查参数格式是否正确',
    E2005: '不支持的操作，请通过 `zentao {module} --help` 查看支持的操作',
    E2006: '当前用户没有权限执行此操作',
    E2007: '`--data` 参数中的 JSON 数据格式无效',
    E2008: '禅道服务端返回错误（Url：{url}，Status：{status}），请查看详细错误信息：{serverResponse}',
    E2009: '选项 {option} 的值无效，{reason}',
    E2010: '选项 {option} 的值类型必须为 {type}，实际类型为 {actualType}',

    // 数据处理 (30xx)
    E3001: '`--pick` 指定的字段不存在',
    E3002: '`--filter` 表达式格式无效，请检查过滤条件格式',
    E3003: '`--sort` 表达式格式无效，请检查排序条件格式',

    // 工作区 (40xx)
    E4001: '未找到指定的工作区，请通过 `zentao workspace ls` 查看可用工作区',
    E4002: '当前未设置工作区，请通过 `zentao workspace set` 设置工作区',

    // 网络通信 (50xx)
    E5001: '请求超时，请检查网络连接或禅道服务是否正常',
    E5002: 'SSL/TLS 证书验证失败，请检查禅道服务地址是否正确',
} as const;

/** 错误码类型，限定为 ERROR_CODES 中定义的 key */
export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * 禅道 CLI 统一错误类。
 * 所有可预期的错误（认证、API、数据处理、网络）均通过此类抛出，
 * 便于在命令层统一捕获并按输出格式渲染。
 */
export class ZentaoError extends Error {
    /** 数字错误码（不含前缀 E），如 '1001' */
    code: string;
    /** 附加的错误详情，如禅道服务端返回的原始响应 */
    details?: unknown;

    /**
     * @param code 错误码，如 'E1001'
     * @param replacements 消息模板占位符替换值，如 { url: 'https://...' }
     * @param details 附加详情，会在 JSON 输出中包含
     */
    constructor(code: ErrorCode, replacements?: Record<string, string>, details?: unknown) {
        let message = ERROR_CODES[code] as string;
        if (replacements) {
            for (const [key, value] of Object.entries(replacements)) {
                message = message.replaceAll(`{${key}}`, value);
            }
        }
        super(message);
        this.name = 'ZentaoError';
        this.code = code.replace('E', '');
        this.details = details;
    }
}

/** 将 ZentaoError 格式化为用户可读的字符串（Markdown 或 JSON） */
export function formatError(error: ZentaoError, format: string): string {
    if (format === 'json' || format === 'raw') {
        const obj: Record<string, unknown> = {
            error: {
                code: error.code,
                message: error.message,
            },
        };
        if (error.details) {
            obj.error = { ...(obj.error as Record<string, unknown>), details: error.details };
        }
        return JSON.stringify(obj, null, 4);
    }
    return `Error(E${error.code}): ${error.message}`;
}
