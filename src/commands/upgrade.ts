import { commandSignal } from '../utils/lifecycle.js';
import { emitResult } from '../utils/output.js';
import { ZentaoError } from '../errors.js';
import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import type { GlobalOptions } from '../types/index.js';
import { getCliVersion } from '../utils/version.js';
import {
    parseSemver,
    compareSemver,
    fetchLatestVersion,
    detectPackageManager,
    buildInstallCommand,
    runInstall,
} from '../utils/update-notifier.js';

async function confirmUpgrade(current: string, latest: string): Promise<boolean> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new ZentaoError('E2009', { option: 'yes', reason: '非交互模式下必须显式确认升级' });
    }

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        const answer = await rl.question(`发现新版本 ${current} → ${latest}，是否立即升级？[y/N] `, { signal: commandSignal() });
        return answer.trim().toLowerCase() === 'y';
    } finally {
        rl.close();
    }
}

/** 注册 `zentao upgrade`：从 npm 检查并升级到最新版本 */
export function registerUpgradeCommand(program: Command): void {
    program
        .command('update')
        .description('检查并升级 CLI 到最新版本')
        .option('-y, --yes', '跳过确认，直接升级')
        .action(async (opts: { yes?: boolean }) => {
            const globalOpts = program.optsWithGlobals() as GlobalOptions;
            const silent = !!globalOpts.quiet;

            const currentVersion = getCliVersion();
            if (!silent) process.stderr.write('正在检查最新版本...\n');

            const latestVersion = await fetchLatestVersion(commandSignal(), globalOpts.timeout);

            const current = parseSemver(currentVersion);
            const latest = parseSemver(latestVersion);

            if (!current || !latest) {
                throw new Error(
                    `版本号格式无法解析: 当前=${currentVersion}, 最新=${latestVersion}`,
                );
            }

            if (compareSemver(current, latest) >= 0) {
                emitResult({ current: currentVersion, latest: latestVersion, updated: false }, globalOpts);
                return;
            }

            if (!opts.yes && globalOpts.input === false) throw new ZentaoError('E2009', { option: 'yes', reason: '--no-input 时必须显式确认升级' });
            const shouldUpgrade = opts.yes || (await confirmUpgrade(currentVersion, latestVersion));

            if (!shouldUpgrade) {
                emitResult({ updated: false, cancelled: true }, globalOpts);
                return;
            }

            const pm = detectPackageManager();
            const { cmd, args } = buildInstallCommand(pm, latestVersion);
            if (!silent) process.stderr.write(`执行: ${cmd} ${args.join(' ')}\n`);

            const { status } = await runInstall(pm, latestVersion, commandSignal());

            if (status === 0) {
                emitResult({ previous: currentVersion, current: latestVersion, updated: true }, globalOpts);
            } else {
                throw new Error(`升级失败，请手动运行:\n  ${cmd} ${args.join(' ')}`);
            }
        });
}
