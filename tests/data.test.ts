import { describe, test, expect } from 'bun:test';
import { pickFields, filterData, sortData, searchData } from '../src/utils/data';

const sampleData = [
    { id: 1, name: '产品1', status: 'normal', priority: 3, owner: { name: 'admin' } },
    { id: 2, name: '产品2', status: 'closed', priority: 1, owner: { name: 'dev1' } },
    { id: 3, name: '项目1', status: 'normal', priority: 2, owner: { name: 'admin' } },
    { id: 4, name: '项目2', status: 'closed', priority: 5, owner: { name: 'dev2' } },
];

describe('pickFields', () => {
    test('picks specified fields', () => {
        const result = pickFields(sampleData, ['id', 'name']);
        expect(result).toEqual([
            { id: 1, name: '产品1' },
            { id: 2, name: '产品2' },
            { id: 3, name: '项目1' },
            { id: 4, name: '项目2' },
        ]);
    });

    test('picks nested fields', () => {
        const result = pickFields(sampleData, ['id', 'owner.name']);
        expect(result[0]).toEqual({ id: 1, 'owner.name': 'admin' });
    });

    test('returns undefined for missing fields', () => {
        const result = pickFields(sampleData, ['id', 'nonexistent']);
        expect(result[0]).toEqual({ id: 1, nonexistent: undefined });
    });

    test('picks deeply nested fields', () => {
        const deepData = [{ id: 1, a: { b: { c: { d: 'deep' } } } }];
        const result = pickFields(deepData, ['id', 'a.b.c.d']);
        expect(result[0]).toEqual({ id: 1, 'a.b.c.d': 'deep' });
    });

    test('returns undefined for partially missing nested path', () => {
        const result = pickFields(sampleData, ['id', 'owner.missing']);
        expect(result[0]).toEqual({ id: 1, 'owner.missing': undefined });
    });
});

describe('filterData', () => {
    test('filters with equals operator', () => {
        const result = filterData(sampleData, ['status:normal']);
        expect(result.length).toBe(2);
        expect(result.every((r) => r.status === 'normal')).toBe(true);
    });

    test('filters with not-equals operator', () => {
        const result = filterData(sampleData, ['status!=normal']);
        expect(result.length).toBe(2);
        expect(result.every((r) => r.status !== 'normal')).toBe(true);
    });

    test('filters with contains operator', () => {
        const result = filterData(sampleData, ['name~产品']);
        expect(result.length).toBe(2);
    });

    test('filters with not-contains operator', () => {
        const result = filterData(sampleData, ['name!~产品']);
        expect(result.length).toBe(2);
    });

    test('filters with greater-than operator', () => {
        const result = filterData(sampleData, ['priority>2']);
        expect(result.length).toBe(2);
    });

    test('filters with less-than operator', () => {
        const result = filterData(sampleData, ['priority<3']);
        expect(result.length).toBe(2);
    });

    test('filters with greater-or-equal operator', () => {
        const result = filterData(sampleData, ['priority>=3']);
        expect(result.length).toBe(2);
    });

    test('filters with less-or-equal operator', () => {
        const result = filterData(sampleData, ['priority<=2']);
        expect(result.length).toBe(2);
    });

    test('AND logic within single filter expression', () => {
        const result = filterData(sampleData, ['status:normal,name~产品']);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('产品1');
    });

    test('OR logic across multiple filter expressions', () => {
        const result = filterData(sampleData, ['name~产品', 'name~项目1']);
        expect(result.length).toBe(3);
    });

    test('empty filter returns all data', () => {
        const result = filterData(sampleData, []);
        expect(result.length).toBe(4);
    });

    test('handles quoted values with commas', () => {
        const result = filterData(sampleData, ['name:"产品1,产品2"']);
        expect(result.length).toBe(0); // No item has the literal name "产品1,产品2"
    });

    test('filters with numeric string values', () => {
        const result = filterData(sampleData, ['id:2']);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(2);
    });

    test('filters with empty string value', () => {
        const data = [
            { id: 1, name: 'test' },
            { id: 2, name: '' },
        ];
        const result = filterData(data, ['name:']);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(2);
    });

    test('filters with nested field', () => {
        const result = filterData(sampleData, ['owner.name:admin']);
        expect(result.length).toBe(2);
        expect(result.every((r) => r.owner.name === 'admin')).toBe(true);
    });
});

describe('sortData', () => {
    test('sorts ascending', () => {
        const result = sortData(sampleData, 'priority_asc');
        expect(result[0].priority).toBe(1);
        expect(result[3].priority).toBe(5);
    });

    test('sorts descending', () => {
        const result = sortData(sampleData, 'priority_desc');
        expect(result[0].priority).toBe(5);
        expect(result[3].priority).toBe(1);
    });

    test('sorts by string field', () => {
        const result = sortData(sampleData, 'name_asc');
        expect(result[0].name).toBe('产品1');
    });

    test('sorts by multiple fields', () => {
        const result = sortData(sampleData, 'status_asc,priority_asc');
        expect(result[0].status).toBe('closed');
        expect(result[0].priority).toBe(1);
    });

    test('does not mutate original array', () => {
        const original = [...sampleData];
        sortData(sampleData, 'priority_desc');
        expect(sampleData).toEqual(original);
    });

    test('maintains stable order for equal values', () => {
        const data = [
            { id: 1, name: 'A', status: 'normal' },
            { id: 2, name: 'B', status: 'normal' },
            { id: 3, name: 'C', status: 'normal' },
        ];
        const result = sortData(data, 'status_asc');
        expect(result.map((r) => r.id)).toEqual([1, 2, 3]);
    });

    test('sorts by nested field', () => {
        const data = [
            { id: 1, owner: { name: 'C' } },
            { id: 2, owner: { name: 'A' } },
            { id: 3, owner: { name: 'B' } },
        ];
        const result = sortData(data, 'owner.name_asc');
        expect(result.map((r) => r.owner.name)).toEqual(['A', 'B', 'C']);
    });
});

describe('searchData', () => {
    test('searches across all fields', () => {
        const result = searchData(sampleData, ['产品']);
        expect(result.length).toBe(2);
    });

    test('searches in specific fields', () => {
        const result = searchData(sampleData, ['admin'], ['name']);
        expect(result.length).toBe(0);
    });

    test('searches in nested fields', () => {
        const result = searchData(sampleData, ['admin'], ['owner.name']);
        expect(result.length).toBe(2);
    });

    test('case insensitive search', () => {
        const data = [{ id: 1, name: 'Hello' }, { id: 2, name: 'HELLO' }];
        const result = searchData(data, ['hello']);
        expect(result.length).toBe(2);
    });

    test('AND logic within single search group', () => {
        const result = searchData(sampleData, ['产品,1'], ['name']);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('产品1');
    });

    test('OR logic across multiple search groups', () => {
        const result = searchData(sampleData, ['产品1', '项目2']);
        expect(result.length).toBe(2);
    });

    test('empty search returns all data', () => {
        const result = searchData(sampleData, []);
        expect(result.length).toBe(4);
    });

    test('handles regex special characters in search', () => {
        const data = [
            { id: 1, name: 'test(1)' },
            { id: 2, name: 'test[2]' },
            { id: 3, name: 'test.3' },
            { id: 4, name: 'test*4' },
        ];
        const result = searchData(data, ['test(1)'], ['name']);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(1);
    });

    test('search with no matching fields returns empty', () => {
        const result = searchData(sampleData, ['admin'], ['id']);
        expect(result.length).toBe(0);
    });
});
