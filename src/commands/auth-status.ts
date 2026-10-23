import { Command } from 'commander';
import { resolveAuthSource, ensureAuth } from '../auth/flow.js';
import { verifyToken } from '../auth/login.js';
import { getConfigPath } from '../config/store.js';
import { emitResult } from '../utils/output.js';
export function registerAuthStatusCommand(program: Command): void {
    program.command('status').description('显示认证来源；默认离线').option('--verify', '连接服务器验证凭据')
        .action(async (_opts, cmd: Command) => {
            const options = cmd.optsWithGlobals();
            const auth = resolveAuthSource(options.profile);
            if (options.verify) {
                const context = await ensureAuth(options);
                await verifyToken(context.client, context.profile.account);
            }
            emitResult({ source: auth.source, server: auth.server, account: auth.account,
                credentialType: auth.token ? 'token' : 'password', configFile: auth.source === 'profile' ? getConfigPath() : null,
                verified: Boolean(options.verify) }, options);
        });
}
