import type { ZentaoClient } from '../api/index.js';
import type { ModuleDefinition, Profile, ModuleActionName, UserConfig } from '../types/index.js';
import { getAction, getObjectProps } from '../modules/helper.js';
import { executeModuleCommand } from '../modules/executor.js';
import { buildParams } from '../modules/args.js';
import type { ModuleExecutionResult } from '../modules/executor.js';
import { getProfileConfig } from '../config/store.js';
import { formatJson, formatOutput } from '../utils/format.js';
import type { ModuleActionOptions } from '../types/index.js';
import { createInterface } from 'node:readline/promises';
import { renderObject } from '../utils/render.js';
import { ZentaoError } from '../errors.js';
import { commandSignal } from '../utils/lifecycle.js';
import { batchTargets } from '../modules/targets.js';


async function confirmDelete(format: string, count: number, machineReadable = false): Promise<boolean> {
    if (machineReadable || format === 'json' || format === 'raw' || !process.stdin.isTTY || !process.stderr.isTTY) {
        throw new ZentaoError('E2009', {
            option: 'yes',
            reason: '非交互或机器可读模式下删除必须显式传入 --yes',
        });
    }

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        const answer = await rl.question(`确认删除 ${count} 个对象？(y/n): `, { signal: commandSignal() });
        return answer.toLowerCase() === 'y';
    } finally {
        rl.close();
    }
}

function renderModuleExecution(
    execution: ModuleExecutionResult,
    options: ModuleActionOptions,
    config: UserConfig,
): void {
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';

    if (format === 'raw') {
        const output = formatOutput(execution.data, {
            format,
            isList: execution.isList,
            fields: execution.fields,
            pager: execution.pager,
            meta: execution.meta,
            jsonPretty: config.jsonPretty,
            rawResponse: execution.rawResponse,
        });
        if (output) console.log(output);
        return;
    }

    if (execution.action.type === 'list') {
        const output = formatOutput(execution.data, {
            format,
            isList: true,
            fields: execution.fields,
            pager: execution.pager,
            meta: execution.meta,
            jsonPretty: config.jsonPretty,
        });
        if (output) console.log(output);
        return;
    }

    if (execution.action.type === 'get') {
        const output = renderObject(execution.data as Record<string, unknown>, format, { fields: execution.fields });
        if (output) console.log(output);
        return;
    }

    const output = formatOutput(execution.data, {
        format,
        isList: false,
        fields: execution.fields,
        jsonPretty: config.jsonPretty,
    });
    if (output) console.log(output);
}

type BatchId = number;

interface BatchError {
    objectID: BatchId;
    error: {
        code?: string;
        message: string;
        details?: unknown;
    };
}

interface BatchResult {
    ids: BatchId[];
    success: BatchId[];
    failed: BatchId[];
    skipped: BatchId[];
    data?: Array<{ objectID: BatchId; value: unknown }>;
    errors: BatchError[];
}

function toBatchError(id: BatchId, error: unknown): BatchError {
    const normalized = error instanceof Error ? error : new Error(String(error));
    return {
        objectID: id,
        error: {
            ...(normalized instanceof ZentaoError ? { code: normalized.code, details: normalized.details } : {}),
            message: normalized.message,
        },
    };
}

function renderBatchResult(result: BatchResult, format: string, pretty: boolean): string {
    if (format === 'json' || format === 'raw') {
        return formatJson({
            ok: result.failed.length === 0,
            data: result.ids.map(objectID => result.success.includes(objectID)
                ? { objectID, ok: true, data: result.data?.find(item => item.objectID === objectID)?.value ?? null }
                : result.skipped.includes(objectID) ? { objectID, ok: false, skipped: true }
                    : { objectID, ok: false, error: result.errors.find(item => item.objectID === objectID)!.error }),
            meta: { success: result.success.length, failed: result.failed.length, skipped: result.skipped.length },
        }, pretty);
    }

    const lines: string[] = [];
    if (result.data?.length) {
        const rows = result.data.map(({ objectID, value }) => (
            value && typeof value === 'object' && !Array.isArray(value)
                ? { ...(value as Record<string, unknown>), objectID }
                : { objectID, value }
        ));
        const dataOutput = formatOutput(rows, { format: 'markdown', isList: true });
        if (dataOutput) lines.push(dataOutput);
    }
    lines.push(
        `操作成功：${result.success.length > 0 ? result.success.join(', ') : '无'}`,
        `操作失败：${result.failed.length > 0 ? result.failed.join(', ') : '无'}`,
    );
    if (result.skipped.length > 0) {
        lines.push(`已跳过：${result.skipped.join(', ')}`);
    }
    for (const item of result.errors) {
        const code = item.error.code ? `E${item.error.code}: ` : '';
        lines.push(`${item.objectID}: ${code}${item.error.message}`);
    }
    return lines.join('\n');
}

/** 输出模块对应对象的属性定义（与 `zentao <module> props` 对应） */
export function showModuleProps(mod: ModuleDefinition, options: ModuleActionOptions): void {

    const props = getObjectProps(mod.name);
    const format = options.format ?? 'markdown';
    const output = formatOutput(props, { format, isList: false });
    if (output) console.log(output);
}


/**
 * 执行模块级 CRUD 或扩展操作：负责拼路径、分页拉取、客户端过滤/排序、HTML 转 Markdown 及格式化输出。
 */
export async function handleModuleCommand(
    client: ZentaoClient,
    module: ModuleDefinition,
    actionName: ModuleActionName,
    args: string[],
    profile: Profile,
    options: ModuleActionOptions,
    preparedParams?: Record<string, unknown>,
): Promise<void> {
    const config = getProfileConfig(profile);
    const batchFailFast = options.batchFailFast ?? config.batchFailFast ?? false;
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';

    const action = getAction(module, actionName);
    if (!action) {
        throw new ZentaoError('E2005', { module: module.name });
    }

    // Resolve all argument sources before selecting targets or confirming deletion.
    const params = preparedParams ?? buildParams(options, actionName, args);
    const batchIds = batchTargets(action, params, options.ids);
    if (batchIds) {
        if (format === 'raw') throw new ZentaoError('E2009', { option: 'raw/ids', reason: '原始响应不支持批量组合，请使用 json' });
        if (action.type === 'delete' && !options.yes) {
            if (!await confirmDelete(format, batchIds.length, options.machineReadable || options.input === false)) {
                return;
            }
        }

        const result: BatchResult = {
            ids: batchIds,
            success: [],
            failed: [],
            skipped: [],
            ...(action.type === 'delete' ? {} : { data: [] }),
            errors: [],
        };
        for (let index = 0; index < batchIds.length; index++) {
            commandSignal()?.throwIfAborted();
            const rawId = batchIds[index];
            const id = Number(rawId);
            try {
                const execution = await executeModuleCommand(
                    client,
                    module,
                    actionName,
                    [],
                    options,
                    config,
                    { ...params, id: rawId },
                );
                result.success.push(id);
                result.data?.push({ objectID: id, value: execution.data });
            } catch (error) {
                commandSignal()?.throwIfAborted();
                result.failed.push(id);
                result.errors.push(toBatchError(id, error));
                if (batchFailFast) {
                    result.skipped.push(...batchIds.slice(index + 1).map(Number));
                    break;
                }
            }
        }

        console.log(renderBatchResult(result, format, config.jsonPretty ?? false));
        if (result.failed.length > 0) {
            process.exitCode = 1;
        }
        return;
    }

    if (action.type === 'delete' && !options.yes) {
        if (!await confirmDelete(format, 1, options.machineReadable || options.input === false)) {
            return;
        }
    }

    const execution = await executeModuleCommand(client, module, actionName, [], options, config, params);
    renderModuleExecution(execution, options, config);
}

