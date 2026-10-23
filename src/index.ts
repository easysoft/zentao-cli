import { CommanderError } from 'commander';
import { createProgram } from './cli.js';
import { ZentaoError, formatError, mapSdkError } from './errors.js';
import { setConfigPath } from './config/store.js';
import { startCommandLifecycle, commandAbortReason } from './utils/lifecycle.js';

const argv = process.argv.slice(2);
function argumentValue(name: string): string | undefined {
    const index = argv.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
    return index < 0 ? undefined : argv[index].includes('=') ? argv[index].slice(name.length + 1) : argv[index + 1];
}
const program = createProgram();
let cleanup: (() => void) | undefined;
program.hook('preAction', (_root, command) => { cleanup = startCommandLifecycle(command.optsWithGlobals()); });
try {
    const path = argumentValue('--config') ?? process.env.ZENTAO_CONFIG_FILE;
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
