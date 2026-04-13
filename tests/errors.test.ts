import { describe, test, expect } from 'bun:test';
import { ZentaoError, ERROR_CODES, formatError } from '../src/errors';

describe('ZentaoError', () => {
    test('creates error with code and default message', () => {
        const error = new ZentaoError('E1001');
        expect(error.code).toBe('1001');
        expect(error.message).toBe(ERROR_CODES.E1001);
        expect(error.name).toBe('ZentaoError');
    });

    test('replaces placeholders in message', () => {
        const error = new ZentaoError('E1002', { url: 'https://example.com' });
        expect(error.message).toBe('所提供的禅道服务地址 https://example.com 无法访问');
    });

    test('stores details', () => {
        const details = { extra: 'info' };
        const error = new ZentaoError('E2008', undefined, details);
        expect(error.details).toEqual(details);
    });

    test('replaces multiple placeholders', () => {
        const error = new ZentaoError('E2003', { fields: 'name,type', module: 'product' });
        expect(error.message).toContain('name,type');
        expect(error.message).toContain('product');
    });
});

describe('formatError', () => {
    test('formats as markdown', () => {
        const error = new ZentaoError('E1001');
        const result = formatError(error, 'markdown');
        expect(result).toBe('Error(E1001): 必须提供有效的禅道服务地址、用户名和密码或 TOKEN');
    });

    test('formats as json', () => {
        const error = new ZentaoError('E1001');
        const result = formatError(error, 'json');
        const parsed = JSON.parse(result);
        expect(parsed.error.code).toBe('1001');
        expect(parsed.error.message).toBe(ERROR_CODES.E1001);
    });

    test('formats as json with details', () => {
        const error = new ZentaoError('E2008', undefined, { status: 500 });
        const result = formatError(error, 'json');
        const parsed = JSON.parse(result);
        expect(parsed.error.details).toEqual({ status: 500 });
    });

    test('formats as raw same as json', () => {
        const error = new ZentaoError('E1001');
        const jsonResult = formatError(error, 'json');
        const rawResult = formatError(error, 'raw');
        expect(rawResult).toBe(jsonResult);
    });
});
