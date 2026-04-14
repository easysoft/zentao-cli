import { ModuleDefinition } from "../types";
import { MODULES } from "./registry";

const moduleNames = MODULES.map(x => x.name);

const moduleMap = new Map<string, ModuleDefinition>(MODULES.map(x => [x.name.toLowerCase(), x]));

/** 按名称（大小写不敏感）查找模块定义 */
export function getModule(name: string): ModuleDefinition | undefined {
    return moduleMap.get(name.toLowerCase());
}

/** 返回所有已注册模块名，用于生成动态子命令 */
export function getModuleNames(): string[] {
    return moduleNames;
}

/** 判断给定字符串是否为已注册模块名 */
export function isModuleName(name: string): boolean {
    return moduleMap.has(name.toLowerCase());
}
