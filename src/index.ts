/**
 * CLI 入口：装配 Commander、注册子命令，并在捕获到 {@link ZentaoError} 时按 `--format` 渲染后退出。
 */
import { Command, CommanderError } from 'commander';
import { registerAllCommands } from './commands/index.js';
import { ZentaoError, formatError } from './errors.js';
import { getAllProfiles, getUpdateCheckData, setUpdateCheckData } from './config/store.js';
import { asyncCheckForUpdate, showUpdateNotification, type UpdateCheckResult } from './utils/update-notifier.js';

declare const BUILD_VERSION: string | undefined;

const program = new Command();

program
    .name('zentao')
    .description('禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据')
    .version(typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : '0.0.0-dev', '-V, --version-flag')
    .option('--format <format>', '输出格式 (markdown|json|raw)')
    .option('--silent', '静默模式')
    .option('--insecure', '跳过 SSL/TLS 证书验证')
    .option('--timeout <ms>', '请求超时时间（毫秒）', parseInt)
    .option('--machine-readable', '启用机器可读模式，简化格式，禁用颜色输出');

registerAllCommands(program);

program.addHelpText('after', () => {
    try {
        if (getAllProfiles().length === 0) {
            return '\n提示：尚未登录禅道服务，请先执行以下命令登录：\n\n  zentao login -s <zentao_url> -u <account> -p <password>\n';
        }
    } catch {
        // 配置文件不可读时静默忽略，不影响帮助输出
    }
    return '';
});

/**
 * Commander 在「仅有子命令、未指定子命令且无根级 action」时会 `help({ error: true })`，并以码 1 退出。
 * 无参运行应视为查看帮助，与 `-h` 一致以 0 退出。
 */
program.exitOverride((err) => {
    if (err.code === 'commander.executeSubCommandAsync') {
        return;
    }
    const exitCode =
        err instanceof CommanderError && err.code === 'commander.help' && err.exitCode === 1 ? 0 : err.exitCode;
    process.exit(exitCode);
});

const EXCLUDED_COMMANDS = ['upgrade', 'version', 'mcp', 'autocomplete', 'help', '-h', '--help'];

const rawArgs = process.argv.slice(2);
const firstArg = rawArgs[0];
const isExcluded = !firstArg || EXCLUDED_COMMANDS.includes(firstArg);

let updateCheckPromise: Promise<UpdateCheckResult | null> | null = null;

if (!isExcluded) {
    const updateData = getUpdateCheckData();
    const now = Date.now();
    const lastCheck = updateData?.lastCheck ? new Date(updateData.lastCheck).getTime() : 0;
    
    // 24小时(86400000ms)检查一次
    if (now - lastCheck > 86400000) {
        updateCheckPromise = asyncCheckForUpdate();
    }
}

program.parseAsync(process.argv).then(async () => {
    if (updateCheckPromise && !program.opts().machineReadable && !program.opts().silent && program.opts().format !== 'json' && program.opts().format !== 'raw') {
        const result = await Promise.race([
            updateCheckPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)) // 3秒超时防止卡住
        ]);
        
        if (result) {
            setUpdateCheckData({
                lastCheck: new Date().toISOString(),
                latestVersion: result.latest
            });
            showUpdateNotification(result);
        }
    }
}).catch((error) => {
    if (error instanceof ZentaoError) {
        console.error(formatError(error, program.opts().format ?? 'markdown'));
        process.exit(1);
    }
    console.error(error.message ?? error);
    process.exit(1);
});
