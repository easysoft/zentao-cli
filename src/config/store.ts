import Configstore from 'configstore';
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ConfigData, Profile, UserConfig } from '../types/index.js';
import { ZentaoError } from '../errors.js';
import { DEFAULT_CONFIG } from './defaults.js';

const CONFIG_PATH = join(homedir(), '.config', 'zentao', 'zentao.json');

let store: Configstore | null = null;

function getStore(): Configstore {
    if (!store) {
        store = new Configstore('zentao-cli', {}, { configPath: CONFIG_PATH });
        enforcePermissions();
    }
    return store;
}

function enforcePermissions(): void {
    try {
        if (existsSync(CONFIG_PATH)) {
            chmodSync(CONFIG_PATH, 0o600);
        }
    } catch {
        // Ignore permission errors on platforms that don't support chmod
    }
}

export function getConfigData(): ConfigData {
    try {
        const s = getStore();
        return {
            currentProfile: s.get('currentProfile') as string | undefined,
            profiles: s.get('profiles') as Profile[] | undefined,
        };
    } catch {
        throw new ZentaoError('E1005');
    }
}

export function profileKey(account: string, server: string): string {
    return `${account}@${server}`;
}

export function getCurrentProfile(): Profile | undefined {
    const data = getConfigData();
    if (!data.currentProfile || !data.profiles?.length) return undefined;
    return data.profiles.find(
        (p) => profileKey(p.account, p.server) === data.currentProfile,
    );
}

export function getProfile(account: string, server: string): Profile | undefined {
    const data = getConfigData();
    return data.profiles?.find(
        (p) => p.account === account && p.server === server,
    );
}

export function findProfileByKey(key: string): Profile | undefined {
    const data = getConfigData();
    return data.profiles?.find(
        (p) => profileKey(p.account, p.server) === key
            || p.account === key
            || `${p.account}@${new URL(p.server).hostname}` === key,
    );
}

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

export function setCurrentProfile(key: string): boolean {
    const profile = findProfileByKey(key);
    if (!profile) return false;
    const s = getStore();
    s.set('currentProfile', profileKey(profile.account, profile.server));
    return true;
}

export function getAllProfiles(): Profile[] {
    const data = getConfigData();
    return data.profiles ?? [];
}

export function getProfileConfig(profile: Profile): Required<UserConfig> {
    return { ...DEFAULT_CONFIG, ...profile.config };
}

export function setProfileConfig(profile: Profile, key: string, value: unknown): void {
    if (!profile.config) profile.config = {};
    (profile.config as Record<string, unknown>)[key] = value;
    saveProfile(profile);
}

export function updateProfile(profile: Profile, updates: Partial<Profile>): void {
    Object.assign(profile, updates);
    saveProfile(profile);
}

export function getConfigPath(): string {
    return CONFIG_PATH;
}

/** 构建 Profile 对象 */
export function buildProfile(server: string, account: string, token: string, user?: Record<string, unknown>, oldProfile?: Profile): Profile {
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
    };
}
