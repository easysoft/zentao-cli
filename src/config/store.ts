import Configstore from 'configstore';
import { chmodSync, existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { ConfigData, Profile, ServerConfig, UpdateCheckData, UserConfig } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { DEFAULT_CONFIG } from './defaults.js';

/** 默认配置文件路径：~/.config/zentao/zentao.json */
function defaultConfigPath(): string {
    return join(homedir(), '.config', 'zentao', 'zentao.json');
}

/** 当前生效的配置文件路径，可通过 setConfigPath 在首次使用前覆盖 */
let configPath: string = defaultConfigPath();

/** 惰性初始化的 Configstore，避免在仅引用常量的场景下触碰磁盘 */
let store: Configstore | null = null;

function getStore(): Configstore {
    if (!store) {
        store = new Configstore('zentao-cli', {}, { configPath });
        enforcePermissions();
    }
    return store;
}

/** 将配置文件权限收紧为仅当前用户可读（平台不支持 chmod 时静默忽略） */
function enforcePermissions(): void {
    try {
        if (existsSync(configPath)) {
            chmodSync(configPath, 0o600);
        }
    } catch {
        // Ignore permission errors on platforms that don't support chmod
    }
}

/** 将路径中的首段 `~` 展开为当前用户家目录 */
function expandHome(p: string): string {
    if (p === '~') return homedir();
    if (p.startsWith('~/') || p.startsWith('~\\')) {
        return join(homedir(), p.slice(2));
    }
    return p;
}

/**
 * 覆盖默认的配置文件路径。必须在首次访问 store 之前调用。
 * - 支持 `~` 展开；
 * - 相对路径基于当前工作目录解析为绝对路径；
 * - 若 store 已初始化且新路径与当前路径不同，则抛错以防止运行期内状态不一致。
 */
export function setConfigPath(p: string): void {
    if (typeof p !== 'string' || p.trim() === '') {
        throw new Error('setConfigPath: path must be a non-empty string');
    }
    const expanded = expandHome(p);
    const absolute = isAbsolute(expanded) ? expanded : resolve(expanded);
    if (store && absolute !== configPath) {
        throw new Error('setConfigPath: cannot change config path after store has been initialized');
    }
    configPath = absolute;
}

/** 返回默认的配置文件路径（不受 setConfigPath 影响） */
export function getDefaultConfigPath(): string {
    return defaultConfigPath();
}

/** 仅供测试使用：重置模块内部状态（store 与 configPath） */
export function __resetConfigStoreForTests(): void {
    store = null;
    configPath = defaultConfigPath();
}

/** 读取完整配置数据，读取失败时抛出 E1005 */
export function getConfigData(): ConfigData {
    try {
        const s = getStore();
        return {
            currentProfile: s.get('currentProfile') as string | undefined,
            profiles: s.get('profiles') as Profile[] | undefined,
        };
    } catch {
        throw new ZentaoError('E1005', { path: configPath });
    }
}

/** 生成 Profile 唯一标识，格式为 account@server */
export function profileKey(account: string, server: string): string {
    return `${account}@${server}`;
}

/** 获取当前激活的用户 Profile，未登录时返回 undefined */
export function getCurrentProfile(): Profile | undefined {
    const data = getConfigData();
    if (!data.currentProfile || !data.profiles?.length) return undefined;
    return data.profiles.find(
        (p) => profileKey(p.account, p.server) === data.currentProfile,
    );
}

/** 根据账号和服务地址精确查找 Profile */
export function getProfile(account: string, server: string): Profile | undefined {
    const data = getConfigData();
    return data.profiles?.find(
        (p) => p.account === account && p.server === server,
    );
}

/**
 * 通过多种匹配方式查找 Profile。
 * 支持三种 key 格式：完整 key (account@server)、仅账号名、账号@主机名。
 */
export function findProfileByKey(key: string): Profile | undefined {
    const data = getConfigData();
    return data.profiles?.find(
        (p) => profileKey(p.account, p.server) === key
            || p.account === key
            || `${p.account}@${new URL(p.server).hostname}` === key,
    );
}

/** 保存或更新 Profile（按 account+server 去重），并将其设为当前 Profile */
export function saveProfile(profile: Profile): void {
    const s = getStore();
    const profiles = (s.get('profiles') as Profile[] | undefined) ?? [];
    const idx = profiles.findIndex(
        (p) => p.account === profile.account && p.server === profile.server,
    );
    if (idx >= 0) {
        profiles[idx] = profile;
    } else {
        profiles.push(profile);
    }
    s.set('profiles', profiles);
    s.set('currentProfile', profileKey(profile.account, profile.server));
    enforcePermissions();
}

/** 按 profileKey 删除 Profile。若删除的是当前 Profile，则自动切换到第一个 */
export function removeProfile(key: string): boolean {
    const s = getStore();
    const profiles = (s.get('profiles') as Profile[] | undefined) ?? [];
    const idx = profiles.findIndex(
        (p) => profileKey(p.account, p.server) === key,
    );
    if (idx < 0) return false;
    profiles.splice(idx, 1);
    s.set('profiles', profiles);
    const current = s.get('currentProfile') as string | undefined;
    if (current === key) {
        s.set('currentProfile', profiles.length > 0 ? profileKey(profiles[0].account, profiles[0].server) : undefined);
    }
    enforcePermissions();
    return true;
}

/** 切换当前 Profile，key 支持 findProfileByKey 的多种格式 */
export function setCurrentProfile(key: string): boolean {
    const profile = findProfileByKey(key);
    if (!profile) return false;
    const s = getStore();
    s.set('currentProfile', profileKey(profile.account, profile.server));
    return true;
}

/** 获取所有已保存的 Profile */
export function getAllProfiles(): Profile[] {
    const data = getConfigData();
    return data.profiles ?? [];
}

/** 获取 Profile 的完整配置（缺省字段用 DEFAULT_CONFIG 填充） */
export function getProfileConfig(profile: Profile): Required<UserConfig> {
    return { ...DEFAULT_CONFIG, ...profile.config };
}

/** 设置 Profile 中的单个配置项，并持久化 */
export function setProfileConfig(profile: Profile, key: string, value: unknown): void {
    if (!profile.config) profile.config = {};
    (profile.config as Record<string, unknown>)[key] = value;
    saveProfile(profile);
}

/** 批量更新 Profile 字段并持久化 */
export function updateProfile(profile: Profile, updates: Partial<Profile>): void {
    Object.assign(profile, updates);
    saveProfile(profile);
}

/** 返回配置文件的绝对路径（若通过 setConfigPath 覆盖，则返回覆盖后的路径） */
export function getConfigPath(): string {
    return configPath;
}

/**
 * 构建或更新 Profile。
 * 若传入 `oldProfile`，会合并 `workspaces`、`config` 等已有字段，并合并 `user` 信息。
 */
export function buildProfile(server: string, account: string, token: string, serverConfig?: ServerConfig, user?: Record<string, unknown>, oldProfile?: Profile): Profile {
    const now = new Date().toISOString();
    return {
        ...oldProfile,
        server: server.replace(/\/+$/, ''),
        account,
        token,
        user: oldProfile ? {
            ...oldProfile.user,
            ...user
        } : user,
        loginTime: now,
        lastUsedTime: now,
        serverConfig: oldProfile?.serverConfig ?? serverConfig,
    };
}

/** 获取版本更新检查数据 */
export function getUpdateCheckData(): UpdateCheckData | undefined {
    try {
        const s = getStore();
        return s.get('updateCheck') as UpdateCheckData | undefined;
    } catch {
        return undefined;
    }
}

/** 设置版本更新检查数据 */
export function setUpdateCheckData(data: UpdateCheckData): void {
    const s = getStore();
    s.set('updateCheck', data);
    enforcePermissions();
}
