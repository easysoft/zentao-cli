import { request } from 'zentao-api';
import type { ZentaoClient } from '../api/index.js';
import { ZentaoError } from '../errors.js';

export async function findRemoteUser(client: ZentaoClient, account: string) {
    let user: Record<string, unknown> | undefined;
    let hadUsers = false;
    let previousPage: string | undefined;
    for (let pageID = 1; ; pageID++) {
        const response = await request('user/list', {
            browseType: 'inside', orderBy: 'id_asc', recPerPage: 100, pageID,
            filters: [{ field: 'account', operator: '=', value: account }],
        }, { client: client, throwOnFail: true });
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
