import type { ModuleAction } from '../types/index.js';
import { ZentaoError } from '../errors.js';

export function targetId(action: ModuleAction): string | undefined {
    return Object.keys(action.pathParams ?? {}).find(name => name.endsWith('ID') && name !== 'scopeID');
}

export function supportsBatch(action: ModuleAction): boolean {
    return ['get', 'update', 'delete', 'action'].includes(action.type) && Boolean(targetId(action));
}

/** Validate the entire target set before sending any request. */
export function batchTargets(action: ModuleAction, params: Record<string, unknown>, ids?: string): number[] | undefined {
    const invalid = (reason: string): never => { throw new ZentaoError('E2009', { option: 'ids', reason }); };
    const key = targetId(action);
    for (const name of ['id', ...Object.keys(action.pathParams ?? {}).filter(name => name.endsWith('ID'))]) {
        if (params[name] !== undefined && (Array.isArray(params[name]) || String(params[name]).includes(','))) {
            invalid('单个目标不接受多个 ID，请使用 --ids');
        }
    }
    if (params.id !== undefined && !key) invalid('此操作没有对象 ID');
    if (ids === undefined) return;
    if (!supportsBatch(action)) invalid('此操作不支持批量对象操作');
    if (params.id !== undefined || (key && params[key] !== undefined)) invalid('--ids 不能与单个目标同时使用');
    const values = ids.split(',').map(value => value.trim());
    if (!values.length || values.some(value => !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
        invalid('每个 ID 必须为正安全整数');
    }
    return [...new Set(values.map(Number))];
}
