import { describe, test, expect } from 'bun:test';
import { z } from 'zod';
import { objectFromShape, normalizeObjectSchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';

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

    test('z.record(z.unknown()) breaks Zod 4 JSON Schema conversion (regression guard)', () => {
        const actionEnum = ['list', 'get'] as [string, ...string[]];
        const shape = {
            action: z.enum(actionEnum),
            params: z.record(z.unknown()).optional(),
        };

        const wrapped = objectFromShape(shape);
        const norm = normalizeObjectSchema(wrapped);
        expect(norm).toBeDefined();

        expect(() =>
            toJsonSchemaCompat(norm!, {
                strictUnions: true,
                pipeStrategy: 'input',
            }),
        ).toThrow();
    });
});
