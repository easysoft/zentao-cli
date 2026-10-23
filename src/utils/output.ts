import type { GlobalOptions } from '../types/index.js';
import { formatOutput } from './format.js';
import { ZentaoError } from '../errors.js';

/** Built-ins use the same result envelope as business commands. */
export function emitResult(data: unknown, options: GlobalOptions = {}, meta: Record<string, unknown> = {}): void {
    if (options.silent) return;
    if (options.format === 'raw') throw new ZentaoError('E2009', { option: 'raw', reason: 'raw 仅适用于具有原始服务端响应的业务命令' });
    console.log(formatOutput(data, { format: options.format ?? 'table', isList: Array.isArray(data), meta }));
}
