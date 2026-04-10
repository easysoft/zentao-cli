import TurndownService from 'turndown';

let turndown: TurndownService | null = null;

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

export function isHtml(value: string): boolean {
    return HTML_TAG_RE.test(value);
}

export function htmlToMarkdown(html: string): string {
    if (!html || !isHtml(html)) return html;
    return getTurndown().turndown(html).trim();
}

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

export function convertHtmlFieldsInArray(arr: Record<string, unknown>[]): Record<string, unknown>[] {
    return arr.map(convertHtmlFields);
}
