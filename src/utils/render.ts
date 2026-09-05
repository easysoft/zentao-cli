import type { OutputFormat } from '../types/index.js';
import { formatJson, formatList } from './format.js';

/** 渲染字符串 */
export function renderString(content: string, format: OutputFormat = 'markdown'): string {
    if (format === 'markdown') {
        return renderMarkdown(content);
    }
    return content;
}

export function renderMarkdown(markdown: string): string {
    if (
        typeof Bun !== 'undefined'
        && typeof Bun.markdown.ansi === 'function'
        && process.stdout.isTTY
        && !process.argv.includes('--machine-readable')
        && process.env.NO_COLOR === undefined
    ) {
        return Bun.markdown.ansi(markdown);
    }
    return markdown;
}

/** 渲染对象 */
export function renderObject(object: Record<string, unknown>, format: OutputFormat, options?: { fields?: string[] }): string {
    return renderString(format === 'markdown' ? formatList(object, options?.fields) : formatJson(object), format);
}
