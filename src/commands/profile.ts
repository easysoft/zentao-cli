import { Command } from 'commander';
import { getAllProfiles, getCurrentProfile, setCurrentProfile, profileKey, findProfileByKey, removeProfile } from '../config/store.js';
import { ZentaoError } from '../errors.js';
import { emitResult } from '../utils/output.js';
import type { Profile } from '../types/index.js';

function publicProfile(profile: Profile) {
    return { key: profileKey(profile.account, profile.server), server: profile.server, account: profile.account,
        current: getCurrentProfile()?.server === profile.server && getCurrentProfile()?.account === profile.account };
}
export function registerProfileCommand(program: Command): void {
    const profile = program.command('profile').description('管理已保存账号；use 才改变默认身份');
    profile.action(() => profile.outputHelp());
    profile.command('list').description('列出已保存账号').action((_opts, cmd: Command) => emitResult(getAllProfiles().map(publicProfile), cmd.optsWithGlobals()));
    profile.command('show').argument('[key]', '完整 key 或唯一简写').description('查看账号，不验证凭据').action((key: string | undefined, _opts, cmd: Command) => {
        const options = cmd.optsWithGlobals();
        const selected = key ?? options.profile;
        const found = selected ? findProfileByKey(selected) : getCurrentProfile();
        if (!found) throw new ZentaoError('E1007');
        emitResult({ ...publicProfile(found), verified: false }, options);
    });
    profile.command('use').argument('<key>').description('设置默认身份').action((key: string, _opts, cmd: Command) => {
        if (!setCurrentProfile(key)) throw new ZentaoError('E1007');
        emitResult(publicProfile(getCurrentProfile()!), cmd.optsWithGlobals());
    });
    profile.command('remove').argument('<key>').description('删除本地账号记录').action((key: string, _opts, cmd: Command) => {
        const found = findProfileByKey(key);
        if (!found) throw new ZentaoError('E1007');
        const fullKey = profileKey(found.account, found.server);
        removeProfile(fullKey); emitResult({ removed: fullKey }, cmd.optsWithGlobals());
    });
}
