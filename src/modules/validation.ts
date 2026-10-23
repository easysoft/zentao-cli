import { getModuleActionParams } from 'zentao-api';
import type { ModuleAction, ModuleDefinition } from '../types/index.js';
import { ZentaoError } from '../errors.js';

// The SDK retains these schema constraints at runtime, beyond its public param type.
export interface ValueSchema {
    type?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
    items?: ValueSchema;
    options?: readonly { value: unknown }[];
}

export function validateValue(name: string, value: unknown, schema: ValueSchema): void {
    const invalid = (reason: string): never => { throw new ZentaoError('E2009', { option: name, reason }); };
    const { type } = schema;
    if (type === 'number' || type === 'integer') {
        if (typeof value !== 'number' || !Number.isFinite(value)) invalid('必须为有限数字');
        if (type === 'integer' && !Number.isSafeInteger(value)) invalid('必须为安全整数');
    } else if (type === 'array' ? !Array.isArray(value)
        : type === 'object' ? !value || typeof value !== 'object' || Array.isArray(value)
            : type && typeof value !== type) {
        invalid(`必须为 ${type} 类型`);
    }
    if (typeof value === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) invalid(`不能小于 ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) invalid(`不能大于 ${schema.maximum}`);
    }
    if (typeof value === 'string') {
        const length = [...value].length;
        if (schema.minLength !== undefined && length < schema.minLength) invalid(`长度不能少于 ${schema.minLength}`);
        if (schema.maxLength !== undefined && length > schema.maxLength) invalid(`长度不能超过 ${schema.maxLength}`);
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) invalid(`格式必须符合 ${schema.pattern}`);
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) invalid(`至少需要 ${schema.minItems} 个元素`);
        if (schema.maxItems !== undefined && value.length > schema.maxItems) invalid(`最多允许 ${schema.maxItems} 个元素`);
        if (schema.items) value.forEach((item, index) => validateValue(`${name}[${index}]`, item, schema.items!));
    }
    if (schema.options?.length) {
        const values = Array.isArray(value) ? value : [value];
        if (values.some(item => !schema.options!.some(option => option.value === item))) {
            invalid(`可选值：${schema.options.map(option => option.value).join(', ')}`);
        }
    }
}

/** Validate the SDK's declared contract before authentication or any HTTP call. */
export function validateToolParams(mod: ModuleDefinition, action: ModuleAction, params: Record<string, unknown>): void {
    const definitions = getModuleActionParams(mod.name, action.name);
    if (params.data !== undefined && (!params.data || typeof params.data !== 'object' || Array.isArray(params.data))) {
        throw new ZentaoError('E2009', { option: 'data', reason: '请求体必须为 JSON 对象' });
    }
    const body = (params.data ?? {}) as Record<string, unknown>;
    const write = Boolean(action.requestBody);
    const invalid = (option: string, reason: string): never => { throw new ZentaoError('E2009', { option, reason }); };
    for (const name of Object.keys(params)) {
        if (name === 'data' && write) continue;
        if (!definitions.some(param => param.name === name)) invalid(name, `操作 ${mod.name}/${action.name} 不支持此参数`);
    }
    for (const name of Object.keys(body)) {
        if (!definitions.some(param => param.name === name && param.role === 'body')) invalid(`data.${name}`, '不是此操作的请求体字段');
        if (params[name] !== undefined && JSON.stringify(params[name]) !== JSON.stringify(body[name])) invalid(name, 'params 与 params.data 中的参数值冲突');
    }
    const autoFill = action.type === 'update' && mod.actions.some(candidate => candidate.type === 'get' && candidate.path === action.path);
    const bodyProperties = action.requestBody?.schema.properties as Record<string, ValueSchema> | undefined;
    for (const param of definitions) {
        const fromBody = param.role === 'body' && Object.hasOwn(body, param.name);
        const value = fromBody ? body[param.name] : params[param.name];
        if (value === undefined) {
            if (param.required && param.defaultValue === undefined && !(param.role === 'body' && autoFill)) {
                throw new ZentaoError('E2003', { fields: param.name, module: mod.name });
            }
            continue;
        }
        const pathID = param.role === 'path' && param.name.endsWith('ID');
        // Flattened SDK params convert integer to number; recover the original body type.
        validateValue(param.name, value, { ...param, type: param.type ?? (pathID ? 'number' : undefined), ...(param.role === 'body' ? bodyProperties?.[param.name] : {}) });
        if (typeof value === 'number') {
            if ((pathID || param.name.endsWith('ID') || ['pageID', 'recPerPage'].includes(param.name)) && (!Number.isSafeInteger(value) || value < 0)) {
                invalid(param.name, '必须为非负安全整数');
            }
            if ((param.name === 'pageID' || param.name === 'recPerPage') && value < 1) invalid(param.name, '必须为大于 0 的整数');
            if (param.name === 'recPerPage' && value > 1000) invalid(param.name, '不能超过 1000');
        }
    }
}
