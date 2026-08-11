import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerAddSkillCommand } from '../src/commands/add-skill';

async function captureConsoleLog(fn: () => Promise<void>): Promise<string[]> {
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
        output.push(args.map(String).join(' '));
    };
    try {
        await fn();
    } finally {
        console.log = originalLog;
    }
    return output;
}

describe('add-skill --output', () => {
    test('exports every bundled skill to the specified directory', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'zentao-cli-add-skill-'));
        const outputDir = join(tempDir, 'exported-skills');
        const program = new Command();
        registerAddSkillCommand(program);

        try {
            const output = await captureConsoleLog(async () => {
                await program.parseAsync([
                    'node',
                    'zentao',
                    'add-skill',
                    '--output',
                    outputDir,
                ], { from: 'node' });
            });

            for (const skillName of ['zentao-cli', 'zentao-tour']) {
                const sourceSkill = join(process.cwd(), 'skills', skillName, 'SKILL.md');
                const exportedSkill = join(outputDir, skillName, 'SKILL.md');

                expect(existsSync(exportedSkill)).toBe(true);
                expect(readFileSync(exportedSkill, 'utf-8')).toBe(readFileSync(sourceSkill, 'utf-8'));
                expect(output).toContain(`已导出 ${skillName} 技能到: ${join(outputDir, skillName)}`);
            }

            expect(existsSync(join(outputDir, 'zentao-tour', 'overview.md'))).toBe(true);
            expect(existsSync(join(outputDir, 'zentao-tour', 'roles'))).toBe(true);
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
