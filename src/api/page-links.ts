import { createLink, parseLink, ZentaoError as SdkError, type LinkProfile, type ServerConfig, type ZentaoLink } from 'zentao-api';
import { mapSdkError, ZentaoError } from '../errors.js';

export type PageLinkInput =
    | { action: 'create'; module: string; method: string; vars?: string[]; relative?: boolean }
    | { action: 'parse'; url: string };

function invalid(option: string, reason: string): never {
    throw new ZentaoError('E2009', { option, reason });
}

function siteURL(server: string): URL {
    let site: URL;
    try { site = new URL(server); } catch { return invalid('server', '请提供完整的 HTTP(S) 站点地址'); }
    if (!/^https?:\/\//i.test(server) || site.username || site.password || /[?#]/.test(server)) {
        return invalid('server', '请提供不含凭据、查询参数或片段的 HTTP(S) 站点地址');
    }
    return site;
}

// The SDK accepts encoded vars and splits path segments on the site's literal requestFix.
function encodePart(value: string, separator?: string): string {
    try {
        if (!separator) return encodeURIComponent(value);
        return Array.from(value, char => {
            const encoded = encodeURIComponent(char);
            return char === encoded && (char === '.' || separator.includes(char))
                ? '%' + char.charCodeAt(0).toString(16).toUpperCase() : encoded;
        }).join('');
    } catch { return invalid('link', '页面参数包含无效的 Unicode 字符'); }
}

function routingField(error: unknown): string | undefined {
    if (error instanceof SdkError && typeof error.params.param === 'string' && error.params.param.startsWith('profile.serverConfig.')) {
        return error.params.param.slice('profile.serverConfig.'.length);
    }
}

export async function runPageLink(
    profile: LinkProfile, input: PageLinkInput, loadConfig: () => Promise<ServerConfig>,
): Promise<string | ZentaoLink> {
    const site = siteURL(profile.server);
    if (input.action === 'parse') {
        if (!input.url.trim()) return invalid('url', '请提供页面链接');
        let page: URL;
        try { page = new URL(input.url, site); } catch { return invalid('url', '无效的页面链接'); }
        if (page.username || page.password) return invalid('url', '页面链接中不能包含登录凭据');
        if (page.origin !== site.origin || !['http:', 'https:'].includes(page.protocol)) {
            return parseLink({ server: site.href }, input.url, { requestType: 'auto' });
        }
    } else if (!input.module.trim() || !input.method.trim()) {
        return invalid('link', '请提供页面模块名和方法名');
    }

    const processLink = (serverConfig: ServerConfig | undefined) => {
        const context = { server: site.href, serverConfig };
        if (input.action === 'parse') return parseLink(context, input.url, { requestType: 'auto' });
        const separator = serverConfig?.requestType !== 'GET' && typeof serverConfig?.requestFix === 'string'
            ? serverConfig.requestFix : undefined;
        const vars = input.vars?.map(item => {
            const at = item.indexOf('=');
            if (at < 1 || !item.slice(0, at).trim()) return invalid('var', '请使用 名称=值，可重复传入');
            return [encodePart(item.slice(0, at)), encodePart(item.slice(at + 1), separator)] as const;
        });
        const link = createLink(context, { moduleName: encodePart(input.module, separator), methodName: encodePart(input.method, separator),
            vars, relative: input.relative ?? false });
        if (new URL(link, site).origin !== site.origin) return invalid('link', '页面链接超出当前站点');
        if (/\/(?:\.|%2e){1,2}(?:\/|$)/i.test(link)) return invalid('var', '路径变量不能解析为 . 或 .. 目录');
        return link;
    };

    try {
        const result = processLink(profile.serverConfig);
        // A legacy profile can lack a custom webRoot or router outside the default installation path.
        if (!(typeof result === 'object' && result.external && !profile.serverConfig?.requestType)) return result;
    } catch (error) {
        const field = routingField(error);
        if (!(field && error instanceof SdkError && error.code === 'E_MISSING_PARAM')) {
            if (field) return invalid('serverConfig', `页面路由配置 ${field} 无效`);
            throw mapSdkError(error);
        }
    }
    try {
        return processLink(await loadConfig());
    } catch (error) {
        const field = routingField(error);
        if (field) return invalid('serverConfig', `站点未提供有效的页面路由配置 ${field}`);
        throw mapSdkError(error);
    }
}
