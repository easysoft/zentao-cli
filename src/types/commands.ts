/** Commander 顶层 `program` 上挂载的全局 CLI 选项 */
export interface GlobalOptions {
    /** 默认输出格式，可被子命令 `--format` 覆盖 */
    format?: string;
    silent?: boolean;
    insecure?: boolean;
    timeout?: number;
    /** 是否启用机器可读模式，简化格式，禁用颜色输出 */
    machineReadable?: boolean;
}

/** 数据类子命令（ls/get/create/... 与各业务模块）共享的查询与变更选项 */
export interface DataOptions {
    format?: string;
    pick?: string;
    filter?: string[];
    sort?: string;
    search?: string[];
    searchFields?: string;
    page?: string;
    recPerPage?: string;
    all?: boolean;
    limit?: string;
    data?: string;
    yes?: boolean;
    silent?: boolean;
    batchFailFast?: boolean;
    product?: string;
    project?: string;
    execution?: string;
}
