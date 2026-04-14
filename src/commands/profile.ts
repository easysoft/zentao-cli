import { Command } from 'commander';
import { getAllProfiles, getCurrentProfile, setCurrentProfile, profileKey } from '../config/store.js';
import { ZentaoError, formatError } from '../errors.js';
import type { GlobalOptions } from './types.js';

/** 注册 `zentao profile`：列出或切换 `account@server` 形式的本地 Profile */
export function registerProfileCommand(program: Command): void {
    program
        .command('profile')
        .description('查看或切换用户配置')
        .argument('[profileKey]', '要切换到的用户配置（格式：account@server，例如 admin@https://zentao.example.com）')
        .action((key: string | undefined) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                if (key) {
                    const success = setCurrentProfile(key);
                    if (!success) throw new ZentaoError('E1007');
                    if (!globalOpts.silent) {
                        console.log(`已切换到: ${key}`);
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
                console.log(Bun.markdown.ansi(lines.join('\n')));
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.error(formatError(error, globalOpts.format ?? 'markdown'));
                    process.exit(1);
                }
                throw error;
            }
        });
}
