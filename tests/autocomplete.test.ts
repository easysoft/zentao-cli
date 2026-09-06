import { describe, expect, test } from 'bun:test';
import { Command } from 'commander';
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
