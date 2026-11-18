import type { Command } from 'commander';
import { createClient } from '../api/index.js';
import { runPageLink, type PageLinkInput } from '../api/page-links.js';
import { selectLinkSite } from '../config/link-site.js';
import type { GlobalOptions } from '../types/index.js';
import { commandSignal } from '../utils/lifecycle.js';
import { emitResult } from '../utils/output.js';

async function showLink(input: PageLinkInput, command: Command): Promise<void> {
    const options = command.optsWithGlobals<GlobalOptions & { server?: string }>();
    const site = selectLinkSite(options);
    const result = await runPageLink(site, input, () => {
        const client = createClient(site.server, undefined, {
            timeout: options.timeout ?? site.timeout, insecure: options.insecure ?? site.insecure, actionAssistant: '',
        });
        return client.getZentaoConfig({ signal: commandSignal() });
    });
    if (typeof result === 'string' && options.format !== 'json') console.log(result);
    else emitResult(result, options);
}

export function registerLinkCommand(program: Command): void {
    const link = program.command('link').description('生成或解析站内页面链接')
        .option('--server <url>', '指定站点地址，可省略登录凭据');
    link.action(() => link.outputHelp());
    link.command('create <module> <method>').description('生成页面链接')
        .option('--var <name=value>', '路由参数，可按页面参数顺序重复指定', (value: string, previous: string[] = []) => previous.concat(value))
        .option('--relative', '输出站内路径')
        .action((module: string, method: string, opts, command: Command) =>
            showLink({ action: 'create', module, method, vars: opts.var, relative: opts.relative }, command));
    link.command('parse <url>').description('解析页面链接')
        .action((url: string, _opts, command: Command) => showLink({ action: 'parse', url }, command));
}
