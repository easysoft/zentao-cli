import { randomUUID } from 'node:crypto';
import { open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getModuleAction } from 'zentao-api';
import type { ZentaoClient } from '../api/index.js';
import { mapSdkError, ZentaoError } from '../errors.js';
import type { ModuleAction, ModuleActionOptions } from '../types/index.js';
import { commandSignal } from '../utils/lifecycle.js';

/** Keep the target intact until all bytes have been received and written. */
export async function downloadFile(client: ZentaoClient, action: ModuleAction, fileID: string, path: string, options: ModuleActionOptions) {
    const signal = options.signal ?? commandSignal();
    const { version } = await client.getZentaoConfig({ timeout: options.timeout, insecure: options.insecure, signal });
    if (!getModuleAction('file', 'read', { version })) {
        throw new ZentaoError('E2010', { action: 'file/read', version, minVersion: action.minVersion.join(' / ') });
    }
    const fileError = (error: unknown): never => {
        throw new ZentaoError('E5005', { path, reason: error instanceof Error ? error.message : String(error) });
    };
    const temporary = join(dirname(path), `.zentao-download-${randomUUID()}`);
    const file = await open(temporary, 'wx', 0o600).catch(fileError);
    let saved = false;
    try {
        const response = await client.request(action.path.replace('{fileID}', fileID), {
            method: 'GET', query: { stream: 0 }, responseType: 'response',
            actionAssistant: options.assistant, timeout: options.timeout, insecure: options.insecure, signal,
        });
        let bytes = 0;
        if (response.body) {
            for await (const chunk of response.body) {
                await file.writeFile(chunk).catch(fileError);
                bytes += chunk.byteLength;
            }
        }
        await file.close().catch(fileError);
        if (signal?.aborted) throw new ZentaoError('E5003');
        await rename(temporary, path).catch(fileError);
        saved = true;
        return { path, bytes };
    } catch (error) {
        if (signal?.aborted) throw new ZentaoError('E5003');
        // The SDK's raw Response can time out during body consumption, after request() returns.
        if (error instanceof Error && error.name === 'AbortError') throw new ZentaoError('E5001');
        const mapped = mapSdkError(error);
        if (mapped instanceof ZentaoError) throw mapped;
        throw new ZentaoError('E1002', { url: client.siteUrl }, { reason: error instanceof Error ? error.message : String(error) });
    } finally {
        if (!saved) {
            try { await file.close(); } finally { await rm(temporary, { force: true }); }
        }
    }
}
