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
    const args = process.argv.slice(2);
    let color = 'auto';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--color') color = args[++i];
        else if (args[i].startsWith('--color=')) color = args[i].slice(8);
    }
    const enabled = color === 'always' || (color === 'auto' && process.stdout.isTTY && process.env.NO_COLOR === undefined);
    return enabled && typeof Bun !== 'undefined' && typeof Bun.markdown.ansi === 'function'
        ? Bun.markdown.ansi(markdown) : markdown;
}

/** 渲染对象 */
export function renderObject(object: Record<string, unknown>, format: OutputFormat, options?: { fields?: string[] }): string {
    return renderString(formatOutput(object, { format, isList: false, fields: options?.fields }), format);
}
