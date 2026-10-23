import { Command, Option } from 'commander';
import { registerAllCommands } from './commands/index.js';
import { getCliVersion } from './utils/version.js';
import { ZentaoError } from './errors.js';

function positive(value: string): number {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
        throw new ZentaoError('E2009', { option: 'timeout/deadline', reason: '必须为正安全整数（毫秒）' });
    }
    return Number(value);
}
export function createProgram(): Command {
    const program = new Command();
    const localize = (text: string) => text.replace(/^Usage:/gm, '用法:').replace(/^Options:/gm, '选项:')
        .replace(/^Commands:/gm, '命令:').replace(/display help for command/g, '显示命令帮助');
    program.configureOutput({ writeOut: text => process.stdout.write(localize(text)), writeErr: text => process.stderr.write(localize(text)), outputError: () => {} });
    program.name('zentao').description('禅道命令行工具')
        .version(getCliVersion(), '-V, --version', '显示 CLI 版本号')
        .helpOption('-h, --help', '显示命令帮助')
        .addOption(new Option('--format <format>', '输出格式').choices(['table', 'json', 'markdown', 'raw']))
        .option('--profile <key>', '仅本次命令选择账号（优先于环境凭据）')
        .option('--config <file>', '配置文件路径（也支持 ZENTAO_CONFIG_FILE）')
        .option('--no-input', '禁止浏览器、输入提示和选择菜单')
        .option('-y, --yes', '确认操作，不补全缺失参数')
        .option('--quiet', '压制进度和提示，保留结果和错误')
        .addOption(new Option('--color <mode>', '颜色控制').choices(['auto', 'always', 'never']).default('auto'))
        .option('--insecure', '跳过 TLS 证书验证')
        .option('--timeout <ms>', '单次 HTTP 请求超时', positive)
        .option('--deadline <ms>', '整次命令期限，含认证和预取', positive)
        .exitOverride();
    registerAllCommands(program);
    program.action(() => program.outputHelp());
    return program;
}
