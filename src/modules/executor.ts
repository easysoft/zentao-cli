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
import { filterData, pickFields, pickFieldsSingle, searchData, sortData } from '../utils/data.js';
import { convertHtmlFields, convertHtmlFieldsInArray } from '../utils/html.js';
import { buildParams, normalizeActionName } from './args.js';
import { getAction } from './helper.js';
import { ZentaoError } from '../errors.js';
import { processImagesInContent, hasImageMarkers } from '../utils/images.js';

/** 支持图片标记的内容字段。 */
const IMAGE_CONTENT_FIELDS: Record<string, string[]> = {
    story: ['spec', 'verify'],
    bug: ['steps'],
};

/**
 * 在创建 story/bug 时，处理内容字段中的图片标记。
 *
 * 解析 `![alt](path)` 标记，上传本地图片到禅道，并将标记替换为禅道图片引用格式。
 */
async function processImagesForCreate(
    client: ZentaoClient,
    moduleName: string,
    params: Record<string, unknown>,
    options: ModuleActionOptions,
): Promise<Record<string, unknown>> {
    const fields = IMAGE_CONTENT_FIELDS[moduleName];
    if (!fields) return params;

    const dataObject = typeof params.data === 'string'
        ? JSON.parse(params.data) as Record<string, unknown>
        : (params.data as Record<string, unknown> | undefined);

    const hasImages = fields.some((field) => {
        const direct = params[field];
        if (typeof direct === 'string' && hasImageMarkers(direct)) return true;
        if (dataObject) {
            const nested = dataObject[field];
            return typeof nested === 'string' && hasImageMarkers(nested);
        }
        return false;
    });
    if (!hasImages) return params;

    const result = { ...params };
    let resultData = dataObject ? { ...dataObject } : undefined;
    let dataChanged = false;

    for (const field of fields) {
        const direct = result[field];
        if (typeof direct === 'string' && hasImageMarkers(direct)) {
            result[field] = await processImagesInContent(client, direct, {
                verbose: options.format !== 'json' && options.format !== 'raw',
                objectType: moduleName,
            });
            continue;
        }
        if (resultData) {
            const nested = resultData[field];
            if (typeof nested === 'string' && hasImageMarkers(nested)) {
                resultData[field] = await processImagesInContent(client, nested, {
                    verbose: options.format !== 'json' && options.format !== 'raw',
                    objectType: moduleName,
                });
                dataChanged = true;
            }
        }
    }

    if (dataChanged && resultData) {
        result.data = JSON.stringify(resultData);
    }
    return result;
}

export interface ModuleExecutionResult {
    /** 解析到的动作定义 */
    action: ModuleAction;
    /** 经提取与本地后处理后的业务数据 */
    data: unknown;
    /** SDK 归一化后的完整响应（供 `--format raw` 使用） */
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
 * `zentao-api` 的 {@link request} 处理；CLI 侧仅保留 HTML→Markdown 转换与
 * 客户端过滤/搜索/排序/限制/摘取（语义与既有用法保持一致）。
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

    const params = buildParams(options, actionName, args);
    const normalizedActionName = normalizeActionName(actionName);
    const requestName = `${module.name}/${normalizedActionName}`;

    // 创建 story/bug 时，处理内容字段中的图片标记
    const processedParams = normalizedActionName === 'create'
        ? await processImagesForCreate(client, module.name, params, options)
        : params;

    let response;
    try {
        // 注意：不向 request() 传递 filter/search/sort/limit/pick，
        // 以保留 CLI 自身的数据处理语义（在下方本地后处理）。
        response = await request(requestName, processedParams, {
            client,
            autoFill: action.type === 'update',
            throwOnFail: true,
            recPerPage: options.recPerPage,
            timeout: options.timeout,
            insecure: options.insecure,
        });
    } catch (error) {
        throw mapSdkError(error);
    }

    const fields = parseFields(options.pick);
    const pager: ListPagerInfo | undefined = response.pager
        ? {
            pageID: response.pager.page,
            recPerPage: response.pager.recPerPage,
            recTotal: response.pager.total,
        }
        : undefined;

    if (action.type === 'list') {
        let data = (Array.isArray(response.data) ? response.data : []) as Record<string, unknown>[];

        if (config.htmlToMarkdown !== false) {
            data = convertHtmlFieldsInArray(data);
        }
        if (options.filter?.length) {
            data = filterData(data, options.filter);
        }
        if (options.search?.length) {
            data = searchData(data, options.search, options.searchFields?.split(','));
        }
        if (options.sort) {
            data = sortData(data, options.sort);
        }
        if (options.limit && Number(options.limit) < data.length) {
            data = data.slice(0, Number(options.limit));
        }
        if (fields) {
            data = pickFields(data, fields);
        }

        return { action, data, rawResponse: response, pager, fields, isList: true };
    }

    if (action.type === 'get') {
        let data = (response.data ?? {}) as Record<string, unknown>;
        if (config.htmlToMarkdown !== false) {
            data = convertHtmlFields(data);
        }
        if (fields) {
            data = pickFieldsSingle(data, fields);
        }

        return { action, data, rawResponse: response, fields, isList: false };
    }

    return { action, data: response.data, rawResponse: response, fields, isList: false };
}
