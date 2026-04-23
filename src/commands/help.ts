import type { Command } from 'commander';
import { getModule } from '../modules/index.js';
import { showModuleAllActionsHelp } from './module-handler.js';

function findSubcommand(program: Command, token: string): Command | undefined {
    return program.commands.find((cmd) => cmd.name() === token || cmd.aliases().includes(token));
}

/** 注册 `zentao help [command]`：根级帮助、子命令帮助，或业务模块的详细操作说明 */
export function registerHelpCommand(program: Command): void {
    program
        .command('help')
        .description('显示命令帮助')
        .argument('[command]', '子命令或模块名')
        .action((commandName?: string) => {
            if (!commandName) {
                program.help();
                return;
            }

            const mod = getModule(commandName);
            if (mod) {
                showModuleAllActionsHelp(mod);
                return;
            }

            const sub = findSubcommand(program, commandName);
            if (sub && !(sub as unknown as { _executableHandler?: boolean })._executableHandler) {
                sub.help();
                return;
            }

            program.help({ error: true });
        });
}
