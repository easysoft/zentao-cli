/** 用户可配置的选项，存储在 profile.config 中 */
export interface UserConfig {
    /** 默认输出格式 */
    defaultOutputFormat?: 'markdown' | 'json' | 'raw';
    /** 默认每页记录数 */
    defaultRecPerPage?: number;
    /** 是否跳过 SSL/TLS 证书验证 */
    insecure?: boolean;
    /** 请求超时时间（毫秒） */
    timeout?: number;
    /** 是否将 HTML 字段自动转换为 Markdown */
    htmlToMarkdown?: boolean;
    /** 批量操作出错时是否立即停止 */
    batchFailFast?: boolean;
    /** 各模块自定义分页大小，key 为模块名 */
    pagers?: Record<string, number>;
    /** 是否启用静默模式（仅输出错误信息） */
    silent?: boolean;
    /** JSON 输出是否美化（带缩进） */
    jsonPretty?: boolean;
}

/** 禅道服务端配置 */
export interface ServerConfig {
    /** 禅道版本 */
    version: string;
    /** 系统模式 */
    systemMode: string;
    /** 冲刺概念 */
    sprintConcept: string;
    /** 请求类型 */
    requestType: string;
    /** 请求修复 */
    requestFix: string;
    /** 模块变量 */
    moduleVar: string;
    /** 方法变量 */
    methodVar: string;
    /** 视图变量 */
    viewVar: string;
    /** 会话变量 */
    sessionVar: string;
}

/**
 * 用户配置（Profile），对应一个禅道服务上的一个账号。
 * 存储在 ~/.config/zentao/zentao.json 的 profiles 数组中。
 */
export interface Profile {
    /** 禅道服务地址，例如 https://zentao.example.com */
    server: string;
    /** 登录账号 */
    account: string;
    /** API Token，通过登录接口获取 */
    token: string;
    /** 登录后获取的用户详情 */
    user?: Record<string, unknown>;
    /** 登录时间 (ISO 8601) */
    loginTime: string;
    /** 最后一次使用时间 (ISO 8601) */
    lastUsedTime: string;
    /** 该 Profile 的用户配置 */
    config?: UserConfig;
    /** 禅道服务端配置 */
    serverConfig?: ServerConfig;
}

/** 顶层配置数据结构，对应 ~/.config/zentao/zentao.json 文件 */
export interface ConfigData {
    /** 当前使用的 Profile 标识，格式为 account@server */
    currentProfile?: string;
    /** 所有已登录的用户配置列表 */
    profiles?: Profile[];
}

/** 支持的输出格式 */
export type OutputFormat = 'markdown' | 'json' | 'raw';
