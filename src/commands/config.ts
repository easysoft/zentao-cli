import { resolveAuthSource } from '../auth/flow.js';
import { Command } from 'commander';
import { getCurrentProfile, getProfileConfig, setProfileConfig, findProfileByKey, getConfigPath } from '../config/store.js';
import { emitResult } from '../utils/output.js';
import { DEFAULT_CONFIG, VALID_CONFIG_KEYS } from '../config/defaults.js';
import { ZentaoError } from '../errors.js';
import { formatJson } from '../utils/format.js';
import type { GlobalOptions } from '../types/index.js';

const BOOLEAN_CONFIG_KEYS = new Set([
    'insecure', 'htmlToMarkdown', 'batchFailFast', 'jsonPretty',
]);

function invalidConfigValue(key: string, value: string): never {
    throw new ZentaoError('E2004', { field: key, value });
}

function parseConfigValue(key: string, value: string): unknown {
    if (key === 'defaultOutputFormat') {
        return ['table', 'markdown', 'json', 'raw'].includes(value) ? value : invalidConfigValue(key, value);
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

/** Configuration writes patch one field in the selected saved profile. */
export function registerConfigCommand(program: Command): void {
    const config = program.command('config').description('查询配置来源并修改已保存账号的偏好');
    config.action(() => config.outputHelp());
    const selected = (cmd: Command) => {
        try { return resolveAuthSource(cmd.optsWithGlobals().profile).profile; }
        catch (error) {
            if (error instanceof ZentaoError && error.code === '1006') return undefined;
            throw error;
        }
    };
    const check = (key: string) => { if (!VALID_CONFIG_KEYS.includes(key)) throw new ZentaoError('E2004', { field: key, value: '' }); };
    config.command('path').description('显示配置文件路径').action((_opts, cmd: Command) => emitResult({ path: getConfigPath() }, cmd.optsWithGlobals()));
    config.command('list').description('列出有效配置及来源').action((_opts, cmd: Command) => {
        const profile = selected(cmd);
        const values = profile ? getProfileConfig(profile) : DEFAULT_CONFIG;
        emitResult(Object.entries(DEFAULT_CONFIG).map(([key]) => ({ key, value: values[key as keyof typeof values],
            source: profile?.config && Object.hasOwn(profile.config, key) ? 'profile' : 'default' })), cmd.optsWithGlobals());
    });
    config.command('get').argument('<key>').description('查看一个配置项').action((key: string, _opts, cmd: Command) => {
        check(key); const profile = selected(cmd); const values = profile ? getProfileConfig(profile) : DEFAULT_CONFIG;
        emitResult({ key, value: values[key as keyof typeof values], source: profile?.config && Object.hasOwn(profile.config, key) ? 'profile' : 'default' }, cmd.optsWithGlobals());
    });
    config.command('set').argument('<key>').argument('<value>').description('修改一个配置项').action((key: string, value: string, _opts, cmd: Command) => {
        check(key); const parsed = parseConfigValue(key, value); const profile = selected(cmd);
        if (!profile) throw new ZentaoError('E1006');
        setProfileConfig(profile, key, parsed); emitResult({ key, value: parsed, source: 'profile' }, cmd.optsWithGlobals());
    });
    config.command('unset').argument('<key>').description('恢复默认值').action((key: string, _opts, cmd: Command) => {
        check(key); const profile = selected(cmd); if (!profile) throw new ZentaoError('E1006');
        setProfileConfig(profile, key, undefined); emitResult({ key, value: DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG], source: 'default' }, cmd.optsWithGlobals());
    });
}
