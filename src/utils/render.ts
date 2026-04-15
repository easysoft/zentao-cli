import { formatError, ZentaoError } from "../errors";
import { ListPagerInfo, OutputFormat } from "../types";
import { formatJson, formatList, formatTable } from "./format";

/** 是否在 Bun 环境中 */
const isBun = typeof Bun !== 'undefined';

/** Bun 环境是否支持 Markdown ANSI 渲染 */
const bunMarkdownEnable = isBun && typeof Bun.markdown.ansi === 'function';

/** 渲染字符串 */
export function renderString(content: string, format: OutputFormat = 'markdown'): string {
    if (format === 'markdown') {
        return renderMarkdown(content);
    }
    if (format === 'json') {
        if (bunMarkdownEnable) {
            return Bun.markdown.ansi(['```json', content, '```'].join('\n'));
        }
        return content;
    }
    return content;
}

export function renderMarkdown(markdown: string): string {
    if (bunMarkdownEnable) {
        return Bun.markdown.ansi(markdown);
    }
    return markdown;
}

/** 渲染错误 */
export function renderError(error: ZentaoError | Error, format: OutputFormat): string {
    if (error instanceof ZentaoError) {
        return formatError(error, format);
    }
    return error.message;
}

/** 渲染列表 */
export function renderList(list: string[] | Record<string, unknown>[], format: OutputFormat, options?: { fields?: string[], pager?: ListPagerInfo }): string {
    const isObjectList = list.every((item) => typeof item === 'object');

    if (isObjectList) {
        return renderString(format === 'markdown' ? formatTable(list as Record<string, unknown>[], options?.fields) : formatJson(list), format);
    }
    return renderString(format === 'markdown' ? list.map((x) => `* ${x}`).join('\n') : list.join('\n'), format);
}

/** 渲染对象 */
export function renderObject(object: Record<string, unknown>, format: OutputFormat, options?: { fields?: string[] }): string {
    return renderString(format === 'markdown' ? formatList(object, options?.fields) : formatJson(object), format);
}

/** 渲染数据 */
export function render(data: unknown, format: OutputFormat, options?: { fields?: string[], pager?: ListPagerInfo }): string {
    if (format === 'raw') {
        return typeof data === 'string' ? data : formatJson(data);
    }
    if (data instanceof Error) {
        return renderError(data, format);
    }
    if (Array.isArray(data)) {
        return renderList(data, format, options);
    }
    if (typeof data === 'object' && data !== null) {
        return renderObject(data as Record<string, unknown>, format, options);
    }
    if (format === 'markdown' && typeof data === 'string') {
        return renderString(data, format);
    }
    if (typeof data !== 'string') {
        return renderString(formatJson(data), format);
    }
    return data;
}
