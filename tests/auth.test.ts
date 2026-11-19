import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '../src/api/index';
import { login, verifyToken, getEnvCredentials } from '../src/auth/login';
import { findCurrentUser } from '../src/auth/user.js';
import { executeModuleCommand } from '../src/modules/executor';
import { getModule } from '../src/modules';
import { DEFAULT_CONFIG } from '../src/config/defaults';
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
    test('uses the token owner endpoint with its own credentials and shares the cached configuration', async () => {
        const user = { account: 'dev', realname: 'Dev' };
        let configRequests = 0;
        const paths: string[] = [];
        const server = createMockServer({
            serverConfig: () => { configRequests++; return Response.json({ version: 'biz14.0' }); },
            users: () => { throw new Error('Unexpected user directory lookup'); },
            fallback: (req, url) => {
                paths.push(url.pathname + url.search);
                expect(req.headers.get('Token')).toBe('test-token');
                expect(req.headers.get('ZenTao-Action-Assistant')).toBe('AI <identity>');
                return Response.json({ status: 'success', user });
            },
        });
        try {
            const client = makeClient(server);
            for (const account of ['dev', undefined]) {
                expect(await findCurrentUser(client, account, 'AI <identity>')).toEqual({ user, hadUsers: true });
            }
            expect(configRequests).toBe(1);
            expect(paths).toEqual(['/api.php/v2/my/profile', '/api.php/v2/my/profile']);
        } finally { server.stop(true); }
    });

    test('reports my/profile failures without falling back to the user directory', async () => {
        let response: Response;
        let directoryReads = 0;
        const server = createMockServer({
            serverConfig: () => Response.json({ version: '23.0' }),
            users: () => { directoryReads++; return Response.json({ users: [{ account: 'admin' }] }); },
            fallback: () => response.clone(),
        });
        try {
            const client = makeClient(server);
            for (const [result, code] of [
                [new Response(null, { status: 401 }), '1004'], [new Response(null, { status: 403 }), '2006'],
                [new Response(null, { status: 404 }), '2002'], [Response.json({ status: 'fail', message: 'denied' }), '2008'],
                [Response.json({ user: { account: ' ' } }), '2008'], [Response.json({ status: 'success' }), '2008'],
                [Response.json({ user: { account: 'other' } }), '1013'],
            ] as const) {
                response = result;
                await expect(verifyToken(client, 'admin')).rejects.toMatchObject({ code });
            }
            expect(directoryReads).toBe(0);
        } finally { server.stop(true); }
    });

    test('CLI verifies token ownership before saving explicit token and password logins', async () => {
        const directory = mkdtempSync(join(tmpdir(), 'zentao-owner-'));
        const config = join(directory, 'config.json');
        const paths: string[] = [];
        let actual = 'other';
        const server = createMockServer({
            serverConfig: () => { paths.push('config'); return Response.json({ version: 'ipd6.0' }); },
            users: () => { throw new Error('Unexpected directory lookup'); },
            fallback: (_req, url) => {
                paths.push(url.pathname);
                return url.pathname.endsWith('/login') ? Response.json({ status: 'success', token: 'my-token' })
                    : Response.json({ status: 'success', user: { account: actual, realname: 'Developer' } });
            },
        });
        const run = async (credential: string) => {
            const child = Bun.spawn([process.execPath, '--no-env-file', 'src/index.ts', '--config', config, '--format=json',
                'auth', 'login', '--server', server.url.href, '--user', 'dev', credential], {
                env: { ...process.env, ZENTAO_URL: '', ZENTAO_ACCOUNT: '', ZENTAO_PASSWORD: '', ZENTAO_TOKEN: '' },
                stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
            });
            return Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
        };
        try {
            for (const credential of ['--token=my-token', '--password=fixture']) {
                writeFileSync(config, '{}');
                actual = 'other';
                const [status, output, error] = await run(credential);
                expect(status).toBe(1);
                expect(output).toBe('');
                expect(JSON.parse(error).error).toMatchObject({ code: '1013', message: expect.stringContaining('other') });
                expect(readFileSync(config, 'utf8')).toBe('{}');
                const requests = [...(credential.startsWith('--password') ? ['/api.php/v2/users/login'] : []), 'config', '/api.php/v2/my/profile'];
                expect(paths.splice(0)).toEqual(requests);
                actual = 'dev';
                const [ok, , stderr] = await run(credential);
                expect(ok, stderr).toBe(0);
                expect(JSON.parse(readFileSync(config, 'utf8')).profiles).toMatchObject([{ account: 'dev', user: { account: 'dev', realname: 'Developer' } }]);
                expect(paths.splice(0)).toEqual(requests);
            }
        } finally { server.stop(true); rmSync(directory, { recursive: true, force: true }); }
    });

    test('password login keeps config when user lookup fails and reuses it for subsequent requests', async () => {
        let configRequests = 0;
        const server = createMockServer({
            serverConfig: () => {
                configRequests++;
                return Response.json({ version: '22.5' });
            },
            users: () => new Response('Forbidden', { status: 403 }),
            fallback: (_req, url) => url.pathname.endsWith('/users/login')
                ? Response.json({ status: 'success', token: 'test-login-token' })
                : Response.json({ status: 'success', products: [] }),
        });
        try {
            const result = await login(server.url.toString(), 'admin', 'test-password');
            expect(result.serverConfig?.version).toBe('22.5');
            expect(result.user).toBeUndefined();
            await executeModuleCommand(result.client, getModule('product')!, 'list', [], {}, DEFAULT_CONFIG);
            expect(configRequests).toBe(1);
        } finally {
            server.stop();
        }
    });

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
            expect(result.serverConfig.version).toBe('22.0');
            expect((result.serverConfig as unknown as Record<string, unknown>).edition).toBe('open');
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
