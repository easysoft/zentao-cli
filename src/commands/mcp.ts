import { Command } from 'commander';
import { startMcpServer } from '../mcp/index.js';
import type { GlobalOptions } from '../types/index.js';
import { ZentaoError } from '../errors.js';

interface McpCommandOptions {
    transport: string;
    host?: string;
    port?: string;
    url?: string;
    readOnly?: boolean;
    modules?: string[];
    splitTools?: boolean;
}

export function registerMcpCommand(program: Command): void {
    program
        .command('mcp')
        .description('启动 MCP 服务，支持本地 stdio 或多客户端 HTTP 访问禅道数据')
        .option('--transport <type>', '传输方式 (stdio|http)', 'stdio')
        .option('--host <host>', 'HTTP 监听地址（默认 127.0.0.1）')
        .option('--port <port>', 'HTTP 监听端口（默认 9090）')
        .option('--url <url>', 'HTTP 模式的固定禅道站点地址（亦可通过 ZENTAO_URL 设置）')
        .option('--read-only', '仅提供查询工具，禁止业务写入和账号切换')
        .option('--modules <names>', '仅提供指定业务模块（逗号分隔，如 product,story,task）', value => value.split(',').map(name => name.trim()))
        .option('--split-tools', '按模块分为 _read 查询工具和 _write 写入工具')
        .action(async (options: McpCommandOptions) => {
            const globalOpts = program.opts() as GlobalOptions;
            const toolOptions = {
                insecure: globalOpts.insecure,
                timeout: globalOpts.timeout,
                readOnly: options.readOnly,
                modules: options.modules,
                splitTools: options.splitTools,
            };
            if (options.transport !== 'stdio' && options.transport !== 'http') {
                throw new ZentaoError('E2009', { option: '--transport', reason: '必须为 stdio 或 http' });
            }
            if (options.transport === 'stdio') {
                for (const option of ['host', 'port', 'url'] as const) {
                    if (options[option] !== undefined) {
                        throw new ZentaoError('E2009', { option: `--${option}`, reason: '仅适用于 --transport http' });
                    }
                }
                await startMcpServer(toolOptions);
                return;
            }

            const url = options.url ?? process.env.ZENTAO_URL;
            if (!url?.trim()) {
                throw new ZentaoError('E2009', { option: '--url', reason: 'HTTP 模式必须指定禅道站点，或设置 ZENTAO_URL' });
            }
            const port = options.port === undefined ? 9090 : Number(options.port);
            if ((options.port !== undefined && !/^\d+$/.test(options.port)) || !Number.isInteger(port) || port < 1 || port > 65535) {
                throw new ZentaoError('E2009', { option: '--port', reason: '必须为 1–65535 的整数' });
            }
            const { startMcpHttpServer } = await import('../mcp/http.js');
            const running = await startMcpHttpServer({ ...toolOptions, url, host: options.host, port });
            process.stderr.write(`MCP HTTP 服务已启动：${running.url.href}\n`);
            const clientUrl = new URL(running.url);
            if (clientUrl.hostname === '0.0.0.0') clientUrl.hostname = '127.0.0.1';
            if (clientUrl.hostname === '[::]') clientUrl.hostname = '[::1]';
            const clientConfig = {
                mcpServers: {
                    'zentao-remote': {
                        url: clientUrl.href,
                        headers: { token: '<your-zentao-token>' },
                    },
                },
            };
            process.stderr.write([
                '\n客户端配置示例（请替换为自己的禅道 Token）：',
                JSON.stringify(clientConfig, null, 2),
                '\n也可将 headers 改为 {"Authorization":"Bearer <your-zentao-token>"}，两种认证头任选其一。',
                '远程客户端请将 url 替换为可访问的 HTTPS 服务地址。\n',
            ].join('\n'));
            let stopping = false;
            const shutdown = () => {
                if (stopping) return;
                stopping = true;
                void running.close().catch(() => {
                    process.stderr.write('MCP HTTP 服务关闭失败\n');
                    process.exitCode = 1;
                }).finally(() => {
                    process.removeListener('SIGINT', shutdown);
                    process.removeListener('SIGTERM', shutdown);
                });
            };
            process.once('SIGINT', shutdown);
            process.once('SIGTERM', shutdown);
        });
}
