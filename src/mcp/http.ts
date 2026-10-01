import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createClient } from '../api/index.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { ZentaoError } from '../errors.js';
import { createMcpServer } from './server.js';
import type { McpToolOptions } from './tools.js';

export interface McpHttpOptions extends McpToolOptions {
    url: string;
    host?: string;
    port?: number;
    timeout?: number;
    insecure?: boolean;
}

export interface McpHttpServer {
    url: URL;
    /** Stop accepting requests, drain for up to five seconds, then cancel remaining work. */
    close(): Promise<void>;
}

const MAX_BODY_BYTES = 1024 * 1024;
const RECEIVE_TIMEOUT = 30_000;
const DRAIN_TIMEOUT = 5_000;

function tokenFromHeaders(rawHeaders: string[]): string | undefined {
    const credentials: Array<[string, string]> = [];
    for (let index = 0; index < rawHeaders.length; index += 2) {
        const name = rawHeaders[index].toLowerCase();
        if (name === 'token' || name === 'authorization') credentials.push([name, rawHeaders[index + 1]]);
    }
    if (credentials.length !== 1) return undefined;
    const [name, value] = credentials[0];
    // Reject joined duplicate fields, whitespace and non-header-safe credentials.
    const pattern = name === 'token' ? /^([A-Za-z0-9\-._~+/]+=*)$/ : /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i;
    return pattern.exec(value)?.[1];
}

function respond(res: ServerResponse, status: number, message: string): void {
    if (res.destroyed || res.writableEnded) return;
    if (res.headersSent) {
        res.destroy();
        return;
    }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...(res.req.method === 'POST' ? { Connection: 'close' } : {}) });
    res.end(JSON.stringify({ error: message }));
}

/** Read actual bytes, including chunked requests, without destroying the response on rejection. */
function readBody(req: IncomingMessage): Promise<{ body?: unknown; status?: number }> {
    return new Promise(resolve => {
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = (result: { body?: unknown; status?: number }) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            req.off('data', onData);
            req.off('end', onEnd);
            req.off('error', onError);
            req.off('aborted', onError);
            resolve(result);
        };
        const onData = (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                finish({ status: 413 });
                req.resume();
            } else chunks.push(chunk);
        };
        const onEnd = () => {
            try { finish({ body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
            catch { finish({ status: 400 }); }
        };
        const onError = () => finish({ status: 400 });
        const timer = setTimeout(() => { finish({ status: 408 }); req.resume(); }, RECEIVE_TIMEOUT);
        timer.unref();
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('error', onError);
        req.once('aborted', onError);
    });
}

export async function startMcpHttpServer(options: McpHttpOptions): Promise<McpHttpServer> {
    options = { ...options, allowLocalFiles: false };
    if (!process.versions.bun) {
        const [major, minor, patch] = process.versions.node.split('.').map(Number);
        if (major < 18 || (major === 18 && (minor < 14 || (minor === 14 && patch < 1)))) {
            throw new ZentaoError('E5004', { reason: 'HTTP 模式需要 Node.js 18.14.1 或更新版本' });
        }
    }
    for (const [option, value] of [['timeout', options.timeout], ['port', options.port]] as const) {
        if (value !== undefined && (!Number.isInteger(value) || value < (option === 'port' ? 0 : 1) || value > (option === 'port' ? 65535 : 2_147_483_647))) {
            throw new ZentaoError('E2009', { option, reason: option === 'port' ? '必须为 0–65535 的整数' : '必须为 1–2147483647 的整数毫秒数' });
        }
    }
    if (options.host !== undefined && !options.host.trim()) throw new ZentaoError('E2009', { option: 'host', reason: '监听地址不能为空' });
    let url: URL;
    try {
        url = new URL(options.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
        throw new ZentaoError('E2009', { option: 'url', reason: '请提供不含凭证、查询参数或片段的 HTTP(S) 禅道站点地址' });
    }
    const site = createClient(url.toString()).siteUrl;
    const config = { ...DEFAULT_CONFIG, pagers: {}, timeout: options.timeout ?? DEFAULT_CONFIG.timeout, insecure: options.insecure ?? DEFAULT_CONFIG.insecure };
    const authFor = (token?: string) => ({
        async getContext() {
            return { client: createClient(site, token, config), config, identity: { server: site } };
        },
    });
    // Validate tool selection at startup, rather than failing the first client request.
    await createMcpServer(authFor(), options).close();
    if (process.versions.bun) return startBunHttpServer(options, config.timeout, authFor);
    const active = new Set<() => void>();
    const sockets = new Set<Socket>();
    const server = createServer({ requestTimeout: RECEIVE_TIMEOUT }, (req, res) => {
        const started = Date.now();
        const route = req.url?.split('?')[0];
        const safeRoute = route === '/mcp' || route === '/healthz' ? route : '/unknown';
        const safeMethod = ['POST', 'GET', 'DELETE', 'PUT', 'PATCH', 'HEAD', 'OPTIONS'].includes(req.method ?? '') ? req.method : 'OTHER';
        let mcp: ReturnType<typeof createMcpServer> | undefined;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        let finished = false;
        const cleanup = () => {
            if (finished) return;
            finished = true;
            clearTimeout(deadline);
            active.delete(cancel);
            req.socket.off('close', cleanup);
            void mcp?.close().catch(() => {});
            process.stderr.write(`[mcp-http] ${safeMethod} ${safeRoute} ${res.writableFinished ? res.statusCode : 499} ${Date.now() - started}ms\n`);
        };
        const cancel = () => { cleanup(); req.destroy(); res.destroy(); };
        active.add(cancel);
        res.once('finish', cleanup);
        res.once('close', cleanup);
        res.once('error', cleanup);
        req.once('aborted', cleanup);
        req.once('error', cleanup);
        req.socket.once('close', cleanup);
        void (async () => {
            if (req.rawHeaders.some((name, index) => index % 2 === 0 && name.toLowerCase() === 'origin')) {
                respond(res, 403, '不支持浏览器 Origin 请求');
                return;
            }
            if (route === '/healthz' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"status":"ok"}');
                return;
            }
            if (route !== '/mcp') { respond(res, 404, '未找到接口'); return; }
            if (req.method !== 'POST') {
                res.setHeader('Allow', 'POST');
                respond(res, 405, '仅支持 POST');
                return;
            }
            const token = tokenFromHeaders(req.rawHeaders);
            if (!token || req.url?.includes('?')) { respond(res, 401, '请通过单个 token 或 Authorization: Bearer 请求头提供禅道 Token'); return; }
            const { body, status } = await readBody(req);
            if (finished) return;
            if (status) { respond(res, status, status === 413 ? '请求体超过 1 MiB' : status === 408 ? '接收请求超时' : 'JSON 请求体无效'); return; }
            deadline = setTimeout(() => {
                respond(res, 504, '工具调用超时');
                cleanup();
            }, Math.max(60_000, config.timeout));
            deadline.unref();
            mcp = createMcpServer(authFor(token), options);
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            await mcp.connect(transport);
            if (finished) { await mcp.close(); return; }
            await transport.handleRequest(req, res, body);
        })().catch(() => {
            // Transport errors can contain headers or upstream payloads; never log them.
            respond(res, 500, 'MCP 请求处理失败');
            cleanup();
        });
    });
    server.on('connection', socket => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
    });
    // Do not echo parser errors, raw packets or credential-bearing URLs.
    server.on('clientError', (_error, socket) => socket.destroy());
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 9090, options.host ?? '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    }).catch(error => {
        throw new ZentaoError('E5004', { reason: typeof error?.code === 'string' ? error.code : '监听失败' });
    });
    let closing: Promise<void> | undefined;
    const address = server.address() as AddressInfo;
    return {
        url: new URL(`http://${address.family === 'IPv6' ? `[${address.address}]` : address.address}:${address.port}/mcp`),
        close() {
            return closing ??= new Promise<void>(resolve => {
                const timer = setTimeout(() => {
                    for (const cancel of active) cancel();
                    for (const socket of sockets) socket.destroy();
                }, DRAIN_TIMEOUT);
                timer.unref();
                server.close(() => { clearTimeout(timer); resolve(); });
                server.closeIdleConnections?.();
            });
        },
    };
}

/** Bun's node:http compatibility layer does not report response disconnects reliably.
 * Its native Request.signal provides the cancellation boundary required for writes. */
async function startBunHttpServer(
    options: McpHttpOptions,
    timeout: number,
    authFor: (token?: string) => Parameters<typeof createMcpServer>[0],
): Promise<McpHttpServer> {
    const active = new Set<() => void>();
    let server: ReturnType<typeof Bun.serve>;
    let stopping = false;
    try {
        server = Bun.serve({
            hostname: options.host ?? '127.0.0.1',
            port: options.port ?? 9090,
            idleTimeout: RECEIVE_TIMEOUT / 1000,
            // Bound native buffering as well as actual streamed bytes below.
            maxRequestBodySize: MAX_BODY_BYTES,
            async fetch(req) {
                if (stopping) return Response.json({ error: 'MCP 服务正在关闭' }, { status: 503, headers: { Connection: 'close' } });
                const started = Date.now();
                const url = new URL(req.url);
                const route = ['/mcp', '/healthz'].includes(url.pathname) ? url.pathname : '/unknown';
                const method = ['POST', 'GET', 'DELETE', 'PUT', 'PATCH', 'HEAD', 'OPTIONS'].includes(req.method) ? req.method : 'OTHER';
                let mcp: ReturnType<typeof createMcpServer> | undefined;
                let timer: ReturnType<typeof setTimeout> | undefined;
                let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
                let finished = false;
                let status = 499;
                const cleanup = () => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);
                    active.delete(cancel);
                    req.signal.removeEventListener('abort', cancel);
                    void mcp?.close().catch(() => {});
                    void reader?.cancel().catch(() => {});
                    process.stderr.write(`[mcp-http] ${method} ${route} ${status} ${Date.now() - started}ms\n`);
                };
                const cancel = () => { status = 499; cleanup(); };
                active.add(cancel);
                req.signal.addEventListener('abort', cancel, { once: true });
                const error = (code: number, message: string, extra?: Record<string, string>) => {
                    status = code;
                    cleanup();
                    return Response.json({ error: message }, { status: code, headers: { ...(req.method === 'POST' ? { Connection: 'close' } : {}), ...extra } });
                };
                try {
                    if (req.headers.has('origin')) return error(403, '不支持浏览器 Origin 请求');
                    if (route === '/healthz' && method === 'GET') { status = 200; cleanup(); return Response.json({ status: 'ok' }); }
                    if (route !== '/mcp') return error(404, '未找到接口');
                    if (method !== 'POST') return error(405, '仅支持 POST', { Allow: 'POST' });
                    const token = tokenFromHeaders(Array.from(req.headers).flat());
                    if (!token || req.url.includes('?')) return error(401, '请通过单个 token 或 Authorization: Bearer 请求头提供禅道 Token');
                    reader = req.body?.getReader();
                    const chunks: Uint8Array[] = [];
                    let size = 0;
                    let receiveExpired = false;
                    timer = setTimeout(() => { receiveExpired = true; void reader?.cancel().catch(() => {}); }, RECEIVE_TIMEOUT);
                    timer.unref();
                    if (reader) while (true) {
                        const chunk = await reader.read();
                        if (chunk.done) break;
                        size += chunk.value.byteLength;
                        if (size > MAX_BODY_BYTES) return error(413, '请求体超过 1 MiB');
                        chunks.push(chunk.value);
                    }
                    clearTimeout(timer);
                    if (receiveExpired) return error(408, '接收请求超时');
                    if (finished || req.signal.aborted) return error(400, '请求已取消');
                    let body: unknown;
                    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
                    catch { return error(400, 'JSON 请求体无效'); }
                    reader = undefined;
                    // Header/body idle limits must not truncate a long-running tool.
                    server.timeout(req, 0);
                    mcp = createMcpServer(authFor(token), options);
                    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
                    await mcp.connect(transport);
                    if (finished) { await mcp.close(); return error(400, '请求已取消'); }
                    timer = setTimeout(() => { status = 504; cleanup(); }, Math.max(60_000, timeout));
                    timer.unref();
                    const response = await transport.handleRequest(req, { parsedBody: body });
                    status = response.status;
                    if (!response.body) { cleanup(); return response; }
                    reader = response.body.getReader();
                    // Observe stream completion as well as disconnects to release per-request MCP state.
                    const stream = new ReadableStream<Uint8Array>({
                        async pull(controller) {
                            try {
                                const chunk = await reader!.read();
                                if (chunk.done) { controller.close(); cleanup(); }
                                else controller.enqueue(chunk.value);
                            } catch { controller.error(new Error('MCP response closed')); cleanup(); }
                        },
                        cancel() { status = 499; cleanup(); },
                    });
                    return new Response(stream, { status: response.status, headers: response.headers });
                } catch { return error(500, 'MCP 请求处理失败'); }
            },
            error() { return Response.json({ error: 'MCP 请求处理失败' }, { status: 500 }); },
        });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        throw new ZentaoError('E5004', { reason: code ?? '监听失败' });
    }
    let closing: Promise<void> | undefined;
    return {
        url: new URL('/mcp', server.url),
        close() {
            return closing ??= (async () => {
                stopping = true;
                const timer = setTimeout(() => {
                    for (const cancel of active) cancel();
                    void server.stop(true);
                }, DRAIN_TIMEOUT);
                timer.unref();
                try { await server.stop(false); await server.stop(true); }
                finally { clearTimeout(timer); }
            })();
        },
    };
}
