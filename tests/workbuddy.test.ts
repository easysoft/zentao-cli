import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import cli from '../connectors/workbuddy/cli.json';
import { verifyWorkbuddyLifecycle } from '../scripts/workbuddy-validation.js';

test('WorkBuddy callbacks complete authentication, verification, expiry, revocation and recovery', async () => {
    const report = await verifyWorkbuddyLifecycle(cli, process.execPath, resolve('src/index.ts'));
    expect(report.checks).toHaveLength(15);
}, 40_000);
