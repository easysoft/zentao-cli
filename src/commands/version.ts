import { Command } from 'commander';
import { getCliVersion } from '../utils/version.js';
import { emitResult } from '../utils/output.js';
import packageInfo from '../../package.json';
export function registerVersionCommand(program: Command): void {
    program.command('version').description('离线显示 CLI、SDK 和运行时版本').action((_opts, cmd: Command) => {
        emitResult({ cli: getCliVersion(), sdk: packageInfo.dependencies['zentao-api'],
            runtime: typeof Bun === 'undefined' ? `Node ${process.versions.node}` : `Bun ${Bun.version}`, platform: process.platform, arch: process.arch }, cmd.optsWithGlobals());
    });
}
