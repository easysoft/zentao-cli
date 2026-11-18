import type { LinkProfile } from 'zentao-api';
import { brandText } from '../brand.js';
import { ZentaoError } from '../errors.js';
import { findProfileByKey, getCurrentProfile } from './store.js';

/** Select the routing information for a local CLI or stdio session without loading credentials into a client. */
export function selectLinkSite(options: { server?: string; profile?: string } = {}): LinkProfile & { timeout?: number; insecure?: boolean } {
    if (options.server !== undefined && options.profile !== undefined) {
        throw new ZentaoError('E2009', { option: 'server/profile', reason: '--server 和 --profile 只能指定一个' });
    }
    if (options.server !== undefined) return { server: options.server };
    const environmentSite = process.env[brandText('ZENTAO_URL')];
    if (options.profile === undefined && environmentSite) return { server: environmentSite };

    const profile = options.profile === undefined ? getCurrentProfile() : findProfileByKey(options.profile);
    if (!profile) {
        if (options.profile !== undefined) throw new ZentaoError('E1007');
        throw new ZentaoError('E2009', { option: 'server', reason: brandText('请用 --server 或 ZENTAO_URL 指定站点，或选择已保存的配置') });
    }
    return { server: profile.server, serverConfig: profile.serverConfig, timeout: profile.config?.timeout, insecure: profile.config?.insecure };
}
