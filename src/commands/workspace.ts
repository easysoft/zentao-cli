import { Command } from 'commander';
import { getCurrentProfile } from '../config/store.js';
import { getCurrentWorkspace, listWorkspaces, setCurrentWorkspace, getWorkspaceById } from '../config/workspace.js';
import { ZentaoError, formatError } from '../errors.js';
import { formatTable, formatList, formatJson } from '../utils/format.js';
import type { Workspace } from '../types/index.js';
import type { GlobalOptions } from './types.js';

/** 将工作区引用展平为适合表格/列表展示的中文字段 */
function workspaceToDisplay(ws: Workspace): Record<string, unknown> {
    return {
        ID: ws.id,
        产品: ws.product ? `#${ws.product.id} ${ws.product.name}` : '-',
        项目: ws.project ? `#${ws.project.id} ${ws.project.name}` : '-',
        执行: ws.execution ? `#${ws.execution.id} ${ws.execution.name}` : '-',
    };
}

/** 注册 `zentao workspace` 及其 `ls` / `set` 子命令 */
export function registerWorkspaceCommand(program: Command): void {
    const wsCmd = program
        .command('workspace')
        .description('管理工作区')
        .argument('[id]', '工作区 ID')
        .action((id: string | undefined) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                const profile = getCurrentProfile();
                if (!profile) throw new ZentaoError('E1006');

                if (id && id !== 'ls' && id !== 'set') {
                    const ws = getWorkspaceById(profile, Number(id));
                    if (!ws) throw new ZentaoError('E4001');

                    if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                        console.log(formatJson({ status: 'success', data: ws }));
                    } else {
                        console.log(formatList(workspaceToDisplay(ws)));
                    }
                    return;
                }

                const ws = getCurrentWorkspace(profile);
                if (!ws) throw new ZentaoError('E4002');

                if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                    console.log(formatJson({ status: 'success', data: ws }));
                } else {
                    console.log(formatList(workspaceToDisplay(ws)));
                }
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.error(formatError(error, globalOpts.format ?? 'markdown'));
                    process.exit(1);
                }
                throw error;
            }
        });

    wsCmd
        .command('ls')
        .description('查看所有工作区')
        .action(() => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                const profile = getCurrentProfile();
                if (!profile) throw new ZentaoError('E1006');

                const workspaces = listWorkspaces(profile);
                const currentId = profile.currentWorkspace;

                if (globalOpts.format === 'json' || globalOpts.format === 'raw') {
                    console.log(formatJson({ status: 'success', data: workspaces }));
                    return;
                }

                if (workspaces.length === 0) {
                    console.log('暂无工作区');
                    return;
                }

                const rows = workspaces.map((ws) => ({
                    ...workspaceToDisplay(ws),
                    使用中: ws.id === currentId ? '是' : '否',
                }));
                console.log(formatTable(rows));
            } catch (error) {
                if (error instanceof ZentaoError) {
                    console.error(formatError(error, globalOpts.format ?? 'markdown'));
                    process.exit(1);
                }
                throw error;
            }
        });

    wsCmd
        .command('set')
        .description('设置当前工作区')
        .argument('[id]', '工作区 ID')
        .option('--product <id>', '设置产品')
        .option('--project <id>', '设置项目')
        .option('--execution <id>', '设置执行')
        .action((id: string | undefined, opts: Record<string, string>) => {
            const globalOpts = program.opts() as GlobalOptions;
            try {
                const profile = getCurrentProfile();
                if (!profile) throw new ZentaoError('E1006');

                if (id) {
                    const success = setCurrentWorkspace(profile, Number(id));
                    if (!success) throw new ZentaoError('E4001');
                } else if (opts.product || opts.project || opts.execution) {
                    // TODO: Fetch object details from API and auto-create workspace
                    // For now, just print a message
                    console.log('请先使用 zentao workspace set <id> 设置工作区');
                    return;
                } else {
                    throw new ZentaoError('E4001');
                }

                const ws = getCurrentWorkspace(profile);
                if (ws && !globalOpts.silent) {
                    console.log(formatList(workspaceToDisplay(ws)));
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
