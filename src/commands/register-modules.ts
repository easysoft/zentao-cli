import { Command } from 'commander';
import { getModuleNames, getModule } from '../modules/index.js';
import { findAction, getAvailableActions} from '../modules/resolver.js';
import { ensureAuth } from '../auth/flow.js';
import { handleModuleCommand, showModuleActionHelp, showModuleHelp } from './module-handler.js';
import { ZentaoError } from '../errors.js';
import type { GlobalOptions, ModuleActionName, ModuleActionOptions, ModuleActionType } from '../types/index.js';
import { renderError } from '../utils/render.js';

/** 为命令挂载数据查询、分页、过滤及父子上下文等通用选项 */
export function addDataOptions(cmd: Command): Command {
    return cmd
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
        .option('--params <json>', 'API 调用参数')
        .option('--options <json>', 'API 调用选项')
        .option('--yes', '跳过确认')
        .option('--silent', '静默模式')
        .option('--batch-fail-fast', '批量操作出错时停止')
        .option('--id <id>', '对象 ID')
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
    'help', 'ls', 'list', 'get', 'create', 'update', 'delete', 'do', 'autocomplete',
    'mcp', 'add-mcp', 'add-skill', // 保留命令
];

/** 根据内置模块注册表为每个业务模块注册 `zentao <module> ...` 子命令 */
export function registerModuleCommands(program: Command): void {
    for (const name of getModuleNames()) {
        /** 跳过内置命令 */
        if (BUILTIN_COMMANDS.includes(name)) continue;

        const mod = getModule(name)!;
        const actions = getAvailableActions(mod);
        const actionDesc = actions.length > 0 ? ` | 操作: ${actions.join(', ')}` : '';

        const cmd = program
            .command(name)
            .description(`${mod.display ?? name}模块${actionDesc}`)
            .argument('[args...]', '参数')
            .allowUnknownOption(true);

        addDataOptions(cmd);

        cmd.action(async (args: string[], opts: ModuleActionOptions) => {
            const globalOpts = program.opts() as GlobalOptions;
            const options = {...globalOpts, ...opts};
            try {
                const { client, profile } = await ensureAuth({
                    insecure: options.insecure,
                    timeout: options.timeout,
                });

                const firstArg = args.shift();
                if (firstArg === 'help') {
                    showModuleHelp(mod);
                    return;
                }

                let action = firstArg;
                const ids = firstArg?.split(',').map((s) => +s.trim());
                if (ids?.length && ids.every((id) => !isNaN(id))) {
                    options.id = ids.join(',');
                    action = 'get';
                } else if (action === undefined) {
                    action = 'list';
                } else if (action.startsWith('-')) {
                    args.unshift(action);
                    action = 'list';
                }

                if (args[0] === 'help') {
                    const crudAliases: Record<string, string> = { ls: 'list' };
                    const normalizedAction = crudAliases[action as string] ?? (action as string);
                    const crudTypes = new Set(['list', 'get', 'create', 'update', 'delete']);
                    const resolvedAction = crudTypes.has(normalizedAction)
                        ? findAction(mod, normalizedAction as ModuleActionType)
                        : findAction(mod, 'action', action as ModuleActionName);
                    if (resolvedAction) {
                        showModuleActionHelp(mod, resolvedAction);
                        return;
                    }
                    showModuleHelp(mod);
                    return;
                }

                await handleModuleCommand(client, mod, action as ModuleActionName, args, profile, options);
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.log(renderError(error, options.format ?? 'markdown'));
                    process.exit(1);
                }
                throw error;
            }
        });
    }
}
