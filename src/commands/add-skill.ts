import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import type { GlobalOptions } from '../types/index.js';

interface AgentTarget {
    label: string;
    dir: string;
}

const SKILL_NAME = 'zentao-cli';

const AGENT_TARGETS: Record<string, AgentTarget> = {
    'claude-code': { label: 'Claude Code', dir: join(homedir(), '.claude', 'skills', SKILL_NAME) },
    'cursor':      { label: 'Cursor',      dir: join(homedir(), '.cursor', 'skills', SKILL_NAME) },
    'cherry-studio': { label: 'Cherry Studio', dir: join(homedir(), '.cherrystudio', 'skills', SKILL_NAME) },
    'codex':       { label: 'Codex',       dir: join(homedir(), '.agents', 'skills', SKILL_NAME) },
    'opencode':    { label: 'OpenCode',    dir: join(homedir(), '.config', 'opencode', 'skills', SKILL_NAME) },
    'vscode':      { label: 'VS Code',     dir: join(homedir(), '.copilot', 'skills', SKILL_NAME) },
};

const AGENT_NAMES = Object.keys(AGENT_TARGETS);

function resolveSkillSource(): string {
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = dirname(thisFile);

    const candidates = [
        join(thisDir, '..', '..', 'skills', SKILL_NAME, 'SKILL.md'),       // from src/commands/
        join(thisDir, '..', 'skills', SKILL_NAME, 'SKILL.md'),             // from dist/
        join(thisDir, '..', '..', '..', 'skills', SKILL_NAME, 'SKILL.md'), // from dist/ in node_modules
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    throw new Error(
        `找不到 SKILL.md 源文件，已尝试路径:\n${candidates.map((p) => `  - ${p}`).join('\n')}\n` +
        '请确认 zentao-cli 安装完整，或从源码目录运行。',
    );
}

function tildeDisplay(absPath: string): string {
    const home = homedir();
    return absPath.startsWith(home) ? absPath.replace(home, '~') : absPath;
}

async function promptAgentSelection(): Promise<string[]> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new Error(
            `未指定 agent，请在交互终端中选择，或显式传入: ${AGENT_NAMES.join('|')}|all`,
        );
    }

    const choices = [...AGENT_NAMES, 'all'];
    const labels = [
        ...AGENT_NAMES.map((name) => AGENT_TARGETS[name].label),
        '全部安装',
    ];

    const rl = createInterface({ input: process.stdin, output: process.stderr });

    process.stderr.write('请选择要安装的 AI Agent:\n');
    labels.forEach((label, index) => {
        process.stderr.write(`  ${index + 1}) ${label}\n`);
    });

    return new Promise((resolve, reject) => {
        rl.question(`请输入编号 (1-${choices.length}): `, (answer) => {
            rl.close();
            const idx = Number(answer.trim());
            if (!Number.isInteger(idx) || idx < 1 || idx > choices.length) {
                reject(new Error(`无效选择: ${answer || '(empty)'}`));
                return;
            }
            const selected = choices[idx - 1];
            resolve(selected === 'all' ? [...AGENT_NAMES] : [selected]);
        });
    });
}

function resolveAgents(agent: string): string[] {
    const normalized = agent.toLowerCase();
    if (normalized === 'all') return [...AGENT_NAMES];
    if (AGENT_TARGETS[normalized]) return [normalized];
    throw new Error(
        `不支持的 agent: ${agent}\n可用选项: ${AGENT_NAMES.join('、')}、all`,
    );
}

function installSkill(agent: string, content: string, silent: boolean): void {
    const target = AGENT_TARGETS[agent];
    const destFile = join(target.dir, 'SKILL.md');

    mkdirSync(target.dir, { recursive: true });
    writeFileSync(destFile, content, 'utf-8');

    if (!silent) {
        console.log(`已安装禅道 CLI 技能到 ${target.label}: ${tildeDisplay(destFile)}`);
    }
}

/** 注册 `zentao add-skill`：安装禅道 CLI 技能到 AI Agent */
export function registerAddSkillCommand(program: Command): void {
    program
        .command('add-skill')
        .description('安装禅道 CLI 技能到 AI Agent')
        .argument('[agent]', `目标 Agent (${AGENT_NAMES.join('|')}|all)`)
        .action(async (agent?: string) => {
            const globalOpts = program.opts() as GlobalOptions;
            const silent = !!globalOpts.silent;

            try {
                const sourcePath = resolveSkillSource();
                const content = readFileSync(sourcePath, 'utf-8');
                const agents = agent ? resolveAgents(agent) : await promptAgentSelection();

                for (const a of agents) {
                    installSkill(a, content, silent);
                }
            } catch (error) {
                console.error(String((error as Error).message ?? error));
                process.exit(1);
            }
        });
}
