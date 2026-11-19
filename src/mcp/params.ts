import { getModuleActionParams } from '../modules/helper.js';
import type { ModuleAction, ModuleDefinition } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { validateToolParams } from '../modules/validation.js';
import { resolveFileUrl, supportsFileUrl } from '../modules/file-url.js';

export interface ToolParamsInput {
    id?: number;
    url?: string;
    product?: number;
    project?: number;
    execution?: number;
    params?: Record<string, unknown>;
    page?: number;
    recPerPage?: number;
}

/** Numeric shortcuts apply only to numeric fields or a supported scoped path. */
export function getScopeAliasTarget(mod: ModuleDefinition, action: ModuleAction, name: string): string | undefined {
    const definitions = getModuleActionParams(mod.name, action.name);
    if (definitions.some(param => param.role === 'path' && param.name === 'scope' && param.options?.some(option => option.value === `${name}s`))) {
        return 'scopeID';
    }
    return [`${name}ID`, name].find(target => definitions.some(param => param.name === target
        && (param.type === 'number' || (param.role === 'path' && !param.type && target.endsWith('ID')))));
}

/** Resolve MCP aliases against the selected action, keeping JSON values intact. */
export function normalizeToolParams(mod: ModuleDefinition, action: ModuleAction, input: ToolParamsInput, checkFileUrlSite?: (url: string) => void): Record<string, unknown> {
    const params = { ...input.params };
    const pathNames = Object.keys(action.pathParams ?? {});
    const scoped = pathNames.includes('scope');
    const invalid = (option: string, reason: string): never => { throw new ZentaoError('E2009', { option, reason }); };
    if (input.url !== undefined) {
        if (!supportsFileUrl(mod.name, action.name)) invalid('url', '附件链接仅适用于 file get 和 file read');
        if (input.id !== undefined || params.id !== undefined || params.fileID !== undefined) invalid('url', '附件链接与文件 ID 只能指定一个');
        params.fileID = resolveFileUrl(input.url, checkFileUrlSite);
    }
    const assign = (name: string, value: unknown) => {
        if (value === undefined) return;
        const existing = params[name];
        const sameNumericInput = (typeof existing === 'string' && typeof value === 'number' && existing === String(value))
            || (typeof existing === 'number' && typeof value === 'string' && String(existing) === value);
        if (existing !== undefined && existing !== value && !sameNumericInput) {
            invalid(name, '简写与 params 中的参数值冲突');
        }
        params[name] = value;
    };

    for (const name of ['product', 'project', 'execution'] as const) {
        const alias = input[name];
        const idName = `${name}ID`;
        if (scoped) {
            const values = [alias, params[name], params[idName]].filter(value => value !== undefined);
            if (values.length) {
                assign('scope', `${name}s`);
                for (const value of values) assign('scopeID', value);
                delete params[name];
                delete params[idName];
            }
        } else if (alias !== undefined) {
            const target = getScopeAliasTarget(mod, action, name);
            if (!target) invalid(name, `操作 ${mod.name}/${action.name} 不支持此数字简写，请按字段类型使用 params`);
            assign(target!, alias);
        }
    }

    const idName = pathNames.find(name => name.endsWith('ID') && name !== 'scopeID');
    if (input.id !== undefined || params.id !== undefined) {
        if (!idName) invalid('id', `操作 ${mod.name}/${action.name} 没有可简写的路径 ID`);
        assign(idName!, input.id);
        assign(idName!, params.id);
        delete params.id;
    }
    assign('pageID', input.page);
    assign('recPerPage', input.recPerPage);

    if (action.requestBody) {
        if (params.data !== undefined && (!params.data || typeof params.data !== 'object' || Array.isArray(params.data))) {
            invalid('params.data', 'MCP 请求体必须是 JSON 对象，请勿使用 CLI 字符串或管道语法');
        }
        // An explicit JSON body keeps MCP away from CLI stdin resolution.
        params.data ??= {};
    }
    validateToolParams(mod, action, params);
    return params;
}
