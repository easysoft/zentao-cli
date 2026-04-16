import type { OutputFormat } from "./config";

/** Commander 顶层 `program` 上挂载的全局 CLI 选项 */
export interface GlobalOptions {
    /** 默认输出格式，可被子命令 `--format` 覆盖 */
    format?: OutputFormat;

    /** 是否静默模式 */
    silent?: boolean;

    /** 是否跳过 SSL/TLS 证书验证 */
    insecure?: boolean;

    /** 请求超时时间（毫秒） */
    timeout?: number;

    /** 是否启用机器可读模式，简化格式，禁用颜色输出 */
    machineReadable?: boolean;
}

/** 模块操作选项 */
export interface ModuleActionOptions extends GlobalOptions {
    /** 摘取指定字段（逗号分隔），适用于 resultType 为 object 或 list 的模块操作 */
    pick?: string;

    /** 过滤条件，适用于 resultType 为 list 的模块操作 */
    filter?: string[];

    /** 排序条件，适用于 resultType 为 list 的模块操作 */
    sort?: string;

    /** 搜索关键词，适用于 resultType 为 list 的模块操作 */
    search?: string[];

    /** 搜索字段（逗号分隔），适用于 resultType 为 list 的模块操作 */
    searchFields?: string;

    /** 页码，适用于 resultType 为 list 的模块操作，等同于 pageID 参数 */
    page?: string;

    /** 每页条数，适用于 resultType 为 list 的模块操作 */
    recPerPage?: string;

    // /** 获取全部数据，适用于 resultType 为 list 的模块操作 */
    // all?: boolean;

    // /** 限制获取数量，适用于 resultType 为 list 的模块操作 */
    // limit?: string;

    /** 用于提交的 JSON 数据，适用于 actionType 为 create、update 和 action 操作 */
    data?: string;

    /** 通过 JSON 对象来指定多个 API 调用参数，不包括 DataOptions 上的选项 */
    params?: string;

    /** 通过 JSON 对象来指定多个选项，不包括 API 调用选项，适用于所有操作 */
    options?: string;

    /** 是否跳过确认，适用于 actionType 为 delete 操作 */
    yes?: boolean;

    /** 是否静默模式，适用于所有操作  */
    silent?: boolean;

    /** 批量操作出错时停止，适用于 actionType 为 create、update 和 action 操作 */
    batchFailFast?: boolean;

    /** 对象 ID，适用于 actionType 为 get、update 和 action 操作，批量操作时多个对象 ID 用逗号分隔 */
    id?: string;

    /** 产品 ID，当 scope 为 products 时，等同于 scopeID 参数 */
    product?: string;

    /** 项目 ID，当 scope 为 projects 时，等同于 scopeID 参数 */
    project?: string;

    /** 执行 ID，当 scope 为 executions 时，等同于 scopeID 参数 */
    execution?: string;
}
