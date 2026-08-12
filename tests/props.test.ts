import { describe, expect, test } from 'bun:test';
import { runCliWithoutAuth } from './helpers';

describe('zentao <module> props', () => {
    test('prints object property definitions without authentication', async () => {
        const result = await runCliWithoutAuth(['product', 'props', '--format=json']);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
        const props = JSON.parse(result.stdout);
        expect(props.id).toBe('编号');
        expect(props.name).toBe('产品名称');
    });

    test('uses markdown output by default', async () => {
        const result = await runCliWithoutAuth(['bug', 'props']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('id: Bug编号');
        expect(result.stdout).toContain('title: Bug标题');
    });

    test('respects silent mode', async () => {
        const result = await runCliWithoutAuth(['task', 'props', '--silent']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
    });
});
