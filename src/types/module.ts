/** 模块操作类型 */
export type ModuleActionType = 'list' | 'get' | 'create' | 'update' | 'delete' | 'action';

/** 模块操作方法 */
export type ModuleActionMethod = 'get' | 'put' | 'post' | 'delete';

/** 模块操作名称 */
export type ModuleActionName = ModuleActionType | (string & {});

/** 模块操作参数可选值定义 */
export type ModuleActionParamOption = {value: unknown, label: string};

/** 模块操作参数定义 */
export interface ModuleActionParam {
    /** 参数名称 */
    name: string;

    /** 参数描述 */
    description?: string;

    /** 是否必填 */
    required?: boolean;

    /** 默认值 */
    defaultValue?: unknown;

    /** 参数类型 */
    type?: 'string' | 'number' | 'boolean';

    /** 可选值 */
    options?: ModuleActionParamOption[];
};

/** 模块操作结果类型 */
export type ModuleActionResultType = 'text' | 'object' | 'list';

/** 列表分页信息 */
export type ListPagerInfo = {
    /** 当前页码 */
    page: number;
    /** 每页记录数 */
    recPerPage: number;
    /** 总记录数 */
    recTotal: number;
};

/** 模块操作请求体 */
export interface ModuleActionRequestBody {
    /** 请求体类型 */
    type?: 'object' | 'string';

    /** 请求体是否必填 */
    required?: boolean;

    /** 请求体 schema */
    schema: Record<string, unknown>;

    /** 请求体示例 */
    example?: unknown;
};

/** 模块操作响应定义 */
export interface ModuleActionResponse {
    /** 响应描述 */
    description?: string;

    /** 响应内容 schema */
    schema: Record<string, unknown>;

    /** 响应示例 */
    example?: unknown;
};

/** 模块操作结果渲染类型 */
export type ModuleActionResultRenderType = 'json' | 'markdown' | 'raw' | (string & {});

/** 模块操作结果渲染函数 */
export type ModuleActionResultRender = (result: unknown, type: ModuleActionResultRenderType, action: ModuleAction) => string;

/** 模块操作定义 */
export interface ModuleAction {
    /** 操作名称，用于命令路由和 URL 拼接 */
    name: ModuleActionName;

    /** 操作类型 */
    type: ModuleActionType;

    /** 操作显示名称，如 '关闭' */
    display?: string;

    /** 操作描述，如 '关闭 Bug' */
    description?: string;

    /** HTTP 方法 */
    method: ModuleActionMethod;

    /** 操作路径 */
    path: string;

    /** 操作路径参数 */
    pathParams?: Record<string, string | Omit<ModuleActionParam, 'name'>>;

    /** 操作参数 */
    params?: ModuleActionParam[];

    /** 操作请求体 */
    requestBody?: ModuleActionRequestBody;

    /** 操作响应，通常不需要 */
    // responses?: Record<number, ModuleActionResponse>;

    /** 操作结果类型 */
    resultType: ModuleActionResultType;

    /**
     * 列表分页信息获取器，支持如下形式:
     * - 字符串：服务器返回的原始数据中的属性名，根据属性名获取分页信息
     * - 对象：键为 ListPagerInfo 的属性名，值为服务器返回的原始数据中的属性名，根据属性名获取分页信息
     * - 函数：接收服务器返回的原始数据和参数，返回 ListPagerInfo
     */
    pagerGetter?: string | Record<keyof ListPagerInfo, string> | ((data: unknown, params: Record<string, unknown>) => ListPagerInfo);

    /**
     * 操作结果获取器，支持如下形式:
     * - 字符串：服务器返回的原始数据中的属性名，根据属性名获取结果
     * - 对象：键为结果的属性名，值为服务器返回的原始数据中的属性名，根据属性名获取结果
     * - 函数：接收服务器返回的原始数据和参数，返回结果
     */
    resultGetter?: string | Record<string, string> | ((data: unknown, params: Record<string, unknown>) => unknown);

    /** 操作结果渲染函数，可以指定为预设渲染函数名称 */
    render?: string | ModuleActionResultRender | Record<ModuleActionResultRenderType, ModuleActionResultRender>;
}

/** 模块名称 */
export type ModuleName = 'user' | 'program' | 'product' | 'project' | 'execution' | 'productplan' | 'story' | 'epic' | 'requirement' | 'bug' | 'testcase' | 'task' | 'feedback' | 'ticket' | 'system' | 'build' | 'testtask' | 'release' | 'file' | (string & {});

/**
 * 禅道模块定义。
 * 每个模块对应禅道的一类数据对象（如 product、bug、task），
 * 描述其 API 路径、支持的操作、父级作用域和扩展操作。
 */
export interface ModuleDefinition {
    /** 模块名称（小写），如 'bug' */
    name: ModuleName;

    /** 模块显示名称，如 'Bug' */
    display?: string;

    /** 模块描述，如 'Bug 管理' */
    description?: string;

    /** 模块操作 */
    actions: ModuleAction[];
}
