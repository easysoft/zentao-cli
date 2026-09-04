import { ZentaoError } from '../errors.js';
import type { ModuleActionOptions } from '../types/index.js';

/**
 * Merge the JSON object supplied through `--options` with parsed CLI options.
 * Explicit CLI values win; Commander's empty array defaults do not.
 */
export function applyOptionsJson(options: ModuleActionOptions): ModuleActionOptions {
    if (options.options === undefined) return options;

    let parsed: unknown;
    try {
        parsed = JSON.parse(options.options);
    } catch {
        throw new ZentaoError('E2009', {
            option: '--options',
            reason: '必须是有效的 JSON 对象',
        });
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ZentaoError('E2009', {
            option: '--options',
            reason: '必须是 JSON 对象',
        });
    }

    const merged: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
    for (const [key, value] of Object.entries(options)) {
        if (key === 'options' || value === undefined) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        merged[key] = value;
    }
    delete merged.options;

    return merged as ModuleActionOptions;
}
