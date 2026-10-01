import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { login } from './login.js';
import { openBrowser } from './browser-open.js';
import { renderBrowserLoginPage } from './browser-page.js';
import { buildProfile, getProfile, normalizeServerUrl, saveProfile } from '../config/store.js';
import { ZentaoError } from '../errors.js';
import type { Profile } from '../types/index.js';

interface BrowserLoginOptions {
    server?: string;
    account?: string;
    message?: string;
    insecure?: boolean;
    timeout?: number;
    open?: boolean;
    fallbackToTerminal?: boolean;
    waitTimeoutMs?: number;
}

/** Keep upstream responses out of the page: they can contain credentials or HTML. */
function loginErrorMessage(error: unknown): string {
    const code = error instanceof ZentaoError ? error.code : '';
    switch (code) {
        case '1003': case '1004': return '用户名或密码不正确，请检查后重试。';
        case '1002': return '无法连接禅道，请检查地址和网络连接。';
        case '5001': return '连接禅道超时，请检查网络后重试。';
        case '5002': return '禅道的 HTTPS 证书验证失败，请联系管理员检查证书。';
        case '2011': case '2012': return '无法识别禅道服务，请填写禅道站点根地址。';
        default: return '登录或保存失败，请检查禅道地址、账号及本地配置文件权限后重试。';
    }
}

/** A short-lived loopback session, shared by CLI and local integration checks. */
export async function startBrowserLogin(options: BrowserLoginOptions = {}): Promise<{
    url: string;
    result: Promise<Profile>;
    cancel: () => void;
}> {
    const key = randomBytes(32).toString('hex');
    const nonce = randomBytes(18).toString('base64');
    const controller = new AbortController();
    const sockets = new Set<Socket>();
    let origin = '';
    let finished = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resolveResult!: (profile: Profile) => void;
    let rejectResult!: (error: ZentaoError) => void;
    const result = new Promise<Profile>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
    });
    // Cancellation can happen while the browser launcher is still running.
    void result.catch(() => {});

    const server = createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Connection', 'close');
        res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
        void handle(req, res).catch(() => {
            if (!res.headersSent) reply(res, 500, { error: '请求处理失败，请重试。' });
            else res.destroy();
        });
    });
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
    });

    function finish(error?: ZentaoError, profile?: Profile): void {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        controller.abort();
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
        server.close();
        // Allow the last response to flush, then reap incomplete/idle requests on Node 18 too.
        const cleanup = setTimeout(() => { for (const socket of sockets) socket.destroy(); }, 250);
        cleanup.unref();
        if (error) rejectResult(error);
        else resolveResult(profile!);
    }

    function cancel(): void { finish(new ZentaoError('E1008')); }

    function reply(res: ServerResponse, status: number, body: object): void {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(body));
    }

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (req.headers.host !== new URL(origin).host) {
            reply(res, 403, { error: '仅允许本机登录请求。' });
            return;
        }
        if (finished) {
            reply(res, 410, { error: '登录页面已失效，请重新发起登录。' });
            return;
        }
        if (req.method === 'GET' && req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderBrowserLoginPage({ nonce, server: options.server, account: options.account, message: options.message, insecure: options.insecure }));
            return;
        }
        if (req.method !== 'POST' || !['/login', '/cancel'].includes(req.url ?? '')) {
            reply(res, 404, { error: '页面不存在。' });
            return;
        }
        if (req.headers.origin !== origin || req.headers['x-zentao-login'] !== key) {
            reply(res, 403, { error: '登录页面已失效或请求来源不正确，请重新发起登录。' });
            return;
        }
        if (req.url === '/cancel') {
            // The CLI exits with an error on cancellation; flush the page response first.
            res.once('finish', cancel);
            res.once('close', cancel);
            reply(res, 200, { ok: true });
            return;
        }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
            reply(res, 415, { error: '请通过登录页面提交信息。' });
            return;
        }
        if (busy) {
            reply(res, 409, { error: '正在登录，请稍候。' });
            return;
        }
        busy = true;
        try {
            const chunks: Buffer[] = [];
            let bytes = 0;
            for await (const chunk of req) {
                bytes += chunk.length;
                if (bytes > 16_384) {
                    reply(res, 413, { error: '登录信息过长，请检查输入。' });
                    return;
                }
                chunks.push(Buffer.from(chunk));
            }
            let data: { server?: unknown; account?: unknown; password?: unknown } | null;
            try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
            catch { reply(res, 400, { error: '登录信息格式不正确。' }); return; }
            if (!data || typeof data.server !== 'string' || typeof data.account !== 'string'
                || typeof data.password !== 'string' || !data.server.trim() || !data.account.trim() || !data.password) {
                reply(res, 400, { error: '请填写禅道地址、用户名和密码。' });
                return;
            }
            let url: URL;
            try { url = new URL(data.server.trim()); }
            catch { reply(res, 400, { error: '请填写完整的禅道地址，例如 https://zentao.example.com。' }); return; }
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
                reply(res, 400, { error: '请填写 HTTP 或 HTTPS 站点根地址，不要包含账号、密码、查询参数或锚点。' });
                return;
            }
            const site = normalizeServerUrl(url.toString());
            const account = data.account.trim();
            const oldProfile = getProfile(account, site);
            const authenticated = await login(site, account, data.password, { ...options, signal: controller.signal });
            if (finished) return;
            const profile = buildProfile(site, account, authenticated.token, authenticated.serverConfig, authenticated.user, oldProfile);
            saveProfile(profile);
            reply(res, 200, { ok: true, account, server: site });
            finish(undefined, profile);
        } catch (error) {
            if (!finished) reply(res, 400, { error: loginErrorMessage(error) });
        } finally {
            busy = false;
        }
    }

    try {
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
        });
    } catch {
        server.close();
        throw new ZentaoError('E1010');
    }
    const address = server.address() as { port: number };
    origin = `http://127.0.0.1:${address.port}`;
    server.on('error', () => finish(new ZentaoError('E1010')));
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    timer = setTimeout(() => finish(new ZentaoError('E1009')), options.waitTimeoutMs ?? 5 * 60_000);
    return { url: `${origin}/#${key}`, result, cancel };
}

export async function browserLogin(options: BrowserLoginOptions = {}): Promise<Profile | undefined> {
    const session = await startBrowserLogin(options);
    process.stderr.write(`请在运行 CLI 的本机浏览器中完成登录（5 分钟内有效）：\n${session.url}\n`);
    if (options.open !== false && !await openBrowser(session.url)) {
        if (options.fallbackToTerminal) {
            session.cancel();
            // A user may have completed the login before the launcher reported failure.
            try { return await session.result; }
            catch (error) {
                if (!(error instanceof ZentaoError) || error.code !== '1008') throw error;
            }
            process.stderr.write('未能自动打开浏览器，已关闭临时页面，改用终端登录。\n');
            return;
        }
        process.stderr.write('未能自动打开浏览器，请手动打开上面的链接。\n');
    }
    return session.result;
}
