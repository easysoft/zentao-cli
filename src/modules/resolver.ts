import type { ModuleDefinition, ParentScope } from '../types/index.js';
import type { Workspace } from '../types/config.js';
import { ZentaoError } from '../errors.js';

function substituteParams(template: string, params: Record<string, string | number>): string {
    return template.replace(/:(\w+)/g, (_, key) => {
        const value = params[key];
        if (value === undefined) {
            throw new Error(`Missing path parameter: ${key}`);
        }
        return String(value);
    });
}

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

export function resolveListPath(
    module: ModuleDefinition,
    workspace?: Workspace,
    explicitParams?: Record<string, number>,
): string {
    if (module.listScopes.length === 0) {
        return module.basePath;
    }

    // If module has a top-level list (basePath matches operations), use it as fallback
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

export function resolveDetailPath(module: ModuleDefinition, id: string | number): string {
    return `${module.basePath}/${id}`;
}

export function resolveCreatePath(module: ModuleDefinition): string {
    return module.basePath;
}

export function resolveActionPath(module: ModuleDefinition, action: string, id: string | number): string {
    const actionDef = module.actions.find((a) => a.name === action);
    if (!actionDef) {
        throw new ZentaoError('E2005');
    }
    return `${module.basePath}/${id}/${action}`;
}

export function getActionMethod(module: ModuleDefinition, action: string): string {
    const actionDef = module.actions.find((a) => a.name === action);
    return actionDef?.method ?? 'put';
}

export function getAvailableActions(module: ModuleDefinition): string[] {
    return module.actions.map((a) => a.name);
}
