import { createClient, type ClientOptions } from '../api/index.js';
import { mapSdkError, ZentaoError } from '../errors.js';

/** Obtain a token without loading or persisting a local profile. */
export async function requestToken(server: string, account: string, password: string, options?: ClientOptions & { signal?: AbortSignal }): Promise<string> {
    try {
        const client = createClient(server, undefined, options);
        // SDK login() also loads server configuration and can persist a profile.
        const response = await client.post<{ status?: unknown; token?: unknown } | null>(
            '/users/login', { account, password }, { signal: options?.signal },
        );
        if (response?.status !== 'success' || typeof response.token !== 'string' || !response.token.trim()) {
            throw new ZentaoError('E1003');
        }
        return response.token;
    } catch (error) {
        throw mapSdkError(error);
    }
}
