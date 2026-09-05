import { describe, expect, test } from 'bun:test';
import type { ZentaoClient } from '../src/api/index';
import { handleModuleCommand } from '../src/commands/module-handler';
import { getModule } from '../src/modules';
import type { ModuleActionName, ModuleActionOptions } from '../src/types';
import { mockProfile } from './helpers';

async function captureConsoleLog(fn: () => Promise<void>): Promise<string[]> {
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
        output.push(args.map(String).join(' '));
    };
    try {
        await fn();
    } finally {
        console.log = originalLog;
    }
    return output;
}

async function captureConsoleError(fn: () => Promise<void>): Promise<string[]> {
    const output: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
        output.push(args.map(String).join(' '));
    };
    try {
        await fn();
    } finally {
        console.error = originalError;
    }
    return output;
}

describe('handleModuleCommand batch ids', () => {
    async function runDelete(args: string[], options: ModuleActionOptions = {}) {
        const requests: Array<{ method: string; path: string }> = [];
        const client = {
            request: async (path: string, opts: { method?: string }) => {
                requests.push({ method: (opts.method ?? 'GET').toLowerCase(), path });
                return { status: 'success' };
            },
        } as unknown as ZentaoClient;

        await handleModuleCommand(
            client,
            getModule('product')!,
            'delete' as ModuleActionName,
            args,
            mockProfile,
            { yes: true, silent: true, ...options },
        );

        return requests;
    }

    test('executes comma-separated positional ids as batch delete', async () => {
        const requests = await runDelete(['1,2']);

        expect(requests).toEqual([
            { method: 'delete', path: '/products/1' },
            { method: 'delete', path: '/products/2' },
        ]);
    });

    test('executes comma-separated --id option as batch delete', async () => {
        const requests = await runDelete([], { id: '1,2' });

        expect(requests).toEqual([
            { method: 'delete', path: '/products/1' },
            { method: 'delete', path: '/products/2' },
        ]);
    });

    test('prints one JSON summary for a batch', async () => {
        const client = {
            request: async () => ({ status: 'success' }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('product')!,
                'delete' as ModuleActionName,
                ['1,2'],
                mockProfile,
                { yes: true, format: 'json' },
            );
        });

        expect(output).toHaveLength(1);
        expect(JSON.parse(output[0])).toEqual({
            status: 'success',
            result: { success: [1, 2], failed: [], skipped: [], errors: [] },
        });
    });

    test('keeps successful data when batching get operations', async () => {
        const client = {
            request: async (path: string) => ({
                status: 'success',
                product: { id: Number(path.split('/').at(-1)), name: `产品${path.split('/').at(-1)}` },
            }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('product')!,
                'get' as ModuleActionName,
                ['1,2'],
                mockProfile,
                { format: 'json' },
            );
        });

        expect(output).toHaveLength(1);
        expect(JSON.parse(output[0])).toEqual({
            status: 'success',
            result: {
                success: [1, 2],
                failed: [],
                skipped: [],
                data: [
                    { objectID: 1, value: { id: 1, name: '产品1' } },
                    { objectID: 2, value: { id: 2, name: '产品2' } },
                ],
                errors: [],
            },
        });
    });

    test('silent batch failures do not print successful object data', async () => {
        const client = {
            request: async (path: string) => {
                if (path.endsWith('/2')) throw new Error('request failed');
                return { status: 'success', product: { id: 1, secret: 'private value' } };
            },
        } as unknown as ZentaoClient;
        const previousExitCode = process.exitCode;
        process.exitCode = undefined;

        try {
            const output = await captureConsoleError(async () => {
                await handleModuleCommand(
                    client,
                    getModule('product')!,
                    'get' as ModuleActionName,
                    ['1,2'],
                    mockProfile,
                    { format: 'json', silent: true },
                );
            });

            expect(output).toHaveLength(1);
            expect(output[0]).not.toContain('private value');
            expect(JSON.parse(output[0])).toEqual({
                status: 'failed',
                result: {
                    failed: [2],
                    skipped: [],
                    errors: [{ objectID: 2, error: { message: 'request failed' } }],
                },
            });
        } finally {
            process.exitCode = previousExitCode ?? 0;
        }
    });

    test('continues after failures and sets a non-zero exit code', async () => {
        const requests: string[] = [];
        const client = {
            request: async (path: string) => {
                requests.push(path);
                if (path === '/products/2') throw new Error('request failed');
                return { status: 'success' };
            },
        } as unknown as ZentaoClient;
        const previousExitCode = process.exitCode;
        process.exitCode = undefined;

        try {
            const output = await captureConsoleLog(async () => {
                await handleModuleCommand(
                    client,
                    getModule('product')!,
                    'delete' as ModuleActionName,
                    ['1,2,3'],
                    mockProfile,
                    { yes: true, format: 'json' },
                );
            });

            expect(requests).toEqual(['/products/1', '/products/2', '/products/3']);
            expect(output).toHaveLength(1);
            expect(JSON.parse(output[0])).toEqual({
                status: 'failed',
                result: {
                    success: [1, 3],
                    failed: [2],
                    skipped: [],
                    errors: [{ objectID: 2, error: { message: 'request failed' } }],
                },
            });
            expect(Number(process.exitCode)).toBe(1);
        } finally {
            process.exitCode = previousExitCode ?? 0;
        }
    });
});

describe('delete confirmation prompt', () => {
    test('refuses non-interactive deletion without --yes', async () => {
        let requestCount = 0;
        const client = {
            request: async () => {
                requestCount++;
                return { status: 'success' };
            },
        } as unknown as ZentaoClient;
        Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });

        try {
            await expect(handleModuleCommand(
                client,
                getModule('product')!,
                'delete' as ModuleActionName,
                [],
                mockProfile,
                { id: '1', format: 'markdown' },
            )).rejects.toMatchObject({ code: '2009' });
            expect(requestCount).toBe(0);
        } finally {
            delete (process.stdin as { isTTY?: boolean }).isTTY;
        }
    });

    test('machine output does not bypass deletion confirmation', async () => {
        let requestCount = 0;
        const client = {
            request: async () => {
                requestCount++;
                return { status: 'success' };
            },
        } as unknown as ZentaoClient;

        await expect(handleModuleCommand(
            client,
            getModule('product')!,
            'delete' as ModuleActionName,
            [],
            mockProfile,
            { id: '1', format: 'json' },
        )).rejects.toMatchObject({ code: '2009' });
        expect(requestCount).toBe(0);
    });
});

describe('handleModuleCommand rendered output', () => {
    test('prints parseable JSON without ANSI for get commands', async () => {
        const client = {
            request: async () => ({ status: 'success', product: { id: 1, name: '产品1' } }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('product')!,
                'get' as ModuleActionName,
                ['1'],
                mockProfile,
                { format: 'json' },
            );
        });

        expect(output).toHaveLength(1);
        expect(output[0]).not.toContain('\x1b');
        expect(JSON.parse(output[0])).toEqual({ id: 1, name: '产品1' });
    });

    test('does not render Markdown ANSI when stdout is not a TTY', async () => {
        const client = {
            request: async () => ({ status: 'success', product: { id: 1, name: '产品1' } }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('product')!,
                'get' as ModuleActionName,
                ['1'],
                mockProfile,
                { format: 'markdown' },
            );
        });

        expect(output[0]).not.toContain('\x1b');
        expect(output[0]).toContain('* id: 1');
    });
});

describe('handleModuleCommand raw output', () => {
    test('prints original API response for list commands', async () => {
        const client = {
            request: async () => ({
                status: 'success',
                products: [{ id: 1, name: '产品1' }],
                pager: { recTotal: 1, recPerPage: 20, pageID: 1 },
            }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('product')!,
                'list' as ModuleActionName,
                [],
                mockProfile,
                { format: 'raw' },
            );
        });

        const parsed = JSON.parse(output[0]);
        expect(parsed.status).toBe('success');
        expect(parsed.products).toEqual([{ id: 1, name: '产品1' }]);
        expect(parsed.pager).toEqual({ recTotal: 1, recPerPage: 20, pageID: 1 });
    });

    test('prints original API response for get commands', async () => {
        const client = {
            request: async () => ({
                status: 'success',
                user: { id: 1, realname: 'Admin' },
                serverTime: '2026-05-07T10:00:00Z',
            }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('user')!,
                'get' as ModuleActionName,
                ['1'],
                mockProfile,
                { format: 'raw' },
            );
        });

        const parsed = JSON.parse(output[0]);
        expect(parsed.status).toBe('success');
        expect(parsed.user).toEqual({ id: 1, realname: 'Admin' });
        expect(parsed.serverTime).toBe('2026-05-07T10:00:00Z');
    });

    test('prints original API response for write commands', async () => {
        const client = {
            request: async () => ({ status: 'success', id: 7, message: 'created' }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('user')!,
                'create' as ModuleActionName,
                [],
                mockProfile,
                {
                    format: 'raw',
                    account: 'dev1',
                    realname: 'Dev One',
                    password: 'secret',
                } as any,
            );
        });

        const parsed = JSON.parse(output[0]);
        expect(parsed.status).toBe('success');
        expect(parsed.id).toBe(7);
        expect(parsed.message).toBe('created');
    });
});
