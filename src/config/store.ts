import Configstore from 'configstore';
import { chmodSync, existsSync, mkdirSync, rmdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { ConfigData, Profile, ServerConfig, UserConfig } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { DEFAULT_CONFIG } from './defaults.js';

const userConfigSchema = z.object({
    defaultOutputFormat: z.enum(['table', 'markdown', 'json', 'raw']),
    defaultRecPerPage: z.number().int().positive().max(1000),
    insecure: z.boolean(),
    timeout: z.number().int().positive(),
    htmlToMarkdown: z.boolean(),
    batchFailFast: z.boolean(),
    pagers: z.record(z.string(), z.number().int().positive().max(1000)),
    jsonPretty: z.boolean(),
}).partial().passthrough();

const configSchema = z.object({
    currentProfile: z.string().optional(),
    profiles: z.array(z.object({
        server: z.string().url(),
        account: z.string(),
        token: z.string(),
        // Older profiles may omit timestamps; preserve them and any unknown fields.
        loginTime: z.string().optional(),
        lastUsedTime: z.string().optional(),
        user: z.record(z.string(), z.unknown()).optional(),
        config: userConfigSchema.optional(),
        serverConfig: z.object({ version: z.string() }).passthrough().optional(),
    }).passthrough()).optional(),
}).passthrough();

/** Use an absolute XDG config root, otherwise retain the legacy ~/.config location. */
function defaultConfigPath(): string {
    const xdg = process.env.XDG_CONFIG_HOME;
    return join(xdg && isAbsolute(xdg) ? xdg : join(homedir(), '.config'), 'zentao', 'zentao.json');
}

/** 当前生效的配置文件路径，可通过 setConfigPath 在首次使用前覆盖 */
let configPath: string = defaultConfigPath();

/** 惰性初始化的 Configstore，避免在仅引用常量的场景下触碰磁盘 */
let store: Configstore | null = null;

function getStore(): Configstore {
    if (!store) {
        store = new Configstore('zentao-cli', undefined, { configPath, clearInvalidConfig: false });
    }
    return store;
}

/** Restrict file access to the current user after a successful write. */
function enforcePermissions(): void {
    try {
        if (existsSync(configPath)) {
            chmodSync(configPath, 0o600);
        }
    } catch {
        // Ignore permission errors on platforms that don't support chmod
    }
}

/** Atomically persist related fields without exposing credential-bearing error messages. */
function writeConfig(data: Partial<ConfigData>): void {
    try {
        getStore().set(data);
        enforcePermissions();
    } catch (error) {
        const systemCode = (error as NodeJS.ErrnoException | undefined)?.code;
        throw new ZentaoError('E1011', { path: configPath }, {
            operation: 'write', reason: 'write_failed', path: configPath,
            ...(systemCode ? { systemCode } : {}),
        });
    }
}

/** Serialize short read-modify-write sections across CLI processes; never hold across network I/O. */
function transaction<T>(change: (data: ConfigData) => T): T {
    const lock = `${configPath}.lock`;
    let locked = false;
    try {
        mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
        const deadline = Date.now() + 5000;
        while (!locked) {
            try { mkdirSync(lock, { mode: 0o700 }); locked = true; }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                if (Date.now() >= deadline) throw new ZentaoError('E1011', { path: configPath }, { reason: 'lock_timeout', path: lock });
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
            }
        }
        const data = getConfigData();
        const result = change(data);
        writeConfig(data);
        return result;
    } catch (error) {
        if (error instanceof ZentaoError) throw error;
        throw new ZentaoError('E1011', { path: configPath }, { operation: 'write', reason: 'write_failed', path: configPath, systemCode: (error as NodeJS.ErrnoException).code });
    } finally { if (locked) rmdirSync(lock); }
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
    let data: unknown;
    try {
        data = getStore().all;
    } catch (error) {
        const systemCode = (error as NodeJS.ErrnoException | undefined)?.code;
        throw new ZentaoError('E1005', { path: configPath }, {
            operation: 'read', reason: error instanceof SyntaxError ? 'invalid_json' : 'unreadable', path: configPath,
            ...(systemCode ? { systemCode } : {}),
        });
    }
    if (!configSchema.safeParse(data).success) {
        throw new ZentaoError('E1005', { path: configPath }, {
            operation: 'read', reason: 'invalid_structure', path: configPath,
        });
    }
    return data as ConfigData;
}

/** 生成 Profile 唯一标识，格式为 account@server */
export function profileKey(account: string, server: string): string {
    return `${account}@${server}`;
}

/** 规范化服务地址，避免尾斜杠造成同一 Profile 的重复记录 */
export function normalizeServerUrl(server: string): string {
    return server.replace(/\/+$/, '');
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
    const normalizedServer = normalizeServerUrl(server);
    return data.profiles?.find(
        (p) => p.account === account && normalizeServerUrl(p.server) === normalizedServer,
    );
}

/**
 * 通过多种匹配方式查找 Profile。
 * 支持三种 key 格式：完整 key (account@server)、仅账号名、账号@主机名。
 */
export function findProfileByKey(key: string): Profile | undefined {
    const profiles = getConfigData().profiles ?? [];
    const exact = profiles.find(p => profileKey(p.account, p.server) === key);
    if (exact) return exact;
    const matches = profiles.filter(p => p.account === key || `${p.account}@${new URL(p.server).hostname}` === key);
    if (matches.length > 1) throw new ZentaoError('E2009', { option: 'profile', reason: '账号简写不唯一，请指定完整 key' }, { candidates: matches.map(p => profileKey(p.account, p.server)) });
    return matches[0];
}

/** Save credentials while preserving the latest preferences and default identity. */
export function saveProfile(profile: Profile): void {
    transaction(data => {
        const server = normalizeServerUrl(profile.server);
        const matches = (p: Profile) => p.account === profile.account && normalizeServerUrl(p.server) === server;
        const existing = data.profiles?.find(matches);
        const saved = { ...existing, ...profile, server,
            config: existing?.config ?? profile.config,
            user: existing?.user || profile.user ? { ...existing?.user, ...profile.user } : undefined,
            serverConfig: profile.serverConfig ?? existing?.serverConfig };
        const profiles = data.profiles ?? [];
        const first = profiles.findIndex(matches);
        data.profiles = profiles.filter(p => !matches(p));
        data.profiles.splice(first < 0 ? data.profiles.length : first, 0, saved);
    });
}

/** Removing the default clears it; only profile use selects an identity. */
export function removeProfile(key: string, expectedToken?: string): boolean {
    return transaction(data => {
        const previous = data.profiles ?? [];
        data.profiles = previous.filter(p => profileKey(p.account, p.server) !== key || (expectedToken !== undefined && p.token !== expectedToken));
        if (data.currentProfile === key && !data.profiles.some(p => profileKey(p.account, p.server) === key)) data.currentProfile = undefined;
        return data.profiles.length !== previous.length;
    });
}

export function setCurrentProfile(key: string): boolean {
    return transaction(data => {
        const profile = findProfileByKey(key);
        if (!profile) return false;
        data.currentProfile = profileKey(profile.account, profile.server);
        return true;
    });
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
    transaction(data => {
        const current = data.profiles?.find(p => p.account === profile.account && p.server === profile.server);
        if (!current) throw new ZentaoError('E1007');
        current.config ??= {};
        if (value === undefined) delete (current.config as Record<string, unknown>)[key];
        else (current.config as Record<string, unknown>)[key] = value;
    });
}

export function updateProfile(profile: Profile, updates: Partial<Profile>): void {
    transaction(data => {
        const current = data.profiles?.find(p => p.account === profile.account && p.server === profile.server);
        if (!current) throw new ZentaoError('E1007');
        Object.assign(current, updates);
    });
}

/** 返回配置文件的绝对路径（若通过 setConfigPath 覆盖，则返回覆盖后的路径） */
export function getConfigPath(): string {
    return configPath;
}

/**
 * 构建或更新 Profile。
 * 若传入 `oldProfile`，会保留已有配置并合并 `user` 信息。
 */
export function buildProfile(server: string, account: string, token: string, serverConfig?: ServerConfig, user?: Record<string, unknown>, oldProfile?: Profile): Profile {
    const now = new Date().toISOString();
    return {
        ...oldProfile,
        server: normalizeServerUrl(server),
        account,
        token,
        user: oldProfile ? {
            ...oldProfile.user,
            ...user
        } : user,
        loginTime: now,
        lastUsedTime: now,
        serverConfig: serverConfig ?? oldProfile?.serverConfig,
    };
}
