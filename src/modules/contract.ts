import { getModuleActionParams } from 'zentao-api';
import type { ModuleAction, ModuleDefinition } from '../types/index.js';
import { supportsBatch } from './targets.js';
import type { ValueSchema } from './validation.js';

export function kebabCase(name: string): string {
    return name.replace(/IDs\b/g, 'Ids').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function actionParameters(mod: ModuleDefinition, action: ModuleAction) {
    const body = action.requestBody?.schema.properties as Record<string, ValueSchema> | undefined;
    return getModuleActionParams(mod.name, action.name).map(param => ({
        ...param,
        ...(param.role === 'body' ? body?.[param.name] : {}),
        type: (param.role === 'body' ? body?.[param.name]?.type : undefined) ?? param.type
            ?? (param.role === 'path' && param.name.endsWith('ID') ? 'integer' : 'string'),
    }));
}

export function paginationFields(mod: ModuleDefinition, action: ModuleAction) {
    if (action.type !== 'list' || !action.pagerGetter) return undefined;
    const params = actionParameters(mod, action);
    const page = params.find(param => ['pageID', 'page'].includes(param.name));
    const size = params.find(param => ['recPerPage', 'limit'].includes(param.name));
    return page && size ? { page, size } : undefined;
}

export function actionContract(mod: ModuleDefinition, action: ModuleAction) {
    const parameters = actionParameters(mod, action);
    const pagination = paginationFields(mod, action);
    const target = parameters.find(param => param.role === 'path' && !['scope', 'scopeID'].includes(param.name));
    return {
        module: mod.name, action: action.name, command: `${mod.name} ${kebabCase(action.name)}`,
        display: action.display, description: action.description, type: action.type,
        path: action.path, method: action.method, minVersion: action.minVersion,
        parameters: parameters.map(param => ({ ...param, flag: `--${kebabCase(param.name)}` })),
        target: target?.name, batch: supportsBatch(action),
        pagination: pagination ? { page: pagination.page.name, pageSize: pagination.size.name } : null,
        requestBody: action.requestBody,
        autoFill: action.type === 'update' && mod.actions.some(item => item.type === 'get' && item.path === action.path),
        localFiles: action.requestBody?.mediaType === 'multipart/form-data',
    };
}
