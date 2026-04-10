import { describe, test, expect } from 'bun:test';
import { formatTable, formatList, formatJson, formatPagerInfo, formatOutput, getNestedValue } from '../src/utils/format';
import { htmlToMarkdown, isHtml, convertHtmlFields } from '../src/utils/html';

describe('formatTable', () => {
    test('generates markdown table', () => {
        const data = [
            { id: 1, name: '产品1' },
            { id: 2, name: '产品2' },
        ];
        const result = formatTable(data);
        expect(result).toContain('| id | name |');
        expect(result).toContain('| --- | --- |');
        expect(result).toContain('| 1 | 产品1 |');
        expect(result).toContain('| 2 | 产品2 |');
    });

    test('uses specified fields', () => {
        const data = [{ id: 1, name: '产品1', status: 'normal' }];
        const result = formatTable(data, ['id', 'name']);
        expect(result).toContain('| id | name |');
        expect(result).not.toContain('status');
    });

    test('returns empty string for empty data', () => {
        expect(formatTable([])).toBe('');
    });

    test('handles null/undefined values', () => {
        const data = [{ id: 1, name: null }];
        const result = formatTable(data);
        expect(result).toContain('| 1 |  |');
    });

    test('handles object values', () => {
        const data = [{ id: 1, meta: { key: 'val' } }];
        const result = formatTable(data);
        expect(result).toContain('{"key":"val"}');
    });
});

describe('formatList', () => {
    test('generates markdown bullet list', () => {
        const data = { id: 1, name: '产品1' };
        const result = formatList(data);
        expect(result).toContain('* id: 1');
        expect(result).toContain('* name: 产品1');
    });

    test('uses specified fields', () => {
        const data = { id: 1, name: '产品1', status: 'normal' };
        const result = formatList(data, ['id', 'name']);
        expect(result).toContain('* id: 1');
        expect(result).not.toContain('status');
    });
});

describe('formatJson', () => {
    test('formats with indentation by default', () => {
        const result = formatJson({ id: 1 });
        expect(result).toBe('{\n    "id": 1\n}');
    });

    test('formats without indentation when pretty is false', () => {
        const result = formatJson({ id: 1 }, false);
        expect(result).toBe('{"id":1}');
    });
});

describe('formatPagerInfo', () => {
    test('formats pager info', () => {
        const pager = { recTotal: 10, recPerPage: 20, pageTotal: 1, pageID: 1 };
        const result = formatPagerInfo(pager, 10);
        expect(result).toContain('已显示 10 项');
        expect(result).toContain('共 10 项');
        expect(result).toContain('当前第 1 页');
        expect(result).toContain('每页 20 条');
    });

    test('returns empty string for no pager', () => {
        expect(formatPagerInfo(undefined, 0)).toBe('');
    });
});

describe('formatOutput', () => {
    test('formats list as markdown table', () => {
        const data = [{ id: 1, name: '产品1' }];
        const result = formatOutput(data, { format: 'markdown', isList: true });
        expect(result).toContain('| id | name |');
    });

    test('formats single object as markdown list', () => {
        const data = { id: 1, name: '产品1' };
        const result = formatOutput(data, { format: 'markdown', isList: false });
        expect(result).toContain('* id: 1');
    });

    test('formats as json', () => {
        const data = [{ id: 1 }];
        const result = formatOutput(data, { format: 'json', isList: true });
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe('success');
        expect(parsed.data).toEqual([{ id: 1 }]);
    });

    test('formats as raw json', () => {
        const rawResponse = { status: 'success', products: [{ id: 1 }] };
        const result = formatOutput([{ id: 1 }], { format: 'raw', isList: true, rawResponse });
        const parsed = JSON.parse(result);
        expect(parsed.products).toBeDefined();
    });
});

describe('getNestedValue', () => {
    test('gets top-level value', () => {
        expect(getNestedValue({ id: 1 }, 'id')).toBe(1);
    });

    test('gets nested value', () => {
        expect(getNestedValue({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3);
    });

    test('returns undefined for missing path', () => {
        expect(getNestedValue({ id: 1 }, 'missing')).toBeUndefined();
    });

    test('returns undefined for deep missing path', () => {
        expect(getNestedValue({ id: 1 }, 'a.b.c')).toBeUndefined();
    });
});

describe('htmlToMarkdown', () => {
    test('converts HTML to markdown', () => {
        const result = htmlToMarkdown('<p>Hello <strong>world</strong></p>');
        expect(result).toContain('Hello **world**');
    });

    test('returns non-HTML string unchanged', () => {
        expect(htmlToMarkdown('plain text')).toBe('plain text');
    });

    test('returns empty string unchanged', () => {
        expect(htmlToMarkdown('')).toBe('');
    });
});

describe('isHtml', () => {
    test('detects HTML tags', () => {
        expect(isHtml('<p>text</p>')).toBe(true);
        expect(isHtml('<br>')).toBe(true);
        expect(isHtml('<div class="test">content</div>')).toBe(true);
    });

    test('returns false for plain text', () => {
        expect(isHtml('plain text')).toBe(false);
        expect(isHtml('1 < 2')).toBe(false);
    });
});

describe('convertHtmlFields', () => {
    test('converts HTML fields in object', () => {
        const obj = { id: 1, desc: '<p>Hello</p>', name: 'test' };
        const result = convertHtmlFields(obj);
        expect(result.desc).toBe('Hello');
        expect(result.name).toBe('test');
        expect(result.id).toBe(1);
    });

    test('does not modify non-string fields', () => {
        const obj = { id: 1, count: 5, active: true };
        const result = convertHtmlFields(obj);
        expect(result).toEqual(obj);
    });
});
