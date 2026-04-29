import { describe, test, expect } from 'bun:test';
import { ZentaoClient, createClient } from '../src/api/client';
import { ZentaoError } from '../src/errors';

describe('ZentaoClient', () => {
    test('constructs correct base URL', () => {
        const client = new ZentaoClient('https://zentao.example.com', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('trims trailing slashes from server URL', () => {
        const client = new ZentaoClient('https://zentao.example.com/', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('trims multiple trailing slashes', () => {
        const client = new ZentaoClient('https://zentao.example.com///', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('preserves port in server URL', () => {
        const client = new ZentaoClient('https://zentao.example.com:8080', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com:8080/api.php/v2');
    });

    test('preserves path prefix in server URL', () => {
        const client = new ZentaoClient('https://zentao.example.com/zentao', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/zentao/api.php/v2');
    });
});

describe('ZentaoClient HTTP behavior', () => {
    function createMockServer(handler: (req: Request) => Response | Promise<Response>) {
        return Bun.serve({
            port: 0, // random available port
            fetch: handler,
        });
    }

    function makeClient(server: { url: URL }, token = 'test-token') {
        return new ZentaoClient(server.url.toString(), token);
    }

    test('sends correct token header', async () => {
        let receivedToken: string | undefined;
        const server = createMockServer((req) => {
            receivedToken = req.headers.get('Token') ?? undefined;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.get('/test');
            expect(receivedToken).toBe('test-token');
        } finally {
            server.stop();
        }
    });

    test('setToken updates token for subsequent requests', async () => {
        let receivedToken: string | undefined;
        const server = createMockServer((req) => {
            receivedToken = req.headers.get('Token') ?? undefined;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.get('/test');
            expect(receivedToken).toBe('test-token');

            client.setToken('updated-token');
            await client.get('/test');
            expect(receivedToken).toBe('updated-token');
        } finally {
            server.stop();
        }
    });

    test('appends query parameters to URL', async () => {
        let receivedUrl: string | undefined;
        const server = createMockServer((req) => {
            receivedUrl = req.url;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.get('/items', { page: 1, recPerPage: 20 });
            const url = new URL(receivedUrl!);
            expect(url.searchParams.get('page')).toBe('1');
            expect(url.searchParams.get('recPerPage')).toBe('20');
        } finally {
            server.stop();
        }
    });

    test('skips undefined query parameters', async () => {
        let receivedUrl: string | undefined;
        const server = createMockServer((req) => {
            receivedUrl = req.url;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.get('/items', { page: 1, extra: undefined as any });
            const url = new URL(receivedUrl!);
            expect(url.searchParams.get('page')).toBe('1');
            expect(url.searchParams.has('extra')).toBe(false);
        } finally {
            server.stop();
        }
    });

    test('sends POST with JSON body', async () => {
        let receivedBody: any;
        let receivedMethod: string | undefined;
        const server = createMockServer(async (req) => {
            receivedMethod = req.method;
            receivedBody = await req.json();
            return Response.json({ status: 'success', data: { id: 1 } });
        });

        try {
            const client = makeClient(server);
            await client.post('/items', { name: 'test' });
            expect(receivedMethod).toBe('POST');
            expect(receivedBody).toEqual({ name: 'test' });
        } finally {
            server.stop();
        }
    });

    test('does not send body for GET requests', async () => {
        let receivedMethod: string | undefined;
        const server = createMockServer(async (req) => {
            receivedMethod = req.method;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.get('/items', { name: 'test' } as any);
            expect(receivedMethod).toBe('GET');
        } finally {
            server.stop();
        }
    });

    test('throws E1004 on 401 response', async () => {
        const server = createMockServer(() => {
            return new Response('Unauthorized', { status: 401 });
        });

        try {
            const client = makeClient(server);
            try {
                await client.get('/test');
            } catch (e) {
                expect((e as ZentaoError).code).toBe('1004');
            }
        } finally {
            server.stop();
        }
    });

    test('throws E2006 on 403 response', async () => {
        const server = createMockServer(() => {
            return new Response('Forbidden', { status: 403 });
        });

        try {
            const client = makeClient(server);
            try {
                await client.get('/test');
            } catch (e) {
                expect((e as ZentaoError).code).toBe('2006');
            }
        } finally {
            server.stop();
        }
    });

    test('throws E2002 on 404 response', async () => {
        const server = createMockServer(() => {
            return new Response('Not Found', { status: 404 });
        });

        try {
            const client = makeClient(server);
            try {
                await client.get('/test');
            } catch (e) {
                expect((e as ZentaoError).code).toBe('2002');
            }
        } finally {
            server.stop();
        }
    });

    test('throws E2008 on server status=fail', async () => {
        const server = createMockServer(() => {
            return Response.json({ status: 'fail', message: 'invalid params' });
        });

        try {
            const client = makeClient(server);
            try {
                await client.get('/test');
            } catch (e) {
                expect((e as ZentaoError).code).toBe('2008');
            }
        } finally {
            server.stop();
        }
    });

    test('throws E2008 on invalid JSON response', async () => {
        const server = createMockServer(() => {
            return new Response('not json', {
                headers: { 'Content-Type': 'text/plain' },
            });
        });

        try {
            const client = makeClient(server);
            try {
                await client.get('/test');
            } catch (e) {
                expect((e as ZentaoError).code).toBe('2008');
            }
        } finally {
            server.stop();
        }
    });

    test('returns parsed JSON on success', async () => {
        const server = createMockServer(() => {
            return Response.json({
                status: 'success',
                products: [{ id: 1, name: '产品1' }],
            });
        });

        try {
            const client = makeClient(server);
            const result = await client.get('/products');
            expect(result.status).toBe('success');
            expect((result as any).products[0].name).toBe('产品1');
        } finally {
            server.stop();
        }
    });

    test('PUT sends correct method', async () => {
        let receivedMethod: string | undefined;
        const server = createMockServer(async (req) => {
            receivedMethod = req.method;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.put('/items/1', { name: 'updated' });
            expect(receivedMethod).toBe('PUT');
        } finally {
            server.stop();
        }
    });

    test('DELETE sends correct method', async () => {
        let receivedMethod: string | undefined;
        const server = createMockServer((req) => {
            receivedMethod = req.method;
            return Response.json({ status: 'success', data: {} });
        });

        try {
            const client = makeClient(server);
            await client.del('/items/1');
            expect(receivedMethod).toBe('DELETE');
        } finally {
            server.stop();
        }
    });

    test('sets custom timeout', async () => {
        const server = createMockServer(async () => {
            await Bun.sleep(200);
            return Response.json({ status: 'success' });
        });

        try {
            const client = makeClient(server);
            await expect(
                client.request('GET', '/test', { timeout: 50 }),
            ).rejects.toThrow(ZentaoError);
        } finally {
            server.stop();
        }
    });

    test('createClient factory works identically', () => {
        const client = createClient('https://example.com', 'tok');
        expect(client.baseUrl).toBe('https://example.com/api.php/v2');
    });
});
