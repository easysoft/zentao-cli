import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LinkProfile } from 'zentao-api';
import { z } from 'zod';
import { createClient, type ClientOptions, type ZentaoClient } from '../api/index.js';
import { runPageLink, type PageLinkInput } from '../api/page-links.js';
import { brandText } from '../brand.js';
import { ZentaoError } from '../errors.js';
import { outputSchema, toolError, toolResult } from './results.js';

export type PageLinkHandler = (input: PageLinkInput, signal?: AbortSignal) => ReturnType<typeof runPageLink>;

/** Share only the bound site's anonymous config cache across link calls. */
export function bindPageLinks(selectSite: () => LinkProfile & ClientOptions, options?: ClientOptions): PageLinkHandler {
    let client: ZentaoClient | undefined;
    let cachedServer: string | undefined;
    let cachedInsecure: boolean | undefined;
    return (input, signal) => {
        if (signal?.aborted) throw new ZentaoError('E5003');
        const site = selectSite();
        return runPageLink(site, input, async () => {
            const insecure = options?.insecure ?? site.insecure;
            if (!client || cachedServer !== site.server || cachedInsecure !== insecure) {
                client = createClient(site.server, undefined, { insecure, actionAssistant: '' });
                cachedServer = site.server;
                cachedInsecure = insecure;
            }
            // A cancelled caller must not abort a shared config refresh for other requests.
            const refresh = client.getZentaoConfig({ timeout: options?.timeout ?? site.timeout });
            if (!signal) return refresh;
            let abort!: () => void;
            const cancelled = new Promise<never>((_, reject) => {
                abort = () => reject(new ZentaoError('E5003'));
                signal.addEventListener('abort', abort, { once: true });
                if (signal.aborted) abort();
            });
            try { return await Promise.race([refresh, cancelled]); }
            finally { signal.removeEventListener('abort', abort); }
        });
    };
}

export function registerLinkTool(server: McpServer, handle: PageLinkHandler): void {
    server.registerTool(brandText('zentao_link'), {
        description: '使用当前绑定站点的路由配置生成或解析页面链接。',
        inputSchema: z.object({
            action: z.enum(['create', 'parse']),
            module: z.string().min(1).optional().describe('create 时必填，页面模块名'),
            method: z.string().min(1).optional().describe('create 时必填，页面方法名'),
            vars: z.array(z.string()).optional().describe('create 的有序参数，如 ["bugID=42"]'),
            relative: z.boolean().optional().describe('create 时返回站内路径'),
            url: z.string().min(1).optional().describe('parse 时必填，页面网址或站内路径'),
        }).strict(),
        outputSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    }, async (input, extra) => {
        try {
            if (input.action === 'parse') {
                if (input.url === undefined || input.module !== undefined || input.method !== undefined || input.vars !== undefined || input.relative !== undefined) {
                    throw new ZentaoError('E2009', { option: 'parse', reason: '解析时仅接受 url' });
                }
                return toolResult(await handle({ action: 'parse', url: input.url }, extra.signal));
            }
            if (!input.module || !input.method || input.url !== undefined) {
                throw new ZentaoError('E2009', { option: 'create', reason: '生成链接需要 module 和 method，url 用于解析' });
            }
            return toolResult(await handle({ action: 'create', module: input.module, method: input.method, vars: input.vars, relative: input.relative }, extra.signal));
        } catch (error) {
            return toolError(error);
        }
    });
}
