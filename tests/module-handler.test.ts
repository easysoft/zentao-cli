import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
});

describe('delete confirmation prompt', () => {
    test('counts comma-separated ids instead of characters', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-test-'));
        const configFile = join(dir, 'zentao.json');

        try {
            writeFileSync(configFile, JSON.stringify({
                currentProfile: `${mockProfile.account}@${mockProfile.server}`,
                profiles: [mockProfile],
                updateCheck: {
                    lastCheck: new Date().toISOString(),
                    latestVersion: '0.1.4',
                },
            }));

            const proc = Bun.spawn({
                cmd: [
                    process.execPath,
                    'src/index.ts',
                    '--config',
                    configFile,
                    'product',
                    'delete',
                    '1,2',
                ],
                cwd: process.cwd(),
                stdin: 'pipe',
                stdout: 'pipe',
                stderr: 'pipe',
                env: process.env,
            });

            proc.stdin.write('n\n');
            proc.stdin.end();

            const [stderr, exitCode] = await Promise.all([
                new Response(proc.stderr).text(),
                proc.exited,
            ]);

            expect(exitCode).toBe(0);
            expect(stderr).toContain('确认删除 2 个对象');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
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
