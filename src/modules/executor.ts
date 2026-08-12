import { request } from 'zentao-api';
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
    if (options.all) {
        throw new ZentaoError('E2009', {
            option: 'all',
            reason: '尚未支持自动翻页，请使用 --page 和 --recPerPage 逐页获取',
        });
    }

    const params = buildParams(options, actionName, args);
    const requestName = `${module.name}/${normalizeActionName(actionName)}`;
    const fields = parseFields(options.pick);
    const rawOutput = (options.format ?? config.defaultOutputFormat ?? 'markdown') === 'raw';
    const shouldProcess = !rawOutput;
    const processList = shouldProcess && action.type === 'list';
    const processSingle = shouldProcess && action.type === 'get';

    let response;
    try {
        response = await request(requestName, params, {
            client,
            autoFill: action.type === 'update',
            throwOnFail: true,
            recPerPage: options.recPerPage,
            timeout: options.timeout,
            insecure: options.insecure,
            raw: rawOutput,
            convert: processList && config.htmlToMarkdown !== false
                ? convertHtmlFieldsInArray
                : undefined,
            convertSingle: processSingle && config.htmlToMarkdown !== false
                ? convertHtmlFields
                : undefined,
            filter: processList ? options.filter : undefined,
            search: processList ? options.search : undefined,
            searchFields: processList ? parseFields(options.searchFields) : undefined,
            sort: processList ? options.sort : undefined,
            limit: processList ? options.limit : undefined,
            pick: processList || processSingle ? fields : undefined,
        });
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
