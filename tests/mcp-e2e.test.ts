import { describe, test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getAllModules } from '../src/modules';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = getAllModules();

describe('MCP server (stdio e2e smoke)', () => {
    test(
        'listTools returns module tools plus profile tools',
        async () => {
            const transport = new StdioClientTransport({
                command: 'bun',
                args: ['run', join(repoRoot, 'src/index.ts'), 'mcp'],
                cwd: repoRoot,
            });

            const client = new Client({ name: 'zentao-cli-e2e', version: '0.0.0' });
            try {
                await client.connect(transport);
                const { tools } = await client.listTools();

                expect(tools.length).toBe(MODULES.length + 2);
                const names = new Set(tools.map(t => t.name));
                expect(names.has('zentao_profile')).toBe(true);
                expect(names.has('zentao_switch_profile')).toBe(true);
                for (const mod of MODULES) {
                    expect(names.has(`zentao_${mod.name}`)).toBe(true);
                }
                for (const t of tools) {
                    expect(t.inputSchema).toBeDefined();
                    expect(t.inputSchema?.type).toBe('object');
                }

                const bugTool = tools.find(t => t.name === 'zentao_bug');
                expect(bugTool?.annotations?.readOnlyHint).toBe(false);
                expect(bugTool?.annotations?.destructiveHint).toBe(true);
                expect(bugTool?.description).toContain('批量操作: get, update, delete');
                expect(bugTool?.inputSchema.properties?.ids).toMatchObject({
                    type: 'array',
                    minItems: 1,
                    items: { type: 'integer', exclusiveMinimum: 0 },
                    description: expect.stringContaining('get/update/delete'),
                });
                expect(bugTool?.inputSchema.properties?.batchFailFast).toMatchObject({
                    type: 'boolean',
                });
            } finally {
                await client.close();
            }
        },
        { timeout: 20_000 },
    );

    test(
        'callTool batches get/update/delete and reports aggregate status',
        async () => {
            const requestedIds: number[] = [];
            const requestedMethods: string[] = [];
            const updateBodies: Array<{ id: number; body: unknown }> = [];
            const api = Bun.serve({
                port: 0,
                async fetch(req) {
                    const match = new URL(req.url).pathname.match(/^\/api\.php\/v2\/bugs\/(\d+)$/);
                    if (!match) return new Response('not found', { status: 404 });
                    const id = Number(match[1]);
                    requestedIds.push(id);
                    requestedMethods.push(req.method);
                    if (id === 2 || id === 8) return new Response('forbidden', { status: 403 });
                    if (req.method === 'PUT') {
                        updateBodies.push({ id, body: await req.json() });
                        return Response.json({ status: 'success' });
                    }
                    return Response.json({ status: 'success', bug: { id, title: `Bug ${id}` } });
                },
            });
            const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-mcp-batch-'));
            const configFile = join(dir, 'zentao.json');
            const serverUrl = api.url.toString().replace(/\/$/, '');
            const account = 'test-user';
            writeFileSync(configFile, JSON.stringify({
                currentProfile: `${account}@${serverUrl}`,
                profiles: [{
                    server: serverUrl,
                    account,
                    token: 'test-token',
                    loginTime: '2026-01-01T00:00:00.000Z',
                    lastUsedTime: '2026-01-01T00:00:00.000Z',
                }],
            }));

            const env = Object.fromEntries(
                Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
            );
            delete env.ZENTAO_URL;
            delete env.ZENTAO_ACCOUNT;
            delete env.ZENTAO_PASSWORD;
            delete env.ZENTAO_TOKEN;

            const transport = new StdioClientTransport({
                command: 'bun',
                args: ['run', join(repoRoot, 'src/index.ts'), '--config', configFile, 'mcp'],
                cwd: repoRoot,
                env,
            });
            const client = new Client({ name: 'zentao-cli-batch-e2e', version: '0.0.0' });

            try {
                await client.connect(transport);
                const response = await client.callTool({
                    name: 'zentao_bug',
                    arguments: {
                        action: 'get',
                        ids: [1, 2, 3],
                        batchFailFast: true,
                    },
                });
                expect(response.isError).not.toBe(true);
                const content = response.content as Array<{ type: string; text?: string }>;
                const payload = JSON.parse(content[0]?.text ?? '{}');
                expect(payload.status).toBe('partial');
                expect(payload.results).toEqual([{ id: 1, data: { id: 1, title: 'Bug 1' } }]);
                expect(payload.errors).toEqual([{
                    id: 2,
                    error: { code: 'E2006', message: '当前用户没有权限执行此操作' },
                }]);
                expect(payload.skipped).toEqual([3]);
                expect(requestedIds).toEqual([1, 2]);

                requestedIds.length = 0;
                const continuedResponse = await client.callTool({
                    name: 'zentao_bug',
                    arguments: {
                        action: 'get',
                        ids: [1, 2, 3],
                        batchFailFast: false,
                    },
                });
                const continuedContent = continuedResponse.content as Array<{ type: string; text?: string }>;
                const continued = JSON.parse(continuedContent[0]?.text ?? '{}');
                expect(continued.status).toBe('partial');
                expect(continued.results).toEqual([
                    { id: 1, data: { id: 1, title: 'Bug 1' } },
                    { id: 3, data: { id: 3, title: 'Bug 3' } },
                ]);
                expect(continued.errors).toEqual([{
                    id: 2,
                    error: { code: 'E2006', message: '当前用户没有权限执行此操作' },
                }]);
                expect(continued.skipped).toBeUndefined();
                expect(requestedIds).toEqual([1, 2, 3]);

                requestedIds.length = 0;
                requestedMethods.length = 0;
                const deleteResponse = await client.callTool({
                    name: 'zentao_bug',
                    arguments: { action: 'delete', ids: [4, 5] },
                });
                const deleteContent = deleteResponse.content as Array<{ type: string; text?: string }>;
                const deleted = JSON.parse(deleteContent[0]?.text ?? '{}');
                expect(deleted.status).toBe('success');
                expect(deleted.results.map((result: { id: number }) => result.id)).toEqual([4, 5]);
                expect(deleted.errors).toBeUndefined();
                expect(requestedIds).toEqual([4, 5]);
                expect(requestedMethods).toEqual(['DELETE', 'DELETE']);

                requestedIds.length = 0;
                requestedMethods.length = 0;
                const updateResponse = await client.callTool({
                    name: 'zentao_bug',
                    arguments: {
                        action: 'update',
                        ids: [6, 7],
                        params: { title: 'Batch updated', severity: 2 },
                    },
                });
                const updateContent = updateResponse.content as Array<{ type: string; text?: string }>;
                const updated = JSON.parse(updateContent[0]?.text ?? '{}');
                expect(updated.status).toBe('success');
                expect(updated.results.map((result: { id: number }) => result.id)).toEqual([6, 7]);
                expect(updateBodies).toEqual([
                    { id: 6, body: { title: 'Batch updated', severity: 2 } },
                    { id: 7, body: { title: 'Batch updated', severity: 2 } },
                ]);
                expect(requestedIds).toEqual([6, 6, 7, 7]);
                expect(requestedMethods).toEqual(['GET', 'PUT', 'GET', 'PUT']);

                const failedResponse = await client.callTool({
                    name: 'zentao_bug',
                    arguments: { action: 'get', ids: [2, 8], batchFailFast: false },
                });
                expect(failedResponse.isError).toBe(true);
                const failedContent = failedResponse.content as Array<{ type: string; text?: string }>;
                const failed = JSON.parse(failedContent[0]?.text ?? '{}');
                expect(failed.status).toBe('fail');
                expect(failed.results).toEqual([]);
                expect(failed.errors.map((entry: { id: number }) => entry.id)).toEqual([2, 8]);
            } finally {
                await client.close();
                api.stop();
                rmSync(dir, { recursive: true, force: true });
            }
        },
        { timeout: 20_000 },
    );
});
