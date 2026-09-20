import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureAuth, type AuthContext } from '../auth/flow.js';
import { getProfile, getProfileConfig } from '../config/store.js';
import { getEnvCredentials } from '../auth/login.js';
import { ZentaoError } from '../errors.js';
import { registerModuleTools, type McpToolOptions } from './tools.js';
import { getCliVersion } from '../utils/version.js';
import type { Profile } from '../types/index.js';

export interface AuthProvider {
    getContext(profile?: Profile): Promise<AuthContext>;
}

function createAuthProvider(options?: { insecure?: boolean; timeout?: number }): AuthProvider {
    let context: Promise<AuthContext> | undefined;
    const env = getEnvCredentials();
    let environmentPinned = Boolean(env.url && env.account && (env.token || env.password));

    return {
        async getContext(profile?: Profile): Promise<AuthContext> {
            if (profile) {
                const selected = await ensureAuth({ ...options, profile, persist: false });
                context = Promise.resolve(selected);
                environmentPinned = false;
                return selected;
            }

            if (!context) {
                const initial = ensureAuth({ ...options, persist: false });
                context = initial;
                // Share concurrent login attempts, but allow retry after a failed login.
                void initial.catch(() => { if (context === initial) context = undefined; });
            }
            const selected = context;
            const pinned = environmentPinned;
            const cached = await selected;
            if (pinned) return cached;

            const current = getProfile(cached.profile.account, cached.profile.server);
            if (!current?.token) throw new ZentaoError('E1006');
            const currentConfig = getProfileConfig(current);
            const cachedConfig = getProfileConfig(cached.profile);
            if (current.token === cached.profile.token
                && (options?.timeout ?? currentConfig.timeout) === (options?.timeout ?? cachedConfig.timeout)
                && (options?.insecure ?? currentConfig.insecure) === (options?.insecure ?? cachedConfig.insecure)) {
                return { client: cached.client, profile: current };
            }
            const refreshed = ensureAuth({ ...options, profile: current, persist: false });
            // A concurrent explicit switch must remain selected for future calls.
            if (context === selected) context = refreshed;
            return refreshed;
        },
    };
}

export async function startMcpServer(options?: McpToolOptions & { insecure?: boolean; timeout?: number }): Promise<void> {
    const server = new McpServer(
        { name: 'zentao-cli', version: getCliVersion() },
        { capabilities: { tools: {} } },
    );

    const auth = createAuthProvider(options);
    registerModuleTools(server, auth, options);

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
