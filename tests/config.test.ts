import { describe, test, expect } from 'bun:test';
import { DEFAULT_CONFIG, VALID_CONFIG_KEYS } from '../src/config/defaults';
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
