import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { DEFAULT_CONFIG, VALID_CONFIG_KEYS } from '../src/config/defaults';
import {
    __resetConfigStoreForTests,
    getConfigPath,
    getDefaultConfigPath,
    saveProfile,
    setConfigPath,
} from '../src/config/store';
import type { UserConfig, Workspace, Profile } from '../src/types/config';

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
        __resetConfigStoreForTests();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-test-'));
    });

    afterEach(() => {
        __resetConfigStoreForTests();
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

        saveProfile({
            server: 'https://zentao.example.com',
            account: 'admin',
            token: 'test-token',
            loginTime: '2026-04-10T10:00:00Z',
            lastUsedTime: '2026-04-10T10:00:00Z',
        });

        expect(existsSync(first)).toBe(true);
        expect(() => setConfigPath(second)).toThrow();
    });

    test('store 初始化后使用相同路径再次设置应幂等', () => {
        const abs = join(tempDir, 'idempotent.json');
        setConfigPath(abs);

        saveProfile({
            server: 'https://zentao.example.com',
            account: 'admin',
            token: 'test-token',
            loginTime: '2026-04-10T10:00:00Z',
            lastUsedTime: '2026-04-10T10:00:00Z',
        });

        expect(() => setConfigPath(abs)).not.toThrow();
        expect(getConfigPath()).toBe(abs);
    });
});
