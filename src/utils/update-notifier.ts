import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
 * 按 semver 2.0 规则比较 prerelease 标识。
 * 以 `.` 切分后，每段：全数字用数值比较，否则用字典序比较；段更短者（全匹配前提下）更小。
 */
function comparePrerelease(a: string, b: string): number {
    const aParts = a.split('.');
    const bParts = b.split('.');
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
        const ap = aParts[i];
        const bp = bParts[i];
        if (ap === undefined) return -1;
        if (bp === undefined) return 1;
        const aNum = /^\d+$/.test(ap);
        const bNum = /^\d+$/.test(bp);
        if (aNum && bNum) {
            const na = Number(ap);
            const nb = Number(bp);
            if (na !== nb) return na > nb ? 1 : -1;
        } else if (aNum !== bNum) {
            // 数字段优先级低于字母段
            return aNum ? -1 : 1;
        } else if (ap !== bp) {
            return ap > bp ? 1 : -1;
        }
    }
    return 0;
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
    if (a.prerelease === b.prerelease) return 0;
    return comparePrerelease(a.prerelease, b.prerelease);
}

export async function fetchLatestVersion(signal?: AbortSignal): Promise<string> {
    let response: Response;
    try {
        response = await fetch(REGISTRY_URL, {
            headers: { Accept: 'application/json' },
            signal: signal ?? AbortSignal.timeout(10_000),
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

/**
 * 根据「当前 CLI 实际被加载的路径」判断包管理器，避免"本机装了 bun 就用 bun"的误判。
 * 路径中包含 `.bun` 段视为 bun 安装；否则一律按 npm 处理。
 */
export function detectPackageManager(): PackageManager {
    let installPath = '';
    try {
        installPath = fileURLToPath(import.meta.url);
    } catch {
        installPath = process.argv[1] ?? '';
    }
    const normalized = installPath.replace(/\\/g, '/');
    if (/\/\.bun\/|\/bun\/install\//.test(normalized)) return 'bun';
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
export async function asyncCheckForUpdate(signal?: AbortSignal): Promise<UpdateCheckResult | null> {
    try {
        const currentVersion = getCliVersion();
        // 仅过滤 getCliVersion 的降级哨兵 `0.0.0-dev`，避免误伤 `1.0.0-develop.1` 之类真实版本
        if (currentVersion === 'unknown' || currentVersion === '0.0.0-dev') {
            return null;
        }

        const latestVersion = await fetchLatestVersion(signal);
        const current = parseSemver(currentVersion);
        const latest = parseSemver(latestVersion);

        if (!current || !latest) return null;

        const hasUpdate = compareSemver(current, latest) < 0;
        return {
            hasUpdate,
            current: currentVersion,
            latest: latestVersion,
        };
    } catch {
        return null;
    }
}

/** 显示升级提示信息，仅在 stderr 为 TTY 时输出彩色文案 */
export function showUpdateNotification(result: UpdateCheckResult): void {
    if (!result.hasUpdate) return;
    if (!process.stderr.isTTY) return;

    const reset = '\x1b[0m';
    const yellow = '\x1b[33m';
    const cyan = '\x1b[36m';
    const dim = '\x1b[2m';
    const bold = '\x1b[1m';

    const lines = [
        `更新提醒：发现新版本 ${dim}${result.current}${reset} → ${yellow}${bold}${result.latest}${reset}`,
        `执行 ${cyan}zentao upgrade${reset} 升级到最新版本`,
    ];

    process.stderr.write('\n' + lines.join('\n') + '\n\n');
}

/**
 * 以 `spawnSync` 在 Windows 兼容地运行 install 命令。
 * Windows 上 `bun`/`npm` 是 `.cmd`，必须通过 shell 才能 spawn。
 */
export function runInstall(pm: PackageManager): { status: number | null; cmd: string; args: string[] } {
    const { cmd, args } = buildInstallCommand(pm);
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        encoding: 'utf-8',
        shell: process.platform === 'win32',
    });
    return { status: result.status, cmd, args };
}
