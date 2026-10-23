import type { Command } from 'commander';
import { getModule } from '../modules/helper.js';
import { actionContract, kebabCase } from '../modules/contract.js';
import { emitResult } from '../utils/output.js';
import { ZentaoError } from '../errors.js';

export function commandDefinition(command: Command): unknown {
    return { name: command.name(), description: command.description(),
        arguments: command.registeredArguments.map(arg => ({ name: arg.name(), required: arg.required, variadic: arg.variadic, description: arg.description })),
        options: command.options.map(option => ({ flags: option.flags, description: option.description, default: option.defaultValue, choices: option.argChoices })),
        commands: command.commands.map(child => ({ name: child.name(), description: child.description() })) };
}
export function registerHelpCommand(program: Command): void {
    program.command('help').description('离线文本或 JSON 命令定义').argument('[command]').argument('[action]')
        .action((name: string | undefined, actionName: string | undefined, _opts, cmd: Command) => {
            const options = cmd.optsWithGlobals();
            const resource = name ? program.commands.find(item => item.name() === name) : program;
            const action = actionName ? resource?.commands.find(item => item.name() === actionName) : resource;
            if (!action) throw new ZentaoError('E2009', { option: 'help', reason: '未找到指定命令或操作' });
            if (options.format !== 'json') { action.outputHelp(); return; }
            const mod = name ? getModule(name) : undefined;
            const definition = mod?.actions.find(item => kebabCase(item.name) === actionName);
            emitResult(definition ? actionContract(mod!, definition) : commandDefinition(action), options);
        });
}
