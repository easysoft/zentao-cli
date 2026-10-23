import type { OutputFormat } from '../types/index.js';
import { formatJson, formatList, formatOutput } from './format.js';

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
        && (process.stdout.isTTY || process.argv.includes('--color=always') || process.argv.includes('always'))
        && !process.argv.includes('--color=never') && !process.argv.includes('never')
        && process.env.NO_COLOR === undefined
    ) {
        return Bun.markdown.ansi(markdown);
    }
    return markdown;
}

/** 渲染对象 */
export function renderObject(object: Record<string, unknown>, format: OutputFormat, options?: { fields?: string[] }): string {
    return renderString(formatOutput(object, { format, isList: false, fields: options?.fields }), format);
}
