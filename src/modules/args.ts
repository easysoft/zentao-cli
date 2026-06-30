import { ZentaoError } from '../errors.js';
import type { ModuleActionOptions } from '../types/index.js';

const ACTION_NAME_ALIASES: Record<string, string> = {
    ls: 'list',
};

/** 将 actionName 归一化（如 `ls` → `list`） */
export function normalizeActionName(actionName: string): string {
    return ACTION_NAME_ALIASES[actionName] ?? actionName;
}

/**
 * 将 CLI 选项与位置参数组装成 SDK `request()` 可消费的参数对象。
 *
 * 负责 CLI 专属的 argv 解析：
 * - 位置参数中的对象 ID（支持逗号分隔的批量 ID 由上层先行拆分）
 * - 位置参数中的 `{...}` JSON 作为请求体（写入 `params.data`）
 * - `--key=value` 形式的额外参数（带基础类型转换）
 * - `--params` 指定的 JSON 对象（浅合并到 params）
 *
 * 路径、查询、请求体的最终拼装由 SDK 的 `resolveModuleCommand` 完成。
 */
export function buildParams(
    options: ModuleActionOptions,
    actionName: string,
    args?: string[],
): Record<string, unknown> {
    const params: Record<string, unknown> = { ...options };

    const extraArgs = args ? [...args] : [];
    if (extraArgs.length > 0 && extraArgs[0] === actionName) {
        extraArgs.shift();
    }

    let positionalID: string | undefined;
    if (extraArgs.length > 0 && !extraArgs[0].startsWith('-')) {
        const candidate = extraArgs[0].trim();
        const idParts = candidate.split(',').map((part) => part.trim()).filter(Boolean);
        const isNumericID = idParts.length > 0 && idParts.every((part) => /^\d+$/.test(part));
        if (isNumericID) {
            positionalID = candidate;
            extraArgs.shift();
        } else if (params.data === undefined && candidate.startsWith('{') && candidate.endsWith('}')) {
            params.data = candidate;
            extraArgs.shift();
        }
    }

    if (options.params) {
        try {
            Object.assign(params, JSON.parse(options.params));
        } catch {
            throw new ZentaoError('E2009', { option: 'params', reason: '不是有效的 JSON 对象' });
        }
    }

    for (const arg of extraArgs) {
        const match = arg.match(/^--(\w[\w.-]*)=(.*)$/);
        if (!match) continue;
        const key = match[1];
        let value: unknown = match[2];
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value as string)) value = Number(value);
        params[key] = value;
    }

    if (positionalID !== undefined) {
        params.id = positionalID;
    }

    return params;
}
