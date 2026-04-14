import { Command } from 'commander';
import { getModule } from '../modules/registry.js';
import { ZentaoError, formatError } from '../errors.js';
import { ensureAuth } from '../auth/flow.js';
import { handleModuleCommand } from './module-handler.js';
import { addDataOptions } from './register-modules.js';
import type { GlobalOptions, DataOptions } from '../types/index.js';

/** 注册 `ls` / `get` / `create` / `update` / `delete` / `do` 等通用 CRUD 入口 */
export function registerCrudCommands(program: Command): void {
    // zentao ls <module>
    const lsCmd = program
        .command('ls')
        .description('获取对象列表')
        .argument('<module>', '模块名称');
    addDataOptions(lsCmd);
    lsCmd.action(async (moduleName: string, opts: DataOptions) => {
        await runCrudCommand(program, moduleName, { type: 'list' }, opts, []);
    });

    // zentao get <module> <id>
    const getCmd = program
        .command('get')
        .description('获取单个对象')
        .argument('<module>', '模块名称')
        .argument('<id>', '对象 ID');
    addDataOptions(getCmd);
    getCmd.action(async (moduleName: string, id: string, opts: DataOptions) => {
        await runCrudCommand(program, moduleName, { type: 'get', objectId: id }, opts, []);
    });

    // zentao create <module>
    const createCmd = program
        .command('create')
        .description('创建对象')
        .argument('<module>', '模块名称');
    addDataOptions(createCmd);
    createCmd.allowUnknownOption(true);
    createCmd.action(async (moduleName: string, opts: DataOptions, cmd: Command) => {
        const extraArgs = cmd.args.slice(1);
        await runCrudCommand(program, moduleName, { type: 'create' }, opts, extraArgs);
    });

    // zentao update <module> [id]
    const updateCmd = program
        .command('update')
        .description('更新对象')
        .argument('<module>', '模块名称')
        .argument('[id]', '对象 ID');
    addDataOptions(updateCmd);
    updateCmd.allowUnknownOption(true);
    updateCmd.action(async (moduleName: string, id: string | undefined, opts: DataOptions, cmd: Command) => {
        const extraArgs = cmd.args.slice(id ? 2 : 1);
        await runCrudCommand(program, moduleName, { type: 'update', objectId: id }, opts, extraArgs);
    });

    // zentao delete <module> <ids>
    const deleteCmd = program
        .command('delete')
        .description('删除对象')
        .argument('<module>', '模块名称')
        .argument('<ids>', '对象 ID（多个用逗号分隔）');
    addDataOptions(deleteCmd);
    deleteCmd.action(async (moduleName: string, ids: string, opts: DataOptions) => {
        await runCrudCommand(program, moduleName, { type: 'delete', objectId: ids }, opts, []);
    });

    // zentao do <module> <action> <id>
    const doCmd = program
        .command('do')
        .description('执行对象操作')
        .argument('<module>', '模块名称')
        .argument('<action>', '操作名称')
        .argument('<id>', '对象 ID');
    addDataOptions(doCmd);
    doCmd.allowUnknownOption(true);
    doCmd.action(async (moduleName: string, action: string, id: string, opts: DataOptions, cmd: Command) => {
        const extraArgs = cmd.args.slice(3);
        await runCrudCommand(program, moduleName, { type: 'action', actionName: action, objectId: id }, opts, extraArgs);
    });
}

/** 校验模块名、完成鉴权后转交给 {@link handleModuleCommand} */
async function runCrudCommand(
    program: Command,
    moduleName: string,
    operation: { type: string; objectId?: string; actionName?: string },
    opts: DataOptions,
    extraArgs: string[],
): Promise<void> {
    const globalOpts = program.opts() as GlobalOptions;
    const format = opts.format ?? globalOpts.format ?? 'markdown';

    try {
        const mod = getModule(moduleName);
        if (!mod) throw new ZentaoError('E2001', { module: moduleName });

        const { client, profile } = await ensureAuth({
            insecure: globalOpts.insecure,
            timeout: globalOpts.timeout,
        });

        await handleModuleCommand(client, mod, profile, operation as any, { ...opts, format }, extraArgs);
    } catch (error) {
        if (error instanceof ZentaoError) {
            console.error(formatError(error, format));
            process.exit(1);
        }
        throw error;
    }
}
