import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureAuth } from '../src/auth/flow';
import {
    __resetConfigStoreForTests,
    profileKey,
    setConfigPath,
} from '../src/config/store';
import { mockProfile } from './helpers';

describe('ensureAuth', () => {
    let tempDir: string;

    beforeEach(() => {
        __resetConfigStoreForTests();
        tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-auth-readonly-'));
        const configPath = join(tempDir, 'config.json');
        writeFileSync(configPath, JSON.stringify({
            currentProfile: profileKey(mockProfile.account, mockProfile.server),
            profiles: [mockProfile],
        }));
        chmodSync(tempDir, 0o500);
        setConfigPath(configPath);
    });

    afterEach(() => {
        __resetConfigStoreForTests();
        chmodSync(tempDir, 0o700);
        rmSync(tempDir, { recursive: true, force: true });
    });

    test('reuses a valid token when last-used persistence is not writable', async () => {
        const auth = await ensureAuth();

        expect(auth.profile.account).toBe('admin');
        expect(auth.profile.token).toBe('test-token');
    });
});
