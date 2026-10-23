import { Command } from 'commander';
import { removeProfile, getCurrentProfile, profileKey, findProfileByKey } from '../config/store.js';
import { ZentaoError } from '../errors.js';
import { emitResult } from '../utils/output.js';
export function registerLogoutCommand(program: Command): void {
    program.command('logout').description('删除本地登录记录').argument('[key]').action((key: string | undefined, _opts, cmd: Command) => {
        const options = cmd.optsWithGlobals();
        const selected = key ?? options.profile;
        const profile = selected ? findProfileByKey(selected) : getCurrentProfile();
        if (!profile) throw new ZentaoError('E1007');
        const fullKey = profileKey(profile.account, profile.server);
        removeProfile(fullKey); emitResult({ removed: fullKey }, options);
    });
}
