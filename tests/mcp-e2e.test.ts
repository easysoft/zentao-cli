import { describe, test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MODULES } from '../src/modules';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

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
            } finally {
                await client.close();
            }
        },
        { timeout: 20_000 },
    );
});
