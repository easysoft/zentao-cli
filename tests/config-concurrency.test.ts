import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { __resetConfigStoreForTests, setConfigPath, saveProfile, setCurrentProfile, getCurrentProfile, getProfile, setProfileConfig, findProfileByKey } from '../src/config/store.js';
import { resolveAuthSource } from '../src/auth/flow.js';
import { mockProfile } from './helpers.js';
const dirs: string[] = [];
afterEach(() => { __resetConfigStoreForTests(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function setup() {
    __resetConfigStoreForTests();
    const dir = mkdtempSync(join(tmpdir(), 'zentao-transaction-')); dirs.push(dir);
    const path = join(dir, 'config.json'); setConfigPath(path); return path;
}
test('saving credentials and editing preferences preserve the selected identity and latest config', () => {
    setup();
    saveProfile(mockProfile);
    expect(getCurrentProfile()).toBeUndefined();
    setCurrentProfile(mockProfile.account);
    const stale = getCurrentProfile()!;
    setProfileConfig(stale, 'timeout', 3333);
    saveProfile({ ...stale, token: 'updated' });
    expect(getCurrentProfile()?.config?.timeout).toBe(3333);
    const other = { ...mockProfile, server: `${mockProfile.server}/other` };
    saveProfile(other);
    setProfileConfig(other, 'timeout', 4444);
    expect(getCurrentProfile()?.server).toBe(mockProfile.server);
    expect(() => findProfileByKey(mockProfile.account)).toThrow('不唯一');
    expect(findProfileByKey(`${mockProfile.account}@${mockProfile.server}`)?.token).toBe('updated');
});
test('concurrent processes update distinct fields without lost writes', async () => {
    const path = setup(); saveProfile(mockProfile);
    const writes = [['timeout', 3333], ['defaultRecPerPage', 42], ['jsonPretty', true], ['batchFailFast', true]];
    const children = writes.map(([key, value]) => Bun.spawn([process.execPath, '--no-env-file', '-e', `
        import {setConfigPath,getProfile,setProfileConfig} from './src/config/store.ts';
        setConfigPath(${JSON.stringify(path)});
        const p=getProfile(${JSON.stringify(mockProfile.account)},${JSON.stringify(mockProfile.server)});
        for(let i=0;i<15;i++) setProfileConfig(p,${JSON.stringify(key)},${JSON.stringify(value)});
    `], { stdout: 'pipe', stderr: 'pipe' }));
    expect(await Promise.all(children.map(child => child.exited))).toEqual([0, 0, 0, 0]);
    expect(getProfile(mockProfile.account, mockProfile.server)?.config).toMatchObject(Object.fromEntries(writes));
});
test('incomplete environment fails, while an explicitly selected profile wins', () => {
    setup(); saveProfile(mockProfile); setCurrentProfile(mockProfile.account);
    const keys = ['ZENTAO_URL', 'ZENTAO_ACCOUNT', 'ZENTAO_TOKEN', 'ZENTAO_PASSWORD'];
    const before = keys.map(key => process.env[key]);
    try {
        keys.forEach(key => delete process.env[key]); process.env.ZENTAO_URL = 'https://other.example.com';
        expect(() => resolveAuthSource()).toThrow();
        expect(resolveAuthSource(mockProfile.account).server).toBe(mockProfile.server);
    } finally { keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; }); }
});
