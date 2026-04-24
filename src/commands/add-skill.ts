import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import type { GlobalOptions } from '../types/index.js';

interface AgentTarget {
    label: string;
    dir: string;
}

const SKILL_NAMES = ['zentao-cli', 'zentao-tour'] as const;

const AGENT_TARGETS: Record<string, AgentTarget> = {
    'claude-code': { label: 'Claude Code', dir: join(homedir(), '.claude', 'skills') },
    'cursor':      { label: 'Cursor',      dir: join(homedir(), '.cursor', 'skills') },
    'cherry-studio': { label: 'Cherry Studio', dir: join(homedir(), '.cherrystudio', 'skills') },
    'codex':       { label: 'Codex',       dir: join(homedir(), '.agents', 'skills') },
    'opencode':    { label: 'OpenCode',    dir: join(homedir(), '.config', 'opencode', 'skills') },
    'vscode':      { label: 'VS Code',     dir: join(homedir(), '.copilot', 'skills') },
    'antigravity': { label: 'Antigravity', dir: join(homedir(), '.gemini', 'antigravity', 'skills') },
    'gemini':      { label: 'Gemini',      dir: join(homedir(), '.gemini', 'skills') },
};

const AGENT_NAMES = Object.keys(AGENT_TARGETS);

function resolveSkillSource(skillName: string): string {
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = dirname(thisFile);

    const candidates = [
        join(thisDir, '..', '..', 'skills', skillName),       // from src/commands/
        join(thisDir, '..', 'skills', skillName),             // from dist/
        join(thisDir, '..', '..', '..', 'skills', skillName), // from dist/ in node_modules
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    throw new Error(
        `找不到技能源目录，已尝试路径:\n${candidates.map((p) => `  - ${p}`).join('\n')}\n` +
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

function copySkillDir(srcDir: string, destDir: string): void {
    mkdirSync(destDir, { recursive: true });
    for (const entry of readdirSync(srcDir)) {
        const srcPath = join(srcDir, entry);
        const destPath = join(destDir, entry);
        if (statSync(srcPath).isDirectory()) {
            copySkillDir(srcPath, destPath);
        } else {
            writeFileSync(destPath, readFileSync(srcPath));
        }
    }
}

function installSkill(agent: string, skillName: string, silent: boolean): void {
    const target = AGENT_TARGETS[agent];
    const sourcePath = resolveSkillSource(skillName);
    const destDir = join(target.dir, skillName);

    copySkillDir(sourcePath, destDir);

    if (!silent) {
        console.log(`已安装 ${skillName} 技能到 ${target.label}: ${tildeDisplay(destDir)}`);
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
                const agents = agent ? resolveAgents(agent) : await promptAgentSelection();

                for (const a of agents) {
                    for (const skillName of SKILL_NAMES) {
                        installSkill(a, skillName, silent);
                    }
                }
            } catch (error) {
                console.error(String((error as Error).message ?? error));
                process.exit(1);
            }
        });
}
