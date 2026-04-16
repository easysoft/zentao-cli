import {getProperty} from 'dot-prop';
import type { ModuleDefinition, ModuleAction, ModuleActionType, ListPagerInfo, Workspace, ModuleActionName, ModuleActionOptions, ResolvedModuleCommand, OutputFormat } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { moduleActionResultRenders } from './renders.js';

const ACTION_NAME_ALIASES: Record<string, string> = {
    ls: 'list',
};

const CRUD_TYPES = new Set<string>(['list', 'get', 'create', 'update', 'delete']);

/**
 * 解析模块命令信息：
 * - 根据 actionName 获取 module 的 action 信息
 * - 根据 opts 和 args 解析出 path, query, data, id 等信息
 * - 如果 action 路径存在 scope 和 scopeID 参数，则根据 opts 中的 product, project, execution 参数确定 scope 和 scopeID
 * - 根据 action 信息检查路径参数、请求参数和请求数据是否合法以及提供了值
 * - 如果参数可选，但拥有默认值则为 path, query, data, id 提供默认值
 */
export function resolveModuleCommand(
    module: ModuleDefinition,
    actionName: ModuleActionName,
    opts: ModuleActionOptions,
    args?: string[],
): ResolvedModuleCommand {
    const normalized = ACTION_NAME_ALIASES[actionName] ?? actionName;

    let action: ModuleAction | undefined;
    if (CRUD_TYPES.has(normalized)) {
        action = findAction(module, normalized as ModuleActionType);
    } else {
        action = findAction(module, 'action', normalized);
    }
    if (!action) {
        throw new ZentaoError('E2005', { module: module.name });
    }

    // 跳过 args 中与 actionName 重复的首个元素，剩余部分用于提取 ID 和 --key=value 参数
    const extraArgs = args ? [...args] : [];
    if (extraArgs.length > 0 && extraArgs[0] === actionName) {
        extraArgs.shift();
    }

    const params: Record<string, unknown> = {};
    if (opts.params) {
        try {
            Object.assign(params, JSON.parse(opts.params));
        } catch {
            throw new ZentaoError('E2009', { field: 'params', value: opts.params, reason: '不是有效的 JSON 对象' });
        }
    }

    for (const arg of extraArgs) {
        const match = arg.match(/^--(\w[\w.-]*)=(.*)$/);
        if (!match) continue;
        const key = match[1];
        let value: unknown = match[2];
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value as string)) value = Number(value);
        params[key] = value;
    }

    // 解析操作 ID
    const rawID = +String(params.id ?? params[`${module.name}ID`] ?? opts.id);
    const id = Number.isNaN(rawID) ? undefined : rawID;

    // --- 解析路径参数 ---
    const pathValues: Record<string, string | number> = {};

    if (action.pathParams) {
        const pathParamNames = Object.keys(action.pathParams);

        if (pathParamNames.includes('scope')) {
            for (const [key, plural] of Object.entries(SCOPE_MAP)) {
                const val = (opts as Record<string, unknown>)[key] ?? params[key];
                if (val) {
                    pathValues.scope = plural;
                    pathValues.scopeID = Number(val);
                    break;
                }
            }
            if (!pathValues.scope) {
                throw new ZentaoError('E2003', {
                    fields: 'product/project/execution',
                    module: module.name,
                });
            }
        }

        const idParamName = pathParamNames.find(k => k.endsWith('ID') && k !== 'scopeID');
        if (idParamName && id !== undefined) {
            pathValues[idParamName] = id;
        }

        for (const key of pathParamNames) {
            if (key === 'scope' || key === 'scopeID' || pathValues[key] !== undefined) continue;
            if (params[key] !== undefined) {
                pathValues[key] = params[key] as string | number;
            } else {
                const def = action.pathParams[key];
                if (typeof def === 'object') {
                    if (def.defaultValue !== undefined) {
                        pathValues[key] = def.defaultValue as string | number;
                    } else if (def.options) {
                        pathValues[key] = def.options[0]?.value as string | number;
                    }
                }
                if (pathValues[key] === undefined) {
                    throw new ZentaoError('E2004', { field: key, module: module.name });
                }
            }
        }
    }

    const path = resolveActionUrl(action, pathValues);

    // --- 构建查询参数 ---
    const query: Record<string, string | number> = {};
    if (action.params?.length) {
        for (const param of action.params) {
            const value = params[param.name] ?? param.defaultValue ?? param.options?.[0]?.value;
            if (param.required && value === undefined) {
                throw new ZentaoError('E2009', { option: param.name, reason: '必须提供参数值' });
            }
            query[param.name] = value as string | number;
        }
    }

    // --- 解析请求数据 ---
    let data: string | Record<string, unknown> | undefined;
    if (opts.data) {
        if (typeof opts.data === 'string') {
            data = opts.data;
        } else if (typeof opts.data === 'object') {
            try {
                data = JSON.parse(opts.data);
            } catch {
                data = opts.data;
            }
        }
    }

    if (action.requestBody?.schema?.type === 'object' && (!data || typeof data !== 'object')) {
        if (!data) {
            data = {};
        }
        const schema = action.requestBody.schema as {
            required?: string[];
            properties?: Record<string, {description: string, defaultValue: unknown, required?: boolean}>;
        };
        const requiredSet = new Set((schema.required ?? []) as string[]);
        Object.keys(schema.properties ?? {}).forEach(key => {
            const prop = schema.properties![key];
            const value = params[key] ?? prop.defaultValue;
            if (value === undefined && (prop.required ?? requiredSet.has(key))) {
                throw new ZentaoError('E2009', { option: key, reason: '必须提供参数值' });
            }
            (data as Record<string, unknown>)[key] = value;
        });
    }

    return { module: module.name, action, params, path, query, data, id };
}

/** 从模块中查找指定类型（和可选名称）的 action */
export function findAction(
    mod: ModuleDefinition,
    type: ModuleActionType,
    name?: string,
): ModuleAction | undefined {
    if (name) {
        return mod.actions.find(a => a.type === type && a.name === name);
    }
    return mod.actions.find(a => a.type === type);
}

/** 返回所有 type === 'action' 的扩展操作名称列表 */
export function getAvailableActions(mod: ModuleDefinition): string[] {
    return mod.actions
        .filter(a => a.type === 'action')
        .map(a => a.name);
}

/** 判断模块是否支持某种操作类型 */
export function hasActionType(mod: ModuleDefinition, type: ModuleActionType): boolean {
    return mod.actions.some(a => a.type === type);
}

const SCOPE_MAP: Record<string, string> = {
    product: 'products',
    project: 'projects',
    execution: 'executions',
};

/**
 * 将 action.path 模板中的 `{param}` 替换为实际值。
 * pathValues 由调用方提供，通常来自对象 ID 和 workspace/CLI 选项。
 *
 * 对于含 `{scope}/{scopeID}` 的路径，自动从 workspace + explicitParams 推断。
 */
export function resolveActionUrl(
    action: ModuleAction,
    pathValues: Record<string, string | number>,
): string {
    return action.path.replace(/\{(\w+)\}/g, (_, key) => {
        const val = pathValues[key];
        if (val === undefined || val === '') {
            throw new Error(`缺少路径参数: ${key} (action: ${action.name})`);
        }
        return String(val);
    });
}

/** 根据 action.resultGetter 从 API 原始响应中提取结果数据 */
export function extractResult(action: ModuleAction, response: Record<string, unknown>): unknown {
    const getter = action.resultGetter;
    if (!getter) return response;

    if (typeof getter === 'function') {
        return getter(response, {});
    }
    if (typeof getter === 'string') {
        return getProperty(response, getter);
    }
    if (typeof getter === 'object') {
        const result: Record<string, unknown> = {};
        for (const [resultKey, sourceKey] of Object.entries(getter)) {
            result[resultKey] = response[sourceKey];
        }
        return result;
    }
    return response;
}

/** 根据 action.pagerGetter 从 API 原始响应中提取分页信息 */
export function extractPager(action: ModuleAction, response: Record<string, unknown>): ListPagerInfo | undefined {
    const getter = action.pagerGetter;
    if (!getter) return undefined;

    if (typeof getter === 'function') {
        return getter(response, {});
    }
    if (typeof getter === 'string') {
        return getProperty(response, getter);
    }
    if (typeof getter === 'object') {
        const page = response[getter.pageID];
        const recPerPage = response[getter.recPerPage];
        const recTotal = response[getter.recTotal];
        if (page !== undefined && recPerPage !== undefined && recTotal !== undefined) {
            return {
                pageID: Number(page),
                recPerPage: Number(recPerPage),
                recTotal: Number(recTotal),
            };
        }
        return undefined;
    }
    return undefined;
}

/** 解析 action 的 render 配置，返回可调用的渲染函数（如果有） */
export function resolveRender(
    action: ModuleAction,
    format: OutputFormat,
): ((result: unknown) => string) | undefined {
    const { render } = action;
    if (!render) return undefined;

    if (typeof render === 'function') {
        return (result: unknown) => render(result, format, action);
    }
    if (typeof render === 'string') {
        const fn = moduleActionResultRenders[render];
        if (fn) return (result: unknown) => fn(result, format, action);
        return undefined;
    }
    if (typeof render === 'object') {
        const fn = render[format];
        if (fn) return (result: unknown) => fn(result, format, action);
        return undefined;
    }
    return undefined;
}
