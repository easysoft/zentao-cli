import type { Command } from 'commander';
import { createClient } from '../api/index.js';
import { requestToken } from '../auth/token.js';
import { findProfileByKey, getCurrentProfile } from '../config/store.js';
import { mapSdkError, ZentaoError } from '../errors.js';
import type { GlobalOptions } from '../types/index.js';

/** Read a saved token or obtain a temporary token without persisting credentials. */
export function registerTokenCommand(program: Command): void {
    program
        .command('token')
        .description('获取 Token（默认输出纯文本，不保存配置）')
        .argument('[profileKey]', '已登录的用户配置（account@server，省略时使用当前账号）')
        .option('-s, --server <url>', '临时获取 Token 的禅道服务地址')
        .option('-u, --user <account>', '临时获取 Token 的用户名')
        .option('-p, --password <password>', '临时获取 Token 的密码')
        .addHelpText('after', '\n省略凭证时只读取本地 Token，不联网验证。\n临时获取必须同时提供 --server、--user、--password，不能与 profileKey 混用。\n使用 --format json 或 --format raw 可同时输出账号、地址和 Token。')
        .action(async (key: string | undefined, opts: { server?: string; user?: string; password?: string }) => {
            const globalOpts = program.opts() as GlobalOptions;
            const temporary = opts.server !== undefined || opts.user !== undefined || opts.password !== undefined;
            if (temporary && key !== undefined) {
                throw new ZentaoError('E2009', {
                    option: 'profileKey',
                    reason: '不能与 --server、--user 或 --password 同时使用',
                });
            }

            let server: string;
            let account: string;
            let token: string;
            if (temporary) {
                if (!opts.server || !opts.user || !opts.password) throw new ZentaoError('E1001');
                try {
                    token = await requestToken(opts.server, opts.user, opts.password, {
                        insecure: globalOpts.insecure,
                        timeout: globalOpts.timeout,
                    });
                    server = createClient(opts.server).siteUrl;
                    account = opts.user;
                } catch (error) {
                    throw mapSdkError(error);
                }
            } else {
                const profile = key === undefined ? getCurrentProfile() : findProfileByKey(key);
                if (!profile) throw new ZentaoError(key === undefined ? 'E1006' : 'E1007');
                if (!profile.token.trim()) throw new ZentaoError('E1006');
                ({ server, account, token } = profile);
            }

            if (globalOpts.silent) return;
            if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                console.log(JSON.stringify({ status: 'success', server, account, token }, null, 4));
            } else {
                console.log(token);
            }
        });
}
