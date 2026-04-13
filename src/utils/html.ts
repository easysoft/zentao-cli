import TurndownService from 'turndown';

let turndown: TurndownService | null = null;

/** Turndown 进程级单例，避免重复构造解析器 */
function getTurndown(): TurndownService {
    if (!turndown) {
        turndown = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });
    }
    return turndown;
}

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

/** 启发式判断字符串是否像 HTML 片段（含标签） */
export function isHtml(value: string): boolean {
    return HTML_TAG_RE.test(value);
}

/** 将 HTML 转为 Markdown；非 HTML 输入原样返回 */
export function htmlToMarkdown(html: string): string {
    if (!html || !isHtml(html)) return html;
    return getTurndown().turndown(html).trim();
}

/** 浅层遍历对象自有字符串字段，对疑似 HTML 的值做 Markdown 转换 */
export function convertHtmlFields(obj: Record<string, unknown>): Record<string, unknown> {
    const result = { ...obj };
    for (const key of Object.keys(result)) {
        const value = result[key];
        if (typeof value === 'string' && isHtml(value)) {
            result[key] = htmlToMarkdown(value);
        }
    }
    return result;
}

/** 对数组中每条记录应用 {@link convertHtmlFields} */
export function convertHtmlFieldsInArray(arr: Record<string, unknown>[]): Record<string, unknown>[] {
    return arr.map(convertHtmlFields);
}
