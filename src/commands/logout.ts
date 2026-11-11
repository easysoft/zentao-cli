import { Command } from 'commander';
import { removeProfile, getCurrentProfile, getAllProfiles, getProfileConfig, profileKey, findProfileByKey } from '../config/store.js';
import { ZentaoError } from '../errors.js';
import { emitResult } from '../utils/output.js';
import { revokeSession } from '../auth/session.js';
import { commandSignal } from '../utils/lifecycle.js';
export function registerLogoutCommand(program: Command): void {
    program.command('logout').description('删除本地登录记录').argument('[key]')
        .option('--all', '清理选定配置文件中的全部账号；空配置也成功')
        .option('--revoke', '先撤销并验证远端会话；失败时保留该账号以便重试')
        .action(async (key: string | undefined, _opts, cmd: Command) => {
            const options = cmd.optsWithGlobals();
            if (options.all && (key || options.profile)) throw new ZentaoError('E2009', { option: '--all', reason: '不能同时指定账号或 --profile' });
            const selected = key ?? options.profile;
            const profile = selected ? findProfileByKey(selected) : getCurrentProfile();
            if (!options.all && !profile) throw new ZentaoError('E1007');
            const profiles = options.all ? getAllProfiles() : [profile!];
            const removed: string[] = [];
            for (const item of profiles) {
                if (options.revoke) {
                    const config = getProfileConfig(item);
                    await revokeSession(item, { timeout: options.timeout ?? config.timeout, insecure: options.insecure ?? config.insecure, signal: commandSignal() });
                }
                const fullKey = profileKey(item.account, item.server);
                // A concurrent login may have replaced the token while revocation was in flight.
                if (removeProfile(fullKey, item.token)) removed.push(fullKey);
                else if (options.revoke && findProfileByKey(fullKey)) throw new ZentaoError('E1012');
            }
            emitResult({ removed: options.all ? removed : removed[0] ?? null }, options);
        });
}
