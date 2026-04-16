import type { OutputFormat, Pager } from '../types/index.js';

/** 将对象数组渲染为 GitHub 风格 Markdown 表格 */
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

/** 将键值对渲染为 Markdown 无序列表 */
export function formatList(data: Record<string, unknown>, fields?: string[]): string {
    const keys = fields ?? Object.keys(data);
    return keys
        .map((key) => {
            const value = getNestedValue(data, key);
            return `* ${key}: ${formatCellValue(value)}`;
        })
        .join('\n');
}

/** JSON 序列化；`pretty` 为 true 时使用 4 空格缩进 */
export function formatJson(data: unknown, pretty = true): string {
    return JSON.stringify(data, null, pretty ? 4 : 0);
}

/** 在 Markdown 列表末尾追加人类可读的分页摘要 */
export function formatPagerInfo(pager: Pager | undefined, shownCount: number): string {
    if (!pager) return '';
    return `\n\n已显示 ${shownCount} 项，共 ${pager.recTotal} 项，当前第 ${pager.pageID} 页，每页 ${pager.recPerPage} 条`;
}

/**
 * 按用户选择的 {@link OutputFormat} 统一渲染命令输出。
 * - `raw`：输出完整原始响应或调用方提供的 `rawResponse`
 * - `json`：包一层 `{ status, data, pager? }`
 * - 默认 Markdown：列表用表格，单对象用键值列表
 */
export function formatOutput(
    data: unknown,
    options: {
        format: OutputFormat;
        isList: boolean;
        fields?: string[];
        pager?: Pager;
        jsonPretty?: boolean;
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
        return formatJson(result, options.jsonPretty ?? false);
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

/** 将禅道 pager 字段名映射为更直观的 JSON 输出键 */
function normalizePager(pager: Pager): Record<string, number> {
    return {
        total: pager.recTotal,
        page: pager.pageID,
        recPerPage: pager.recPerPage,
    };
}

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/** 以点分路径读取嵌套字段，路径不存在时返回 `undefined` */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}
