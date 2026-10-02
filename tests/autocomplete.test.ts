import { describe, expect, test } from 'bun:test';
import { Command } from 'commander';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGENT_NAMES as MCP_AGENT_NAMES } from '../src/commands/add-mcp.js';
import { AGENT_NAMES as SKILL_AGENT_NAMES } from '../src/commands/add-skill.js';
import { generateCompletionScript } from '../src/commands/autocomplete.js';
import { registerModuleCommands } from '../src/commands/register-modules.js';

function makeProgram(): Command {
    const program = new Command()
        .version('1.0.0')
        .helpOption('-h, --help')
        .option('--config <file>')
        .option('--machine-readable');
    for (const name of ['help', 'mcp', 'upgrade']) program.command(name);
    registerModuleCommands(program);
    return program;
}

describe('autocomplete scripts', () => {
    test('writes completion under XDG_CONFIG_HOME and quotes its source path', async () => {
        const directory = mkdtempSync(join(tmpdir(), 'zentao-completion-'));
        const xdg = join(directory, "config's directory");
        const file = join(xdg, 'zentao', '.zentao-completion.bash');
        try {
            const child = Bun.spawn({
                cmd: [process.execPath, '--no-env-file', 'src/index.ts', '--config', join(directory, 'other.json'), 'autocomplete', 'bash'],
                env: { ...process.env, XDG_CONFIG_HOME: xdg },
                stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
            });
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
            ]);
            expect(exitCode).toBe(0);
            expect(stderr).toBe('');
            expect(readFileSync(file, 'utf8')).toContain('# bash completion for zentao');
            expect(stdout).toContain(`source '${file.replaceAll("'", "'\\''")}'`);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    for (const shell of ['bash', 'zsh', 'fish']) {
        test(`${shell} uses registered commands, global options, and agent names`, () => {
            const script = generateCompletionScript(shell, makeProgram());

            for (const value of [
                'help', 'mcp', 'upgrade', '-h', '--help', '-V', '--version', '--config', '--machine-readable',
                ...SKILL_AGENT_NAMES, ...MCP_AGENT_NAMES,
                'getGrades', 'createMyDoc', 'updateLib', 'projectExecutions', 'my', 'todos',
            ]) {
                expect(script).toContain(value);
            }
            expect(script).toContain(shell === 'fish' ? 'productplan plan' : 'productplan|plan');
        });
    }
});
