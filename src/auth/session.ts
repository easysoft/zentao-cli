import { createClient, withRequestSignal, type ClientOptions, type ZentaoClient } from '../api/index.js';
import { mapSdkError, ZentaoError } from '../errors.js';
import type { Profile } from '../types/index.js';

/** API v1 and v2 share the API session; this reads only the current user. */
async function sessionAccount(client: ZentaoClient, token: string): Promise<string | undefined> {
    const url = new URL('api.php/v1/user', `${client.siteUrl.replace(/\/+$/, '')}/`).href;
    try {
        const result = await client.fetch(url, {}, token) as { profile?: { account?: string } } | undefined;
        return typeof result?.profile?.account === 'string' ? result.profile.account : undefined;
    } catch (error) {
        throw mapSdkError(error);
    }
}

export async function verifySession(client: ZentaoClient, profile: Pick<Profile, 'account' | 'token'>): Promise<void> {
    if (await sessionAccount(client, profile.token) !== profile.account) throw new ZentaoError('E1004');
}

/** Revoke only this API session, and confirm that its token is no longer usable. */
export async function revokeSession(profile: Profile, options: ClientOptions & { signal?: AbortSignal }): Promise<void> {
    const client = withRequestSignal(createClient(profile.server, profile.token, options), options.signal);
    let failure: unknown;
    try {
        const result = await client.post<{ status?: string }>('/users/logout', {});
        if (result?.status !== 'success') throw new ZentaoError('E1012');
    } catch (error) {
        failure = mapSdkError(error);
    }
    try {
        await sessionAccount(client, profile.token);
    } catch (error) {
        // API v2 may reject an already-expired session with 403. Confirm via API v1;
        // the logout response alone cannot distinguish expiration from permission denial.
        if (error instanceof ZentaoError && error.code === '1004') return;
        throw failure ?? error;
    }
    throw failure ?? new ZentaoError('E1012');
}
