import { Command } from 'commander';
import { getModule } from '../modules/index.js';
import { ZentaoError } from '../errors.js';
import { ensureAuth } from '../auth/flow.js';
import { handleModuleCommand } from './module-handler.js';
import { addDataOptions } from './register-modules.js';
import type { GlobalOptions, ModuleActionOptions, ModuleName, ModuleActionName } from '../types/index.js';
import { renderError } from '../utils/render.js';

/** 注册 `ls` / `get` / `create` / `update` / `delete` / `do` 等通用 CRUD 入口 */
export function registerCrudCommands(program: Command): void {
    // zentao ls <module>
    const lsCmd = program
        .command('ls')
        .alias('list')
        .description('获取对象列表')
        .argument('<module>', '模块名称，例如 bug')
        .argument('[args...]', '参数');
    addDataOptions(lsCmd);
    lsCmd.allowUnknownOption(true);
    lsCmd.action(async (moduleName: string, opts: ModuleActionOptions) => {
        const extraArgs = lsCmd.args.slice(1);
        await runCrudCommand(program, moduleName, 'list', opts, extraArgs);
    });

    // zentao get <module> <id>
    const getCmd = program
        .command('get')
        .description('获取单个对象')
        .argument('<module>', '模块名称，例如 bug')
        .argument('<id>', '对象 ID');
    addDataOptions(getCmd);
    getCmd.action(async (moduleName: string, id: string, opts: ModuleActionOptions) => {
        opts.id = id;
        await runCrudCommand(program, moduleName, 'get', {id, ...opts});
    });

    // zentao create <module>
    const createCmd = program
        .command('create')
        .description('创建对象')
        .argument('<module>', '模块名称，例如 bug')
        .argument('[args...]', '参数');
    addDataOptions(createCmd);
    createCmd.allowUnknownOption(true);
    createCmd.action(async (moduleName: string, args: string[], opts: ModuleActionOptions) => {
        await runCrudCommand(program, moduleName, 'create', opts, args);
    });

    // zentao update <module> [id]
    const updateCmd = program
        .command('update')
        .description('更新对象')
        .argument('<module>', '模块名称，例如 bug')
        .argument('[args...]', '--id 和其他参数');
    addDataOptions(updateCmd);
    updateCmd.allowUnknownOption(true);
    updateCmd.action(async (moduleName: string, args: string[], opts: ModuleActionOptions) => {
        await runCrudCommand(program, moduleName, 'update', opts, args);
    });

    // zentao delete <module> <ids>
    const deleteCmd = program
        .command('delete')
        .description('删除对象')
        .argument('<module>', '模块名称，例如 bug')
        .argument('[args...]', '--id 和其他参数');
    addDataOptions(deleteCmd);
    deleteCmd.allowUnknownOption(true);
    deleteCmd.action(async (moduleName: string, args: string[], opts: ModuleActionOptions) => {
        await runCrudCommand(program, moduleName, 'delete', opts, args);
    });

    // zentao do <module> <action> <id>
    const doCmd = program
        .command('do')
        .description('执行对象操作')
        .argument('<module>', '模块名称，例如 bug')
        .argument('<action>', '操作名称，例如 resolve')
        .argument('[args...]', '--id 和其他参数');
    addDataOptions(doCmd);
    doCmd.allowUnknownOption(true);
    doCmd.action(async (moduleName: string, action: string, args: string[], opts: ModuleActionOptions) => {
        await runCrudCommand(program, moduleName, action, opts, args);
    });
}

/** 校验模块名、完成鉴权后转交给 {@link handleModuleCommand} */
async function runCrudCommand(
    program: Command,
    moduleName: ModuleName,
    actionName: ModuleActionName,
    opts: ModuleActionOptions,
    args: string[] = [],
): Promise<void> {
    const mod = getModule(moduleName);
    if (!mod) {
        throw new ZentaoError('E2001', { module: moduleName });
    }

    const globalOpts = program.opts() as GlobalOptions;
    const options = {...globalOpts, ...opts};
    try {
        const { client, profile } = await ensureAuth({
            insecure: globalOpts.insecure,
            timeout: globalOpts.timeout,
        });

        const firstArg = args[0];
        if (firstArg && !isNaN(Number(firstArg))) {
            options.id = firstArg;
            args.shift();
        }

        await handleModuleCommand(client, mod, actionName, args, profile, options);
    } catch (error) {
        if (error instanceof ZentaoError) {
            console.log(renderError(error, options.format ?? 'markdown'));
            process.exit(1);
        }
        throw error;
    }
}
