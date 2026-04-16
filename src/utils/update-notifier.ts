import { spawnSync } from 'node:child_process';
import { getCliVersion } from './version.js';

export const PACKAGE_NAME = 'zentao-cli';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

export interface SemVer {
    major: number;
    minor: number;
    patch: number;
    prerelease: string;
}

export function parseSemver(version: string): SemVer | null {
    const match = version.trim().replace(/^v/, '').match(
        /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/,
    );
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ?? '',
    };
}

/**
 * 返回值：
 *  1  => a > b（本地版本更新）
 * -1  => a < b（有新版本）
 *  0  => 相同
 */
export function compareSemver(a: SemVer, b: SemVer): number {
    for (const key of ['major', 'minor', 'patch'] as const) {
        if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
    }
    // 无 prerelease > 有 prerelease（正式版 > beta 版）
    if (!a.prerelease && b.prerelease) return 1;
    if (a.prerelease && !b.prerelease) return -1;
    if (a.prerelease !== b.prerelease) return a.prerelease > b.prerelease ? 1 : -1;
    return 0;
}

export async function fetchLatestVersion(): Promise<string> {
    let response: Response;
    try {
        response = await fetch(REGISTRY_URL, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10_000),
        });
    } catch (err) {
        throw new Error(`无法连接到 npm registry: ${(err as Error).message}`);
    }

    if (!response.ok) {
        throw new Error(`npm registry 返回错误: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { version?: unknown };
    if (typeof data.version !== 'string' || !data.version) {
        throw new Error('npm registry 返回数据格式异常');
    }
    return data.version;
}

export type PackageManager = 'bun' | 'npm';

export function detectPackageManager(): PackageManager {
    // 检测 bun 是否可用
    const result = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
    if (result.status === 0) return 'bun';
    return 'npm';
}

export function buildInstallCommand(pm: PackageManager): { cmd: string; args: string[] } {
    if (pm === 'bun') {
        return { cmd: 'bun', args: ['add', '-g', `${PACKAGE_NAME}@latest`] };
    }
    return { cmd: 'npm', args: ['install', '-g', `${PACKAGE_NAME}@latest`] };
}

export interface UpdateCheckResult {
    hasUpdate: boolean;
    current: string;
    latest: string;
}

/** 异步检查是否有版本更新，忽略所有异常 */
export async function asyncCheckForUpdate(): Promise<UpdateCheckResult | null> {
    try {
        const currentVersion = getCliVersion();
        if (currentVersion === 'unknown' || currentVersion.includes('dev')) {
            return null;
        }

        const latestVersion = await fetchLatestVersion();
        const current = parseSemver(currentVersion);
        const latest = parseSemver(latestVersion);

        if (!current || !latest) return null;

        const hasUpdate = compareSemver(current, latest) < 0;
        return {
            hasUpdate,
            current: currentVersion,
            latest: latestVersion
        };
    } catch {
        return null; // 错误静默忽略
    }
}

/** 显示升级提示信息 */
export function showUpdateNotification(result: UpdateCheckResult) {
    if (!result.hasUpdate) return;
    
    const termWidth = process.stdout.columns || 80;
    
    // 使用简单的 ANSI 颜色，不引入新依赖
    const reset = '\x1b[0m';
    const yellow = '\x1b[33m';
    const cyan = '\x1b[36m';
    const dim = '\x1b[2m';
    const bold = '\x1b[1m';
    const bgYellow = '\x1b[43m\x1b[30m';
    
    const lines = [
        `更新提醒：发现新版本 ${dim}${result.current}${reset} → ${yellow}${bold}${result.latest}${reset}`,
        `执行 ${cyan}zentao upgrade${reset} 升级到最新版本`
    ];

    process.stderr.write('\n' + lines.join('\n') + '\n\n');
}
