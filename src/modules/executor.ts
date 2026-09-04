import { processData, request } from 'zentao-api';
import type { ZentaoClient } from '../api/index.js';
import { mapSdkError } from '../errors.js';
import type {
    ListPagerInfo,
    ModuleAction,
    ModuleActionName,
    ModuleActionOptions,
    ModuleDefinition,
    UserConfig,
} from '../types/index.js';
import { convertHtmlFields, convertHtmlFieldsInArray } from '../utils/html.js';
import { buildParams, normalizeActionName } from './args.js';
import { getAction } from './helper.js';
import { ZentaoError } from '../errors.js';

export interface ModuleExecutionResult {
    /** 解析到的动作定义 */
    action: ModuleAction;
    /** 经提取与本地后处理后的业务数据 */
    data: unknown;
    /** 完整响应；raw 模式为服务端原文，其他模式为 SDK 归一化响应 */
    rawResponse: unknown;
    /** 分页信息（CLI 字段命名） */
    pager?: ListPagerInfo;
    /** 用户通过 --pick 指定的字段 */
    fields?: string[];
    /** 是否为列表结果 */
    isList: boolean;
}

function parseFields(fields?: string): string[] | undefined {
    const parsed = fields?.split(',').map((field) => field.trim()).filter(Boolean);
    return parsed && parsed.length > 0 ? parsed : undefined;
}

interface ValidPager {
    total: number;
    page: number;
    recPerPage: number;
}

function isValidPager(value: unknown, expectedPage: number): value is ValidPager {
    if (!value || typeof value !== 'object') return false;
    const pager = value as Partial<ValidPager>;
    return pager.page === expectedPage
        && Number.isInteger(pager.total) && Number(pager.total) >= 0
        && Number.isInteger(pager.recPerPage) && Number(pager.recPerPage) > 0;
}

/**
 * 执行模块级 CRUD 或扩展操作。
 *
 * 路径解析、查询/请求体组装、update 自动补全（autoFill）与响应提取均交由
 * `zentao-api` 的 {@link request} 处理；CLI 仅提供 HTML→Markdown 转换函数
 * 与命令行选项适配。raw 输出不做归一化或本地数据处理，保留服务端响应原文。
 */
export async function executeModuleCommand(
    client: ZentaoClient,
    module: ModuleDefinition,
    actionName: ModuleActionName,
    args: string[],
    options: ModuleActionOptions,
    config: UserConfig,
): Promise<ModuleExecutionResult> {
    const action = getAction(module, actionName);
    if (!action) {
        throw new ZentaoError('E2005', { module: module.name });
    }
    if (options.all && action.type !== 'list') {
        throw new ZentaoError('E2009', {
            option: 'all',
            reason: '仅列表操作支持自动翻页',
        });
    }
    if (options.all && options.page !== undefined) {
        throw new ZentaoError('E2009', {
            option: 'all',
            reason: '不能与 --page 同时使用',
        });
    }

    const params = buildParams(options, actionName, args);
    const requestName = `${module.name}/${normalizeActionName(actionName)}`;
    const fields = parseFields(options.pick);
    const rawOutput = (options.format ?? config.defaultOutputFormat ?? 'markdown') === 'raw';
    if (options.all && rawOutput) {
        throw new ZentaoError('E2009', {
            option: 'all',
            reason: '不能与 --format=raw 同时使用',
        });
    }
    if (options.all) {
        const paramNames = new Set((action.params ?? []).map((param) => param.name));
        if (!paramNames.has('pageID') || !paramNames.has('recPerPage')) {
            throw new ZentaoError('E2009', {
                option: 'all',
                reason: '当前列表操作不支持分页',
            });
        }
        delete params.page;
        params.pageID = 1;
    }
    const shouldProcess = !rawOutput;
    const processList = shouldProcess && action.type === 'list';
    const processSingle = shouldProcess && action.type === 'get';

    const requestOptions = {
        client,
        autoFill: action.type === 'update',
        throwOnFail: true,
        recPerPage: options.recPerPage,
        timeout: options.timeout,
        insecure: options.insecure,
    };

    let response;
    try {
        response = await request(requestName, params, {
            ...requestOptions,
            raw: rawOutput,
            convert: processList && !options.all && config.htmlToMarkdown !== false
                ? convertHtmlFieldsInArray
                : undefined,
            convertSingle: processSingle && config.htmlToMarkdown !== false
                ? convertHtmlFields
                : undefined,
            filter: processList && !options.all ? options.filter : undefined,
            search: processList && !options.all ? options.search : undefined,
            searchFields: processList && !options.all ? parseFields(options.searchFields) : undefined,
            sort: processList && !options.all ? options.sort : undefined,
            limit: processList && !options.all ? options.limit : undefined,
            pick: !options.all && (processList || processSingle) ? fields : undefined,
        });

        if (options.all) {
            if (!isValidPager(response.pager, 1) || !Array.isArray(response.data)) {
                throw new ZentaoError('E2009', {
                    option: 'all',
                    reason: '服务端响应缺少有效的分页信息',
                });
            }

            const records = [...response.data] as Record<string, unknown>[];
            let pager = response.pager;
            const expectedTotal = pager.total;
            const expectedPageSize = pager.recPerPage;
            if (records.length === 0 && pager.total > 0) {
                throw new ZentaoError('E2009', {
                    option: 'all',
                    reason: '第 1 页为空，无法确认已获取全部数据',
                });
            }
            if (records.length > expectedTotal) {
                throw new ZentaoError('E2009', {
                    option: 'all',
                    reason: '服务端返回的记录数超过分页总数',
                });
            }

            while (records.length < expectedTotal) {
                const nextPage = pager.page + 1;
                const pageResponse = await request(requestName, { ...params, pageID: nextPage }, requestOptions);
                if (!isValidPager(pageResponse.pager, nextPage) || !Array.isArray(pageResponse.data)) {
                    throw new ZentaoError('E2009', {
                        option: 'all',
                        reason: `第 ${nextPage} 页响应缺少有效的分页信息`,
                    });
                }
                if (pageResponse.pager.total !== expectedTotal
                    || pageResponse.pager.recPerPage !== expectedPageSize) {
                    throw new ZentaoError('E2009', {
                        option: 'all',
                        reason: `第 ${nextPage} 页的分页总数或页大小发生变化`,
                    });
                }
                if (pageResponse.data.length === 0) {
                    throw new ZentaoError('E2009', {
                        option: 'all',
                        reason: `第 ${nextPage} 页为空，无法确认已获取全部数据`,
                    });
                }
                records.push(...pageResponse.data as Record<string, unknown>[]);
                pager = pageResponse.pager;
            }
            if (records.length !== expectedTotal) {
                throw new ZentaoError('E2009', {
                    option: 'all',
                    reason: '服务端返回的记录数与分页总数不一致',
                });
            }

            const data = processData(records, {
                convert: config.htmlToMarkdown !== false ? convertHtmlFieldsInArray : undefined,
                filter: options.filter,
                search: options.search,
                searchFields: parseFields(options.searchFields),
                sort: options.sort,
                limit: options.limit,
                pick: fields,
            });
            response = {
                ...response,
                data,
                pager: {
                    total: expectedTotal,
                    page: 1,
                    recPerPage: expectedTotal > 0 ? expectedTotal : expectedPageSize,
                },
            };
        }
    } catch (error) {
        throw mapSdkError(error);
    }

    if (rawOutput) {
        return {
            action,
            data: response,
            rawResponse: response,
            fields,
            isList: action.type === 'list',
        };
    }

    const pager: ListPagerInfo | undefined = response.pager
        ? {
            pageID: response.pager.page,
            recPerPage: response.pager.recPerPage,
            recTotal: response.pager.total,
        }
        : undefined;

    if (action.type === 'list') {
        const data = (Array.isArray(response.data) ? response.data : []) as Record<string, unknown>[];
        return { action, data, rawResponse: response, pager, fields, isList: true };
    }

    if (action.type === 'get') {
        const data = (response.data ?? {}) as Record<string, unknown>;
        return { action, data, rawResponse: response, fields, isList: false };
    }

    return { action, data: response.data, rawResponse: response, fields, isList: false };
}
