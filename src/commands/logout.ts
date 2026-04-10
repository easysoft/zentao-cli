import { Command } from 'commander';
import { removeProfile, getCurrentProfile, profileKey } from '../config/store.js';
import { ZentaoError, formatError } from '../errors.js';
import type { GlobalOptions } from './types.js';

export function registerLogoutCommand(program: Command): void {
    program
        .command('logout')
        .description('退出当前用户登录')
        .argument('[profileKey]', '要退出的用户配置（格式：account@server）')
        .action((key: string | undefined) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                let targetKey: string;
                if (key) {
                    targetKey = key;
                } else {
                    const current = getCurrentProfile();
                    if (!current) throw new ZentaoError('E1006');
                    targetKey = profileKey(current.account, current.server);
                }

                const removed = removeProfile(targetKey);
                if (!removed) {
                    throw new ZentaoError('E1007');
                }

                if (!globalOpts.silent) {
                    console.log(`已退出: ${targetKey}`);
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
