import type { ModuleDefinition, ModuleAction, ModuleActionType, ListPagerInfo, Workspace } from '../types/index.js';
import { moduleActionResultRenders } from './renders.js';

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

/**
 * 为 list action 解析路径参数：从显式 CLI 选项和 workspace 上下文中推断 scope/scopeID 等参数。
 * 返回 pathValues 字典，用于 resolveActionUrl。
 */
export function resolveListPathParams(
    action: ModuleAction,
    workspace: Workspace,
    explicitParams: Record<string, number>,
): Record<string, string | number> {
    const pathValues: Record<string, string | number> = {};

    if (!action.pathParams) return pathValues;

    const pathParamNames = Object.keys(action.pathParams);
    const hasScope = pathParamNames.includes('scope');

    if (hasScope) {
        let scopeType: string | undefined;
        let scopeId: number | undefined;

        for (const [key, plural] of Object.entries(SCOPE_MAP)) {
            if (explicitParams[key]) {
                scopeType = plural;
                scopeId = explicitParams[key];
                break;
            }
        }

        if (!scopeType && workspace) {
            if (workspace.execution?.id) {
                scopeType = 'executions';
                scopeId = workspace.execution.id;
            } else if (workspace.project?.id) {
                scopeType = 'projects';
                scopeId = workspace.project.id;
            } else if (workspace.product?.id) {
                scopeType = 'products';
                scopeId = workspace.product.id;
            }
        }

        if (scopeType && scopeId) {
            pathValues.scope = scopeType;
            pathValues.scopeID = scopeId;
        }
    }

    for (const key of pathParamNames) {
        if (key === 'scope' || key === 'scopeID') continue;
        if (pathValues[key] !== undefined) continue;

        const singularKey = key.replace(/ID$/, '').toLowerCase();
        if (explicitParams[singularKey]) {
            pathValues[key] = explicitParams[singularKey];
        } else {
            const wsRef = (workspace as unknown as Record<string, unknown>)[singularKey];
            if (wsRef && typeof wsRef === 'object' && 'id' in (wsRef as object)) {
                pathValues[key] = (wsRef as { id: number }).id;
            }
        }
    }

    return pathValues;
}

/** 根据 action.resultGetter 从 API 原始响应中提取结果数据 */
export function extractResult(action: ModuleAction, response: Record<string, unknown>): unknown {
    const getter = action.resultGetter;
    if (!getter) return response;

    if (typeof getter === 'function') {
        return getter(response, {});
    }
    if (typeof getter === 'string') {
        return response[getter] ?? response;
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
        return response[getter] as ListPagerInfo | undefined;
    }
    if (typeof getter === 'object') {
        const page = response[getter.page];
        const recPerPage = response[getter.recPerPage];
        const recTotal = response[getter.recTotal];
        if (page !== undefined && recPerPage !== undefined && recTotal !== undefined) {
            return {
                page: Number(page),
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
    format: string,
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
