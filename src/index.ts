/**
 * CLI 入口：装配 Commander、注册子命令，并在捕获到 {@link ZentaoError} 时按 `--format` 渲染后退出。
 */
import { Command, CommanderError } from 'commander';
import { registerAllCommands } from './commands/index.js';
import { ZentaoError, formatError } from './errors.js';
import { getAllProfiles, setConfigPath } from './config/store.js';
import { getCliVersion } from './utils/version.js';

/**
 * 在 Commander 正式解析之前，手动扫描 argv 查找 `--config`，
 * 若未命中则回退到 `ZENTAO_CONFIG_FILE` 环境变量。
 * 必须在任何 store 访问之前调用。
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

function localizeHelpOutput(text: string): string {
    return text
        .replace(/^Usage:/gm, '用法:')
        .replace(/^Options:/gm, '选项:')
        .replace(/^Commands:/gm, '命令:')
        .replace(/display help for command/g, '显示命令帮助');
}

program.configureOutput({
    writeOut: (str) => process.stdout.write(localizeHelpOutput(str)),
    writeErr: (str) => process.stderr.write(localizeHelpOutput(str)),
});

program
    .name('zentao')
    .description('禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据')
    .version(getCliVersion(), '-V, --version', '显示版本号')
    .helpOption('-h, --help', '显示命令帮助')
    .option('--format <format>', '输出格式 (markdown|json|raw)')
    .option('--silent', '静默模式')
    .option('--insecure', '跳过 SSL/TLS 证书验证')
    .option('--timeout <ms>', '请求超时时间（毫秒）', parseInt)
    .option('--config <config_file>', '指定自定义配置文件路径（亦可通过 ZENTAO_CONFIG_FILE 环境变量设置）')
    .option('--machine-readable', '禁用 Markdown ANSI 渲染；删除操作仍需显式传入 --yes');

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

program.parseAsync(process.argv).catch((error) => {
    if (error instanceof ZentaoError) {
        console.error(formatError(error, program.opts().format ?? 'markdown'));
        process.exit(1);
    }
    console.error(error.message ?? error);
    process.exit(1);
});
