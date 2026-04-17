import { describe, test, expect } from 'bun:test';
import {
    parseSemver,
    compareSemver,
    buildInstallCommand,
    PACKAGE_NAME,
} from '../src/utils/update-notifier';

describe('parseSemver', () => {
    test('parses basic semver', () => {
        expect(parseSemver('1.2.3')).toEqual({
            major: 1, minor: 2, patch: 3, prerelease: '',
        });
    });

    test('parses prerelease', () => {
        expect(parseSemver('0.1.2-beta.3')).toEqual({
            major: 0, minor: 1, patch: 2, prerelease: 'beta.3',
        });
    });

    test('accepts leading v', () => {
        expect(parseSemver('v1.0.0')).toEqual({
            major: 1, minor: 0, patch: 0, prerelease: '',
        });
    });

    test('returns null on invalid input', () => {
        expect(parseSemver('not-a-version')).toBeNull();
        expect(parseSemver('1.2')).toBeNull();
    });
});

describe('compareSemver', () => {
    const cmp = (a: string, b: string) => compareSemver(parseSemver(a)!, parseSemver(b)!);

    test('compares major/minor/patch numerically', () => {
        expect(cmp('1.0.0', '2.0.0')).toBe(-1);
        expect(cmp('1.2.0', '1.10.0')).toBe(-1);
        expect(cmp('1.0.2', '1.0.10')).toBe(-1);
        expect(cmp('1.2.3', '1.2.3')).toBe(0);
    });

    test('release version is greater than its prerelease', () => {
        expect(cmp('1.0.0', '1.0.0-beta.1')).toBe(1);
        expect(cmp('1.0.0-beta.1', '1.0.0')).toBe(-1);
    });

    // 回归：修复前 "beta.2" > "beta.10" （字典序），这里断言正确的 semver 数值比较
    test('prerelease numeric segment compares as number, not string', () => {
        expect(cmp('0.1.2-beta.2', '0.1.2-beta.10')).toBe(-1);
        expect(cmp('0.1.2-beta.10', '0.1.2-beta.2')).toBe(1);
        expect(cmp('0.1.2-beta.9', '0.1.2-beta.10')).toBe(-1);
    });

    test('prerelease shorter tag is lower when all prior segments equal', () => {
        expect(cmp('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
        expect(cmp('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
    });

    test('alphanumeric segment beats numeric segment', () => {
        expect(cmp('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1);
    });

    test('different prerelease labels compare lexicographically', () => {
        expect(cmp('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
        expect(cmp('1.0.0-beta', '1.0.0-rc')).toBe(-1);
    });
});

describe('buildInstallCommand', () => {
    test('returns bun command', () => {
        const { cmd, args } = buildInstallCommand('bun');
        expect(cmd).toBe('bun');
        expect(args).toEqual(['add', '-g', `${PACKAGE_NAME}@latest`]);
    });

    test('returns npm command', () => {
        const { cmd, args } = buildInstallCommand('npm');
        expect(cmd).toBe('npm');
        expect(args).toEqual(['install', '-g', `${PACKAGE_NAME}@latest`]);
    });
});
