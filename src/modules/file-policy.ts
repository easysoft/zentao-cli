import { AsyncLocalStorage } from 'node:async_hooks';
import { extendModuleAction } from 'zentao-api';
import { ZentaoError } from '../errors.js';

export const LOCAL_FILE_UPLOAD_UNAVAILABLE = 'HTTP MCP 不支持通过本地路径上传服务端文件，请使用本地 CLI 或 stdio MCP';
const remoteRequest = new AsyncLocalStorage<true>();
let guardInstalled = false;

export function localUploadsBlocked(): boolean {
    return remoteRequest.getStore() === true;
}

export function withoutLocalUploads<T>(run: () => T): T {
    if (!guardInstalled) {
        // SDK rich-text uploads also enter file/create, before the SDK opens the file.
        extendModuleAction('file', 'create', action => {
            const original = action.beforeRequest;
            return { ...action, beforeRequest: async request => {
                if (localUploadsBlocked()) throw new ZentaoError('E2009', { option: 'file/create', reason: LOCAL_FILE_UPLOAD_UNAVAILABLE });
                return original ? original(request) : {};
            } };
        });
        guardInstalled = true;
    }
    return remoteRequest.run(true, run);
}
