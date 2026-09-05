import { describe, expect, test } from 'bun:test';
import {
    ALL_MAINSTREAM_TARGETS,
    buildCompileOptions,
    getCurrentPlatformTarget,
    parseBuildArgs,
} from '../scripts/build-options';

describe('build script target resolution', () => {
    test('empty targets resolves to the current operating system platform', () => {
        expect(parseBuildArgs(['--compile'], {
            platform: 'darwin',
            arch: 'arm64',
        }).targets).toEqual(['darwin-arm64']);

        expect(parseBuildArgs(['--compile'], {
            platform: 'linux',
            arch: 'x64',
        }).targets).toEqual(['linux-x64']);
    });

    test('--targets=all resolves to all mainstream platforms', () => {
        expect(parseBuildArgs(['--compile', '--targets=all']).targets).toEqual([...ALL_MAINSTREAM_TARGETS]);
    });

    test('supports comma separated targets and repeated --target flags', () => {
        expect(parseBuildArgs([
            '--compile',
            '--targets=linux-x64,darwin-arm64',
            '--target',
            'windows-x64',
        ]).targets).toEqual(['linux-x64', 'darwin-arm64', 'windows-x64']);
    });

    test('accepts full Bun compile target names', () => {
        expect(parseBuildArgs(['--compile', '--targets=bun-linux-x64-musl']).targets)
            .toEqual(['bun-linux-x64-musl']);
    });

    test('rejects unknown target aliases', () => {
        expect(() => parseBuildArgs(['--compile', '--targets=solaris-sparc'])).toThrow(
            'Unsupported build target: solaris-sparc',
        );
    });

    test('builds output file names under the configured output directory', () => {
        const options = buildCompileOptions({
            packageName: 'zentao-cli',
            outdir: 'release',
            targets: ['darwin-arm64', 'windows-x64'],
        });

        expect(options).toEqual([
            {
                id: 'darwin-arm64',
                bunTarget: 'bun-darwin-arm64',
                outfile: 'release/zentao-cli-darwin-arm64',
            },
            {
                id: 'windows-x64',
                bunTarget: 'bun-windows-x64',
                outfile: 'release/zentao-cli-windows-x64.exe',
            },
        ]);
    });

    test('single explicit outfile is only valid for one target', () => {
        expect(buildCompileOptions({
            packageName: 'zentao-cli',
            outdir: 'release',
            outfile: 'release/zentao',
            targets: ['linux-x64'],
        })[0].outfile).toBe('release/zentao');

        expect(() => buildCompileOptions({
            packageName: 'zentao-cli',
            outdir: 'release',
            outfile: 'release/zentao',
            targets: ['linux-x64', 'darwin-arm64'],
        })).toThrow('--outfile can only be used with a single compile target');
    });
});

describe('current platform target detection', () => {
    test('maps supported operating systems and architectures', () => {
        expect(getCurrentPlatformTarget({ platform: 'darwin', arch: 'x64' })).toBe('darwin-x64');
        expect(getCurrentPlatformTarget({ platform: 'darwin', arch: 'arm64' })).toBe('darwin-arm64');
        expect(getCurrentPlatformTarget({ platform: 'linux', arch: 'x64' })).toBe('linux-x64');
        expect(getCurrentPlatformTarget({ platform: 'linux', arch: 'arm64' })).toBe('linux-arm64');
        expect(getCurrentPlatformTarget({ platform: 'win32', arch: 'x64' })).toBe('windows-x64');
    });
});
