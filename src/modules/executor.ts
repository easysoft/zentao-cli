import type { ZentaoClient } from '../api/client.js';
import { ZentaoError } from '../errors.js';
import type {
    ListPagerInfo,
    ModuleAction,
    ModuleActionName,
    ModuleActionOptions,
    ModuleDefinition,
    ResolvedModuleCommand,
    UserConfig,
} from '../types/index.js';
import { filterData, pickFields, pickFieldsSingle, searchData, sortData } from '../utils/data.js';
import { convertHtmlFields, convertHtmlFieldsInArray } from '../utils/html.js';
import { getModule } from './helper.js';
import { extractPager, extractResult, findAction, resolveActionUrl, resolveModuleCommand } from './resolver.js';

export interface ModuleExecutionResult {
    command: ResolvedModuleCommand;
    data: unknown;
    rawResponse: Record<string, unknown>;
    pager?: ListPagerInfo;
    fields?: string[];
    isList: boolean;
}

function parseFields(fields?: string): string[] | undefined {
    const parsed = fields?.split(',').map((field) => field.trim()).filter(Boolean);
    return parsed && parsed.length > 0 ? parsed : undefined;
}

export async function executeModuleCommand(
    client: ZentaoClient,
    module: ModuleDefinition,
    actionName: ModuleActionName,
    args: string[],
    options: ModuleActionOptions,
    config: UserConfig,
): Promise<ModuleExecutionResult> {
    const command = resolveModuleCommand(module, actionName, options, args);
    return executeResolvedModuleCommand(client, command, options, config);
}

export async function executeResolvedModuleCommand(
    client: ZentaoClient,
    command: ResolvedModuleCommand,
    options: ModuleActionOptions,
    config: UserConfig,
): Promise<ModuleExecutionResult> {
    if (command.action.type === 'update') {
        await fillUpdateDataFromCurrent(client, command);
    }

    const rawResponse = await client.request(command.action.method, command.path, {
        query: command.query,
        body: command.data,
    }) as Record<string, unknown>;
    const fields = parseFields(options.pick);

    if (command.action.type === 'list') {
        let data = extractResult(command.action, rawResponse) as Record<string, unknown>[];
        const pager = extractPager(command.action, rawResponse);

        if (config.htmlToMarkdown !== false) {
            data = convertHtmlFieldsInArray(data);
        }
        if (options.filter?.length) {
            data = filterData(data, options.filter);
        }
        if (options.search?.length) {
            data = searchData(data, options.search, options.searchFields?.split(','));
        }
        if (options.sort) {
            data = sortData(data, options.sort);
        }
        if (options.limit && Number(options.limit) < data.length) {
            data = data.slice(0, Number(options.limit));
        }
        if (fields) {
            data = pickFields(data, fields);
        }

        return { command, data, rawResponse, pager, fields, isList: true };
    }

    if (command.action.type === 'get') {
        let data = (extractResult(command.action, rawResponse) ?? rawResponse) as Record<string, unknown>;
        if (config.htmlToMarkdown !== false) {
            data = convertHtmlFields(data);
        }
        if (fields) {
            data = pickFieldsSingle(data, fields);
        }

        return { command, data, rawResponse, fields, isList: false };
    }

    const data = extractResult(command.action, rawResponse);
    return { command, data, rawResponse, fields, isList: false };
}

interface UpdateSchemaProperty {
    type?: string;
    items?: { type?: string };
    required?: boolean;
}

interface UpdateSchema {
    type?: string;
    required?: string[];
    properties?: Record<string, UpdateSchemaProperty>;
}

/**
 * 在执行 update 请求前，自动从当前对象补全用户未提供的字段。
 *
 * 禅道 PUT 接口通常会按提交的字段覆盖原值，未提供的字段可能被清空。为避免用户
 * 只想改一两个字段却把其它字段意外重置，这里先发起一次 GET，把 update schema
 * 中用户未显式设置的字段用当前值填充。
 */
async function fillUpdateDataFromCurrent(
    client: ZentaoClient,
    command: ResolvedModuleCommand,
): Promise<void> {
    if (command.id === undefined) return;

    const schema = command.action.requestBody?.schema as UpdateSchema | undefined;
    if (!schema || schema.type !== 'object' || !schema.properties) return;

    const dataObj = command.data as Record<string, unknown> | undefined;
    if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) return;

    const propertyKeys = Object.keys(schema.properties);
    const missingKeys = propertyKeys.filter((key) => dataObj[key] === undefined);

    if (missingKeys.length === 0) {
        cleanupUndefinedFields(dataObj);
        return;
    }

    const module = getModule(command.module);
    const getAction = module ? findAction(module, 'get') : undefined;

    if (module && getAction) {
        try {
            const currentData = await fetchCurrentObject(client, getAction, command.id);
            if (currentData) {
                for (const key of missingKeys) {
                    const raw = currentData[key];
                    if (raw === undefined || raw === null) continue;
                    const coerced = coerceForSchema(raw, schema.properties[key]);
                    if (coerced !== undefined) {
                        dataObj[key] = coerced;
                    }
                }
            }
        } catch (error) {
            // 仅静默"对象不存在"（E2002），其余如鉴权/网络/权限/证书等错误直接抛出，
            // 避免真实原因被后续禅道服务端的参数错误掩盖、增加排障难度。
            if (!(error instanceof ZentaoError) || error.code !== '2002') {
                throw error;
            }
        }
    }

    const requiredSet = new Set(schema.required ?? []);
    for (const key of propertyKeys) {
        const prop = schema.properties[key];
        const required = prop.required ?? requiredSet.has(key);
        if (required && dataObj[key] === undefined) {
            throw new ZentaoError('E2009', { option: key, reason: '必须提供参数值' });
        }
    }

    cleanupUndefinedFields(dataObj);
}

function cleanupUndefinedFields(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
        if (obj[key] === undefined) {
            delete obj[key];
        }
    }
}

/**
 * 调用 GET action 拉取当前对象，用于 update 自动补全。
 *
 * 假设 GET 路径最多只有一个非 scope 的 ID 参数（例如 `/users/:userID`），
 * 所有 `*ID` 路径参数都使用同一个 `id` 值。当前 registry 中没有需要多 ID 的
 * GET 路径，扩展时需重新评估该假设。
 */
async function fetchCurrentObject(
    client: ZentaoClient,
    getAction: ModuleAction,
    id: number,
): Promise<Record<string, unknown> | undefined> {
    const pathValues: Record<string, string | number> = {};
    if (getAction.pathParams) {
        for (const key of Object.keys(getAction.pathParams)) {
            if (key === 'scope' || key === 'scopeID') continue;
            if (key.endsWith('ID')) {
                pathValues[key] = id;
            }
        }
    }
    if (Object.keys(pathValues).length === 0) return undefined;

    const path = resolveActionUrl(getAction, pathValues);
    const response = await client.request(getAction.method, path, {}) as Record<string, unknown>;
    const result = extractResult(getAction, response);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return undefined;
    return result as Record<string, unknown>;
}

/**
 * 将 GET 返回的字段值适配为 update schema 期望的类型。
 *
 * 禅道 GET 接口经常把关联字段展开成对象（如 `assignedTo: {account, realname}`），
 * 但 PUT 接受的是标量。这里做尽力转换：
 *   - 数字：从对象中取 `id`；字符串/布尔可转就转，否则返回 undefined
 *   - 字符串：从对象中取 `account` / `name` / `id`；标量转 String
 *   - 数组：标量包成数组，元素类型按 items.type 转换
 * 无法可靠转换的值返回 undefined，由后续 required 校验决定行为。
 */
function coerceForSchema(value: unknown, prop: UpdateSchemaProperty | undefined): unknown {
    if (value === undefined || value === null) return undefined;
    const type = prop?.type;

    if (type === 'number' || type === 'integer') {
        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            if (obj.id !== undefined && obj.id !== null) value = obj.id;
            else return undefined;
        }
        const num = Number(value);
        return Number.isNaN(num) ? undefined : num;
    }

    if (type === 'string') {
        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            const picked = obj.account ?? obj.name ?? obj.id;
            return picked === undefined || picked === null ? undefined : String(picked);
        }
        return String(value);
    }

    if (type === 'array') {
        const itemType = prop?.items?.type;
        let arr: unknown[];
        if (Array.isArray(value)) {
            arr = value;
        } else if (typeof value === 'object') {
            // 只把"键全为数字字符串"的伪数组（如 {0: 'a', 1: 'b'}）转换为数组；
            // 普通关联对象（如 {id, account}）无法可靠映射为数组，直接放弃。
            const obj = value as Record<string, unknown>;
            const keys = Object.keys(obj);
            if (keys.length === 0 || !keys.every((k) => /^\d+$/.test(k))) return undefined;
            arr = Object.values(obj);
        } else {
            arr = [value];
        }
        const items = arr.map((item) => {
            if (itemType === 'string') return item === null || item === undefined ? '' : String(item);
            if (itemType === 'number' || itemType === 'integer') {
                if (item === null || item === undefined) return undefined;
                const num = Number(item);
                return Number.isNaN(num) ? undefined : num;
            }
            return item;
        });
        if ((itemType === 'number' || itemType === 'integer') && items.some((item) => item === undefined)) {
            return undefined;
        }
        return items;
    }

    if (type === 'boolean') {
        if (typeof value === 'boolean') return value;
        if (value === '1' || value === 1 || value === 'true') return true;
        if (value === '0' || value === 0 || value === 'false') return false;
        return undefined;
    }

    return value;
}
