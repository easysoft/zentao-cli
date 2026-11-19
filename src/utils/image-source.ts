import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function isLocalImageSource(src: string): boolean {
    return /^file:(?:\.\.?\/|~\/|\/\/)/i.test(src);
}

/** Keep shorthand paths literal. Existing file URLs retain their URL escaping. */
export async function localImageSource(src: string, paths: Map<string, string>) {
    const tail = src.slice(5);
    let path: string;
    if (tail.startsWith('//')) {
        try {
            const urlPath = tail.slice(2);
            path = /^(?:\/|localhost(?:\/|$))/i.test(urlPath)
                ? fileURLToPath(src) : resolve(decodeURIComponent(urlPath));
        } catch {
            // The SDK reports malformed file URLs as individual upload warnings.
            return { url: src, filename: basename(tail) || '图片' };
        }
    } else {
        path = tail.startsWith('~/') ? resolve(homedir(), '.' + tail.slice(1)) : resolve(tail);
    }
    let canonical = paths.get(path);
    if (!canonical) {
        // A symlinked cwd and an absolute URL may name the same file. Leave
        // missing/unreadable paths to the SDK's normal warning handling.
        canonical = await realpath(path).catch(() => path);
        paths.set(path, canonical);
    }
    return { url: pathToFileURL(canonical).href, filename: basename(path) || '图片' };
}
