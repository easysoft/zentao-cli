import { Command } from 'commander';
import { createInterface, type Interface } from 'node:readline';
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

function ask(rl: Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer));
    });
}

async function confirmUpgrade(current: string, latest: string): Promise<boolean> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        console.error('非交互模式下请使用 --yes 跳过确认。');
        process.exit(2);
    }

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        const answer = await ask(rl, `发现新版本 ${current} → ${latest}，是否立即升级？[y/N] `);
        return answer.trim().toLowerCase() === 'y';
    } finally {
        rl.close();
    }
}

/** 注册 `zentao upgrade`：从 npm 检查并升级到最新版本 */
export function registerUpgradeCommand(program: Command): void {
    program
        .command('upgrade')
        .description('检查并升级 CLI 到最新版本')
        .option('-y, --yes', '跳过确认，直接升级')
        .action(async (opts: { yes?: boolean }) => {
            const globalOpts = program.opts() as GlobalOptions;
            const silent = !!globalOpts.silent;

            try {
                const currentVersion = getCliVersion();
                if (!silent) process.stderr.write('正在检查最新版本...\n');

                const latestVersion = await fetchLatestVersion();

                const current = parseSemver(currentVersion);
                const latest = parseSemver(latestVersion);

                if (!current || !latest) {
                    throw new Error(
                        `版本号格式无法解析: 当前=${currentVersion}, 最新=${latestVersion}`,
                    );
                }

                if (compareSemver(current, latest) >= 0) {
                    console.log(`当前已是最新版本 ${currentVersion}，无需升级。`);
                    return;
                }

                const shouldUpgrade =
                    opts.yes || (await confirmUpgrade(currentVersion, latestVersion));

                if (!shouldUpgrade) {
                    console.log('已取消升级。');
                    return;
                }

                const pm = detectPackageManager();
                const { cmd, args } = buildInstallCommand(pm);
                console.log(`\n执行: ${cmd} ${args.join(' ')}\n`);

                const { status } = runInstall(pm);

                if (status === 0) {
                    console.log(`\n升级成功！${currentVersion} → ${latestVersion}`);
                } else {
                    console.error('\n升级失败，请手动运行:');
                    console.error(`  ${cmd} ${args.join(' ')}`);
                    process.exit(1);
                }
            } catch (error) {
                console.error(String((error as Error).message ?? error));
                process.exit(1);
            }
        });
}
