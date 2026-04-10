import type { ZentaoClient } from '../api/client.js';
import type { ApiListResponse, Pager } from '../types/index.js';

export interface PaginationOptions {
    page?: number;
    recPerPage?: number;
    all?: boolean;
    limit?: number;
}

export async function fetchAllPages<T extends Record<string, unknown>>(
    client: ZentaoClient,
    path: string,
    dataKey: string,
    options: PaginationOptions & { queryParams?: Record<string, string | number> } = {},
): Promise<{ data: T[]; pager?: Pager }> {
    const { page = 1, recPerPage = 20, all = false, limit, queryParams = {} } = options;

    if (!all && !limit) {
        const params = { ...queryParams, recPerPage, pageID: page };
        const response = await client.get<ApiListResponse>(path, params);
        const data = (response[dataKey] as T[] | undefined) ?? [];
        return { data, pager: response.pager };
    }

    const collected: T[] = [];
    let currentPage = page;
    const perPage = recPerPage;
    let totalPages = 1;
    let lastPager: Pager | undefined;

    while (true) {
        const params = { ...queryParams, recPerPage: perPage, pageID: currentPage };
        const response = await client.get<ApiListResponse>(path, params);
        const pageData = (response[dataKey] as T[] | undefined) ?? [];
        lastPager = response.pager;

        collected.push(...pageData);

        if (lastPager) {
            totalPages = lastPager.pageTotal;
        }

        if (limit && collected.length >= limit) {
            return { data: collected.slice(0, limit), pager: lastPager };
        }

        currentPage++;
        if (currentPage > totalPages || pageData.length === 0) break;
    }

    return { data: collected, pager: lastPager };
}
