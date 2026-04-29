import { __resetConfigStoreForTests } from '../src/config/store';
import type { Profile, Workspace } from '../src/types/config';

/** Shared workspace fixture for tests */
export const mockWorkspace: Workspace = {
    id: 1,
    product: { id: 1, name: '产品1' },
    project: { id: 2, name: '项目1' },
    execution: { id: 3, name: '执行1' },
};

/** Shared profile fixture for tests */
export const mockProfile: Profile = {
    server: 'https://zentao.example.com',
    account: 'admin',
    token: 'test-token',
    loginTime: '2026-04-10T10:00:00Z',
    lastUsedTime: '2026-04-10T10:00:00Z',
};

/** Reset config store between tests */
export function resetConfigStore(): void {
    __resetConfigStoreForTests();
}
