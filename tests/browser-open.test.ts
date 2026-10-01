import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canOpenBrowser } from '../src/auth/browser-open';

describe('desktop browser detection', () => {
    test('supports desktop Agents without requiring a TTY', () => {
        expect(canOpenBrowser('darwin', {})).toBe(true);
        expect(canOpenBrowser('win32', { SESSIONNAME: 'Console' })).toBe(true);
        expect(canOpenBrowser('linux', { DISPLAY: ':0' })).toBe(true);
        expect(canOpenBrowser('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(true);
        expect(canOpenBrowser('darwin', { CI: 'false' })).toBe(true);
    });

    test('avoids remote, CI, service, container and headless sessions', () => {
        for (const platform of ['darwin', 'linux', 'win32'] as const) {
            for (const env of [{ SSH_CONNECTION: 'host' }, { SSH_CLIENT: 'host' }, { SSH_TTY: '/dev/pts/0' }, { CI: 'true' }, { container: 'docker' }]) {
                expect(canOpenBrowser(platform, { DISPLAY: ':0', ...env })).toBe(false);
            }
        }
        expect(canOpenBrowser('linux', {})).toBe(false);
        expect(canOpenBrowser('win32', { SESSIONNAME: 'Services' })).toBe(false);
        expect(canOpenBrowser('freebsd', { DISPLAY: ':0' })).toBe(false);
    });
});

describe.skipIf(process.platform !== 'darwin' && process.platform !== 'linux')('native browser opener', () => {
    async function runOpener(script?: string): Promise<{ opened: boolean; argument?: string }> {
        const dir = mkdtempSync(join(tmpdir(), 'zentao-browser-open-'));
        const argumentFile = join(dir, 'argument');
        const url = 'http://127.0.0.1:4321/?value=$(echo unsafe)&quote="literal"';
        try {
            if (script) writeFileSync(join(dir, process.platform === 'darwin' ? 'open' : 'xdg-open'), script, { mode: 0o700 });
            const proc = Bun.spawn({
                cmd: [process.execPath, '-e', `import { openBrowser } from './src/auth/browser-open.ts'; console.log(await openBrowser(${JSON.stringify(url)}));`],
                cwd: process.cwd(),
                env: { ...process.env, PATH: dir, OPENED_URL_FILE: argumentFile },
                stdout: 'pipe',
                stderr: 'pipe',
            });
            const [output, error, exit] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
            expect(exit).toBe(0);
            expect(error).toBe('');
            const argument = script?.includes('OPENED_URL_FILE') ? readFileSync(argumentFile, 'utf8') : undefined;
            if (argument) expect(argument).toBe(url);
            return { opened: output.trim() === 'true', argument };
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }

    test('passes the URL as one literal argument without a shell', async () => {
        expect(await runOpener('#!/bin/sh\nprintf \'%s\' "$1" > "$OPENED_URL_FILE"\n')).toMatchObject({ opened: true });
    });

    test('reports missing or failing launchers without throwing', async () => {
        expect(await runOpener()).toEqual({ opened: false, argument: undefined });
        expect(await runOpener('#!/bin/sh\nexit 1\n')).toEqual({ opened: false, argument: undefined });
    });

    test('returns when a desktop launcher stays alive', async () => {
        expect(await runOpener('#!/bin/sh\nexec /bin/sleep 7\n')).toEqual({ opened: true, argument: undefined });
    }, 8_000);
});
