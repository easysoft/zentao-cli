import { brandText, brandMetadata } from '../brand.js';
import {
    extendModuleAction,
    getModule as sdkGetModule,
    getModuleAction as sdkGetModuleAction,
    getModuleNames as sdkGetModuleNames,
    getObjectProps as sdkGetObjectProps,
    getModuleActionParams as sdkGetModuleActionParams,
} from 'zentao-api';
import type { ModuleDefinition, ModuleAction, ModuleActionType } from '../types/index.js';

// SDK 0.9 converts number-like gids (e.g. "1e03") to numbers before encoding the path.
extendModuleAction('file', 'get', action => {
    const encodePath = action.beforeRequest!;
    return { ...action, beforeRequest(request) {
        const id = request.params.fileID;
        if (request.params.id === undefined && typeof id === 'string' && !/^\d+$/.test(id)) {
            request.path = action.path.replace('{fileID}', id);
        }
        return encodePath(request);
    } };
});

/** 按名称（大小写不敏感）查找模块定义；未注册时返回 undefined */
export function getModule(name: string): ModuleDefinition | undefined {
    if (!name) return undefined;
    try {
        return brandMetadata(sdkGetModule(name));
    } catch {
        return undefined;
    }
}

/** 返回所有已注册模块名，用于生成动态子命令 */
export function getModuleNames(): string[] {
    return sdkGetModuleNames();
}

/** 判断给定字符串是否为已注册模块名（大小写不敏感） */
export function isModuleName(name: string): boolean {
    return getModule(name) !== undefined;
}

/** 返回所有已注册模块定义 */
export function getAllModules(): ModuleDefinition[] {
    return sdkGetModuleNames().map((name) => brandMetadata(sdkGetModule(name)!));
}

/** 返回模块对应对象的属性名及中文说明 */
export function getObjectProps(moduleName: string): Record<string, string> {
    return Object.fromEntries(Object.entries(sdkGetObjectProps(moduleName) ?? {}).map(([key, value]) => [key, brandText(value)]));
}

/** 按动作名解析 action：支持 `ls` 别名、基础 CRUD 与扩展 action */
export function getAction(mod: ModuleDefinition, actionName: string): ModuleAction | undefined {
    return brandMetadata(sdkGetModuleAction(mod.name, actionName));
}

/** 从模块中查找指定类型（和可选名称）的 action */
export function findAction(
    mod: ModuleDefinition,
    type: ModuleActionType,
    name?: string,
): ModuleAction | undefined {
    if (name) {
        return mod.actions.find((a) => a.type === type && a.name === name);
    }
    return mod.actions.find((a) => a.type === type);
}

/** Include named list/get/create/update/delete operations as well as state transitions. */
export function getAvailableActions(mod: ModuleDefinition): string[] {
    return mod.actions.filter((a) => !['list', 'get', 'create', 'update', 'delete'].includes(a.name)).map((a) => a.name);
}

/** Shared action description for CLI help and MCP discovery. */
export function getActionDescription(action: ModuleAction): string {
    return `${action.display ?? action.name}（最低版本：${action.minVersion.join(' / ')}）`;
}

export const getModuleActionParams: typeof sdkGetModuleActionParams = (moduleName, actionName, options) => {
    const params = sdkGetModuleActionParams(moduleName, actionName, options);
    // The SDK consumes an explicit upload uid even though object schemas omit it.
    if (params.some(param => param.role === 'body' && param.textType === 'html') && !params.some(param => param.name === 'uid')) {
        const action = sdkGetModuleAction(moduleName, actionName)!;
        const method = action.method?.toUpperCase();
        if ((method === 'POST' || method === 'PUT') && (action.requestBody?.mediaType ?? 'application/json') === 'application/json') {
            params.push({
                name: 'uid', role: 'body', type: 'string', required: false,
                description: '预上传图片的批次标识。使用上传时的 Token 和 uid 保存单个对象以绑定图片。需 23.0 / biz14.0 / max9.0 / ipd6.0 或更新版本。',
            });
        }
    }
    return brandMetadata(params);
};
