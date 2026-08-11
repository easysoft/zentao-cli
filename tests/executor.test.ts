import { describe, expect, test } from 'bun:test';
import type { ZentaoClient } from '../src/api/index';
import { DEFAULT_CONFIG } from '../src/config/defaults';
import { getModule } from '../src/modules';
import { executeModuleCommand } from '../src/modules/executor';

interface CapturedRequest {
    path: string;
    options: { method?: string; query?: unknown; body?: unknown };
}

function mockClient(handler: (req: CapturedRequest) => unknown) {
    const requests: CapturedRequest[] = [];
    const client = {
        async request(path: string, options: CapturedRequest['options']) {
            const captured = { path, options };
            requests.push(captured);
            return handler(captured);
        },
    } as unknown as ZentaoClient;
    return { client, requests };
}

describe('module executor (zentao-api request pipeline)', () => {
    test('executes list commands and applies SDK-side processing', async () => {
        const { client, requests } = mockClient(() => ({
            status: 'success',
            products: [
                { id: 1, name: '保留', status: 'active', desc: '<p>Hello</p>' },
                { id: 2, name: '丢弃', status: 'closed', desc: '<p>Bye</p>' },
            ],
            pager: { recTotal: 2, recPerPage: 20, pageID: 1 },
        }));

        const result = await executeModuleCommand(
            client,
            getModule('product')!,
            'list',
            [],
            {
                filter: ['status:active'],
                search: ['保留'],
                pick: 'id,name,desc',
                page: '1',
                recPerPage: '20',
            },
            DEFAULT_CONFIG,
        );

        expect(requests).toHaveLength(1);
        expect(requests[0].path).toBe('/products');
        expect(requests[0].options.method).toBe('GET');
        expect(result.isList).toBe(true);
        expect(result.fields).toEqual(['id', 'name', 'desc']);
        expect(result.pager).toEqual({ recTotal: 2, recPerPage: 20, pageID: 1 });
        expect(result.data).toEqual([{ id: 1, name: '保留', desc: 'Hello' }]);
    });

    test('uses unified filter/search groups, legacy sort syntax, and nested pick output', async () => {
        const { client } = mockClient(() => ({
            status: 'success',
            products: [
                { id: 1, name: '产品1', status: 'active', priority: 3, owner: { name: 'admin' } },
                { id: 2, name: '产品2', status: 'closed', priority: 1, owner: { name: 'dev1' } },
                { id: 3, name: '项目1', status: 'active', priority: 2, owner: { name: 'admin' } },
                { id: 4, name: '项目2', status: 'closed', priority: 5, owner: { name: 'dev2' } },
            ],
        }));

        const result = await executeModuleCommand(
            client,
            getModule('product')!,
            'list',
            [],
            {
                filter: ['status:active,priority>=2', 'owner.name=dev1'],
                search: ['产品,1', '项目1'],
                searchFields: 'name',
                sort: 'priority_desc',
                pick: 'id,owner.name',
            },
            DEFAULT_CONFIG,
        );

        expect(result.data).toEqual([
            { id: 1, owner: { name: 'admin' } },
            { id: 3, owner: { name: 'admin' } },
        ]);
    });

    test('executes get commands with HTML conversion and pick', async () => {
        const { client, requests } = mockClient(() => ({
            status: 'success',
            user: { id: 1, realname: 'Admin', bio: '<p>Hello</p>' },
        }));

        const result = await executeModuleCommand(
            client,
            getModule('user')!,
            'get',
            ['1'],
            { pick: 'id,bio' },
            DEFAULT_CONFIG,
        );

        expect(requests[0].path).toBe('/users/1');
        expect(requests[0].options.method).toBe('GET');
        expect(result.isList).toBe(false);
        expect(result.fields).toEqual(['id', 'bio']);
        expect(result.data).toEqual({ id: 1, bio: 'Hello' });
        expect((result.rawResponse as { status: string }).status).toBe('success');
    });

    test('skips HTML conversion when disabled', async () => {
        const { client } = mockClient(() => ({
            status: 'success',
            products: [{ id: 1, name: '产品', desc: '<p>Hello</p>' }],
        }));

        const result = await executeModuleCommand(
            client,
            getModule('product')!,
            'list',
            [],
            { pick: 'id,desc' },
            { ...DEFAULT_CONFIG, htmlToMarkdown: false },
        );

        expect(result.data).toEqual([{ id: 1, desc: '<p>Hello</p>' }]);
    });

    test('returns the original API response in raw mode without local processing', async () => {
        const { client } = mockClient(() => ({
            status: 'success',
            products: [{ id: 1, status: 'active', desc: '<p>Hello</p>' }],
        }));

        const result = await executeModuleCommand(
            client,
            getModule('product')!,
            'list',
            [],
            { format: 'raw', filter: ['status=closed'], pick: 'id' },
            DEFAULT_CONFIG,
        );

        expect(result.data).toEqual({
            status: 'success',
            products: [{ id: 1, status: 'active', desc: '<p>Hello</p>' }],
        });
        expect(result.rawResponse).toEqual(result.data);
    });

    test('executes create commands and retains the normalized response', async () => {
        const rawResponse = { status: 'success', id: 7, message: 'created' };
        const { client, requests } = mockClient(() => rawResponse);

        const result = await executeModuleCommand(
            client,
            getModule('user')!,
            'create',
            [],
            { account: 'dev1', realname: 'Dev One', password: 'secret' } as never,
            DEFAULT_CONFIG,
        );

        expect(requests[0].path).toBe('/users');
        expect(requests[0].options.method).toBe('POST');
        expect(requests[0].options.body).toMatchObject({
            account: 'dev1',
            realname: 'Dev One',
            password: 'secret',
        });
        expect((result.rawResponse as { status: string }).status).toBe('success');
    });

    test('throws when required write parameters are missing', async () => {
        const { client } = mockClient(() => {
            throw new Error('should not request');
        });

        await expect(executeModuleCommand(
            client,
            getModule('user')!,
            'create',
            [],
            { account: 'dev1', realname: 'Dev One' } as never,
            DEFAULT_CONFIG,
        )).rejects.toThrow();
    });

    test('update auto-fills missing fields from the current object', async () => {
        const { client, requests } = mockClient((req) => {
            if (req.options.method === 'GET') {
                return {
                    status: 'success',
                    user: {
                        id: 1,
                        account: 'admin',
                        realname: 'Admin',
                        dept: 5,
                        email: 'admin@example.com',
                        group: ['1', '2'],
                        mobile: '13800000000',
                    },
                };
            }
            return { status: 'success', id: 1 };
        });

        await executeModuleCommand(
            client,
            getModule('user')!,
            'update',
            ['1'],
            { email: 'new@example.com' } as never,
            DEFAULT_CONFIG,
        );

        expect(requests).toHaveLength(2);
        const getReq = requests.find((r) => r.options.method === 'GET');
        const putReq = requests.find((r) => r.options.method === 'PUT');
        expect(getReq?.path).toBe('/users/1');
        expect(putReq?.path).toBe('/users/1');
        expect(putReq?.options.body).toMatchObject({
            realname: 'Admin',
            dept: 5,
            email: 'new@example.com',
        });
    });

    test('create does not trigger an auto-fill GET', async () => {
        const { client, requests } = mockClient(() => ({ status: 'success', id: 9 }));

        await executeModuleCommand(
            client,
            getModule('user')!,
            'create',
            [],
            { account: 'a', realname: 'b', password: 'c' } as never,
            DEFAULT_CONFIG,
        );

        expect(requests.every((r) => r.options.method !== 'GET')).toBe(true);
    });
});
