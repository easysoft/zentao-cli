import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function toolData(result: unknown): any {
    return JSON.parse((result as CallToolResult).content.filter(item => item.type === 'text').map(item => item.text).join('\n'));
}

/** Run the real stdio entrypoint against an isolated local API and config. */
export async function createMcpTestClient(handler: (req: Request) => Response | Promise<Response>, args: string[] = []) {
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler });
    const dir = mkdtempSync(join(tmpdir(), 'zentao-cli-mcp-test-'));
    const configFile = join(dir, 'config.json');
    writeFileSync(configFile, JSON.stringify({ profiles: [] }));
    const client = new Client({ name: 'zentao-cli-test', version: '0.0.0' });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['--no-env-file', join(repoRoot, 'src/index.ts'), '--config', configFile, 'mcp', ...args],
        cwd: dir,
        env: { ...process.env, ZENTAO_URL: server.url.toString(), ZENTAO_ACCOUNT: 'audit', ZENTAO_TOKEN: 'test-token', ZENTAO_PASSWORD: '' },
    });
    const close = async () => {
        await client.close();
        server.stop(true);
        rmSync(dir, { recursive: true, force: true });
    };
    try {
        await client.connect(transport);
        return { client, transport, close };
    } catch (error) {
        await close();
        throw error;
    }
}
