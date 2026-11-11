import { brandText } from '../brand.js';
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

export function registerMcpCommand(program: Command): Command {
    const mcp = addMcpOptions(program
        .command('mcp')
        .description(brandText('启动 MCP 服务，支持本地 stdio 或多客户端 HTTP 访问禅道数据'))
        .option('--transport <type>', '传输方式 (stdio|http)', 'stdio'))
        .action((options: McpCommandOptions) => runMcpCommand(options, program.optsWithGlobals() as GlobalOptions));
    addMcpOptions(mcp.command('serve').description('启动 MCP 服务')
        .option('--transport <type>', '传输方式 (stdio|http)', 'stdio'))
        .action((_options: McpCommandOptions, command: Command) => {
            // Commander can consume shared MCP flags on the parent command.
            const options = command.optsWithGlobals<McpCommandOptions & GlobalOptions>();
            return runMcpCommand(options, options);
        });

    addMcpOptions(program
        .command('mcp-server')
        .description(brandText('启动 HTTP MCP 服务，供多个客户端访问固定禅道站点'))
        .argument('[url]', brandText('禅道站点地址，与 --url 二选一；省略时读取 ZENTAO_URL')))
        .addHelpText('after', brandText('\n示例：\n  zentao mcp-server https://zentao.example.com\n  zentao mcp-server --url https://zentao.example.com\n  ZENTAO_URL=https://zentao.example.com zentao mcp-server\n'))
        .action((url: string | undefined, options: Omit<McpCommandOptions, 'transport'>) => {
            if (url !== undefined && options.url !== undefined) {
                throw new ZentaoError('E2009', { option: '--url', reason: '位置参数 URL 与 --url 不能同时提供' });
            }
            return runMcpCommand({ ...options, url: url ?? options.url, transport: 'http' }, program.optsWithGlobals() as GlobalOptions);
        });
    return mcp;
}

function addMcpOptions(command: Command): Command {
    return command
        .option('--host <host>', 'HTTP 监听地址（默认 127.0.0.1）')
        .option('--port <port>', 'HTTP 监听端口（默认 9090）')
        .option('--url <url>', brandText('HTTP 模式的固定禅道站点地址（亦可通过 ZENTAO_URL 设置）'))
        .option('--read-only', '仅提供查询工具，禁止业务写入和账号切换')
        .option('--modules <names>', '仅提供指定业务模块（逗号分隔，如 product,story,task）', value => value.split(',').map(name => name.trim()))
        .option('--split-tools', '按模块分为 _read 查询工具和 _write 写入工具');
}

async function runMcpCommand(options: McpCommandOptions, globalOpts: GlobalOptions): Promise<void> {
    const toolOptions = {
        insecure: globalOpts.insecure,
        timeout: globalOpts.timeout,
        profile: globalOpts.profile,
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

    const url = options.url ?? process.env[brandText('ZENTAO_URL')];
    if (!url?.trim()) {
        throw new ZentaoError('E2009', { option: '--url', reason: brandText('HTTP 模式必须指定禅道站点，或设置 ZENTAO_URL') });
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
    process.stderr.write(`用户接入页面：${new URL('/start', clientUrl).href}\n`);
    const jsonConfig = {
        mcpServers: {
            [brandText('zentao-remote')]: {
                type: 'http',
                url: clientUrl.href,
                headers: { token: brandText('<your-zentao-token>') },
            },
        },
    };
    process.stderr.write([
        brandText('\n客户端配置示例（请替换为自己的禅道 Token，并合并到已有配置）：'),
        '\nCodex（~/.codex/config.toml）：',
        brandText('[mcp_servers.zentao-remote]'),
        `url = ${JSON.stringify(clientUrl.href)}`,
        brandText('http_headers = { token = "<your-zentao-token>" }'),
        '\nClaude Code / Cursor（JSON）：',
        'Claude Code：~/.claude.json',
        'Cursor：~/.cursor/mcp.json（或项目内 .cursor/mcp.json）',
        JSON.stringify(jsonConfig, null, 2),
        brandText('\n也可将 token 请求头替换为 Authorization: Bearer <your-zentao-token>，两种认证头任选其一。'),
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
}
