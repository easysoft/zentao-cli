import type { ModuleDefinition, ParentScope } from '../types/index.js';
import type { Workspace } from '../types/config.js';
import { ZentaoError } from '../errors.js';

/** 将 `:productID` 形式的占位符替换为实际值，缺失参数时抛出同步 Error（由上层转换为 CLI 错误） */
function substituteParams(template: string, params: Record<string, string | number>): string {
    return template.replace(/:(\w+)/g, (_, key) => {
        const value = params[key];
        if (value === undefined) {
            throw new Error(`Missing path parameter: ${key}`);
        }
        return String(value);
    });
}

/**
 * 在多种父级作用域中选出第一个能解析出 ID 的路径。
 * 优先级：执行 > 项目 > 产品 > 项目集，与禅道「当前上下文通常最具体」的使用习惯一致；
 * `--execution` 等显式参数优先于工作区中保存的引用。
 */
function resolveParentScope(
    scopes: ParentScope[],
    workspace?: Workspace,
    explicitParams?: Record<string, number>,
): { path: string; params: Record<string, string | number> } | undefined {
    const parentOrder: Array<'execution' | 'project' | 'product' | 'program'> = [
        'execution', 'project', 'product', 'program',
    ];

    for (const parent of parentOrder) {
        const scope = scopes.find((s) => s.parent === parent);
        if (!scope) continue;

        const explicitId = explicitParams?.[parent];
        const workspaceId = workspace?.[parent as keyof Workspace];
        const id = explicitId ?? (typeof workspaceId === 'object' && workspaceId !== null ? (workspaceId as { id: number }).id : undefined);

        if (id) {
            return {
                path: scope.path,
                params: { [`${parent}ID`]: id },
            };
        }
    }
    return undefined;
}

/**
 * 解析列表接口的完整路径。
 * - 无 `listScopes` 时直接使用 `basePath`
 * - 否则尝试父级路径；若无可用父级上下文且模块仍声明了顶级 `list` 操作，则回退到 `basePath`
 * - 否则抛出 `E4002`（需先设置工作区或传入 `--product` 等）
 */
export function resolveListPath(
    module: ModuleDefinition,
    workspace?: Workspace,
    explicitParams?: Record<string, number>,
): string {
    if (module.listScopes.length === 0) {
        return module.basePath;
    }

    const hasTopLevelList = module.operations.includes('list');

    const resolved = resolveParentScope(module.listScopes, workspace, explicitParams);
    if (resolved) {
        return substituteParams(resolved.path, resolved.params);
    }

    if (hasTopLevelList) {
        return module.basePath;
    }

    throw new ZentaoError('E4002');
}

/** 详情接口：`{basePath}/{id}` */
export function resolveDetailPath(module: ModuleDefinition, id: string | number): string {
    return `${module.basePath}/${id}`;
}

/** 创建接口：POST 到模块 `basePath` */
export function resolveCreatePath(module: ModuleDefinition): string {
    return module.basePath;
}

/** 扩展操作：`{basePath}/{id}/{action}` */
export function resolveActionPath(module: ModuleDefinition, action: string, id: string | number): string {
    const actionDef = module.actions.find((a) => a.name === action);
    if (!actionDef) {
        throw new ZentaoError('E2005');
    }
    return `${module.basePath}/${id}/${action}`;
}

/** 返回扩展操作对应的 HTTP 方法，未命中定义时默认 `put` */
export function getActionMethod(module: ModuleDefinition, action: string): string {
    const actionDef = module.actions.find((a) => a.name === action);
    return actionDef?.method ?? 'put';
}

/** 列出模块在 `actions` 中声明的扩展操作名 */
export function getAvailableActions(module: ModuleDefinition): string[] {
    return module.actions.map((a) => a.name);
}
