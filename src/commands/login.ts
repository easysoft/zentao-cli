import { Command } from 'commander';
import { login, getEnvCredentials } from '../auth/login.js';
import { promptLogin } from '../auth/prompt.js';
import { saveProfile, profileKey, getProfile, buildProfile } from '../config/store.js';
import { ZentaoError, formatError } from '../errors.js';
import type { Profile } from '../types/index.js';
import type { GlobalOptions } from './types.js';

export function registerLoginCommand(program: Command): void {
    program
        .command('login')
        .description('登录禅道服务')
        .option('-s, --server <url>', '禅道服务地址')
        .option('-u, --user <account>', '用户名')
        .option('-p, --password <password>', '密码')
        .option('-t, --token <token>', 'Token')
        .option('--useEnv', '强制使用环境变量登录')
        .action(async (opts) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
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
                } else if (opts.server && opts.user && (opts.password || opts.token)) {
                    server = opts.server;
                    account = opts.user;
                    password = opts.password ?? '';
                    token = opts.token ?? '';
                } else {
                    const prompted = await promptLogin();
                    server = prompted.url;
                    account = prompted.account;
                    password = prompted.password;
                    token = prompted.token;
                }

                if (!server || !account || (!password && !token)) {
                    throw new ZentaoError('E1001');
                }

                const oldProfile = getProfile(account, server);
                let profile: Profile;
                if (token) {
                    profile = buildProfile(server, account, token, undefined, oldProfile);
                } else {
                    const result = await login(server, account, password, {
                        insecure: globalOpts.insecure,
                        timeout: globalOpts.timeout,
                    });

                    profile = buildProfile(server, account, result.token, result.user, oldProfile);
                }

                saveProfile(profile);

                if (!globalOpts.silent) {
                    console.log(`登录成功: ${profileKey(account, server)}`);
                }
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.error(formatError(error, globalOpts.format ?? 'markdown'));
                    process.exit(1);
                }
                throw error;
            }
        });
}
