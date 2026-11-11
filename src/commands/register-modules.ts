import { isDeepStrictEqual } from 'node:util';
import { ZentaoError } from '../errors.js';
import { Command, Option } from 'commander';
import { getModuleNames, getModule } from '../modules/index.js';
import { getScopeAliasTarget } from '../mcp/params.js';
import { actionContract, actionParameters, kebabCase, parameterFlag, paginationFields } from '../modules/contract.js';
import { parseCliValue, prepareCliParams } from '../modules/cli-input.js';
import { ensureAuth } from '../auth/flow.js';
import { handleModuleCommand, showModuleProps } from './module-handler.js';
import type { GlobalOptions, ModuleActionName, ModuleActionOptions } from '../types/index.js';

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
                const flag = parameterFlag(param.name).slice(2);
                const option = new Option(`--${flag} ${param.type === 'boolean' ? '[boolean]' : '<value>'}`,
                    `${param.description ?? param.name}${param.required ? '（必填）' : ''}`);
                if (param.type === 'array') option.argParser((value: string, previous: string[] = []) => previous.concat(value));
                if (param.type === 'boolean') option.preset(true);
                cmd.addOption(option);
                mappings.push({ name: param.name, attribute: option.attributeName() });
                if (param.type === 'boolean') cmd.addOption(new Option(`--no-${flag}`, `将 ${param.name} 设为 false`).default(undefined));
                if (param.type !== 'array') {
                    let previous: unknown;
                    const checkDuplicate = () => {
                        const value = parseCliValue(cmd.getOptionValue(option.attributeName()), param);
                        if (previous !== undefined && !isDeepStrictEqual(previous, value)) {
                            throw new ZentaoError('E2009', { option: flag, reason: '重复选项的输入值冲突' });
                        }
                        previous = value;
                    };
                    cmd.on(`option:${option.name()}`, checkDuplicate);
                    if (param.type === 'boolean') cmd.on(`option:no-${flag}`, checkDuplicate);
                }
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
