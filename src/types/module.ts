/**
 * 模块相关类型统一从 `zentao-api` SDK 重导出。
 * CLI 不再维护本地模块注册表，模块定义、动作、解析结果等均复用 SDK 的类型。
 */
export type {
    ModuleActionType,
    ModuleActionMethod,
    ModuleActionName,
    ModuleActionParamOption,
    ModuleActionParam,
    ModuleActionResultType,
    ModuleActionRequestBody,
    ModuleActionResponse,
    ModuleActionPagerGetterMap,
    ModuleAction,
    ModuleName,
    ModuleDefinition,
    ListPagerInfo,
} from 'zentao-api';
