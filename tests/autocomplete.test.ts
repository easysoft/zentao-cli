import { expect, test } from 'bun:test';
import { generateCompletionScript, completionCandidates } from '../src/commands/autocomplete.js';
import { createProgram } from '../src/cli.js';
import { runCliWithoutAuth } from './helpers.js';

test.each(['bash', 'zsh', 'fish'])('%s completion is an offline stdout artifact', async shell => {
    const result = await runCliWithoutAuth(['completion', shell]);
    expect(result.exitCode).toBe(0); expect(result.stderr).toBe('');
    expect(result.stdout).toBe(generateCompletionScript(shell));
    expect(result.stdout).toContain('zentao completion candidates');
});
test('completion discovers actions and action options with preceding global flags', () => {
    const program = createProgram();
    expect(completionCandidates(program, ['--config', '/tmp/example.json', 'doc', 'create-'])).toContain('create-my-doc');
    expect(completionCandidates(program, ['--profile=admin', 'doc', 'create-my-doc', '--space'])).toEqual(['--space-id']);
    expect(completionCandidates(program, ['mcp', ''])).toContain('serve');
    expect(completionCandidates(program, ['--format', 'j'])).toEqual(['json']);
});
