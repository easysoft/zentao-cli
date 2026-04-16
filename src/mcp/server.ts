import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZentaoClient } from '../api/client.js';
import { ensureAuth } from '../auth/flow.js';
import { registerModuleTools } from './tools.js';
import { getCliVersion } from '../utils/version.js';

export interface AuthProvider {
    getClient(): Promise<ZentaoClient>;
    resetClient(): void;
}

function createAuthProvider(options?: { insecure?: boolean; timeout?: number }): AuthProvider {
    let client: ZentaoClient | null = null;

    return {
        async getClient(): Promise<ZentaoClient> {
            if (client) return client;

            const auth = await ensureAuth(options);
            client = auth.client;
            return client;
        },
        resetClient(): void {
            client = null;
        },
    };
}

export async function startMcpServer(options?: { insecure?: boolean; timeout?: number }): Promise<void> {
    const server = new McpServer(
        { name: 'zentao-cli', version: getCliVersion() },
        { capabilities: { tools: {} } },
    );

    const auth = createAuthProvider(options);
    registerModuleTools(server, auth);

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
