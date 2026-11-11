import { ZentaoError } from '../errors.js';
import type { GlobalOptions } from '../types/index.js';
let controller: AbortController | undefined;
let reason: 'interrupt' | 'deadline' | undefined;
export function commandSignal(): AbortSignal | undefined { return controller?.signal; }
export function commandAbortReason() { return reason; }
export function startCommandLifecycle(options: GlobalOptions): () => void {
    controller = new AbortController();
    reason = undefined;
    const cancel = () => { reason = 'interrupt'; controller!.abort(new ZentaoError('E5003')); };
    process.once('SIGINT', cancel);
    const timer = options.deadline ? setTimeout(() => { reason = 'deadline'; controller!.abort(new ZentaoError('E5001')); }, options.deadline) : undefined;
    timer?.unref();
    return () => { clearTimeout(timer); process.removeListener('SIGINT', cancel); };
}
