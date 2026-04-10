import { Command } from 'commander';
import { getModuleNames, getModule } from '../modules/registry.js';
import { getAvailableActions } from '../modules/resolver.js';
import { ensureAuth } from '../auth/flow.js';
import { resolveOperation, handleModuleCommand } from './module-handler.js';
import { ZentaoError, formatError } from '../errors.js';
import type { GlobalOptions, DataOptions } from './types.js';

export function addDataOptions(cmd: Command): Command {
    return cmd
        .option('--format <format>', '输出格式 (markdown|json|raw)')
        .option('--pick <fields>', '摘取指定字段（逗号分隔）')
        .option('--filter <expr>', '过滤条件', collect, [])
        .option('--sort <expr>', '排序条件')
        .option('--search <keywords>', '搜索关键词', collect, [])
        .option('--search-fields <fields>', '搜索字段（逗号分隔）')
        .option('--page <number>', '页码')
        .option('--recPerPage <number>', '每页条数')
        .option('--all', '获取全部数据')
        .option('--limit <number>', '限制获取数量')
        .option('--data <json>', 'JSON 数据')
        .option('--yes', '跳过确认')
        .option('--silent', '静默模式')
        .option('--batch-fail-fast', '批量操作出错时停止')
        .option('--product <id>', '产品 ID')
        .option('--project <id>', '项目 ID')
        .option('--execution <id>', '执行 ID');
}

function collect(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}

const BUILTIN_COMMANDS = [
    'login', 'logout', 'profile', 'config', 'workspace', 'version',
    'help', 'ls', 'get', 'create', 'update', 'delete', 'do', 'autocomplete',
];

export function registerModuleCommands(program: Command): void {
    for (const name of getModuleNames()) {
        if (BUILTIN_COMMANDS.includes(name)) continue;

        const mod = getModule(name)!;
        const actions = getAvailableActions(mod);
        const actionDesc = actions.length > 0 ? ` | 操作: ${actions.join(', ')}` : '';

        const cmd = program
            .command(name)
            .description(`${name} 模块${actionDesc}`)
            .argument('[args...]', '参数')
            .allowUnknownOption(true);

        addDataOptions(cmd);

        cmd.action(async (args: string[], opts: DataOptions) => {
            const globalOpts = program.opts() as GlobalOptions;
            const format = opts.format ?? globalOpts.format ?? 'markdown';

            try {
                const { client, profile } = await ensureAuth({
                    insecure: globalOpts.insecure,
                    timeout: globalOpts.timeout,
                });

                const operation = resolveOperation(mod, args);

                if (args[0] === 'help') {
                    showModuleHelp(mod);
                    return;
                }

                // Collect unknown options as extra args for body building
                const knownOpts = new Set([
                    'format', 'pick', 'filter', 'sort', 'search', 'searchFields',
                    'page', 'recPerPage', 'all', 'limit', 'data', 'yes', 'silent',
                    'batchFailFast', 'product', 'project', 'execution',
                ]);
                const extraArgs = cmd.args.filter((a: string) =>
                    a.startsWith('--') && !knownOpts.has(a.replace(/^--/, '').replace(/=.*/, '')),
                );

                await handleModuleCommand(client, mod, profile, operation, { ...opts, format }, extraArgs);
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.error(formatError(error, format));
                    process.exit(1);
                }
                throw error;
            }
        });
    }
}

function showModuleHelp(mod: ReturnType<typeof getModule>): void {
    if (!mod) return;
    const actions = getAvailableActions(mod);

    console.log(`模块: ${mod.name}`);
    console.log(`\n操作:`);
    if (mod.operations.includes('list')) console.log(`  zentao ${mod.name}                    获取列表`);
    if (mod.operations.includes('get')) console.log(`  zentao ${mod.name} <id>               获取详情`);
    if (mod.operations.includes('create')) console.log(`  zentao ${mod.name} create [params]    创建`);
    if (mod.operations.includes('update')) console.log(`  zentao ${mod.name} update <id>        更新`);
    if (mod.operations.includes('delete')) console.log(`  zentao ${mod.name} delete <ids>       删除`);

    if (actions.length > 0) {
        console.log(`\n扩展操作:`);
        for (const action of actions) {
            console.log(`  zentao ${mod.name} ${action} <id>     ${action}`);
        }
    }

    if (mod.listScopes.length > 0) {
        console.log(`\n上下文参数:`);
        for (const scope of mod.listScopes) {
            console.log(`  --${scope.parent} <id>`);
        }
    }
}
