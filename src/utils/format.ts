import type { OutputFormat, Pager } from '../types/index.js';

export function formatTable(data: Record<string, unknown>[], fields?: string[]): string {
    if (data.length === 0) return '';

    const keys = fields ?? Object.keys(data[0]);
    if (keys.length === 0) return '';

    const rows = data.map((row) =>
        keys.map((key) => {
            const value = getNestedValue(row, key);
            return formatCellValue(value);
        }),
    );

    const header = `| ${keys.join(' | ')} |`;
    const separator = `| ${keys.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');

    return `${header}\n${separator}\n${body}`;
}

export function formatList(data: Record<string, unknown>, fields?: string[]): string {
    const keys = fields ?? Object.keys(data);
    return keys
        .map((key) => {
            const value = getNestedValue(data, key);
            return `* ${key}: ${formatCellValue(value)}`;
        })
        .join('\n');
}

export function formatJson(data: unknown, pretty = true): string {
    return JSON.stringify(data, null, pretty ? 4 : 0);
}

export function formatPagerInfo(pager: Pager | undefined, shownCount: number): string {
    if (!pager) return '';
    return `\n已显示 ${shownCount} 项，共 ${pager.recTotal} 项，当前第 ${pager.pageID} 页，每页 ${pager.recPerPage} 条`;
}

export function formatOutput(
    data: unknown,
    options: {
        format: OutputFormat;
        isList: boolean;
        fields?: string[];
        pager?: Pager;
        rawResponse?: unknown;
    },
): string {
    if (options.format === 'raw') {
        return formatJson(options.rawResponse ?? data);
    }

    if (options.format === 'json') {
        const result: Record<string, unknown> = { status: 'success', data };
        if (options.pager) {
            result.pager = normalizePager(options.pager);
        }
        return formatJson(result);
    }

    // Markdown format
    if (options.isList && Array.isArray(data)) {
        const table = formatTable(data as Record<string, unknown>[], options.fields);
        const pagerInfo = formatPagerInfo(options.pager, data.length);
        return table + pagerInfo;
    }

    if (!options.isList && data && typeof data === 'object' && !Array.isArray(data)) {
        return formatList(data as Record<string, unknown>, options.fields);
    }

    return formatJson(data);
}

function normalizePager(pager: Pager): Record<string, number> {
    return {
        total: pager.recTotal,
        page: pager.pageID,
        recPerPage: pager.recPerPage,
        totalPage: pager.pageTotal,
    };
}

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}
