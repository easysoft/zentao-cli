import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CommanderError } from 'commander';
import { createProgram } from '../src/cli.js';
import { runCliWithoutAuth } from './helpers.js';
function markdownFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? markdownFiles(join(dir, entry.name)) : entry.name.endsWith('.md') ? [join(dir, entry.name)] : []);
}
function shellWords(line: string): string[] {
    const words: string[] = []; let value = ''; let quote = '';
    for (const char of line) {
        if (quote) { if (char === quote) quote = ''; else value += char; }
        else if (char === '"' || char === "'") quote = char;
        else if (/\s/.test(char)) { if (value) words.push(value); value = ''; }
        else value += char;
    }
    if (value) words.push(value); return words;
}
test('concrete bundled skill examples use the real command tree without invoking any action', async () => {
    let checked = 0;
    for (const file of markdownFiles('skills')) {
        let fenced = false;
        for (const line of readFileSync(file, 'utf8').split('\n')) {
            if (line.startsWith('```')) { fenced = !fenced; continue; }
            if (!fenced || !line.trim().startsWith('zentao ') || /<[^ ]+>|\.\.\./.test(line)) continue;
            const words = shellWords(line.trim()).slice(1);
            const redirect = words.findIndex(word => ['<', '>', '|', '#'].includes(word));
            if (redirect >= 0) words.splice(redirect);
            const stop = new Error('parsed');
            const program = createProgram().configureOutput({ writeOut: () => {}, writeErr: () => {} });
            program.hook('preAction', () => { throw stop; });
            let error: unknown;
            try { await program.parseAsync(words, { from: 'user' }); } catch (caught) { error = caught; }
            expect(error === stop || error instanceof CommanderError && error.exitCode === 0, `${file}: ${line}\n${String(error)}`).toBe(true);
            checked++;
        }
    }
    expect(checked).toBeGreaterThan(30);
});
test('help and machine schemas are offline and advertise only supported capabilities', async () => {
    for (const args of [['help', 'bug'], ['bug', '--help'], ['bug', 'resolve', '--help'], ['help', 'bug', 'resolve', '--format=json']]) {
        const result = await runCliWithoutAuth(args); expect(result.exitCode, result.stderr).toBe(0);
    }
    const unpaged = await runCliWithoutAuth(['story', 'get-grades', '--help']);
    expect(unpaged.stdout).not.toContain('--all');
    const paged = await runCliWithoutAuth(['release', 'list', '--help']);
    expect(paged.stdout).toContain('--all'); expect(paged.stdout).toContain('--page-size');
    const calendar = JSON.parse((await runCliWithoutAuth(['help', 'resourcecalendar', 'get', '--format=json'])).stdout);
    expect(calendar.data.target).toBeUndefined();
    const product = JSON.parse((await runCliWithoutAuth(['help', 'product', 'get', '--format=json'])).stdout);
    expect(product.data.target).toBe('productID');
});
