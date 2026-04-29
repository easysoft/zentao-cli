import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { DEFAULT_CONFIG, VALID_CONFIG_KEYS } from '../src/config/defaults';
import {
    getConfigPath,
    getDefaultConfigPath,
    saveProfile,
    setConfigPath,
    getCurrentProfile,
    getProfile,
    findProfileByKey,
    getAllProfiles,
    removeProfile,
    setCurrentProfile,
    getProfileConfig,
    setProfileConfig,
    updateProfile,
    buildProfile,
    getUpdateCheckData,
    setUpdateCheckData,
    profileKey,
} from '../src/config/store';
import type { UserConfig, Workspace, Profile } from '../src/types/config';
import { mockProfile, resetConfigStore } from './helpers';

describe('DEFAULT_CONFIG', () => {
    test('has correct default values', () => {
        expect(DEFAULT_CONFIG.defaultOutputFormat).toBe('markdown');
        expect(DEFAULT_CONFIG.lang).toBe('zh-CN');
        expect(DEFAULT_CONFIG.defaultRecPerPage).toBe(20);
        expect(DEFAULT_CONFIG.insecure).toBe(false);
        expect(DEFAULT_CONFIG.timeout).toBe(10000);
        expect(DEFAULT_CONFIG.htmlToMarkdown).toBe(true);
        expect(DEFAULT_CONFIG.batchFailFast).toBe(false);
        expect(DEFAULT_CONFIG.autoSetWorkspace).toBe(false);
        expect(DEFAULT_CONFIG.silent).toBe(false);
    });

    test('VALID_CONFIG_KEYS contains all config keys', () => {
        expect(VALID_CONFIG_KEYS).toContain('defaultOutputFormat');
        expect(VALID_CONFIG_KEYS).toContain('lang');
        expect(VALID_CONFIG_KEYS).toContain('defaultRecPerPage');
        expect(VALID_CONFIG_KEYS).toContain('insecure');
        expect(VALID_CONFIG_KEYS).toContain('timeout');
        expect(VALID_CONFIG_KEYS).toContain('htmlToMarkdown');
        expect(VALID_CONFIG_KEYS).toContain('batchFailFast');
        expect(VALID_CONFIG_KEYS).toContain('autoSetWorkspace');
        expect(VALID_CONFIG_KEYS).toContain('pagers');
        expect(VALID_CONFIG_KEYS).toContain('silent');
    });
});

describe('Workspace type validation', () => {
    test('workspace structure is correct', () => {
        const ws: Workspace = {
            id: 1,
            product: { id: 1, name: '产品1' },
            project: { id: 2, name: '项目1' },
            execution: { id: 3, name: '执行1' },
        };
        expect(ws.id).toBe(1);
        expect(ws.product?.id).toBe(1);
        expect(ws.project?.name).toBe('项目1');
        expect(ws.execution?.id).toBe(3);
    });

    test('workspace with optional fields', () => {
        const ws: Workspace = { id: 1 };
        expect(ws.product).toBeUndefined();
        expect(ws.project).toBeUndefined();
        expect(ws.execution).toBeUndefined();
    });
});

describe('Profile type validation', () => {
    test('profile structure is correct', () => {
        const profile: Profile = {
            server: 'https://zentao.example.com',
            account: 'admin',
            token: 'test-token',
            loginTime: '2026-04-10T10:00:00Z',
            lastUsedTime: '2026-04-10T10:00:00Z',
        };
        expect(profile.server).toBe('https://zentao.example.com');
        expect(profile.account).toBe('admin');
        expect(profile.token).toBe('test-token');
    });

    test('profile with all optional fields', () => {
        const profile: Profile = {
            server: 'https://zentao.example.com',
            account: 'admin',
            token: 'test-token',
            user: { id: 1, realname: 'Admin' },
            loginTime: '2026-04-10T10:00:00Z',
            lastUsedTime: '2026-04-10T10:00:00Z',
            currentWorkspace: 1,
            workspaces: [{ id: 1, product: { id: 1, name: '产品1' } }],
            config: { defaultOutputFormat: 'json' },
        };
        expect(profile.user?.id).toBe(1);
        expect(profile.currentWorkspace).toBe(1);
        expect(profile.workspaces?.length).toBe(1);
        expect(profile.config?.defaultOutputFormat).toBe('json');
    });
});

describe('setConfigPath', () => {
    let tempDir: string;

    beforeEach(() => {
        resetConfigStore();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-test-'));
    });

    afterEach(() => {
        resetConfigStore();
        if (tempDir && existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('默认路径为 ~/.config/zentao/zentao.json', () => {
        expect(getDefaultConfigPath()).toBe(join(homedir(), '.config', 'zentao', 'zentao.json'));
        expect(getConfigPath()).toBe(getDefaultConfigPath());
    });

    test('展开路径中首段的 ~ 为家目录', () => {
        setConfigPath('~/custom/zt.json');
        expect(getConfigPath()).toBe(join(homedir(), 'custom', 'zt.json'));
    });

    test('单独的 ~ 展开为家目录自身', () => {
        setConfigPath('~');
        expect(getConfigPath()).toBe(homedir());
    });

    test('相对路径基于 CWD 解析为绝对路径', () => {
        setConfigPath('./relative/zt.json');
        const got = getConfigPath();
        expect(isAbsolute(got)).toBe(true);
        expect(got).toBe(resolve('./relative/zt.json'));
    });

    test('绝对路径原样保留', () => {
        const abs = join(tempDir, 'zt.json');
        setConfigPath(abs);
        expect(getConfigPath()).toBe(abs);
    });

    test('空字符串或非法输入抛错', () => {
        expect(() => setConfigPath('')).toThrow();
        expect(() => setConfigPath('   ')).toThrow();
        // @ts-expect-error: 故意传入非字符串以验证运行时校验
        expect(() => setConfigPath(undefined)).toThrow();
    });

    test('store 初始化后再次设置为不同路径应抛错', () => {
        const first = join(tempDir, 'first.json');
        const second = join(tempDir, 'second.json');
        setConfigPath(first);

        saveProfile(mockProfile);

        expect(existsSync(first)).toBe(true);
        expect(() => setConfigPath(second)).toThrow();
    });

    test('store 初始化后使用相同路径再次设置应幂等', () => {
        const abs = join(tempDir, 'idempotent.json');
        setConfigPath(abs);

        saveProfile(mockProfile);

        expect(() => setConfigPath(abs)).not.toThrow();
        expect(getConfigPath()).toBe(abs);
    });
});

describe('profileKey', () => {
    test('generates account@server key', () => {
        expect(profileKey('admin', 'https://zentao.example.com')).toBe('admin@https://zentao.example.com');
    });
});

describe('profile management', () => {
    let tempDir: string;

    beforeEach(() => {
        resetConfigStore();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-test-'));
        setConfigPath(join(tempDir, 'config.json'));
    });

    afterEach(() => {
        resetConfigStore();
        if (tempDir && existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('saveProfile and getCurrentProfile', () => {
        saveProfile(mockProfile);
        const current = getCurrentProfile();
        expect(current).toBeDefined();
        expect(current!.account).toBe('admin');
        expect(current!.server).toBe('https://zentao.example.com');
    });

    test('getAllProfiles returns all saved profiles', () => {
        saveProfile(mockProfile);
        saveProfile({
            ...mockProfile,
            account: 'dev1',
            server: 'https://zentao2.example.com',
        });
        const profiles = getAllProfiles();
        expect(profiles.length).toBe(2);
    });

    test('getProfile finds by account and server', () => {
        saveProfile(mockProfile);
        const found = getProfile('admin', 'https://zentao.example.com');
        expect(found).toBeDefined();
        expect(found!.token).toBe('test-token');
    });

    test('getProfile returns undefined for nonexistent', () => {
        saveProfile(mockProfile);
        const found = getProfile('nobody', 'https://example.com');
        expect(found).toBeUndefined();
    });

    test('findProfileByKey by full key', () => {
        saveProfile(mockProfile);
        const found = findProfileByKey('admin@https://zentao.example.com');
        expect(found).toBeDefined();
        expect(found!.account).toBe('admin');
    });

    test('findProfileByKey by account only', () => {
        saveProfile(mockProfile);
        const found = findProfileByKey('admin');
        expect(found).toBeDefined();
        expect(found!.account).toBe('admin');
    });

    test('findProfileByKey by account@hostname', () => {
        saveProfile(mockProfile);
        const found = findProfileByKey('admin@zentao.example.com');
        expect(found).toBeDefined();
        expect(found!.account).toBe('admin');
    });

    test('removeProfile removes existing profile', () => {
        saveProfile(mockProfile);
        expect(getAllProfiles().length).toBe(1);
        const removed = removeProfile('admin@https://zentao.example.com');
        expect(removed).toBe(true);
        expect(getAllProfiles().length).toBe(0);
    });

    test('removeProfile returns false for nonexistent', () => {
        saveProfile(mockProfile);
        const removed = removeProfile('nobody@https://example.com');
        expect(removed).toBe(false);
        expect(getAllProfiles().length).toBe(1);
    });

    test('removeProfile auto-switches to first remaining profile', () => {
        const profile2: Profile = {
            ...mockProfile,
            account: 'dev1',
            server: 'https://zentao2.example.com',
        };
        saveProfile(mockProfile);
        saveProfile(profile2);
        expect(getCurrentProfile()!.account).toBe('dev1');

        removeProfile('dev1@https://zentao2.example.com');
        expect(getCurrentProfile()!.account).toBe('admin');
    });

    test('setCurrentProfile switches active profile', () => {
        const profile2: Profile = {
            ...mockProfile,
            account: 'dev1',
            server: 'https://zentao2.example.com',
        };
        saveProfile(mockProfile);
        saveProfile(profile2);
        expect(getCurrentProfile()!.account).toBe('dev1');

        const switched = setCurrentProfile('admin@https://zentao.example.com');
        expect(switched).toBe(true);
        expect(getCurrentProfile()!.account).toBe('admin');
    });

    test('setCurrentProfile returns false for nonexistent key', () => {
        saveProfile(mockProfile);
        const switched = setCurrentProfile('nobody@https://example.com');
        expect(switched).toBe(false);
    });

    test('saveProfile updates existing profile', () => {
        saveProfile(mockProfile);
        saveProfile({ ...mockProfile, token: 'new-token' });
        expect(getAllProfiles().length).toBe(1);
        expect(getCurrentProfile()!.token).toBe('new-token');
    });
});

describe('profile config', () => {
    let tempDir: string;

    beforeEach(() => {
        resetConfigStore();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-test-'));
        setConfigPath(join(tempDir, 'config.json'));
    });

    afterEach(() => {
        resetConfigStore();
        if (tempDir && existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('getProfileConfig returns defaults when no config set', () => {
        const config = getProfileConfig(mockProfile);
        expect(config.defaultOutputFormat).toBe(DEFAULT_CONFIG.defaultOutputFormat);
        expect(config.lang).toBe(DEFAULT_CONFIG.lang);
    });

    test('getProfileConfig merges profile config with defaults', () => {
        const profile: Profile = { ...mockProfile, config: { defaultOutputFormat: 'json' } };
        const config = getProfileConfig(profile);
        expect(config.defaultOutputFormat).toBe('json');
        expect(config.lang).toBe(DEFAULT_CONFIG.lang);
    });

    test('setProfileConfig persists config to profile', () => {
        saveProfile(mockProfile);
        setProfileConfig(mockProfile, 'defaultOutputFormat', 'json');
        const current = getCurrentProfile();
        expect(current!.config?.defaultOutputFormat).toBe('json');
    });

    test('updateProfile merges fields and persists', () => {
        saveProfile(mockProfile);
        updateProfile(mockProfile, { token: 'updated-token' });
        const current = getCurrentProfile();
        expect(current!.token).toBe('updated-token');
        expect(current!.account).toBe('admin');
    });
});

describe('buildProfile', () => {
    test('builds profile from scratch', () => {
        const profile = buildProfile('https://zentao.example.com', 'admin', 'tok123');
        expect(profile.server).toBe('https://zentao.example.com');
        expect(profile.account).toBe('admin');
        expect(profile.token).toBe('tok123');
        expect(profile.loginTime).toBeDefined();
        expect(profile.lastUsedTime).toBeDefined();
    });

    test('strips trailing slashes from server', () => {
        const profile = buildProfile('https://zentao.example.com/', 'admin', 'tok');
        expect(profile.server).toBe('https://zentao.example.com');
    });

    test('merges with oldProfile preserving workspaces', () => {
        const old: Profile = {
            ...mockProfile,
            workspaces: [{ id: 1, product: { id: 1, name: 'P1' } }],
            config: { defaultOutputFormat: 'json' },
        };
        const profile = buildProfile('https://zentao.example.com', 'admin', 'new-tok', undefined, undefined, old);
        expect(profile.workspaces).toEqual(old.workspaces);
        expect(profile.config).toEqual(old.config);
        expect(profile.token).toBe('new-tok');
    });

    test('merges user info from oldProfile', () => {
        const old: Profile = {
            ...mockProfile,
            user: { id: 1, realname: 'Admin' },
        };
        const profile = buildProfile('https://zentao.example.com', 'admin', 'tok', undefined, { realname: 'Super Admin' }, old);
        expect(profile.user).toEqual({ id: 1, realname: 'Super Admin' });
    });
});

describe('update check data', () => {
    let tempDir: string;

    beforeEach(() => {
        resetConfigStore();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-test-'));
        setConfigPath(join(tempDir, 'config.json'));
    });

    afterEach(() => {
        resetConfigStore();
        if (tempDir && existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('returns undefined when no update check data set', () => {
        expect(getUpdateCheckData()).toBeUndefined();
    });

    test('setUpdateCheckData and getUpdateCheckData', () => {
        const data = { lastCheck: '2026-04-29T00:00:00Z', latestVersion: '0.2.0' };
        setUpdateCheckData(data);
        expect(getUpdateCheckData()).toEqual(data);
    });
});
