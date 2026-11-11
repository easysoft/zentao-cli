import { brandText } from '../brand.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureAuth, type AuthContext } from '../auth/flow.js';
import { findProfileByKey, getProfile, getProfileConfig } from '../config/store.js';
import { getEnvCredentials } from '../auth/login.js';
import { ZentaoError } from '../errors.js';
import { registerModuleTools, type McpToolOptions } from './tools.js';
import { getCliVersion } from '../utils/version.js';
import type { UserConfig } from '../types/index.js';
import type { ZentaoClient } from '../api/index.js';
import { resolveAssistant } from '../api/assistant.js';

export interface McpAuthContext {
    client: ZentaoClient;
    config: Required<UserConfig>;
    identity: { server: string; account?: string };
}

export interface AuthProvider {
    getContext(signal?: AbortSignal): Promise<McpAuthContext>;
    switchProfile?(key: string): Promise<McpAuthContext>;
}

function toMcpContext({ client, profile }: AuthContext): McpAuthContext {
    return {
        client,
        config: getProfileConfig(profile),
        identity: { server: profile.server, account: profile.account },
    };
}

export function createAuthProvider(options?: { insecure?: boolean; timeout?: number; profile?: string; assistant?: string }): AuthProvider {
    resolveAssistant(options?.assistant, true, 'stdio');
    const authOptions = { ...options, assistantSource: 'stdio' as const };
    let context: Promise<AuthContext> | undefined;
    let flight: { promise: Promise<AuthContext>; controller: AbortController; pending: boolean; waiters: number } | undefined;
    const env = getEnvCredentials();
    let environmentPinned = Boolean(!options?.profile && env.url && env.account && (env.token || env.password));

    return {
        async getContext(signal?: AbortSignal): Promise<McpAuthContext> {
            if (signal?.aborted) throw new ZentaoError('E5003');
            if (!context) {
                const controller = new AbortController();
                const initial = ensureAuth({ ...authOptions, signal: controller.signal });
                const attempt = { promise: initial, controller, pending: true, waiters: 0 };
                flight = attempt;
                context = initial;
                void initial.finally(() => { attempt.pending = false; }).catch(() => {});
                // Share concurrent login attempts, but allow retry after a failed login.
                void initial.catch(() => { if (context === initial) context = undefined; });
            }
            const selected = context;
            const pinned = environmentPinned;
            const attempt = flight?.promise === selected ? flight : undefined;
            if (attempt) attempt.waiters++;
            let cancel: (() => void) | undefined;
            let cached: AuthContext;
            try {
                cached = await (signal ? Promise.race([selected, new Promise<never>((_resolve, reject) => {
                    cancel = () => reject(new ZentaoError('E5003'));
                    signal.addEventListener('abort', cancel, { once: true });
                })]) : selected);
            } finally {
                if (cancel) signal?.removeEventListener('abort', cancel);
                if (attempt && --attempt.waiters === 0 && attempt.pending) {
                    attempt.controller.abort();
                    if (context === selected) context = undefined;
                }
            }
            if (signal?.aborted) throw new ZentaoError('E5003');
            if (pinned) return toMcpContext(cached);

            const current = getProfile(cached.profile.account, cached.profile.server);
            if (!current?.token) throw new ZentaoError('E1006');
            const currentConfig = getProfileConfig(current);
            const cachedConfig = getProfileConfig(cached.profile);
            if (current.token === cached.profile.token
                && (options?.timeout ?? currentConfig.timeout) === (options?.timeout ?? cachedConfig.timeout)
                && (options?.insecure ?? currentConfig.insecure) === (options?.insecure ?? cachedConfig.insecure)
                && resolveAssistant(options?.assistant, currentConfig.autoAssistant, 'stdio') === resolveAssistant(options?.assistant, cachedConfig.autoAssistant, 'stdio')) {
                return toMcpContext({ client: cached.client, profile: current });
            }
            const refreshed = ensureAuth({ ...authOptions, profile: current });
            // A concurrent explicit switch must remain selected for future calls.
            if (context === selected) context = refreshed;
            return toMcpContext(await refreshed);
        },
        async switchProfile(key: string): Promise<McpAuthContext> {
            const profile = findProfileByKey(key);
            if (!profile) throw new ZentaoError('E1007');
            const selected = await ensureAuth({ ...authOptions, profile });
            context = Promise.resolve(selected);
            environmentPinned = false;
            return toMcpContext(selected);
        },
    };
}

export function createMcpServer(auth: AuthProvider, options?: McpToolOptions): McpServer {
    const server = new McpServer(
        { name: brandText('zentao-cli'), version: getCliVersion() },
        { capabilities: { tools: {} } },
    );

    registerModuleTools(server, auth, options);
    return server;
}

export async function startMcpServer(options?: McpToolOptions & { insecure?: boolean; timeout?: number; profile?: string }): Promise<void> {
    const server = createMcpServer(createAuthProvider(options), options);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
