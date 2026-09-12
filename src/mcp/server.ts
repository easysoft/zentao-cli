import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureAuth, type AuthContext } from '../auth/flow.js';
import { getCurrentProfile, getProfileConfig, normalizeServerUrl } from '../config/store.js';
import { ZentaoError } from '../errors.js';
import { registerModuleTools } from './tools.js';
import { getCliVersion } from '../utils/version.js';
import type { Profile } from '../types/index.js';

export interface AuthProvider {
    getContext(profile?: Profile): Promise<AuthContext>;
}

function createAuthProvider(options?: { insecure?: boolean; timeout?: number }): AuthProvider {
    let context: AuthContext | undefined;

    return {
        async getContext(profile?: Profile): Promise<AuthContext> {
            if (context && !profile) {
                const current = getCurrentProfile();
                if (!current?.token) throw new ZentaoError('E1006');

                const currentConfig = getProfileConfig(current);
                const cachedConfig = getProfileConfig(context.profile);
                if (normalizeServerUrl(current.server) === normalizeServerUrl(context.profile.server)
                    && current.account === context.profile.account
                    && current.token === context.profile.token
                    && (options?.timeout ?? currentConfig.timeout) === (options?.timeout ?? cachedConfig.timeout)
                    && (options?.insecure ?? currentConfig.insecure) === (options?.insecure ?? cachedConfig.insecure)) {
                    return { client: context.client, profile: current };
                }
                profile = current;
            }

            // Environment credentials apply initially; later calls follow the selected saved profile.
            context = await ensureAuth({ ...options, profile });
            return context;
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
