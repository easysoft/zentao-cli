import { ZentaoError } from '../errors.js';
import type { ModuleActionOptions } from '../types/index.js';

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
        const separator = arg.indexOf('=');
        const key = arg.slice(2, separator);
        if (!arg.startsWith('--') || separator < 3 || !/^\w/.test(key) || /[^\w.-]/.test(key)) {
            throw new ZentaoError('E2009', {
                option: separator < 0 ? arg : arg.slice(0, separator),
                reason: '请使用 --字段名=值 传参',
            });
        }
        // Slice at the first '=' so all line breaks and further '=' remain intact.
        let value: unknown = arg.slice(separator + 1);
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value !== '' && !/\D/.test(value as string)) value = Number(value);
        params[key] = value;
    }

    if (positionalID !== undefined) {
        params.id = positionalID;
    }

    return params;
}
