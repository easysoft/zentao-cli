import { getNestedValue } from './format.js';

export function pickFields(data: Record<string, unknown>[], fields: string[]): Record<string, unknown>[] {
    return data.map((item) => {
        const picked: Record<string, unknown> = {};
        for (const field of fields) {
            picked[field] = getNestedValue(item, field);
        }
        return picked;
    });
}

export function pickFieldsSingle(data: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const picked: Record<string, unknown> = {};
    for (const field of fields) {
        picked[field] = getNestedValue(data, field);
    }
    return picked;
}

type FilterOperator = ':' | '!=' | '>' | '<' | '>=' | '<=' | '~' | '!~';

interface FilterCondition {
    field: string;
    operator: FilterOperator;
    value: string;
}

const OPERATORS: FilterOperator[] = ['!=', '>=', '<=', '!~', '>', '<', '~', ':'];

function parseFilterExpression(expr: string): FilterCondition[] {
    const conditions: FilterCondition[] = [];
    const parts = splitFilterParts(expr);

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        let matched = false;
        for (const op of OPERATORS) {
            const idx = trimmed.indexOf(op);
            if (idx > 0) {
                const field = trimmed.substring(0, idx);
                let value = trimmed.substring(idx + op.length);
                // Strip surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                conditions.push({ field, operator: op, value });
                matched = true;
                break;
            }
        }
        if (!matched) {
            conditions.push({ field: trimmed, operator: '~', value: '' });
        }
    }
    return conditions;
}

function splitFilterParts(expr: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (const ch of expr) {
        if (inQuote) {
            current += ch;
            if (ch === inQuote) inQuote = null;
        } else if (ch === '"' || ch === "'") {
            inQuote = ch;
            current += ch;
        } else if (ch === ',') {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current) parts.push(current);
    return parts;
}

function matchCondition(item: Record<string, unknown>, condition: FilterCondition): boolean {
    const rawValue = getNestedValue(item, condition.field);
    const itemValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    const filterValue = condition.value;

    switch (condition.operator) {
        case ':':
            return itemValue === filterValue;
        case '!=':
            return itemValue !== filterValue;
        case '>':
            return Number(itemValue) > Number(filterValue);
        case '<':
            return Number(itemValue) < Number(filterValue);
        case '>=':
            return Number(itemValue) >= Number(filterValue);
        case '<=':
            return Number(itemValue) <= Number(filterValue);
        case '~':
            return itemValue.includes(filterValue);
        case '!~':
            return !itemValue.includes(filterValue);
        default:
            return true;
    }
}

/**
 * Filter data with AND/OR logic.
 * Each element in filterGroups is a filter expression string.
 * Conditions within a single expression (comma-separated) are ANDed.
 * Multiple expressions (multiple --filter flags) are ORed.
 */
export function filterData(data: Record<string, unknown>[], filterGroups: string[]): Record<string, unknown>[] {
    if (filterGroups.length === 0) return data;

    const parsedGroups = filterGroups.map(parseFilterExpression);

    return data.filter((item) =>
        parsedGroups.some((conditions) =>
            conditions.every((cond) => matchCondition(item, cond)),
        ),
    );
}

export function sortData(data: Record<string, unknown>[], sortExpr: string): Record<string, unknown>[] {
    const parts = sortExpr.split(',').map((s) => s.trim()).filter(Boolean);
    const sortFields = parts.map((part) => {
        const match = part.match(/^(.+?)_(asc|desc)$/i);
        if (!match) return { field: part, order: 'asc' as const };
        return { field: match[1], order: match[2].toLowerCase() as 'asc' | 'desc' };
    });

    return [...data].sort((a, b) => {
        for (const { field, order } of sortFields) {
            const aVal = getNestedValue(a, field);
            const bVal = getNestedValue(b, field);
            let cmp = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                cmp = aVal - bVal;
            } else {
                cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
            }
            if (cmp !== 0) return order === 'desc' ? -cmp : cmp;
        }
        return 0;
    });
}

/**
 * Fuzzy search data.
 * Each element in keywordGroups is a comma-separated keyword string.
 * Keywords within a single string are ANDed.
 * Multiple keyword strings (multiple --search flags) are ORed.
 */
export function searchData(
    data: Record<string, unknown>[],
    keywordGroups: string[],
    searchFields?: string[],
): Record<string, unknown>[] {
    if (keywordGroups.length === 0) return data;

    const parsedGroups = keywordGroups.map((g) =>
        g.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
    );

    return data.filter((item) =>
        parsedGroups.some((keywords) =>
            keywords.every((keyword) => {
                const fields = searchFields ?? Object.keys(item);
                return fields.some((field) => {
                    const value = getNestedValue(item, field);
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(keyword);
                });
            }),
        ),
    );
}
