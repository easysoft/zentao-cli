import { describe, expect, test } from 'bun:test';
import { applyOptionsJson } from '../src/utils/cli-options.js';
import { runCliWithoutAuth } from './helpers.js';

describe('applyOptionsJson', () => {
    test('uses options JSON as the base and lets explicit CLI values win', () => {
        const result = applyOptionsJson({
            options: JSON.stringify({ format: 'json', limit: '50', page: '2' }),
            format: 'raw',
            limit: '10',
        });

        expect(result).toEqual({ format: 'raw', limit: '10', page: '2' });
    });

    test('does not let Commander empty array defaults replace JSON values', () => {
        const result = applyOptionsJson({
            options: JSON.stringify({ filter: ['status=active'], search: ['keyword'] }),
            filter: [],
            search: [],
        });

        expect(result.filter).toEqual(['status=active']);
        expect(result.search).toEqual(['keyword']);
    });

    test('lets non-empty repeated CLI options replace JSON values', () => {
        const result = applyOptionsJson({
            options: JSON.stringify({ filter: ['status=active'], search: ['old'] }),
            filter: ['status=closed'],
            search: ['new'],
        });

        expect(result.filter).toEqual(['status=closed']);
        expect(result.search).toEqual(['new']);
    });

    test('preserves boolean flags supplied only through options JSON', () => {
        const result = applyOptionsJson({
            options: JSON.stringify({ insecure: true, silent: true, yes: true, all: true }),
            filter: [],
            search: [],
        });

        expect(result).toMatchObject({ insecure: true, silent: true, yes: true, all: true });
    });

    test('does not pass a nested options key to command execution', () => {
        const result = applyOptionsJson({
            options: JSON.stringify({ options: 'nested', format: 'json' }),
        });

        expect(result).toEqual({ format: 'json' });
    });

    test.each([
        ['invalid JSON', '{'],
        ['an array', '[]'],
        ['null', 'null'],
        ['a scalar', 'true'],
    ])('rejects %s', (_label, value) => {
        expect(() => applyOptionsJson({ options: value })).toThrow('选项 --options 的值无效');
    });
});

describe('--options command wiring', () => {
    test('applies options JSON to a module command', async () => {
        const result = await runCliWithoutAuth(['bug', '--options', '{"format":"json"}']);

        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: { code: '1006' } });
    });

    test('applies options JSON to a generic CRUD command', async () => {
        const result = await runCliWithoutAuth(['get', 'bug', '1', '--options', '{"format":"json"}']);

        expect(result.exitCode).toBe(1);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: { code: '1006' } });
    });

    test('validates module command input before authentication', async () => {
        const result = await runCliWithoutAuth(['bug', '--options', '[]']);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('Error(E2009)');
        expect(result.stdout).toContain('--options');
        expect(result.stdout).not.toContain('E1006');
    });

    test('validates generic CRUD input before authentication', async () => {
        const result = await runCliWithoutAuth(['get', 'bug', '1', '--options', '{']);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('Error(E2009)');
        expect(result.stdout).toContain('--options');
        expect(result.stdout).not.toContain('E1006');
    });
});
