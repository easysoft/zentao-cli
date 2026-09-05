import { join } from 'node:path';

export const ALL_MAINSTREAM_TARGETS = [
    'darwin-x64',
    'darwin-arm64',
    'linux-x64',
    'linux-arm64',
    'windows-x64',
] as const;

const TARGET_ALIASES = {
    'darwin-x64': 'bun-darwin-x64',
    'darwin-arm64': 'bun-darwin-arm64',
    'macos-x64': 'bun-darwin-x64',
    'macos-arm64': 'bun-darwin-arm64',
    'linux-x64': 'bun-linux-x64',
    'linux-arm64': 'bun-linux-arm64',
    'windows-x64': 'bun-windows-x64',
    'windows-arm64': 'bun-windows-arm64',
    'win32-x64': 'bun-windows-x64',
    'win32-arm64': 'bun-windows-arm64',
} as const;

const SUPPORTED_BUN_TARGETS = new Set([
    'bun-darwin-x64',
    'bun-darwin-x64-baseline',
    'bun-darwin-arm64',
    'bun-linux-x64',
    'bun-linux-x64-baseline',
    'bun-linux-x64-modern',
    'bun-linux-arm64',
    'bun-linux-x64-musl',
    'bun-linux-arm64-musl',
    'bun-windows-x64',
    'bun-windows-x64-baseline',
    'bun-windows-x64-modern',
    'bun-windows-arm64',
]);

type TargetAlias = keyof typeof TARGET_ALIASES;

export interface PlatformInfo {
    platform: NodeJS.Platform;
    arch: NodeJS.Architecture;
}

export interface ParsedBuildArgs {
    compile: boolean;
    sourcemap: boolean;
    bytecode: boolean;
    minify: boolean;
    outdir: string;
    outfile?: string;
    targets: string[];
}

export interface BuildCompileInput {
    packageName: string;
    outdir: string;
    outfile?: string;
    targets: string[];
}

export interface CompileTargetOptions {
    id: string;
    bunTarget: Bun.Build.CompileTarget;
    outfile: string;
}

export function parseBuildArgs(
    args: string[],
    platformInfo: PlatformInfo = {
        platform: process.platform,
        arch: process.arch,
    },
): ParsedBuildArgs {
    const targetValues = [
        ...readOptionValues(args, '--targets'),
        ...readOptionValues(args, '--target'),
    ];
    const compile = args.includes('--compile');

    return {
        compile,
        sourcemap: args.includes('--sourcemap'),
        bytecode: args.includes('--bytecode'),
        minify: args.includes('--minify'),
        outdir: readLastOptionValue(args, '--outdir') ?? 'release',
        outfile: readLastOptionValue(args, '--outfile'),
        targets: compile || targetValues.length > 0
            ? resolveTargetIds(targetValues, platformInfo)
            : [],
    };
}

export function getCurrentPlatformTarget({ platform, arch }: PlatformInfo): string {
    const target = TARGET_ALIASES[`${platform}-${arch}` as TargetAlias];

    if (!target) {
        throw new Error(`Unsupported current platform for single-file build: ${platform}-${arch}`);
    }

    return target.replace(/^bun-/, '');
}

export function buildCompileOptions(input: BuildCompileInput): CompileTargetOptions[] {
    const resolvedTargets = input.targets.map(resolveTarget);

    if (input.outfile && resolvedTargets.length !== 1) {
        throw new Error('--outfile can only be used with a single compile target');
    }

    return resolvedTargets.map((target) => ({
        id: target.id,
        bunTarget: target.bunTarget,
        outfile: input.outfile ?? join(input.outdir, `${input.packageName}-${outputSuffix(target.id)}${windowsExtension(target.id)}`),
    }));
}

function resolveTargetIds(values: string[], platformInfo: PlatformInfo): string[] {
    const tokens = splitTargetValues(values);

    if (tokens.length === 0) {
        return [getCurrentPlatformTarget(platformInfo)];
    }

    if (tokens.includes('all')) {
        if (tokens.length > 1) {
            throw new Error('--targets=all cannot be combined with other build targets');
        }

        return [...ALL_MAINSTREAM_TARGETS];
    }

    return unique(tokens.map((target) => resolveTarget(target).id));
}

function resolveTarget(target: string): { id: string; bunTarget: Bun.Build.CompileTarget } {
    const bunTarget = TARGET_ALIASES[target as TargetAlias] ?? target;

    if (!SUPPORTED_BUN_TARGETS.has(bunTarget)) {
        throw new Error(`Unsupported build target: ${target}`);
    }

    return {
        id: target,
        bunTarget: bunTarget as Bun.Build.CompileTarget,
    };
}

function outputSuffix(target: string): string {
    return target.replace(/^bun-/, '');
}

function windowsExtension(target: string): string {
    return outputSuffix(target).startsWith('windows-') ? '.exe' : '';
}

function splitTargetValues(values: string[]): string[] {
    return values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}

function readOptionValues(args: string[], option: string): string[] {
    const values: string[] = [];

    for (let index = 0; index < args.length; index++) {
        const arg = args[index];

        if (arg === option) {
            const next = args[index + 1];
            if (next && !next.startsWith('--')) {
                values.push(next);
                index++;
            }
            continue;
        }

        if (arg.startsWith(`${option}=`)) {
            values.push(arg.slice(option.length + 1));
        }
    }

    return values;
}

function readLastOptionValue(args: string[], option: string): string | undefined {
    return readOptionValues(args, option).at(-1);
}
