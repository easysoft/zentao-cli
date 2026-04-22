/**
 * CLI 入口：装配 Commander、注册子命令，并在捕获到 {@link ZentaoError} 时按 `--format` 渲染后退出。
 */
import { Command, CommanderError } from 'commander';
import { registerAllCommands } from './commands/index.js';
import { ZentaoError, formatError } from './errors.js';
import { getAllProfiles, getUpdateCheckData, setConfigPath, setUpdateCheckData } from './config/store.js';
import { asyncCheckForUpdate, showUpdateNotification, type UpdateCheckResult } from './utils/update-notifier.js';
import { getCliVersion } from './utils/version.js';

/**
 * 在 Commander 正式解析之前，手动扫描 argv 查找 `--config`，
 * 若未命中则回退到 `ZENTAO_CONFIG_FILE` 环境变量。
 * 必须在任何 store 访问（如 getUpdateCheckData）之前调用。
 */
function resolveCustomConfigPath(argv: readonly string[], env: NodeJS.ProcessEnv): void {
    let customPath: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--config') {
            customPath = argv[i + 1];
            break;
        }
        if (arg.startsWith('--config=')) {
            customPath = arg.slice('--config='.length);
            break;
        }
    }
    if (!customPath) {
        const envPath = env.ZENTAO_CONFIG_FILE;
        if (envPath && envPath.trim() !== '') {
            customPath = envPath;
        }
    }
    if (customPath && customPath.trim() !== '') {
        setConfigPath(customPath);
    }
}

resolveCustomConfigPath(process.argv.slice(2), process.env);

const program = new Command();

program
    .name('zentao')
    .description('禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据')
    .version(getCliVersion(), '-V, --version-flag')
    .option('--format <format>', '输出格式 (markdown|json|raw)')
    .option('--silent', '静默模式')
    .option('--insecure', '跳过 SSL/TLS 证书验证')
    .option('--timeout <ms>', '请求超时时间（毫秒）', parseInt)
    .option('--config <config_file>', '指定自定义配置文件路径（亦可通过 ZENTAO_CONFIG_FILE 环境变量设置）')
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

/** 不触发更新检查的子命令集合 */
const EXCLUDED_COMMANDS = new Set([
    'upgrade',
    'version',
    'mcp',
    'autocomplete',
    'completion',
    'help',
    '-h',
    '--help',
    '-V',
    '--version-flag',
]);

/** 扫描 argv，找到第一个看起来像子命令的非选项参数 */
function findSubcommand(argv: readonly string[]): string | undefined {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('-')) return arg;
        // 跳过带参数的全局选项
        if (arg === '--format' || arg === '--timeout' || arg === '--config') {
            i++;
        }
    }
    return undefined;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** 失败时短退避，避免网络不通时每次运行都重连 */
const FAILURE_BACKOFF_MS = 60 * 60 * 1000;

const subcommand = findSubcommand(process.argv.slice(2));
const shouldCheckUpdate = !subcommand || !EXCLUDED_COMMANDS.has(subcommand);

let updateCheckPromise: Promise<UpdateCheckResult | null> | null = null;
let updateAbortController: AbortController | null = null;

if (shouldCheckUpdate) {
    const updateData = getUpdateCheckData();
    const now = Date.now();
    const lastCheck = updateData?.lastCheck ? new Date(updateData.lastCheck).getTime() : 0;
    const lastCheckFailed = updateData?.latestVersion === '';
    const interval = lastCheckFailed ? FAILURE_BACKOFF_MS : ONE_DAY_MS;

    if (now - lastCheck > interval) {
        updateAbortController = new AbortController();
        updateCheckPromise = asyncCheckForUpdate(updateAbortController.signal);
    }
}

function canShowNotification(): boolean {
    const opts = program.opts();
    if (opts.silent) return false;
    if (opts.machineReadable) return false;
    if (opts.format === 'json' || opts.format === 'raw') return false;
    if (!process.stderr.isTTY) return false;
    return true;
}

/** 带超时竞速，但到期后主动 abort 正在进行的 fetch 并 unref 定时器，避免拖延进程退出 */
async function raceWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    onTimeout: () => void,
): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
            onTimeout();
            resolve(null);
        }, timeoutMs);
        timer.unref?.();
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

program.parseAsync(process.argv).then(async () => {
    if (!updateCheckPromise || !updateAbortController) return;

    if (!canShowNotification()) {
        updateAbortController.abort();
        return;
    }

    const controller = updateAbortController;
    const result = await raceWithTimeout(updateCheckPromise, 3000, () => controller.abort());

    // 无论成功失败都记录时间戳：成功写入真实 latest，失败写入空字符串作为退避标记
    try {
        setUpdateCheckData({
            lastCheck: new Date().toISOString(),
            latestVersion: result?.latest ?? '',
        });
    } catch {
        // 配置写入失败不影响主流程
    }

    if (result) {
        showUpdateNotification(result);
    }
}).catch((error) => {
    updateAbortController?.abort();
    if (error instanceof ZentaoError) {
        console.error(formatError(error, program.opts().format ?? 'markdown'));
        process.exit(1);
    }
    console.error(error.message ?? error);
    process.exit(1);
});
