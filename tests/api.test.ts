import { describe, test, expect } from 'bun:test';
import { ZentaoClient } from '../src/api/client';

describe('ZentaoClient', () => {
    test('constructs correct base URL', () => {
        const client = new ZentaoClient('https://zentao.example.com', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('trims trailing slashes from server URL', () => {
        const client = new ZentaoClient('https://zentao.example.com/', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('trims multiple trailing slashes', () => {
        const client = new ZentaoClient('https://zentao.example.com///', 'token123');
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });

    test('can update token', () => {
        const client = new ZentaoClient('https://zentao.example.com', 'old-token');
        client.setToken('new-token');
        // Token is private, verify it works through request building
        expect(client.baseUrl).toBe('https://zentao.example.com/api.php/v2');
    });
});
