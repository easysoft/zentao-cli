import { Command } from 'commander';
import { getModuleNames, getModule } from '../modules/index.js';
import { getAvailableActions, findAction, hasActionType } from '../modules/resolver.js';
import { ensureAuth } from '../auth/flow.js';
import { resolveOperation, handleModuleCommand } from './module-handler.js';
import { ZentaoError, formatError } from '../errors.js';
import type { ModuleDefinition } from '../types/index.js';
import type { GlobalOptions, DataOptions } from '../types/index.js';

/** 为命令挂载数据查询、分页、过滤及父子上下文等通用选项 */
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

/** Commander 的 `collect` 回调：将多次出现的选项累积为数组 */
function collect(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}

/** 内置模块命令列表 */
const BUILTIN_COMMANDS = [
    'login', 'logout', 'profile', 'config', 'workspace', 'version',
    'help', 'ls', 'get', 'create', 'update', 'delete', 'do', 'autocomplete',
];

/** 根据内置模块注册表为每个业务模块注册 `zentao <module> ...` 子命令 */
export function registerModuleCommands(program: Command): void {
    for (const name of getModuleNames()) {
        if (BUILTIN_COMMANDS.includes(name)) continue;

        const mod = getModule(name)!;
        const actions = getAvailableActions(mod);
        const actionDesc = actions.length > 0 ? ` | 操作: ${actions.join(', ')}` : '';

        const cmd = program
            .command(name)
            .description(`${mod.display ?? name} 模块${actionDesc}`)
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

                if (args[0] === 'help') {
                    showModuleHelp(mod);
                    return;
                }

                const operation = resolveOperation(mod, args);

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

/** 打印模块级内建帮助（与 `zentao <module> help` 对应） */
function showModuleHelp(mod: ModuleDefinition): void {
    console.log(`模块: ${mod.display ?? mod.name}`);
    if (mod.description) console.log(`描述: ${mod.description}`);

    console.log(`\n操作:`);
    if (hasActionType(mod, 'list')) console.log(`  zentao ${mod.name}                    获取列表`);
    if (hasActionType(mod, 'get')) console.log(`  zentao ${mod.name} <id>               获取详情`);
    if (hasActionType(mod, 'create')) console.log(`  zentao ${mod.name} create [params]    创建`);
    if (hasActionType(mod, 'update')) console.log(`  zentao ${mod.name} update <id>        更新`);
    if (hasActionType(mod, 'delete')) console.log(`  zentao ${mod.name} delete <ids>       删除`);

    const actions = getAvailableActions(mod);
    if (actions.length > 0) {
        console.log(`\n扩展操作:`);
        for (const actionName of actions) {
            const action = findAction(mod, 'action', actionName);
            const display = action?.display ?? actionName;
            console.log(`  zentao ${mod.name} ${actionName} <id>     ${display}`);
        }
    }

    const listAction = findAction(mod, 'list');
    if (listAction?.pathParams) {
        const scopeParams = Object.entries(listAction.pathParams)
            .filter(([key]) => key !== 'scope' && key !== 'scopeID');
        const hasScopePattern = 'scope' in listAction.pathParams;

        if (hasScopePattern || scopeParams.length > 0) {
            console.log(`\n上下文参数:`);
            if (hasScopePattern) {
                const scopeDef = listAction.pathParams.scope;
                if (typeof scopeDef === 'object' && scopeDef.options) {
                    for (const opt of scopeDef.options) {
                        const singular = String(opt.value).replace(/s$/, '');
                        console.log(`  --${singular} <id>          ${opt.label}`);
                    }
                } else {
                    console.log(`  --product <id>          产品`);
                    console.log(`  --project <id>          项目`);
                    console.log(`  --execution <id>        执行`);
                }
            }
            for (const [key, def] of scopeParams) {
                const desc = typeof def === 'string' ? def : def.description ?? key;
                console.log(`  --${key} <id>          ${desc}`);
            }
        }
    }
}
