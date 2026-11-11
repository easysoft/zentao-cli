import { getModule } from './modules/helper.js';
import { brandText } from './brand.js';
import { kebabCase } from './modules/contract.js';
import { CommanderError } from 'commander';
import { createProgram } from './cli.js';
import { ZentaoError, formatError, mapSdkError } from './errors.js';
import { setConfigPath } from './config/store.js';
import { startCommandLifecycle, commandAbortReason } from './utils/lifecycle.js';

const argv = process.argv.slice(2);
function argumentValue(name: string): string | undefined {
    let result: string | undefined;
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--') break;
        const separator = arg.indexOf('=');
        const flag = separator < 0 ? arg : arg.slice(0, separator);
        const option = program.options.find(option => option.long === flag || option.short === flag);
        if (!option) continue;
        // Required values can look like flags, including --assistant '--config=...'.
        const value = separator >= 0 ? arg.slice(separator + 1) : option.required ? argv[++index] : undefined;
        if (option.long === name) result = value;
    }
    return result;
}
const program = createProgram();
let cleanup: (() => void) | undefined;
program.hook('preAction', (_root, command) => {
    const options = command.optsWithGlobals();
    if (options.format === 'raw' && command.name() !== 'token' && !getModule(command.parent?.name() ?? '')?.actions.some(action => kebabCase(action.name) === command.name())) {
        throw new ZentaoError('E2009', { option: 'raw', reason: 'raw 仅适用于具有原始服务端响应的业务命令' });
    }
    cleanup = startCommandLifecycle(options);
});
try {
    const path = argumentValue('--config') ?? process.env[brandText('ZENTAO_CONFIG_FILE')];
    if (path?.trim()) setConfigPath(path);
    await program.parseAsync(process.argv);
} catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
        process.exitCode = 0;
    } else {
        const aborted = commandAbortReason();
        const normalized = aborted ? new ZentaoError(aborted === 'deadline' ? 'E5001' : 'E5003')
            : error instanceof CommanderError ? new ZentaoError('E2009', { option: 'argv', reason: error.message.replace(/^error: /, '').trim() })
                : error instanceof ZentaoError ? error : mapSdkError(error);
        const domain = normalized instanceof ZentaoError ? normalized : new ZentaoError('E2008', { url: '', status: '', serverResponse: normalized instanceof Error ? normalized.message : String(normalized) });
        process.stderr.write(formatError(domain, argumentValue('--format') ?? 'table') + '\n');
        process.exitCode = aborted === 'interrupt' || ['5003', '1008'].includes(domain.code) ? 130
            : error instanceof CommanderError || ['2001', '2003', '2004', '2005', '2007', '2009'].includes(domain.code) ? 2 : 1;
    }
} finally { cleanup?.(); }
