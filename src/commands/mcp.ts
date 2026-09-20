import { Command } from 'commander';
import { startMcpServer } from '../mcp/index.js';
import type { GlobalOptions } from '../types/index.js';

export function registerMcpCommand(program: Command): void {
    program
        .command('mcp')
        .description('启动 MCP (Model Context Protocol) 服务，供 AI Agents 通过 stdio 访问禅道数据')
        .option('--read-only', '仅提供查询工具，禁止业务写入和账号切换')
        .option('--modules <names>', '仅提供指定业务模块（逗号分隔，如 product,story,task）', value => value.split(',').map(name => name.trim()))
        .option('--split-tools', '按模块分为 _read 查询工具和 _write 写入工具')
        .action(async (options: { readOnly?: boolean; modules?: string[]; splitTools?: boolean }) => {
            const globalOpts = program.opts() as GlobalOptions;
            await startMcpServer({
                insecure: globalOpts.insecure,
                timeout: globalOpts.timeout,
                ...options,
            });
        });
}
