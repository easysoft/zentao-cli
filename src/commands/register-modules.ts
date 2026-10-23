import { Command, Option } from 'commander';
import { getModuleNames, getModule } from '../modules/index.js';
import { getScopeAliasTarget } from '../mcp/params.js';
import { actionContract, actionParameters, kebabCase, paginationFields } from '../modules/contract.js';
import { prepareCliParams } from '../modules/cli-input.js';
import { ensureAuth } from '../auth/flow.js';
import { handleModuleCommand, showModuleProps } from './module-handler.js';
import type { GlobalOptions, ModuleActionName, ModuleActionOptions } from '../types/index.js';

/** 为命令挂载数据查询、分页、过滤及父子上下文等通用选项 */
export function addDataOptions(cmd: Command): Command {
    return cmd
        .option('--pick <fields>', '摘取指定字段（逗号分隔）')
        .option('--filter <expr>', '过滤条件（组内 AND，多次指定为 OR）', collect, [])
        .option('--sort <expr>', '排序条件（如 pri:desc,id:asc）')
        .option('--search <keywords>', '搜索关键词（组内 AND，多次指定为 OR）', collect, [])
        .option('--search-fields <fields>', '搜索字段（逗号分隔）')
        .option('--page <number>', '页码')
        .option('--recPerPage <number>', '每页条数')
        .option('--all', '尚未支持自动翻页，请使用 --page 和 --recPerPage')
        .option('--limit <number>', '限制获取数量')
        .option('--data <json>', 'JSON 数据')
        .option('--params <json>', 'API 调用参数')
        .option('--yes', '跳过确认')
        .option('--silent', '静默模式')
        .option('--batch-fail-fast', '批量操作出错时停止')
        .option('--id <id>', '对象 ID')
        .option('--ids <ids>', '批量对象 ID（逗号分隔；仅支持对象操作）')
        .option('--product <id>', '产品 ID')
        .option('--project <id>', '项目 ID')
        .option('--execution <id>', '执行 ID');
}

/** Commander 的 `collect` 回调：将多次出现的选项累积为数组 */
function collect(value: string, previous: string[] = []): string[] {
    return previous.concat([value]);
}

/** SDK actions are real commands; unknown options are rejected by Commander. */
export function registerModuleCommands(program: Command): void {
    for (const name of getModuleNames()) {
        const mod = getModule(name)!;
        const resource = program.command(name).description(mod.display ?? name);
        resource.action(() => resource.outputHelp());
        resource.command('props').description('返回对象字段定义（离线）').action((_options, command: Command) => {
            showModuleProps(mod, command.optsWithGlobals());
        });
        for (const action of mod.actions) {
            const contract = actionContract(mod, action);
            const cmd = resource.command(kebabCase(action.name))
                .description(`${action.display ?? action.name}（最低版本：${action.minVersion.join(' / ')}）`);
            if (contract.target) cmd.argument('[target]', `单个 ${contract.target}；也可使用命名参数`);
            const mappings: Array<{ name: string; attribute: string }> = [];
            const pagination = paginationFields(mod, action);
            const reserved = new Set(pagination ? [pagination.page.name, pagination.size.name] : []);
            for (const param of actionParameters(mod, action)) {
                if (reserved.has(param.name) || mappings.some(item => item.name === param.name)) continue;
                const flag = kebabCase(param.name);
                const option = new Option(`--${flag} ${param.type === 'boolean' ? '[boolean]' : '<value>'}`,
                    `${param.description ?? param.name}${param.required ? '（必填）' : ''}`);
                if (param.type === 'array') option.argParser((value: string, previous: string[] = []) => previous.concat(value));
                if (param.type === 'boolean') option.preset(true);
                cmd.addOption(option);
                mappings.push({ name: param.name, attribute: option.attributeName() });
                if (param.type === 'boolean') cmd.addOption(new Option(`--no-${flag}`, `将 ${param.name} 设为 false`).default(undefined));
            }
            for (const scope of ['product', 'project', 'execution']) {
                if (!getScopeAliasTarget(mod, action, scope) || mappings.some(item => item.name === scope)) continue;
                const option = new Option(`--${scope} <id>`, `${scope}ID 或 scope/scopeID 别名`);
                cmd.addOption(option);
                mappings.push({ name: scope, attribute: option.attributeName() });
            }
            if (action.requestBody) cmd.option('--data <json|@file|@->', 'JSON 对象、文件或显式标准输入');
            if (contract.batch) cmd.option('--ids <ids>', '批量目标 ID，逗号分隔并去重').option('--batch-fail-fast', '失败后跳过剩余目标');
            if (action.type === 'delete') cmd.option('--yes', '确认删除');
            if (action.type === 'list' || action.type === 'get') cmd.option('--fields <fields>', '返回字段，逗号分隔').option('--html-to-markdown', '显式将富文本字段转换为 Markdown');
            if (action.type === 'list') {
                cmd.option('--max-items <number>', '整次命令最多返回条数');
                cmd.option('--filter <expr>', '当前获取范围内过滤；组内 AND，多次指定为 OR', collect);
                cmd.option('--search <keywords>', '当前获取范围内搜索', collect);
                cmd.option('--search-fields <fields>', '本地搜索字段');
                cmd.option('--sort <expr>', '当前获取范围内排序，如 id:asc');
            }
            if (pagination) cmd.option('--page <number>', '指定页，从 1 开始')
                .option('--page-size <number>', '每次服务端请求的页大小').option('--all', '显式遍历全部页面');
            cmd.action(async (...args: unknown[]) => {
                const command = args.at(-1) as Command;
                const parsed = command.optsWithGlobals();
                const options: ModuleActionOptions = { ...parsed, pick: parsed.fields, recPerPage: parsed.pageSize };
                const values = Object.fromEntries(mappings.map(item => [item.name, parsed[item.attribute]]));
                const params = await prepareCliParams(mod, action, contract.target ? args[0] as string | undefined : undefined, options, values);
                const { client, profile } = await ensureAuth(options);
                await handleModuleCommand(client, mod, action.name, [], profile, options, params);
            });
        }
    }
}
