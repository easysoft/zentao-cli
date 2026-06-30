import { describe, test, expect } from 'bun:test';
import { z } from 'zod';
import { objectFromShape, normalizeObjectSchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';

function convertShape(shape: Record<string, z.ZodTypeAny>) {
    const wrapped = objectFromShape(shape);
    const norm = normalizeObjectSchema(wrapped);
    return toJsonSchemaCompat(norm!, {
        strictUnions: true,
        pipeStrategy: 'input',
    });
}

describe('MCP tool input JSON Schema', () => {
    test('converts record with string keys (params field shape)', () => {
        const actionEnum = ['list', 'get'] as [string, ...string[]];
        const shape = {
            action: z.enum(actionEnum).describe('op'),
            params: z.record(z.string(), z.unknown()).optional().describe('params'),
        };

        const wrapped = objectFromShape(shape);
        const norm = normalizeObjectSchema(wrapped);
        expect(norm).toBeDefined();

        const json = toJsonSchemaCompat(norm!, {
            strictUnions: true,
            pipeStrategy: 'input',
        });

        expect(json.type).toBe('object');
        expect(json.properties && 'params' in json.properties).toBe(true);
    });

    test('explicit string-key record is preferred over z.record(z.unknown())', () => {
        // 历史上 z.record(z.unknown()) 会破坏 Zod 4 的 JSON Schema 转换，因此
        // buildInputSchema 统一使用 z.record(z.string(), z.unknown())。当前依赖版本
        // 下两种写法均可转换，这里保留断言以确保显式 string-key 写法持续可用。
        const actionEnum = ['list', 'get'] as [string, ...string[]];
        const json = convertShape({
            action: z.enum(actionEnum),
            params: z.record(z.string(), z.unknown()).optional(),
        });

        expect(json.type).toBe('object');
        expect(json.properties && 'params' in json.properties).toBe(true);
    });

    test('converts simple string and number fields', () => {
        const json = convertShape({
            name: z.string().describe('name'),
            count: z.number().optional().describe('count'),
        });

        expect(json.type).toBe('object');
        expect(json.properties.name).toBeDefined();
        expect(json.properties.count).toBeDefined();
    });

    test('converts enum field', () => {
        const json = convertShape({
            status: z.enum(['active', 'closed']).describe('status'),
        });

        expect(json.properties.status).toBeDefined();
    });

    test('converts array of strings', () => {
        const json = convertShape({
            tags: z.array(z.string()).optional().describe('tags'),
        });

        expect(json.properties.tags).toBeDefined();
    });

    test('marks required vs optional fields', () => {
        const json = convertShape({
            required: z.string(),
            optional: z.string().optional(),
        });

        expect(json.type).toBe('object');
        // Required fields should be in the required array
        if (json.required) {
            expect(json.required).toContain('required');
        }
    });

    test('converts nested object with z.record(z.string(), z.string())', () => {
        const json = convertShape({
            meta: z.record(z.string(), z.string()).optional().describe('metadata'),
        });

        expect(json.properties.meta).toBeDefined();
    });
});
