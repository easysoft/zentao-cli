import { Command } from 'commander';
import { getAllProfiles, getCurrentProfile, setCurrentProfile, profileKey, getConfigPath } from '../config/store.js';
import { resolveAuthSource } from '../auth/flow.js';
import { ZentaoError } from '../errors.js';
import type { GlobalOptions } from '../types/index.js';
import { renderMarkdown } from '../utils/render.js';

/** 注册 `zentao profile`：列出或切换 `account@server` 形式的本地 Profile */
export function registerProfileCommand(program: Command): void {
    program
        .command('profile')
        .description('查看或切换用户配置')
        .argument('[profileKey]', '要切换到的用户配置（格式：account@server，例如 admin@https://zentao.example.com）')
        .option('--effective', '显示业务命令实际使用的认证来源（不验证凭据）')
        .action((key: string | undefined, options: { effective?: boolean }) => {
            const globalOpts = program.opts() as GlobalOptions;
            if (options.effective) {
                if (key) throw new ZentaoError('E2009', { option: '--effective', reason: '不能与切换账号同时使用' });
                const auth = resolveAuthSource();
                const result = {
                    status: 'success',
                    source: auth.source,
                    server: auth.server,
                    account: auth.account,
                    credentialType: auth.token ? 'token' : 'password',
                    configFile: auth.source === 'profile' ? getConfigPath() : null,
                    verified: false,
                };
                if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                    console.log(JSON.stringify(result, null, 4));
                } else {
                    console.log(renderMarkdown([
                        `* 认证来源: ${result.source === 'environment' ? '环境变量' : '本地 Profile'}`,
                        `* 禅道地址: ${result.server}`,
                        `* 账号: ${result.account}`,
                        `* 凭据类型: ${result.credentialType === 'token' ? 'Token' : '密码'}`,
                        `* 配置文件: ${result.configFile ?? '未使用'}`,
                        '* 凭据尚未进行网络验证',
                    ].join('\n')));
                }
                return;
            }
            if (key) {
                const success = setCurrentProfile(key);
                if (!success) throw new ZentaoError('E1007');
                if (!globalOpts.silent) {
                    console.log(renderMarkdown(`已切换到: \`${key}\``));
                }
                return;
            }

            const profiles = getAllProfiles();
            if (profiles.length === 0) {
                throw new ZentaoError('E1006');
            }

            const current = getCurrentProfile();
            const currentKey = current ? profileKey(current.account, current.server) : '';

            if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                console.log(JSON.stringify({
                    status: 'success',
                    currentProfile: currentKey,
                    profiles: profiles.map((p) => ({
                        key: profileKey(p.account, p.server),
                        server: p.server,
                        account: p.account,
                        current: profileKey(p.account, p.server) === currentKey,
                    })),
                }, null, 4));
                return;
            }

            const lines = profiles.map((p) => {
                const pKey = profileKey(p.account, p.server);
                const parts = [pKey];
                if (p.serverConfig) {
                    parts.push(` (${p.serverConfig.version.toUpperCase()})`);
                }
                if (pKey === currentKey) {
                    parts.push(' **[当前]**');
                }
                return `* ${parts.join('')}`;
            });
            console.log(renderMarkdown(lines.join('\n')));
        });
}
