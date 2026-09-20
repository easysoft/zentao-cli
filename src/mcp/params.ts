import { getModuleActionParams } from 'zentao-api';
import type { ModuleAction, ModuleDefinition } from '../types/index.js';
import { ZentaoError } from '../errors.js';

export interface ToolParamsInput {
    id?: number;
    product?: number;
    project?: number;
    execution?: number;
    params?: Record<string, unknown>;
    page?: number;
    recPerPage?: number;
}

/** Resolve MCP aliases against the selected action, keeping JSON values intact. */
export function normalizeToolParams(mod: ModuleDefinition, action: ModuleAction, input: ToolParamsInput): Record<string, unknown> {
    const params = { ...input.params };
    const definitions = getModuleActionParams(mod.name, action.name);
    const names = new Set(definitions.map(param => param.name));
    const pathNames = Object.keys(action.pathParams ?? {});
    const scoped = pathNames.includes('scope');
    const invalid = (option: string, reason: string): never => { throw new ZentaoError('E2009', { option, reason }); };
    const assign = (name: string, value: unknown) => {
        if (value === undefined) return;
        if (params[name] !== undefined && String(params[name]) !== String(value)) {
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
            const target = names.has(idName) ? idName : names.has(name) ? name : undefined;
            if (!target) invalid(name, `操作 ${mod.name}/${action.name} 不支持此范围参数`);
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

    if (['create', 'update', 'action'].includes(action.type)) {
        if (params.data !== undefined && (!params.data || typeof params.data !== 'object' || Array.isArray(params.data))) {
            invalid('params.data', 'MCP 请求体必须是 JSON 对象，请勿使用 CLI 字符串或管道语法');
        }
        // An explicit JSON body keeps MCP away from CLI stdin resolution.
        params.data ??= {};
    }
    return params;
}
