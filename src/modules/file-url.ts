import { extractFileIdFromUrl } from 'zentao-api';
import { ZentaoError } from '../errors.js';

export function supportsFileUrl(moduleName: string, actionName: string): boolean {
    return moduleName === 'file' && (actionName === 'get' || actionName === 'read');
}

function invalidFileUrl(): ZentaoError {
    return new ZentaoError('E2009', { option: 'url', reason: '请提供当前站点的附件读取或下载链接' });
}

export function fileIdAtSite(url: string, siteUrl?: string): number {
    const id = extractFileIdFromUrl(url, siteUrl);
    if (id === undefined) throw invalidFileUrl();
    return id;
}

/** Check the route before looking up credentials. Only qualified URLs also need a site check. */
export function resolveFileUrl(url: string, checkSite?: (url: string) => void): number {
    if (!/^(?:https?:)?\/\//i.test(url.trim())) return fileIdAtSite(url);
    if (!checkSite) throw invalidFileUrl();
    let origin: string;
    try { origin = new URL(url, 'https://zentao.invalid/').origin; } catch { throw invalidFileUrl(); }
    const id = fileIdAtSite(url, origin);
    checkSite(url);
    return id;
}
