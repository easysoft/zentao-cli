import { Command } from 'commander';
import { getCurrentProfile } from '../config/store.js';
import type { GlobalOptions } from '../types/index.js';
import { getCliVersion } from '../utils/version.js';

/** 注册 `zentao version`：输出 CLI 与当前 Profile 指向的服务器 */
export function registerVersionCommand(program: Command): void {
    program
        .command('version')
        .description('显示版本信息')
        .action(() => {
            const globalOpts = program.opts() as GlobalOptions;
            const version = getCliVersion();

            if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                const result: Record<string, unknown> = { cli: `zentao-cli ${version}` };
                const profile = getCurrentProfile();
                if (profile) {
                    result.server = profile.server;
                }
                console.log(JSON.stringify(result, null, 4));
                return;
            }

            console.log(`Zentao CLI: ${version}`);
            const profile = getCurrentProfile();
            if (profile) {
                console.log(`Zentao Server: ${profile.serverConfig?.version ? profile.serverConfig.version.toUpperCase() : 'Unknown'} (${profile.server})`);
            }
        });
}
