import { ZentaoError } from '../errors.js';
import type { ModuleActionOptions } from '../types/index.js';

const ACTION_NAME_ALIASES: Record<string, string> = {
    ls: 'list',
};

/** 将 actionName 归一化（如 `ls` → `list`） */
export function normalizeActionName(actionName: string): string {
    return ACTION_NAME_ALIASES[actionName] ?? actionName;
}

/** Convert scalar CLI values while leaving arbitrary strings unchanged. */
function coerceValue(raw: string): unknown {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?\d+$/.test(raw)) return Number(raw);
    if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
    return raw;
}

/** Repeated dynamic flags represent ZenTao multi-value fields. */
function assignFlag(params: Record<string, unknown>, key: string, value: unknown): void {
    const existing = params[key];
    if (existing === undefined || existing === true) {
        params[key] = value;
        return;
    }
    params[key] = `${existing},${value}`;
}

function validateJsonData(data: unknown): void {
    if (typeof data !== 'string' || data.length === 0) return;
    try {
        JSON.parse(data);
    } catch {
        throw new ZentaoError('E2007');
    }
}

/**
 * 将 CLI 选项与位置参数组装成 SDK `request()` 可消费的参数对象。
 *
 * 负责 CLI 专属的 argv 解析：
 * - 位置参数中的对象 ID（支持逗号分隔的批量 ID 由上层先行拆分）
 * - 位置参数中的 `{...}` JSON 作为请求体（写入 `params.data`）
 * - `--key=value` 和 `--key value` 形式的额外参数（带基础类型转换）
 * - 重复参数、裸布尔参数以及以 `-` 开头的参数值
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
        const idParts = candidate.split(',').map((part) => part.trim());
        const isNumericID = idParts.length > 0 && idParts.every((part) => /^\d+$/.test(part));
        if (isNumericID) {
            positionalID = candidate;
            extraArgs.shift();
        } else if (params.data === undefined && candidate.startsWith('{')) {
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

    for (let index = 0; index < extraArgs.length; index++) {
        const arg = extraArgs[index];
        const match = arg.match(/^--(\w[\w.-]*)=(.*)$/);
        if (match) {
            assignFlag(params, match[1], coerceValue(match[2]));
            continue;
        }

        const flagMatch = arg.match(/^--(\w[\w.-]*)$/);
        if (!flagMatch) continue;

        const next = extraArgs[index + 1];
        if (next !== undefined && !next.startsWith('--')) {
            assignFlag(params, flagMatch[1], coerceValue(next));
            index++;
        } else {
            assignFlag(params, flagMatch[1], true);
        }
    }

    if (positionalID !== undefined) {
        params.id = positionalID;
    }

    validateJsonData(params.data);

    return params;
}
