import { request, processData, type RequestOptions, type ResponseData } from 'zentao-api';
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
import { resolveData } from '../utils/stdin.js';
import { buildParams } from './args.js';
import { getAction } from './helper.js';
import { ZentaoError } from '../errors.js';
import { actionContract, paginationFields } from './contract.js';
import { validateValue } from './validation.js';

export interface ModuleExecutionResult {
    /** 解析到的动作定义 */
    action: ModuleAction;
    /** 经提取与本地后处理后的业务数据 */
    data: unknown;
    /** 完整响应；raw 模式为服务端原文，其他模式为 SDK 归一化响应 */
    rawResponse: unknown;
    /** 分页信息（CLI 字段命名） */
    pager?: ListPagerInfo;
    meta?: Record<string, unknown>;
    /** 用户通过 --pick 指定的字段 */
    fields?: string[];
    /** 是否为列表结果 */
    isList: boolean;
}

function parseFields(fields?: string): string[] | undefined {
    const parsed = fields?.split(',').map((field) => field.trim()).filter(Boolean);
    return parsed && parsed.length > 0 ? parsed : undefined;
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
    resolvedParams?: Record<string, unknown>,
): Promise<ModuleExecutionResult> {
    const action = getAction(module, actionName);
    if (!action) {
        throw new ZentaoError('E2005', { module: module.name });
    }

    const params = resolvedParams ? { ...resolvedParams } : buildParams(options, actionName, args);
    if (module.name === 'relation' && action.name === 'unlink') {
        // Old object selectors plus an ID alias could otherwise delete an unrelated relation.
        const legacy = ['objectType', 'objectID', 'relatedObjectType', 'relatedObjectID', 'relationName'].filter(name => Object.hasOwn(params, name));
        if (legacy.length) {
            throw new ZentaoError('E2009', {
                option: legacy.join(', '),
                reason: '解除关联已改用关系记录 relationID，请从 relation list 的返回结果获取，不能用对象 ID 或 relationKey 代替',
            });
        }
    }
    if (module.name === 'bug' && action.name === 'create' && params.product !== undefined) {
        if (params.productID !== undefined && Number(params.product) !== Number(params.productID)) {
            throw new ZentaoError('E2009', {
                option: 'product/productID',
                reason: '--product 与 --productID 必须指定同一个产品',
            });
        }
        // Normalize the flat alias; the SDK still gives --data fields precedence.
        if (params.productID === undefined) params.productID = params.product;
    }
    if (action.requestBody) {
        const data = params.data;
        if (data === undefined || typeof data === 'string') {
            const resolved = await resolveData(data);
            if (resolved !== undefined) params.data = resolved;
        }
    }
    const requestName = `${module.name}/${action.name}`;
    const fields = parseFields(options.pick);
    const outputFormat = options.format ?? config.defaultOutputFormat ?? 'table';
    const rawOutput = outputFormat === 'raw';
    const convertHtml = options.htmlToMarkdown ?? (outputFormat !== 'json' && config.htmlToMarkdown !== false);
    if (rawOutput && (options.all || options.maxItems || options.pick || options.filter?.length || options.search?.length || options.sort || options.searchFields)) {
        throw new ZentaoError('E2009', { option: 'raw', reason: '原始响应不能与本地处理或自动翻页组合' });
    }
    const pagination = paginationFields(module, action);
    if (options.all && !pagination) throw new ZentaoError('E2009', { option: 'all', reason: '此操作不支持分页' });
    const body = (params.data ?? {}) as Record<string, unknown>;
    const getParam = (name: string) => body[name] ?? params[name];
    const setParam = (name: string, value: unknown) => {
        params[name] = value;
        if (Object.hasOwn(body, name)) body[name] = value;
    };
    if (pagination) {
        const page = Number(getParam(pagination.page.name) ?? options.page ?? 1);
        const size = Number(getParam(pagination.size.name) ?? options.recPerPage ?? config.pagers?.[module.name] ?? config.defaultRecPerPage ?? 20);
        validateValue('page', page, { ...pagination.page, type: 'integer', minimum: 1 });
        validateValue('page-size', size, { ...pagination.size, type: 'integer', minimum: 1, maximum: pagination.size.maximum ?? 1000 });
        setParam(pagination.page.name, page); setParam(pagination.size.name, size);
    }
    const shouldProcess = !rawOutput;
    const processList = shouldProcess && action.type === 'list';
    const processSingle = shouldProcess && action.type === 'get';

    const requestOptions: RequestOptions = {
        client,
        autoFill: action.type === 'update',
        throwOnFail: true,
        recPerPage: pagination ? String(getParam(pagination.size.name)) : undefined,
        timeout: options.timeout,
        insecure: options.insecure,
        convert: processList && convertHtml
            ? convertHtmlFieldsInArray
            : undefined,
        convertSingle: processSingle && convertHtml
            ? convertHtmlFields
            : undefined,
        filter: processList ? options.filter : undefined,
        search: processList ? options.search : undefined,
        searchFields: processList ? parseFields(options.searchFields) : undefined,
        sort: processList ? options.sort : undefined,
        limit: processList ? options.maxItems : undefined,
        pick: processList || processSingle ? fields : undefined,
    };

    let response: ResponseData;
    let collected: Record<string, unknown>[] = [];
    let fetched = 0;
    let processedCount = 0;
    try {
        if (rawOutput) {
            const rawResponse = await request(requestName, params, { ...requestOptions, raw: true });
            // The SDK returns raw responses before applying throwOnFail.
            if (rawResponse && typeof rawResponse === 'object' && 'status' in rawResponse && rawResponse.status === 'fail') {
                const message = 'message' in rawResponse ? rawResponse.message : undefined;
                throw new ZentaoError('E2008', {
                    url: '',
                    status: '',
                    serverResponse: typeof message === 'string' ? message : JSON.stringify(message ?? rawResponse),
                }, rawResponse);
            }
            return {
                action,
                data: rawResponse,
                rawResponse,
                fields,
                isList: action.type === 'list',
            };
        }
        let previousPage: string | undefined;
        for (;;) {
            response = await request(requestName, params, { ...requestOptions, raw: false,
                convert: undefined, filter: undefined, search: undefined, sort: undefined, limit: undefined, pick: processList ? undefined : requestOptions.pick });
            if (!processList) break;
            const rows = (Array.isArray(response.data) ? response.data : []) as Record<string, unknown>[];
            fetched += rows.length;
            collected.push(...rows);
            if (!options.all) break;
            const pager = response.pager;
            if (!pager) throw new ZentaoError('E2008', { url: '', status: '', serverResponse: '服务端未返回分页信息，无法保证全量结果' });
            const fingerprint = JSON.stringify(rows);
            if (pager.page !== Number(getParam(pagination!.page.name)) || (previousPage !== undefined && fingerprint === previousPage)) {
                throw new ZentaoError('E2008', { url: '', status: '', serverResponse: '服务端分页未向前推进' });
            }
            if (pager.page * pager.recPerPage >= pager.total) break;
            if (!rows.length) throw new ZentaoError('E2008', { url: '', status: '', serverResponse: '服务端返回空页但报告仍有数据' });
            previousPage = fingerprint;
            setParam(pagination!.page.name, pager.page + 1);
        }
        if (processList) {
            collected = processData(collected, { ...requestOptions, limit: undefined });
            processedCount = collected.length;
            if (options.maxItems) collected = collected.slice(0, Number(options.maxItems));
        }
    } catch (error) {
        throw mapSdkError(error);
    }

    const pager: ListPagerInfo | undefined = response.pager
        ? {
            pageID: response.pager.page,
            recPerPage: response.pager.recPerPage,
            recTotal: response.pager.total,
        }
        : undefined;

    if (action.type === 'list') {
        const data = collected;
        const hasMore = pager ? pager.pageID * pager.recPerPage < pager.recTotal : null;
        const meta = { returned: data.length, fetched, page: pager?.pageID ?? null, pageSize: pager?.recPerPage ?? null,
            total: pager?.recTotal ?? null, hasMore, truncated: processedCount > data.length,
            processingScope: options.all ? 'all' : 'page', totalScope: 'serverBeforeLocalProcessing' };
        const displayFields = outputFormat === 'table' && !fields && data.some(row => row && typeof row === 'object')
            ? actionContract(module, action).defaultFields.filter(key => data.some(row => row && Object.hasOwn(row, key))) : fields;
        return { action, data, rawResponse: response, pager, fields: displayFields?.length ? displayFields : undefined, isList: true, meta };
    }

    if (action.type === 'get') {
        const data = (response.data ?? {}) as Record<string, unknown>;
        return { action, data, rawResponse: response, fields, isList: false };
    }

    return { action, data: response.data, rawResponse: response, fields, isList: false };
}
