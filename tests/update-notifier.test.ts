import { afterEach, describe, expect, test } from 'bun:test';
import {
    parseSemver,
    compareSemver,
    buildInstallCommand,
    fetchLatestVersion,
    isStableVersion,
    PACKAGE_NAME,
} from '../src/utils/update-notifier';

const originalFetch = globalThis.fetch;

function mockRegistryResponse(body: unknown, status = 200): void {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), {
        status,
        statusText: status === 200 ? 'OK' : 'Error',
    })) as typeof fetch;
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

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

describe('isStableVersion', () => {
    test('accepts release versions only', () => {
        expect(isStableVersion('1.2.3')).toBe(true);
        expect(isStableVersion('1.2.3-alpha.1')).toBe(false);
        expect(isStableVersion('1.2.3-beta.1')).toBe(false);
        expect(isStableVersion('not-a-version')).toBe(false);
    });
});

describe('fetchLatestVersion', () => {
    test('returns highest stable version and skips prereleases', async () => {
        mockRegistryResponse({
            'dist-tags': { latest: '0.2.0-beta.1' },
            versions: {
                '0.1.8': {},
                '0.1.9-alpha.1': {},
                '0.1.9': {},
                '0.2.0-beta.1': {},
            },
        });

        await expect(fetchLatestVersion()).resolves.toBe('0.1.9');
    });

    test('falls back to package document version when it is stable', async () => {
        mockRegistryResponse({ version: '0.1.9' });

        await expect(fetchLatestVersion()).resolves.toBe('0.1.9');
    });

    test('rejects package document version when it is prerelease', async () => {
        mockRegistryResponse({ version: '0.2.0-beta.1' });

        await expect(fetchLatestVersion()).rejects.toThrow('npm registry 未找到正式版本');
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

    test('can target a concrete stable version', () => {
        const { cmd, args } = buildInstallCommand('npm', '0.1.9');
        expect(cmd).toBe('npm');
        expect(args).toEqual(['install', '-g', `${PACKAGE_NAME}@0.1.9`]);
    });
});
