import { getModuleActionParams } from './helper.js';
import type { ModuleAction, ModuleActionParam, ModuleDefinition } from '../types/index.js';
import { supportsBatch } from './targets.js';
import { supportsFileUrl } from './file-url.js';
import type { ValueSchema } from './validation.js';

export function kebabCase(name: string): string {
    return name.replace(/IDs\b/g, 'Ids').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// Reserve global and processing flags so business fields cannot be consumed by Commander.
export function parameterFlag(name: string): string {
    const flag = kebabCase(name);
    return `--${['deadline', 'timeout', 'profile', 'config', 'format', 'color', 'input', 'yes', 'quiet', 'insecure', 'assistant', 'data', 'ids', 'fields', 'markdown', 'all', 'max-items', 'filter', 'sort', 'search'].includes(flag) ? 'data-' : ''}${flag}`;
}

export function pathIdType(mod: ModuleDefinition, action: ModuleAction, name: string) {
    if (!name.endsWith('ID')) return undefined;
    return mod.name === 'file' && action.name === 'get' && name === 'fileID' ? ['integer', 'string'] as const : 'integer';
}

export function actionParameters(mod: ModuleDefinition, action: ModuleAction) {
    const body = action.requestBody?.schema.properties as Record<string, ValueSchema> | undefined;
    return getModuleActionParams(mod.name, action.name).map(param => ({
        ...param,
        ...(param.role === 'body' ? body?.[param.name] : {}),
        type: (param.role === 'body' ? body?.[param.name]?.type : undefined) ?? param.type
            ?? (param.role === 'path' ? pathIdType(mod, action, param.name) : undefined) ?? 'string',
    }));
}

export function paginationFields(mod: ModuleDefinition, action: ModuleAction) {
    if (action.type !== 'list' || !action.pagerGetter) return undefined;
    const params = actionParameters(mod, action);
    const page = params.find(param => ['pageID', 'page'].includes(param.name));
    const size = params.find(param => ['recPerPage', 'limit'].includes(param.name));
    return page && size ? { page, size } : undefined;
}

export function canAutoFill(mod: ModuleDefinition, action: ModuleAction): boolean {
    // The file detail exposes title, while renaming requires a new fileName.
    return action.type === 'update' && !(mod.name === 'file' && action.name === 'update')
        && mod.actions.some(detail => detail.type === 'get' && detail.path === action.path);
}

export function defaultTableFields(objectType?: string) {
    if (!objectType) return [];
    if (objectType === 'user') return ['id', 'account', 'realname', 'dept', 'role', 'status'];
    return ['id', 'title', 'name', 'status', ...(objectType === 'bug' ? ['severity'] : []), 'assignedTo'];
}

type InputParam = Pick<ModuleActionParam, 'name' | 'role' | 'textType'> & Pick<ValueSchema, 'type'>;

export function htmlInputFields(moduleName: string, actionName: string,
    parameters: readonly InputParam[] = getModuleActionParams(moduleName, actionName)): string[] {
    // SDK 0.9 documents weekly/update.content as HTML but omits its textType.
    return parameters.filter(param => param.role === 'body' && param.type === 'string'
        && (param.textType === 'html' || (moduleName === 'weekly' && actionName === 'update' && param.name === 'content')))
        .map(param => param.name);
}

export function actionContract(mod: ModuleDefinition, action: ModuleAction) {
    const parameters = actionParameters(mod, action);
    const pagination = paginationFields(mod, action);
    const target = parameters.find(param => param.role === 'path' && !['scope', 'scopeID'].includes(param.name));
    let description = action.description;
    if (supportsFileUrl(mod.name, action.name)) {
        description = action.name === 'get'
            ? '查询附件元数据。位置参数接受数字 ID、Base64 gid 或当前站点的附件 URL。'
            : '读取附件内容。位置参数接受数字 ID 或当前站点的附件 URL。CLI 默认输出 Base64，--format=raw 保留服务端字节或文本。使用 --output <path> 将原始附件流式保存到文件。';
    }
    return {
        module: mod.name, action: action.name, command: `${mod.name} ${kebabCase(action.name)}`,
        display: action.display, type: action.type,
        description,
        path: action.path, method: action.method, minVersion: action.minVersion,
        parameters: parameters.map(param => ({ ...param, flag: parameterFlag(param.name) })),
        markdownFields: htmlInputFields(mod.name, action.name, parameters),
        target: target?.name, batch: supportsBatch(action),
        pagination: pagination ? { page: pagination.page.name, pageSize: pagination.size.name } : null,
        requestBody: action.requestBody,
        readOnly: actionIsReadOnly(action),
        destructive: !actionIsReadOnly(action) && ['update', 'delete', 'action'].includes(action.type),
        autoFill: canAutoFill(mod, action),
        resultObjectType: action.resultObjectType,
        defaultFields: defaultTableFields(typeof action.resultObjectType === 'string' ? action.resultObjectType : undefined),
        localFiles: action.requestBody?.mediaType === 'multipart/form-data',
    };
}

/** POST knowledge search has no side effects; SQL stays excluded until server capability is verified. */
export function actionIsReadOnly(action: ModuleAction): boolean {
    return ((action.type === 'list' || action.type === 'get') && (action.method ?? 'get').toLowerCase() === 'get')
        || (action.type === 'list' && ['/ai/knowledges/search', '/ai/knowledges/embeddingssearch'].includes(action.path));
}
