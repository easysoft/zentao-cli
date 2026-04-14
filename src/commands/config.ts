import { Command } from 'commander';
import { getCurrentProfile, getProfileConfig, setProfileConfig } from '../config/store.js';
import { VALID_CONFIG_KEYS } from '../config/defaults.js';
import { ZentaoError, formatError } from '../errors.js';
import { formatJson } from '../utils/format';
import type { GlobalOptions } from '../types/index.js';

/** 注册 `zentao config get|set`：读写当前 Profile 下的用户偏好 */
export function registerConfigCommand(program: Command): void {
    const configCmd = program
        .command('config')
        .description('管理用户配置');

    configCmd
        .command('get')
        .description('查看配置')
        .argument('[key]', '配置项名称')
        .action((key: string | undefined) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                const profile = getCurrentProfile();
                if (!profile) throw new ZentaoError('E1006');

                const config = getProfileConfig(profile);

                if (key) {
                    if (!VALID_CONFIG_KEYS.includes(key)) {
                        throw new ZentaoError('E2004', { field: key, value: '' });
                    }
                    const value = config[key as keyof typeof config];
                    if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                        console.log(formatJson({ [key]: value }));
                    } else {
                        console.log(typeof value === 'object' ? formatJson(value) : String(value));
                    }
                    return;
                }

                if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                    console.log(formatJson(config));
                } else {
                    for (const [k, v] of Object.entries(config)) {
                        console.log(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : JSON.stringify(v)}`);
                    }
                }
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.error(formatError(error, globalOpts.format ?? 'markdown'));
                    process.exit(1);
                }
                throw error;
            }
        });

    configCmd
        .command('set')
        .description('设置配置')
        .argument('<key>', '配置项名称')
        .argument('<value>', '配置值')
        .action((key: string, value: string) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                const profile = getCurrentProfile();
                if (!profile) throw new ZentaoError('E1006');

                if (!VALID_CONFIG_KEYS.includes(key)) {
                    throw new ZentaoError('E2004', { field: key, value });
                }

                let parsed: unknown = value;
                if (value === 'true') parsed = true;
                else if (value === 'false') parsed = false;
                else if (/^\d+$/.test(value)) parsed = Number(value);
                else {
                    try { parsed = JSON.parse(value); } catch { /* keep as string */ }
                }

                setProfileConfig(profile, key, parsed);

                if (!globalOpts.silent) {
                    console.log(`已设置 ${key} = ${JSON.stringify(parsed)}`);
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
