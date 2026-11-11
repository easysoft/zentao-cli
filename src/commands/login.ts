import { brandText } from '../brand.js';
import { Command } from 'commander';
import { login, getEnvCredentials, verifyToken } from '../auth/login.js';
import { promptLogin } from '../auth/prompt.js';
import { saveProfile, profileKey, setCurrentProfile, buildProfile, normalizeServerUrl } from '../config/store.js';
import { ZentaoError } from '../errors.js';
import type { Profile } from '../types/index.js';
import type { GlobalOptions } from '../types/index.js';
import { createClient, withRequestSignal } from '../api/index.js';
import { browserLogin } from '../auth/browser-login.js';
import { commandSignal } from '../utils/lifecycle.js';
import { emitResult } from '../utils/output.js';
import { canOpenBrowser } from '../auth/browser-open.js';

/** Register login with browser, terminal, explicit credential, and environment modes. */
export function registerLoginCommand(program: Command): void {
    program
        .command('login')
        .description(brandText('登录禅道服务'))
        .option('-s, --server <url>', brandText('禅道服务地址'))
        .option('-u, --user <account>', '用户名')
        .option('-p, --password <password>', '密码')
        .option('-t, --token <token>', 'Token')
        .option('--use-env', '强制使用环境变量登录')
        .option('--web', '通过本机浏览器页面登录')
        .option('--no-open', '仅输出浏览器登录链接，由调用方打开（需 --web）')
        .option('--select', '登录成功后将该账号设为当前配置', program.parent ? undefined : true)
        .option('--message <text>', '自定义浏览器登录页面的副标题提示语')
        .option('--no-browser', '使用终端交互登录，不打开浏览器')
        .action(async (opts) => {
            const globalOpts = program.optsWithGlobals() as GlobalOptions;
            if (opts.open === false && !opts.web) {
                throw new ZentaoError('E2009', { option: '--no-open', reason: '必须与 --web 一起使用' });
            }
            if (opts.web && (opts.browser === false || opts.useEnv || opts.password !== undefined || opts.token !== undefined)) {
                throw new ZentaoError('E2009', {
                    option: '--web',
                    reason: '不能与 --no-browser、--useEnv、--password 或 --token 同时使用',
                });
            }
            if (globalOpts.input === false && (opts.web || (!opts.useEnv && !(opts.server && opts.user && (opts.password || opts.token))))) {
                throw new ZentaoError('E2009', { option: 'no-input', reason: '禁止交互时必须提供完整凭据或 --use-env' });
            }
            const fullCredentials = opts.server && opts.user && (opts.password || opts.token);
            if (!opts.useEnv && !fullCredentials && (opts.password !== undefined || opts.token !== undefined)) {
                throw new ZentaoError('E1001');
            }
            const desktop = canOpenBrowser();
            if (opts.web || (!opts.useEnv && !fullCredentials && opts.browser !== false && desktop)) {
                const profile = await browserLogin({
                    server: opts.server,
                    account: opts.user,
                    message: opts.message,
                    insecure: globalOpts.insecure,
                    timeout: globalOpts.timeout,
                    signal: commandSignal(),
                    open: opts.open !== false && desktop,
                    fallbackToTerminal: !opts.web && Boolean(process.stdin.isTTY),
                });
                if (profile) {
                    const key = profileKey(profile.account, profile.server);
                    if (opts.select) setCurrentProfile(key);
                    emitResult({ saved: key, selected: Boolean(opts.select) }, globalOpts);
                    return;
                }
            }
            let server: string;
            let account: string;
            let password: string;
            let token: string;

            if (opts.useEnv) {
                const env = getEnvCredentials();
                if (!env.url || !env.account || (!env.password && !env.token)) {
                    throw new ZentaoError('E1001');
                }
                server = env.url;
                account = env.account;
                password = env.password ?? '';
                token = env.token ?? '';
            } else if (fullCredentials) {
                server = opts.server;
                account = opts.user;
                password = opts.password ?? '';
                token = opts.token ?? '';
            } else {
                if (!process.stdin.isTTY) throw new ZentaoError('E1006');
                const prompted = await promptLogin();
                server = prompted.url;
                account = prompted.account;
                password = prompted.password;
                token = prompted.token;
            }

            if (!server || !account || (!password && !token)) {
                throw new ZentaoError('E1001');
            }

            server = normalizeServerUrl(server);
            let profile: Profile;
            if (token) {
                // 检查 token 是否有效
                const client = createClient(server, token, {
                    insecure: globalOpts.insecure,
                    timeout: globalOpts.timeout,
                });
                const { serverConfig, user } = await verifyToken(withRequestSignal(client, commandSignal()), account);
                profile = buildProfile(server, account, token, serverConfig, user);
            } else {
                const result = await login(server, account, password, {
                    insecure: globalOpts.insecure,
                    timeout: globalOpts.timeout,
                    signal: commandSignal(),
                });

                profile = buildProfile(server, account, result.token, result.serverConfig, result.user);
            }

            saveProfile(profile);
            const key = profileKey(account, server);
            if (opts.select) setCurrentProfile(key);
            emitResult({ saved: key, selected: Boolean(opts.select) }, globalOpts);
        });
}
