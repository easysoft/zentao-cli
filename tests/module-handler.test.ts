import { createProgram } from '../src/cli.js';
import { kebabCase } from '../src/modules/contract.js';
import { describe, expect, test } from 'bun:test';
import type { ZentaoClient } from '../src/api/index';
import { handleModuleCommand } from '../src/commands/module-handler';
import { getAllModules, getAvailableActions, getModule } from '../src/modules';
import type { ModuleActionName, ModuleActionOptions } from '../src/types';
import { mockProfile, runCliWithoutAuth } from './helpers';

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

function stubIsTTY(stream: { isTTY?: boolean }, value: boolean): () => void {
    const original = Object.getOwnPropertyDescriptor(stream, 'isTTY');
    Object.defineProperty(stream, 'isTTY', { configurable: true, enumerable: true, writable: true, value });
    return () => {
        if (original) Object.defineProperty(stream, 'isTTY', original);
        else delete (stream as { isTTY?: boolean }).isTTY;
    };
}

describe('expanded SDK actions', () => {
    test('shows every registered action and its version requirement exactly once in detailed help', async () => {
        const program = createProgram();
        for (const mod of getAllModules()) {
            const command = program.commands.find(command => command.name() === mod.name)!;
            expect(command.commands.filter(child => child.name() !== 'props')).toHaveLength(mod.actions.length);
            for (const action of mod.actions) {
                const child = command.commands.find(child => child.name() === kebabCase(action.name))!;
                expect(child.helpInformation()).toContain(action.minVersion.join(' / '));
            }
        }
    });

    test('shows named list operations without advertising a nonexistent default list', async () => {
        const result = await runCliWithoutAuth(['my']);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('tasks [options]');
        expect(result.stdout).not.toContain('zentao my [选项]');
        expect(result.stderr).toBe('');
    });

    test('preserves distinct document path parameters in help and requests', async () => {
        const mod = getModule('doc')!;
        const action = mod.actions.find((action) => action.name === 'createMyDoc')!;
        const help = createProgram().commands.find(cmd => cmd.name() === 'doc')!.commands.find(cmd => cmd.name() === 'create-my-doc')!.helpInformation();
        expect(help).toContain('--space-id <value>');
        expect(help).toContain('--lib-id <value>');
        expect(help).toContain('22.5 / biz13.5 / max8.5 / ipd5.5');

        const requests: Array<{ path: string; options: { method?: string; body?: unknown } }> = [];
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async (path: string, options: { method?: string; body?: unknown }) => {
                requests.push({ path, options });
                return { status: 'success', id: 3 };
            },
        } as unknown as ZentaoClient;
        await handleModuleCommand(client, mod, 'createMyDoc', ['--spaceID=1', '--libID=2'], mockProfile, {
            quiet: true, data: '{"title":"新文档","content":"# 正文","contentType":"doc"}',
        });
        expect(requests).toEqual([{
            path: '/doc/my/spaces/1/libs/2/docs',
            options: expect.objectContaining({ method: 'POST', body: { title: '新文档', content: '# 正文', contentType: 'doc' } }),
        }]);
    });

    test('accepts a named path ID and auto-fills from the matching document resource', async () => {
        const requests: Array<{ path: string; method?: string; body?: unknown }> = [];
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async (path: string, options: { method?: string; body?: unknown }) => {
                requests.push({ path, method: options.method, body: options.body });
                return options.method === 'GET'
                    ? { lib: { id: 2, name: '原文档库', acl: 'private', users: ['admin'] } }
                    : { status: 'success', id: 2 };
            },
        } as unknown as ZentaoClient;
        await handleModuleCommand(client, getModule('doc')!, 'updateLib', ['--libID=2', '--name=新文档库'], mockProfile, { quiet: true });
        expect(requests.map(({ path, method }) => ({ path, method }))).toEqual([
            { path: '/doc/libs/2', method: 'GET' },
            { path: '/doc/libs/2', method: 'PUT' },
        ]);
        expect(requests[1].body).toMatchObject({ name: '新文档库', acl: 'private', users: ['admin'] });
        requests.length = 0;
        await expect(handleModuleCommand(client, getModule('doc')!, 'updateLib', [], mockProfile, { quiet: true })).rejects.toMatchObject({ code: '2003' });
        expect(requests).toHaveLength(0);
    });
});

describe('handleModuleCommand batch ids', () => {
    async function runDelete(args: string[], options: ModuleActionOptions = {}) {
        const requests: Array<{ method: string; path: string }> = [];
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
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
            { yes: true, quiet: true, ...options },
        );

        return requests;
    }

    test('deduplicates explicit batch ids', async () => {
        const requests = await runDelete([], { ids: '1,2,1' });

        expect(requests).toEqual([
            { method: 'delete', path: '/products/1' },
            { method: 'delete', path: '/products/2' },
        ]);
    });

    test('executes explicit --ids as batch delete', async () => {
        const requests = await runDelete([], { ids: '1,2' });

        expect(requests).toEqual([
            { method: 'delete', path: '/products/1' },
            { method: 'delete', path: '/products/2' },
        ]);
    });

    test('prints one JSON summary for a batch', async () => {
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async () => ({ status: 'success' }),
        } as unknown as ZentaoClient;

        const output = await captureConsoleLog(async () => {
            await handleModuleCommand(
                client,
                getModule('product')!,
                'delete' as ModuleActionName,
                [],
                mockProfile,
                { ids: '1,2', yes: true, format: 'json' },
            );
        });

        expect(output).toHaveLength(1);
        expect(JSON.parse(output[0])).toEqual({
            ok: true, data: [{ objectID: 1, ok: true, data: null }, { objectID: 2, ok: true, data: null }],
            meta: { success: 2, failed: 0, skipped: 0 },
        });
    });

    test('keeps successful data when batching get operations', async () => {
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
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
                [],
                mockProfile,
                { ids: '1,2', format: 'json' },
            );
        });

        expect(output).toHaveLength(1);
        expect(JSON.parse(output[0])).toEqual({ ok: true,
            data: [1, 2].map(id => ({ objectID: id, ok: true, data: { id, name: `产品${id}` } })),
            meta: { success: 2, failed: 0, skipped: 0 } });
    });

    test('quiet batch failures retain per-target results and errors', async () => {
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async (path: string) => {
                if (path.endsWith('/2')) throw new Error('request failed');
                return { status: 'success', product: { id: 1, secret: 'private value' } };
            },
        } as unknown as ZentaoClient;
        const previousExitCode = process.exitCode;
        process.exitCode = undefined;

        try {
            const output = await captureConsoleLog(async () => {
                await handleModuleCommand(
                    client,
                    getModule('product')!,
                    'get' as ModuleActionName,
                    [],
                    mockProfile,
                    { ids: '1,2', format: 'json', quiet: true },
                );
            });

            expect(output).toHaveLength(1);
            expect(output[0]).toContain('private value');
            expect(JSON.parse(output[0])).toMatchObject({ ok: false, data: [{ objectID: 1, ok: true }, { objectID: 2, ok: false, error: { message: 'request failed' } }], meta: { failed: 1, skipped: 0 } });
        } finally {
            process.exitCode = previousExitCode ?? 0;
        }
    });

    test('continues after failures and sets a non-zero exit code', async () => {
        const requests: string[] = [];
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
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
                    [],
                    mockProfile,
                    { ids: '1,2,3', yes: true, format: 'json' },
                );
            });

            expect(requests).toEqual(['/products/1', '/products/2', '/products/3']);
            expect(output).toHaveLength(1);
            expect(JSON.parse(output[0])).toMatchObject({ ok: false, meta: { success: 2, failed: 1, skipped: 0 } });
            expect(JSON.parse(output[0]).data.find((item: { objectID: number }) => item.objectID === 2)).toMatchObject({ ok: false, error: { message: 'request failed' } });
            expect(Number(process.exitCode)).toBe(1);
        } finally {
            process.exitCode = previousExitCode ?? 0;
        }
    });

    test.each([false, true])('records API failures with batchFailFast=%p', async (batchFailFast) => {
        const requests: string[] = [];
        const failure = { status: 'fail', message: { name: ['Cannot delete this product'] } };
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async (path: string) => {
                requests.push(path);
                return path === '/products/2' ? failure : { status: 'success' };
            },
        } as unknown as ZentaoClient;
        const previousExitCode = process.exitCode;

        try {
            process.exitCode = 0;
            const output = await captureConsoleLog(() => handleModuleCommand(
                client,
                getModule('product')!,
                'delete',
                [],
                mockProfile,
                { ids: '1,2,3', yes: true, format: 'json', batchFailFast },
            ));

            expect(requests).toEqual(batchFailFast
                ? ['/products/1', '/products/2']
                : ['/products/1', '/products/2', '/products/3']);
            expect(output).toHaveLength(1);
            expect(JSON.parse(output[0])).toMatchObject({ ok: false, meta: { success: batchFailFast ? 1 : 2, failed: 1, skipped: batchFailFast ? 1 : 0 } });
            expect(output[0]).toContain('Cannot delete this product');
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
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async () => {
                requestCount++;
                return { status: 'success' };
            },
        } as unknown as ZentaoClient;
        const restoreStdin = stubIsTTY(process.stdin, false);

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
            restoreStdin();
        }
    });

    test('machine output does not bypass deletion confirmation', async () => {
        let requestCount = 0;
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
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
            getZentaoConfig: async () => ({ version: '22.5' }),
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
        expect(JSON.parse(output[0])).toMatchObject({ ok: true, data: { id: 1, name: '产品1' }, meta: {} });
    });

    test('does not render Markdown ANSI when stdout is not a TTY', async () => {
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async () => ({ status: 'success', product: { id: 1, name: '产品1' } }),
        } as unknown as ZentaoClient;
        const restoreStdout = stubIsTTY(process.stdout, false);

        try {
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
        } finally {
            restoreStdout();
        }
    });
});

describe('handleModuleCommand raw output', () => {
    test('prints original API response for list commands', async () => {
        const client = {
            getZentaoConfig: async () => ({ version: '22.5' }),
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
            getZentaoConfig: async () => ({ version: '22.5' }),
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
            getZentaoConfig: async () => ({ version: '22.5' }),
            request: async () => ({ status: 'success', id: 7, message: 'created' }),
        } as unknown as ZentaoClient;
        const restoreStdin = stubIsTTY(process.stdin, true);

        try {
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
        } finally {
            restoreStdin();
        }
    });
});
