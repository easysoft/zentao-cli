import { describe, test, expect } from 'bun:test';
import { ZentaoClient, createClient, getServerConfig } from '../src/api/index';
import { ZentaoError } from '../src/errors';

describe('createClient', () => {
    test('constructs correct base URL', () => {
        const client = createClient('https://zentao.example.com', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('trims trailing slashes from server URL', () => {
        const client = createClient('https://zentao.example.com///', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('preserves port in server URL', () => {
        const client = createClient('https://zentao.example.com:8080', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com:8080/api.php/v2');
    });

    test('exposes siteUrl without the API suffix', () => {
        const client = createClient('https://zentao.example.com/', 'token123');
        expect(client.siteUrl).toBe('https://zentao.example.com');
    });

    test('returns an SDK ZentaoClient instance', () => {
        expect(createClient('https://example.com', 'tok')).toBeInstanceOf(ZentaoClient);
    });
});

describe('ZentaoClient HTTP behavior (SDK)', () => {
    function createMockServer(handler: (req: Request) => Response | Promise<Response>) {
        return Bun.serve({ port: 0, fetch: handler });
    }

    function makeClient(server: { url: URL }, token = 'test-token') {
        return createClient(server.url.toString(), token);
    }

    test('sends correct token header', async () => {
        let receivedToken: string | undefined;
        const server = createMockServer((req) => {
            receivedToken = req.headers.get('Token') ?? undefined;
            return Response.json({ status: 'success', data: {} });
        });
        try {
            await makeClient(server).get('/test');
            expect(receivedToken).toBe('test-token');
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
            await makeClient(server).get('/items', { query: { page: 1, recPerPage: 20 } });
            const url = new URL(receivedUrl!);
            expect(url.searchParams.get('page')).toBe('1');
            expect(url.searchParams.get('recPerPage')).toBe('20');
        } finally {
            server.stop();
        }
    });

    test('sends POST with JSON body', async () => {
        let receivedBody: unknown;
        let receivedMethod: string | undefined;
        const server = createMockServer(async (req) => {
            receivedMethod = req.method;
            receivedBody = await req.json();
            return Response.json({ status: 'success', data: { id: 1 } });
        });
        try {
            await makeClient(server).post('/items', { name: 'test' });
            expect(receivedMethod).toBe('POST');
            expect(receivedBody).toEqual({ name: 'test' });
        } finally {
            server.stop();
        }
    });

    test('does not send body for GET requests', async () => {
        let receivedMethod: string | undefined;
        const server = createMockServer((req) => {
            receivedMethod = req.method;
            return Response.json({ status: 'success', data: {} });
        });
        try {
            await makeClient(server).get('/items', { query: { name: 'test' } });
            expect(receivedMethod).toBe('GET');
        } finally {
            server.stop();
        }
    });

    test('returns parsed JSON on success', async () => {
        const server = createMockServer(() =>
            Response.json({ status: 'success', products: [{ id: 1, name: '产品1' }] }),
        );
        try {
            const result = await makeClient(server).get<Record<string, unknown>>('/products');
            expect(result.status).toBe('success');
            expect((result.products as Array<{ name: string }>)[0].name).toBe('产品1');
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
            await makeClient(server).put('/items/1', { name: 'updated' });
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
            await makeClient(server).delete('/items/1');
            expect(receivedMethod).toBe('DELETE');
        } finally {
            server.stop();
        }
    });

    test('rejects on custom timeout', async () => {
        const server = createMockServer(async () => {
            await Bun.sleep(200);
            return Response.json({ status: 'success' });
        });
        try {
            const client = createClient(server.url.toString(), 'tok', { timeout: 50 });
            await expect(client.get('/test')).rejects.toThrow();
        } finally {
            server.stop();
        }
    });
});

describe('getServerConfig', () => {
    function createMockServer(handler: (req: Request, url: URL) => Response | Promise<Response>) {
        return Bun.serve({
            port: 0,
            fetch(req) {
                return handler(req, new URL(req.url));
            },
        });
    }

    test('fetches the getconfig endpoint from siteUrl', async () => {
        let receivedPath: string | undefined;
        let receivedMode: string | null = null;
        const server = createMockServer((_req, url) => {
            receivedPath = url.pathname;
            receivedMode = url.searchParams.get('mode');
            return Response.json({ version: '22.0' });
        });
        try {
            const config = await getServerConfig(createClient(server.url.toString(), 'tok'));
            expect(receivedPath).toBe('/');
            expect(receivedMode).toBe('getconfig');
            expect(config.version).toBe('22.0');
        } finally {
            server.stop();
        }
    });

    test('throws ZentaoError on non-ok response', async () => {
        const server = createMockServer(() => new Response('boom', { status: 500 }));
        try {
            await expect(
                getServerConfig(createClient(server.url.toString(), 'tok')),
            ).rejects.toBeInstanceOf(ZentaoError);
        } finally {
            server.stop();
        }
    });
});
