import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import mcp from '../connectors/workbuddy/mcp.json';
import { verifyWorkbuddyConfiguration, verifyWorkbuddyLifecycle } from '../scripts/workbuddy-validation.js';

test('WorkBuddy native form declares password and Token authentication for the pinned stdio runtime', () => {
    verifyWorkbuddyConfiguration();
});

test.each(['~/.config/zentao/workbuddy-mcp.json', '/Users/example/zentao.json', 'C:\\Users\\example\\zentao.json', '\\\\host\\share\\zentao.json', '--config=/tmp/zentao.json'])(
    'WorkBuddy rejects nonportable stdio arguments: %s', path => {
        const configuration = structuredClone(mcp);
        Object.values(configuration.mcpServers)[0].args.push(path);
        expect(() => verifyWorkbuddyConfiguration(configuration)).toThrow('stdio args must not contain host paths');
    },
);

test('WorkBuddy stdio authenticates, reuses sessions, isolates credentials and reconnects', async () => {
    const report = await verifyWorkbuddyLifecycle(process.execPath, resolve('src/index.ts'));
    expect(report.transport).toBe('stdio');
    expect(report.checks).toContain('password-login');
    expect(report.checks).toContain('direct-token');
    expect(report.checks).toContain('config-isolation');
    expect(report.checks).toContain('portable-config-path');
    expect(report.checks).toContain('empty-form-no-profile-fallback');
}, 40_000);
