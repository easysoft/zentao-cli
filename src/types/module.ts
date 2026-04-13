/** 模块支持的 CRUD 操作类型 */
export type Operation = 'list' | 'get' | 'create' | 'update' | 'delete';

/**
 * 父级作用域定义。
 * 某些模块（如 bug、task）没有顶级列表接口，
 * 必须通过父级对象的路径访问，例如 /products/:productID/bugs。
 */
export interface ParentScope {
    /** 父级对象类型 */
    parent: 'program' | 'product' | 'project' | 'execution';
    /** API 路径模板，含占位符如 :productID */
    path: string;
}

/** 模块扩展操作定义，如 resolve、close、activate 等 */
export interface ActionDefinition {
    /** 操作名称，用于命令路由和 URL 拼接 */
    name: string;
    /** HTTP 方法 */
    method: 'put' | 'post';
    /** 路径中使用的 ID 参数名 */
    idParam: string;
}

/**
 * 禅道模块定义。
 * 每个模块对应禅道的一类数据对象（如 product、bug、task），
 * 描述其 API 路径、支持的操作、父级作用域和扩展操作。
 */
export interface ModuleDefinition {
    /** 模块名称（小写），如 'bug' */
    name: string;
    /** API 列表响应中的 JSON key，如 'bugs' */
    pluralKey: string;
    /** API 详情响应中的 JSON key，如 'bug' */
    singularKey: string;
    /** API 基础路径，如 '/bugs' */
    basePath: string;
    /** 路径参数名称，如 'bugID' */
    idParam: string;
    /** 支持的 CRUD 操作列表 */
    operations: Operation[];
    /** 父级作用域列表；为空表示有顶级列表接口 */
    listScopes: ParentScope[];
    /** 扩展操作列表（如 resolve、start、finish） */
    actions: ActionDefinition[];
    /** 支持的列表查询参数 */
    queryParams: string[];
}
