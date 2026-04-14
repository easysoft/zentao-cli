import type { ZentaoClient } from '../api/client.js';
import type { ModuleDefinition, ApiListResponse, Pager, OutputFormat, Profile } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { resolveListPath, resolveDetailPath, resolveCreatePath, resolveActionPath, getActionMethod, getAvailableActions } from '../modules/resolver.js';
import { getCurrentWorkspace } from '../config/workspace.js';
import { getProfileConfig } from '../config/store.js';
import { convertHtmlFields, convertHtmlFieldsInArray } from '../utils/html.js';
import { filterData, sortData, searchData, pickFields, pickFieldsSingle } from '../utils/data.js';
import { fetchAllPages } from '../utils/pagination.js';
import { formatOutput } from '../utils/format.js';
import { resolveData } from '../utils/stdin.js';
import type { DataOptions } from '../types/index.js';
import { createInterface } from 'node:readline';

type OperationType = 'list' | 'get' | 'create' | 'update' | 'delete' | 'action';

/** 将 `zentao bug 1` / `zentao bug ls` 等 argv 解析为统一的操作描述 */
interface ResolvedOperation {
    type: OperationType;
    objectId?: string;
    actionName?: string;
}

/**
 * 解析模块子命令参数：
 * - 无参数 → 列表
 * - 已知关键字 `create` / `update` / `delete` / `ls` → 对应操作
 * - 与模块 `actions` 匹配的首参 → 扩展操作，次参为对象 ID
 * - 纯数字首参 → 视为详情 `get`
 * - 其余情况回退为列表（例如未知子命令）
 */
export function resolveOperation(
    module: ModuleDefinition,
    args: string[],
): ResolvedOperation {
    if (args.length === 0) {
        return { type: 'list' };
    }

    const first = args[0];

    if (first === 'help') {
        return { type: 'list' };
    }

    const operations = ['create', 'update', 'delete', 'ls', 'help'];
    if (operations.includes(first)) {
        if (first === 'ls') return { type: 'list' };
        if (first === 'delete') return { type: 'delete', objectId: args[1] };
        if (first === 'update') return { type: 'update', objectId: args[1] };
        if (first === 'create') return { type: 'create' };
        return { type: 'list' };
    }

    const actions = getAvailableActions(module);
    if (actions.includes(first)) {
        return { type: 'action', actionName: first, objectId: args[1] };
    }

    if (/^\d+$/.test(first)) {
        return { type: 'get', objectId: first };
    }

    return { type: 'list' };
}

/** JSON/raw 模式下跳过交互确认，便于脚本化调用 */
async function confirmDelete(format: string, count: number): Promise<boolean> {
    if (format === 'json' || format === 'raw') return true;

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve) => {
        rl.question(`确认删除 ${count} 个对象？(y/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

/**
 * 执行模块级 CRUD 或扩展操作：负责拼路径、分页拉取、客户端过滤/排序、HTML 转 Markdown 及格式化输出。
 */
export async function handleModuleCommand(
    client: ZentaoClient,
    module: ModuleDefinition,
    profile: Profile,
    operation: ResolvedOperation,
    opts: DataOptions,
    extraArgs: string[],
): Promise<void> {
    const config = getProfileConfig(profile);
    const format = (opts.format ?? config.defaultOutputFormat ?? 'markdown') as OutputFormat;
    const silent = opts.silent ?? config.silent ?? false;
    const workspace = getCurrentWorkspace(profile);
    const shouldConvertHtml = config.htmlToMarkdown !== false;

    const explicitParams: Record<string, number> = {};
    if (opts.product) explicitParams.product = Number(opts.product);
    if (opts.project) explicitParams.project = Number(opts.project);
    if (opts.execution) explicitParams.execution = Number(opts.execution);

    switch (operation.type) {
        case 'list': {
            const path = resolveListPath(module, workspace, explicitParams);
            const queryParams: Record<string, string | number> = {};
            // 未知选项在 register-modules 中也会进入 extraArgs；此处仅收集 `key=value` 形式作为查询参数透传给 API
            for (const arg of extraArgs) {
                const match = arg.match(/^--(\w+)=(.+)$/);
                if (match) queryParams[match[1]] = match[2];
            }

            const paginationOpts = {
                page: opts.page ? Number(opts.page) : 1,
                recPerPage: opts.recPerPage ? Number(opts.recPerPage) : (config.pagers?.[module.name] ?? config.defaultRecPerPage ?? 20),
                all: opts.all,
                limit: opts.limit ? Number(opts.limit) : undefined,
                queryParams,
            };

            const { data, pager } = await fetchAllPages<Record<string, unknown>>(
                client, path, module.pluralKey, paginationOpts,
            );

            let processed: Record<string, unknown>[] = data;

            if (shouldConvertHtml) {
                processed = convertHtmlFieldsInArray(processed);
            }
            if (opts.filter?.length) {
                processed = filterData(processed, opts.filter);
            }
            if (opts.search?.length) {
                const searchFields = opts.searchFields?.split(',');
                processed = searchData(processed, opts.search, searchFields);
            }
            if (opts.sort) {
                processed = sortData(processed, opts.sort);
            }

            const fields = opts.pick?.split(',');
            if (fields) {
                processed = pickFields(processed, fields);
            }

            if (!silent) {
                const output = formatOutput(processed, { format, isList: true, fields, pager, jsonPretty: config.jsonPretty });
                if (output) console.log(output);
            }
            break;
        }

        case 'get': {
            if (!operation.objectId) throw new ZentaoError('E2003', { fields: 'id', module: module.name });
            const path = resolveDetailPath(module, operation.objectId);
            const response = await client.get(path);
            let obj = (response[module.singularKey] ?? response) as Record<string, unknown>;

            if (shouldConvertHtml) {
                obj = convertHtmlFields(obj);
            }

            const fields = opts.pick?.split(',');
            if (fields) {
                obj = pickFieldsSingle(obj, fields);
            }

            if (!silent) {
                const output = formatOutput(obj, { format, isList: false, fields, rawResponse: response, jsonPretty: config.jsonPretty });
                if (output) console.log(output);
            }
            break;
        }

        case 'create': {
            let body = await resolveData(opts.data);
            if (!body) {
                body = buildBodyFromArgs(extraArgs);
            }

            if (Array.isArray(body)) {
                await handleBatchCreate(client, module, body as Record<string, unknown>[], opts, format, silent, profile);
            } else {
                const path = resolveCreatePath(module);
                const response = await client.post(path, body);
                if (!silent) {
                    const output = formatOutput(response, { format, isList: false, rawResponse: response, jsonPretty: config.jsonPretty });
                    if (output) console.log(output);
                }
            }
            break;
        }

        case 'update': {
            let body = await resolveData(opts.data);
            if (!body) {
                body = buildBodyFromArgs(extraArgs);
            }

            if (Array.isArray(body)) {
                await handleBatchUpdate(client, module, body as Array<Record<string, unknown> & { id: number }>, opts, format, silent, profile);
            } else {
                if (!operation.objectId) throw new ZentaoError('E2003', { fields: 'id', module: module.name });
                const path = resolveDetailPath(module, operation.objectId);
                const response = await client.put(path, body);
                if (!silent) {
                    const output = formatOutput(response, { format, isList: false, rawResponse: response, jsonPretty: config.jsonPretty });
                    if (output) console.log(output);
                }
            }
            break;
        }

        case 'delete': {
            if (!operation.objectId) throw new ZentaoError('E2003', { fields: 'id', module: module.name });
            const ids = operation.objectId.split(',').map((s) => s.trim());

            if (!opts.yes && ids.length > 0) {
                const confirmed = await confirmDelete(format, ids.length);
                if (!confirmed) {
                    if (!silent) console.log('已取消');
                    return;
                }
            }

            const success: string[] = [];
            const failed: string[] = [];
            const skipped: string[] = [];
            const errors: Array<{ objectID: string; error: { code: string; message: string } }> = [];
            const failFast = opts.batchFailFast ?? config.batchFailFast ?? false;

            for (const id of ids) {
                // failFast：一旦出现失败，后续 ID 不再请求接口，仅记入 skipped
                if (failFast && failed.length > 0) {
                    skipped.push(id);
                    continue;
                }
                try {
                    const path = resolveDetailPath(module, id);
                    await client.del(path);
                    success.push(id);
                } catch (error) {
                    failed.push(id);
                    if (error instanceof ZentaoError) {
                        errors.push({ objectID: id, error: { code: error.code, message: error.message } });
                    }
                }
            }

            if (!silent) {
                if (format === 'json' || format === 'raw') {
                    const result: Record<string, unknown> = {
                        status: failed.length > 0 ? 'fail' : 'success',
                        result: { success, failed, skipped },
                    };
                    if (errors.length > 0) {
                        (result.result as Record<string, unknown>).errors = errors;
                        result.error = errors[0].error;
                    }
                    console.log(JSON.stringify(result, null, 4));
                } else {
                    if (success.length > 0) {
                        console.log(`已删除 ${success.length} 个${module.name}：${success.join(', ')}`);
                    }
                    if (failed.length > 0) {
                        console.log(`操作失败：${failed.join(', ')}`);
                        if (errors.length > 0) {
                            console.log(`失败原因：Error(E${errors[0].error.code}): ${errors[0].error.message}`);
                        }
                    }
                    if (skipped.length > 0) {
                        console.log(`已跳过 ${skipped.length} 个${module.name}：${skipped.join(', ')}`);
                    }
                }
            }
            break;
        }

        case 'action': {
            if (!operation.actionName) throw new ZentaoError('E2005');
            if (!operation.objectId) throw new ZentaoError('E2003', { fields: 'id', module: module.name });

            const path = resolveActionPath(module, operation.actionName, operation.objectId);
            const method = getActionMethod(module, operation.actionName);

            let body = await resolveData(opts.data);
            if (!body) {
                body = buildBodyFromArgs(extraArgs);
            }

            const response = method === 'put'
                ? await client.put(path, body)
                : await client.post(path, body);

            if (!silent) {
                const output = formatOutput(response, { format, isList: false, rawResponse: response, jsonPretty: config.jsonPretty });
                if (output) console.log(output);
            }
            break;
        }
    }
}

/** 顺序提交多条创建请求，聚合响应后一次性输出 */
async function handleBatchCreate(
    client: ZentaoClient,
    module: ModuleDefinition,
    items: Record<string, unknown>[],
    opts: DataOptions,
    format: OutputFormat,
    silent: boolean,
    profile: Profile,
): Promise<void> {
    const results: unknown[] = [];
    for (const item of items) {
        const path = resolveCreatePath(module);
        const response = await client.post(path, item);
        results.push(response);
    }
    if (!silent) {
        const config = getProfileConfig(profile);
        const output = formatOutput(results, { format, isList: true, jsonPretty: config.jsonPretty });
        if (output) console.log(output);
    }
}

/** 批量更新：每项必须含 `id` 字段，其余字段作为 PUT 请求体 */
async function handleBatchUpdate(
    client: ZentaoClient,
    module: ModuleDefinition,
    items: Array<Record<string, unknown> & { id: number }>,
    opts: DataOptions,
    format: OutputFormat,
    silent: boolean,
    profile: Profile,
): Promise<void> {
    const results: unknown[] = [];
    for (const item of items) {
        const { id, ...body } = item;
        const path = resolveDetailPath(module, id);
        const response = await client.put(path, body);
        results.push(response);
    }
    if (!silent) {
        const config = getProfileConfig(profile);
        const output = formatOutput(results, { format, isList: true, jsonPretty: config.jsonPretty });
        if (output) console.log(output);
    }
}

/** 将 `--field=value` 形式的 argv 转为 JSON 体，并对布尔值与纯数字做简单类型推断 */
function buildBodyFromArgs(args: string[]): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const arg of args) {
        const match = arg.match(/^--(\w[\w.-]*)=(.*)$/);
        if (match) {
            const key = match[1];
            let value: unknown = match[2];
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (/^\d+$/.test(value as string)) value = Number(value);
            body[key] = value;
        }
    }
    return body;
}
