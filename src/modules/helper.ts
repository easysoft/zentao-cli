import {
    getModule as sdkGetModule,
    getModuleAction as sdkGetModuleAction,
    getModuleNames as sdkGetModuleNames,
    getObjectProps as sdkGetObjectProps,
} from 'zentao-api';
import type { ModuleDefinition, ModuleAction, ModuleActionType } from '../types/index.js';

/** 按名称（大小写不敏感）查找模块定义；未注册时返回 undefined */
export function getModule(name: string): ModuleDefinition | undefined {
    if (!name) return undefined;
    try {
        return sdkGetModule(name);
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
    return sdkGetModuleNames().map((name) => sdkGetModule(name)!);
}

/** 返回模块对应对象的属性名及中文说明 */
export function getObjectProps(moduleName: string): Record<string, string> {
    return sdkGetObjectProps(moduleName) ?? {};
}

/** 按动作名解析 action：支持 `ls` 别名、基础 CRUD 与扩展 action */
export function getAction(mod: ModuleDefinition, actionName: string): ModuleAction | undefined {
    return sdkGetModuleAction(mod.name, actionName);
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

/** 返回所有 type === 'action' 的扩展操作名称列表 */
export function getAvailableActions(mod: ModuleDefinition): string[] {
    return mod.actions.filter((a) => a.type === 'action').map((a) => a.name);
}
