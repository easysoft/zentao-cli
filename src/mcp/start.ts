import { randomBytes } from 'node:crypto';
import { requestToken } from '../auth/token.js';
import { ZentaoError } from '../errors.js';
import { renderMcpStartPage } from './start-page.js';
import { mcpStartMessages } from './start-messages.js';
import type { McpHttpOptions } from './http.js';

export const START_BODY_LIMIT = 16_384;
export const isStartRoute = (path: string) => ['/start', '/start/', '/start/token'].includes(path);

interface StartRequest {
    path: string;
    method: string;
    headers: Headers;
    signal: AbortSignal;
    readBody(): Promise<{ body?: unknown; status?: number }>;
}

/** Shared by Node and Bun; this public page never uses the service machine's credentials. */
export function createMcpStartHandler(options: McpHttpOptions) {
    const key = randomBytes(32).toString('hex');
    let pending = 0;
    return async ({ path, method, headers, signal, readBody }: StartRequest): Promise<Response> => {
        const nonce = randomBytes(18).toString('base64');
        const responseHeaders = {
            ...(method === 'POST' ? { Connection: 'close' } : {}),
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        };
        const error = (status: number, errorCode: keyof typeof mcpStartMessages.zh, extra?: Record<string, string>) =>
            Response.json({ error: mcpStartMessages.zh[errorCode], errorCode }, { status, headers: { ...responseHeaders, ...extra } });
        if (path.includes('?')) return error(400, 'noQuery');
        if (path === '/start' || path === '/start/') {
            if (method !== 'GET') return error(405, 'pageMethod', { Allow: 'GET' });
            return new Response(renderMcpStartPage({ ...options, nonce, key }), {
                headers: { ...responseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
            });
        }
        if (method !== 'POST') return error(405, 'postOnly', { Allow: 'POST' });
        // Host is preserved by the proxy; do not trust arbitrary Forwarded headers.
        let origin: URL;
        try { origin = new URL(headers.get('origin') ?? ''); }
        catch { return error(403, 'invalidOrigin'); }
        if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== headers.get('origin')
            || origin.host !== headers.get('host')?.toLowerCase() || headers.get('x-zentao-start') !== key
            || ![null, 'same-origin', 'none'].includes(headers.get('sec-fetch-site'))) {
            return error(403, 'expired');
        }
        if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
            return error(403, 'httpsRequired');
        }
        if (headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
            return error(415, 'jsonRequired');
        }
        if (pending >= 8) return error(429, 'busy', { 'Retry-After': '5' });
        pending++;
        try {
            const { body, status } = await readBody();
            if (status) return error(status, status === 413 ? 'tooLarge' : status === 408 ? 'bodyTimeout' : 'invalidJson');
            if (!body || typeof body !== 'object' || Array.isArray(body)) return error(400, 'required');
            const data = body as Record<string, unknown>;
            if (Object.keys(data).some(name => !['account', 'password'].includes(name))
                || typeof data.account !== 'string' || !data.account.trim() || data.account.length > 256
                || typeof data.password !== 'string' || !data.password || data.password.length > 4096) {
                return error(400, 'invalidCredentialsInput');
            }
            if (signal.aborted) return error(400, 'cancelled');
            const token = await requestToken(options.url, data.account.trim(), data.password, { ...options, signal });
            if (!/^[A-Za-z0-9\-._~+/]+=*$/.test(token)) return error(502, 'invalidTokenResponse');
            return Response.json({ token }, { headers: responseHeaders });
        } catch (cause) {
            // Never expose upstream payloads, passwords or tokens through errors or logs.
            const code = cause instanceof ZentaoError ? cause.code : '';
            if (['1003', '1004', '2006'].includes(code)) return error(401, 'invalidCredentials');
            if (code === '5001') return error(504, 'timeout');
            if (code === '5002') return error(502, 'certificate');
            return error(502, 'loginFailed');
        } finally { pending--; }
    };
}
