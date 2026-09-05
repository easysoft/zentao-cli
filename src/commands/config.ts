import { Command } from 'commander';
import { getCurrentProfile, getProfileConfig, setProfileConfig } from '../config/store.js';
import { VALID_CONFIG_KEYS } from '../config/defaults.js';
import { ZentaoError } from '../errors.js';
import { formatJson } from '../utils/format.js';
import type { GlobalOptions } from '../types/index.js';

const BOOLEAN_CONFIG_KEYS = new Set([
    'insecure', 'htmlToMarkdown', 'batchFailFast', 'silent', 'jsonPretty',
]);

function invalidConfigValue(key: string, value: string): never {
    throw new ZentaoError('E2004', { field: key, value });
}

function parseConfigValue(key: string, value: string): unknown {
    if (key === 'defaultOutputFormat') {
        return ['markdown', 'json', 'raw'].includes(value) ? value : invalidConfigValue(key, value);
    }
    if (BOOLEAN_CONFIG_KEYS.has(key)) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return invalidConfigValue(key, value);
    }
    if (key === 'timeout' || key === 'defaultRecPerPage') {
        const number = Number(value);
        const valid = Number.isInteger(number) && number > 0
            && (key !== 'defaultRecPerPage' || number <= 1000);
        return valid ? number : invalidConfigValue(key, value);
    }
    if (key === 'pagers') {
        try {
            const pagers = JSON.parse(value) as unknown;
            if (
                pagers && typeof pagers === 'object' && !Array.isArray(pagers)
                && Object.values(pagers).every((size) => typeof size === 'number' && Number.isInteger(size) && size > 0 && size <= 1000)
            ) {
                return pagers;
            }
        } catch {
            // Fall through to the common config error.
        }
        return invalidConfigValue(key, value);
    }
    return invalidConfigValue(key, value);
}

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
                    console.log(`${k}: ${JSON.stringify(v)}`);
                }
            }
        });

    configCmd
        .command('set')
        .description('设置配置')
        .argument('<key>', '配置项名称')
        .argument('<value>', '配置值')
        .action((key: string, value: string) => {
            const globalOpts = program.opts() as GlobalOptions;
            const profile = getCurrentProfile();
            if (!profile) throw new ZentaoError('E1006');

            if (!VALID_CONFIG_KEYS.includes(key)) {
                throw new ZentaoError('E2004', { field: key, value });
            }

            const parsed = parseConfigValue(key, value);

            setProfileConfig(profile, key, parsed);

            if (!globalOpts.silent) {
                console.log(`已设置 ${key} = ${JSON.stringify(parsed)}`);
            }
        });
}
