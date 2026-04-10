import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerAllCommands } from './commands/index.js';
import { ZentaoError, formatError } from './errors.js';

function getVersion(): string {
    try {
        const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
        return pkg.version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

const program = new Command();

program
    .name('zentao')
    .description('禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据')
    .version(getVersion(), '-V, --version-flag')
    .option('--format <format>', '输出格式 (markdown|json|raw)')
    .option('--silent', '静默模式')
    .option('--insecure', '跳过 SSL/TLS 证书验证')
    .option('--timeout <ms>', '请求超时时间（毫秒）', parseInt);

registerAllCommands(program);

program.parseAsync(process.argv).catch((error) => {
    if (error instanceof ZentaoError) {
        console.error(formatError(error, program.opts().format ?? 'markdown'));
        process.exit(1);
    }
    console.error(error.message ?? error);
    process.exit(1);
});
