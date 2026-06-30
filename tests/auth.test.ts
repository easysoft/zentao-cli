import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { createClient } from '../src/api/index';
import { verifyToken, getEnvCredentials } from '../src/auth/login';
import { ZentaoError } from '../src/errors';

type RouteHandler = (req: Request, url: URL) => Response | Promise<Response>;

interface MockRoutes {
    serverConfig?: RouteHandler;
    users?: RouteHandler;
    fallback?: RouteHandler;
}

function createMockServer(routes: MockRoutes) {
    return Bun.serve({
        port: 0,
        fetch(req) {
            const url = new URL(req.url);
            if (url.pathname === '/' && url.searchParams.get('mode') === 'getconfig') {
                return routes.serverConfig?.(req, url) ?? Response.json({ version: '22.0' });
            }
            if (url.pathname === '/api.php/v2/users') {
                return routes.users?.(req, url) ?? Response.json({ status: 'success', users: [] });
            }
            return routes.fallback?.(req, url) ?? new Response('not found', { status: 404 });
        },
    });
}

function makeClient(server: { url: URL }, token = 'test-token') {
    return createClient(server.url.toString(), token);
}

describe('verifyToken', () => {
    test('返回 serverConfig 和匹配账号的 user', async () => {
        const server = createMockServer({
            serverConfig: () => Response.json({ version: '22.0', edition: 'open' }),
            users: () =>
                Response.json({
                    status: 'success',
                    users: [
                        { account: 'alice', realname: 'Alice' },
                        { account: 'admin', realname: 'Admin' },
                    ],
                }),
        });

        try {
            const result = await verifyToken(makeClient(server), 'admin');
            expect(result.serverConfig).toEqual({ version: '22.0', edition: 'open' });
            expect(result.user).toEqual({ account: 'admin', realname: 'Admin' });
        } finally {
            server.stop();
        }
    });

    test('token 有效但账号不在前 100 时，user 为 undefined（非致命）', async () => {
        const server = createMockServer({
            users: () =>
                Response.json({
                    status: 'success',
                    users: [{ account: 'someone-else', realname: 'Other' }],
                }),
        });

        try {
            const result = await verifyToken(makeClient(server), 'admin');
            expect(result.user).toBeUndefined();
            expect(result.serverConfig).toBeDefined();
        } finally {
            server.stop();
        }
    });

    test('/users 返回 401 时抛 E1004（token 失效）', async () => {
        const server = createMockServer({
            users: () => new Response('Unauthorized', { status: 401 }),
        });

        try {
            await expect(verifyToken(makeClient(server), 'admin')).rejects.toMatchObject({
                code: '1004',
            });
        } finally {
            server.stop();
        }
    });

    test('/users 返回空列表时抛 E1004', async () => {
        const server = createMockServer({
            users: () => Response.json({ status: 'success', users: [] }),
        });

        try {
            await expect(verifyToken(makeClient(server), 'admin')).rejects.toMatchObject({
                code: '1004',
            });
        } finally {
            server.stop();
        }
    });

    test('/users 返回的 users 缺失时抛 E1004', async () => {
        const server = createMockServer({
            users: () => Response.json({ status: 'success' }),
        });

        try {
            await expect(verifyToken(makeClient(server), 'admin')).rejects.toMatchObject({
                code: '1004',
            });
        } finally {
            server.stop();
        }
    });

    test('/server/config 返回 5xx 时抛 E2008（按 ZentaoClient 默认映射）', async () => {
        const server = createMockServer({
            serverConfig: () => new Response('boom', { status: 500 }),
        });

        try {
            await expect(verifyToken(makeClient(server), 'admin')).rejects.toBeInstanceOf(
                ZentaoError,
            );
        } finally {
            server.stop();
        }
    });

    test('请求带上 Token 头', async () => {
        let usersToken: string | undefined;
        const server = createMockServer({
            users: (req) => {
                usersToken = req.headers.get('Token') ?? undefined;
                return Response.json({
                    status: 'success',
                    users: [{ account: 'admin' }],
                });
            },
        });

        try {
            await verifyToken(makeClient(server, 'my-token'), 'admin');
            expect(usersToken).toBe('my-token');
        } finally {
            server.stop();
        }
    });

    test('/users 请求带 browseType=inside&recPerPage=100 查询参数', async () => {
        let receivedQuery: URLSearchParams | undefined;
        const server = createMockServer({
            users: (_req, url) => {
                receivedQuery = url.searchParams;
                return Response.json({
                    status: 'success',
                    users: [{ account: 'admin' }],
                });
            },
        });

        try {
            await verifyToken(makeClient(server), 'admin');
            expect(receivedQuery?.get('browseType')).toBe('inside');
            expect(receivedQuery?.get('recPerPage')).toBe('100');
        } finally {
            server.stop();
        }
    });
});

describe('getEnvCredentials', () => {
    const originalEnv = {
        url: process.env.ZENTAO_URL,
        account: process.env.ZENTAO_ACCOUNT,
        password: process.env.ZENTAO_PASSWORD,
        token: process.env.ZENTAO_TOKEN,
    };

    beforeEach(() => {
        delete process.env.ZENTAO_URL;
        delete process.env.ZENTAO_ACCOUNT;
        delete process.env.ZENTAO_PASSWORD;
        delete process.env.ZENTAO_TOKEN;
    });

    afterEach(() => {
        for (const key of ['ZENTAO_URL', 'ZENTAO_ACCOUNT', 'ZENTAO_PASSWORD', 'ZENTAO_TOKEN'] as const) {
            const original = originalEnv[key.replace('ZENTAO_', '').toLowerCase() as keyof typeof originalEnv];
            if (original === undefined) delete process.env[key];
            else process.env[key] = original;
        }
    });

    test('全部环境变量缺失时返回各字段 undefined', () => {
        const env = getEnvCredentials();
        expect(env).toEqual({
            url: undefined,
            account: undefined,
            password: undefined,
            token: undefined,
        });
    });

    test('读取已设置的环境变量', () => {
        process.env.ZENTAO_URL = 'https://zentao.example.com';
        process.env.ZENTAO_ACCOUNT = 'admin';
        process.env.ZENTAO_TOKEN = 'abc';

        const env = getEnvCredentials();
        expect(env.url).toBe('https://zentao.example.com');
        expect(env.account).toBe('admin');
        expect(env.token).toBe('abc');
        expect(env.password).toBeUndefined();
    });
});
