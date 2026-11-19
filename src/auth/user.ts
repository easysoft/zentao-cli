import { getModuleAction, request } from 'zentao-api';
import { getServerConfig, type ZentaoClient } from '../api/index.js';
import { ZentaoError } from '../errors.js';

export function supportsCurrentUserProfile(version: string): boolean {
    return Boolean(getModuleAction('my', 'profile', { version }));
}

export async function findCurrentUser(client: ZentaoClient, account?: string, assistant?: string): Promise<{ user?: Record<string, unknown>; hadUsers: boolean }> {
    const { version } = await getServerConfig(client);
    if (supportsCurrentUserProfile(version)) {
        const { data: user } = await request('my/profile', {}, { client, throwOnFail: true, actionAssistant: assistant });
        if (typeof user?.account !== 'string' || !user.account.trim()) {
            throw new ZentaoError('E2008', { url: client.siteUrl, status: '', serverResponse: 'my/profile 未返回当前用户的有效账号' });
        }
        if (account !== undefined && account !== user.account) {
            throw new ZentaoError('E1013', { account, actual: user.account });
        }
        return { user, hadUsers: true };
    }
    if (account === undefined) return { hadUsers: false };

    let user: Record<string, unknown> | undefined;
    let hadUsers = false;
    let previousPage: string | undefined;
    for (let pageID = 1; ; pageID++) {
        const response = await request('user/list', {
            browseType: 'inside', orderBy: 'id_asc', recPerPage: 100, pageID,
            filters: [{ field: 'account', operator: '=', value: account }],
        }, { client, throwOnFail: true, actionAssistant: assistant });
        const users = Array.isArray(response.data) ? response.data as Record<string, unknown>[] : [];
        hadUsers ||= users.length > 0;
        user = users.find(item => item.account === account);
        if (user || !users.length) break;
        // Older servers may ignore filters; continue paging without silently truncating.
        const page = JSON.stringify(users.map(item => [item.id, item.account]));
        if (page === previousPage || (response.pager && response.pager.page !== pageID)) {
            throw new ZentaoError('E2008', { url: client.siteUrl, status: '', serverResponse: '用户列表分页未向前推进，无法确认当前用户详情' });
        }
        previousPage = page;
        if (response.pager
            ? pageID * response.pager.recPerPage >= response.pager.total
            : users.length < 100) break;
    }
    return { user, hadUsers };
}
