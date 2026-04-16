import { Command } from 'commander';
import { startMcpServer } from '../mcp/index.js';
import type { GlobalOptions } from '../types/index.js';

export function registerMcpCommand(program: Command): void {
    program
        .command('mcp')
        .description('启动 MCP (Model Context Protocol) 服务，供 AI Agents 通过 stdio 访问禅道数据')
        .action(async () => {
            const globalOpts = program.opts() as GlobalOptions;
            await startMcpServer({
                insecure: globalOpts.insecure,
                timeout: globalOpts.timeout,
            });
        });
}
