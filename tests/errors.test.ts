import { describe, test, expect } from 'bun:test';
import { ZentaoError as SdkZentaoError } from 'zentao-api';
import { ZentaoError, ERROR_CODES, formatError, mapSdkError } from '../src/errors';

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

describe('mapSdkError', () => {
    test('maps HTTP 401 to E1004', () => {
        const sdk = new SdkZentaoError('E_HTTP_ERROR', { status: 401, statusText: 'Unauthorized' }, { status: 401, url: 'x' });
        const mapped = mapSdkError(sdk);
        expect(mapped).toBeInstanceOf(ZentaoError);
        expect((mapped as ZentaoError).code).toBe('1004');
    });

    test('maps HTTP 404 to E2002', () => {
        const sdk = new SdkZentaoError('E_HTTP_ERROR', { status: 404, statusText: 'Not Found' }, { status: 404, url: '/x' });
        expect((mapSdkError(sdk) as ZentaoError).code).toBe('2002');
    });

    test('maps HTTP 403 to E2006', () => {
        const sdk = new SdkZentaoError('E_HTTP_ERROR', { status: 403, statusText: 'Forbidden' }, { status: 403 });
        expect((mapSdkError(sdk) as ZentaoError).code).toBe('2006');
    });

    test('maps other HTTP errors to E2008', () => {
        const sdk = new SdkZentaoError('E_HTTP_ERROR', { status: 500, statusText: 'Server Error' }, { status: 500 });
        expect((mapSdkError(sdk) as ZentaoError).code).toBe('2008');
    });

    test('maps timeout to E5001', () => {
        expect((mapSdkError(new SdkZentaoError('E_TIMEOUT')) as ZentaoError).code).toBe('5001');
    });

    test('maps API failure to E2008', () => {
        const sdk = new SdkZentaoError('E_API_FAILED', { message: 'invalid params' });
        expect((mapSdkError(sdk) as ZentaoError).code).toBe('2008');
    });

    test('maps login failure to E1003', () => {
        expect((mapSdkError(new SdkZentaoError('E_LOGIN_FAILED')) as ZentaoError).code).toBe('1003');
    });

    test('maps missing param to E2003', () => {
        expect((mapSdkError(new SdkZentaoError('E_MISSING_PARAM', { param: 'title' })) as ZentaoError).code).toBe('2003');
    });

    test('returns CLI ZentaoError unchanged', () => {
        const cli = new ZentaoError('E1006');
        expect(mapSdkError(cli)).toBe(cli);
    });

    test('passes through non-SDK errors', () => {
        const plain = new Error('boom');
        expect(mapSdkError(plain)).toBe(plain);
    });
});
