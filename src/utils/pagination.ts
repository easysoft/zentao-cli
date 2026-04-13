import type { ZentaoClient } from '../api/client.js';
import type { ApiListResponse, Pager } from '../types/index.js';

/** 控制分页拉取行为的选项，与禅道 `pageID` / `recPerPage` 对应 */
export interface PaginationOptions {
    /** 起始页码（1-based） */
    page?: number;
    recPerPage?: number;
    /** 为 true 时顺序请求直至最后一页（或与 `limit` 组合提前结束） */
    all?: boolean;
    /** 最多保留的记录条数（在 `all` 为 true 时用于截断） */
    limit?: number;
}

/**
 * 获取列表数据：默认只取一页；`all` 或 `limit` 为真时按 `pageTotal` 循环请求。
 * `dataKey` 为响应 JSON 中数组字段名（如 `bugs`、`tasks`）。
 */
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
        // 无数据或已超过服务端声明的总页数时结束；后者依赖首次响应中的 pager.pageTotal
        if (currentPage > totalPages || pageData.length === 0) break;
    }

    return { data: collected, pager: lastPager };
}
