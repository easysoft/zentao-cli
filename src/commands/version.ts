import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCurrentProfile, getProfileConfig, profileKey } from '../config/store.js';
import type { GlobalOptions } from './types.js';

/** 从当前工作目录的 `package.json` 读取 CLI 版本（开发与本地运行场景） */
function getCliVersion(): string {
    try {
        // Try multiple paths for development vs built mode
        const paths = [
            join(process.cwd(), 'package.json'),
        ];
        for (const p of paths) {
            try {
                const pkg = JSON.parse(readFileSync(p, 'utf-8'));
                return pkg.version ?? 'unknown';
            } catch { continue; }
        }
        return 'unknown';
    } catch {
        return 'unknown';
    }
}

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
