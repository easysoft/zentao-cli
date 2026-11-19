import { isDeepStrictEqual } from 'node:util';
import type { ModuleAction, ModuleActionOptions, ModuleDefinition } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { resolveData } from '../utils/stdin.js';
import { getMarkdownRenderer } from '../utils/markdown.js';
import { normalizeToolParams } from '../mcp/params.js';
import { actionContract, paginationFields } from './contract.js';
import { batchTargets, targetId } from './targets.js';
import { isFileGid, type ValueSchema } from './validation.js';
import { supportsFileUrl } from './file-url.js';

function invalid(option: string, reason: string): never { throw new ZentaoError('E2009', { option, reason }); }

/** Only schema-declared numbers and booleans are coerced; JSON stays typed. */
export function parseCliValue(value: string | string[] | boolean, schema: ValueSchema): unknown {
    if (schema.type === 'array') {
        if (typeof value === 'string' && value.startsWith('[')) {
            try { return JSON.parse(value); } catch { invalid('data', '数组不是有效 JSON'); }
        }
        return (Array.isArray(value) ? value : [String(value)]).flatMap(item => {
            if (item.startsWith('[')) {
                try { const parsed = JSON.parse(item); if (Array.isArray(parsed)) return parsed; } catch { /* Checked below. */ }
                invalid('data', '数组不是有效 JSON');
            }
            return [parseCliValue(item, schema.items ?? { type: 'string' })];
        });
    }
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) invalid('data', '此字段不能重复');
    if (Array.isArray(schema.type)) return /^\d+$/.test(value) ? Number(value) : value;
    if (schema.type === 'number' || schema.type === 'integer') {
        if (!value.trim() || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) invalid('data', '需要有效数字');
        return Number(value);
    }
    if (schema.type === 'boolean') {
        if (value === 'true') return true;
        if (value === 'false') return false;
        invalid('data', '布尔值只接受 true 或 false');
    }
    if (schema.type === 'object') {
        try { return JSON.parse(value); } catch { invalid('data', '需要 JSON 对象'); }
    }
    return value;
}

/** Only transform user inputs, before the SDK can fill missing fields from the server. */
async function convertMarkdownInput(moduleName: string, candidates: string[], selection: true | string, params: Record<string, unknown>) {
    const body = (params.data ?? {}) as Record<string, unknown>;
    const nativeDoc = moduleName === 'doc' && (body.contentType ?? params.contentType) !== 'html';
    const names = selection === true ? candidates : selection.split(',').map(name => name.trim());
    const inputs = new Map<string, string>();
    for (const name of names) {
        if (!candidates.includes(name)) invalid('markdown', `无效的字段名「${name}」，可选 HTML 字段为 ${candidates.join(', ')}`);
        if (nativeDoc && name === 'content') {
            if (selection === true) continue;
            invalid('markdown', '文档正文可直接传入 Markdown，转换为 HTML 需显式指定 --content-type html');
        }
        const value = body[name] ?? params[name];
        if (typeof value === 'string') inputs.set(name, value);
        else if (selection !== true) invalid('markdown', `本次请求未提供字段 ${name}`);
    }
    if (!inputs.size) return;
    const render = await getMarkdownRenderer();
    for (const [name, value] of inputs) {
        const html = render(value);
        if (Object.hasOwn(params, name)) params[name] = html;
        if (Object.hasOwn(body, name)) body[name] = html;
    }
}

/** Prepare and validate every input before authentication, including all batch targets. */
export async function prepareCliParams(mod: ModuleDefinition, action: ModuleAction, target: string | undefined,
    options: ModuleActionOptions, values: Record<string, unknown>, checkFileUrlSite?: (url: string) => void): Promise<Record<string, unknown>> {
    if (options.format === 'raw' && (options.ids || options.all || options.maxItems || options.pick || options.filter?.length || options.search?.length || options.sort || options.searchFields || options.htmlToMarkdown)) invalid('raw', '原始响应不能与本地处理或自动翻页组合');
    const params: Record<string, unknown> = {};
    const contract = actionContract(mod, action);
    const definitions = contract.parameters;
    const assign = (name: string, value: unknown) => {
        if (value === undefined) return;
        if (Object.hasOwn(params, name) && !isDeepStrictEqual(params[name], value)) invalid(name, '同一字段的输入值冲突');
        params[name] = value;
    };
    for (const [name, value] of Object.entries(values)) {
        if (value === undefined) continue;
        const schema = definitions.find(param => param.name === name);
        assign(name, schema ? parseCliValue(value as string, schema) : Number(value));
    }
    if (mod.name === 'file' && action.name === 'read' && options.output !== undefined) {
        if (!options.output.trim()) invalid('output', '请输入目标文件路径');
        if (options.ids !== undefined || options.batchFailFast || options.format === 'raw' || params.stream === 1) {
            invalid('output', '写入单个附件的原始字节时不能同时指定 --ids、--batch-fail-fast、--format=raw 或 --stream=1');
        }
    }
    const primary = contract.target;
    let url: string | undefined;
    if (target !== undefined) {
        if (!primary) invalid('target', '此操作没有位置参数');
        if (supportsFileUrl(mod.name, action.name) && !Number.isFinite(Number(target))
            && !(action.name === 'get' && isFileGid(target))) {
            if (options.ids !== undefined) invalid('ids', '--ids 与单个附件链接只能指定一个');
            url = target;
        } else {
            assign(primary!, parseCliValue(target, definitions.find(param => param.name === primary)!));
        }
    }
    if (options.data !== undefined) params.data = await resolveData(options.data);
    const pagination = paginationFields(mod, action);
    if (pagination) {
        if (options.page !== undefined) assign(pagination.page.name, parseCliValue(options.page, pagination.page));
        if (options.recPerPage !== undefined) assign(pagination.size.name, parseCliValue(options.recPerPage, pagination.size));
    }
    if (options.all && pagination && (params[pagination.page.name] !== undefined || (params.data as Record<string, unknown> | undefined)?.[pagination.page.name] !== undefined)) invalid('all/page', '--all 与 --page 不能同时使用');
    if (options.maxItems !== undefined && (!/^\d+$/.test(options.maxItems) || !Number.isSafeInteger(Number(options.maxItems)) || Number(options.maxItems) < 1)) invalid('max-items', '必须为正安全整数');
    const ids = batchTargets(action, params, options.ids);
    const aliases: Record<string, number> = {};
    for (const name of ['product', 'project', 'execution']) {
        if (params[name] !== undefined && !definitions.some(param => param.name === name)) {
            aliases[name] = params[name] as number;
            delete params[name];
        }
    }
    const normalized = normalizeToolParams(mod, action, { ...aliases, url, params: ids ? { ...params, [targetId(action)!]: ids[0] } : params }, checkFileUrlSite);
    if (options.markdown !== undefined) await convertMarkdownInput(mod.name, contract.markdownFields, options.markdown, normalized);
    if (ids) delete normalized[targetId(action)!];
    return normalized;
}
