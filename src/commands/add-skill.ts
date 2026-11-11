import { brandText } from '../brand.js';
import { commandSignal } from '../utils/lifecycle.js';
import { emitResult } from '../utils/output.js';
import { Command } from 'commander';
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import type { GlobalOptions } from '../types/index.js';
import { ZentaoError } from '../errors.js';

interface AgentTarget {
    label: string;
    dir: string;
}

interface AddSkillOptions {
    output?: string;
}

type SkillSource =
    | { type: 'directory'; path: string }
    | { type: 'embedded'; files: Record<string, string> };

declare const BUILD_SKILL_FILES: Record<string, string> | undefined;

const SKILL_NAMES = [brandText('zentao-cli'), brandText('zentao-tour')] as const;

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

export const AGENT_NAMES = Object.keys(AGENT_TARGETS);

function resolveSkillSource(skillName: string): SkillSource {
    if (typeof BUILD_SKILL_FILES !== 'undefined') {
        const prefix = `${skillName}/`;
        const files = Object.fromEntries(
            Object.entries(BUILD_SKILL_FILES)
                .filter(([path]) => path.startsWith(prefix))
                .map(([path, content]) => [path.slice(prefix.length), content]),
        );
        if (files['SKILL.md'] === undefined) {
            throw new ZentaoError('E2009', {
                option: 'add-skill',
                reason: brandText`找不到内置技能: ${skillName}，请重新安装完整的 zentao-cli。`,
            });
        }
        return { type: 'embedded', files };
    }

    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = dirname(thisFile);

    const candidates = [
        join(thisDir, '..', '..', 'skills', skillName),       // from src/commands/
        join(thisDir, '..', 'skills', skillName),             // from dist/
        join(thisDir, '..', '..', '..', 'skills', skillName), // from dist/ in node_modules
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) return { type: 'directory', path: candidate };
    }

    throw new Error(
        `找不到技能源目录，已尝试路径:\n${candidates.map((p) => `  - ${p}`).join('\n')}\n` +
        brandText('请确认 zentao-cli 安装完整，或从源码目录运行。'),
    );
}

function tildeDisplay(absPath: string): string {
    const home = homedir();
    return absPath.startsWith(home) ? absPath.replace(home, '~') : absPath;
}

async function promptAgentSelection(): Promise<string[]> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new ZentaoError('E2009', { option: 'agent', reason: `未指定 agent，请显式传入: ${AGENT_NAMES.join('|')}|all` });
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

    try {
        const answer = await rl.question(`请输入编号 (1-${choices.length}): `, { signal: commandSignal() });
        const idx = Number(answer.trim());
        if (!Number.isInteger(idx) || idx < 1 || idx > choices.length) {
            throw new ZentaoError('E2009', { option: 'agent', reason: `无效选择: ${answer || '(empty)'}` });
        }
        const selected = choices[idx - 1];
        return selected === 'all' ? [...AGENT_NAMES] : [selected];
    } finally {
        rl.close();
    }
}

function resolveAgents(agent: string): string[] {
    const normalized = agent.toLowerCase();
    if (normalized === 'all') return [...AGENT_NAMES];
    if (AGENT_TARGETS[normalized]) return [normalized];
    throw new ZentaoError('E2009', { option: 'agent', reason:
        `不支持的 agent: ${agent}\n可用选项: ${AGENT_NAMES.join('、')}、all`,
    });
}

function assertDestinationOutsideSource(srcDir: string, destDir: string): void {
    const relativeDestination = relative(resolve(srcDir), resolve(destDir));
    const parentPrefix = '..' + sep;
    const destinationIsWithinSource = relativeDestination === ''
        || (!isAbsolute(relativeDestination)
            && relativeDestination !== '..'
            && !relativeDestination.startsWith(parentPrefix));
    if (destinationIsWithinSource) {
        throw new Error('技能目标路径不能是技能源目录或其子目录: ' + destDir);
    }
}

function assertSkillDestination(source: SkillSource, destDir: string): void {
    if (source.type === 'directory') {
        assertDestinationOutsideSource(source.path, destDir);
    }

    if (existsSync(destDir) && !statSync(destDir).isDirectory()) {
        throw new Error(`技能目标路径必须是目录: ${destDir}`);
    }
}

function copySkill(source: SkillSource, destDir: string): void {
    assertSkillDestination(source, destDir);

    if (source.type === 'directory') {
        cpSync(source.path, destDir, { recursive: true, dereference: true });
        return;
    }

    for (const [path, content] of Object.entries(source.files)) {
        const target = join(destDir, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(content, 'base64'));
    }
}

function resolveOutputDir(output: string): string {
    const trimmed = output.trim();
    if (!trimmed) {
        throw new Error('导出路径不能为空');
    }

    const expanded = trimmed === '~'
        ? homedir()
        : trimmed.replace(/^~[\\/]/, `${homedir()}/`);
    const outputDir = resolve(expanded);

    if (existsSync(outputDir) && !statSync(outputDir).isDirectory()) {
        throw new Error(`导出路径必须是目录: ${outputDir}`);
    }

    return outputDir;
}

function installSkill(agent: string, skillName: string) {
    const target = AGENT_TARGETS[agent];
    const source = resolveSkillSource(skillName);
    const destDir = join(target.dir, skillName);

    copySkill(source, destDir);

    return { skill: skillName, agent, path: destDir };
}

function exportSkills(output: string) {
    const outputDir = resolveOutputDir(output);
    const skills = SKILL_NAMES.map((skillName) => ({
        skillName,
        source: resolveSkillSource(skillName),
        destDir: join(outputDir, skillName),
    }));

    for (const { source, destDir } of skills) {
        assertSkillDestination(source, destDir);
    }

    for (const { skillName, source, destDir } of skills) {
        copySkill(source, destDir);
    }
    return skills.map(({ skillName, destDir }) => ({ skill: skillName, path: destDir }));
}

export function registerAddSkillCommand(program: Command): void {
    program.command('install').description('安装技能到指定 Agent').argument('[agent]', AGENT_NAMES.join('|') + '|all')
        .action(async (agent: string | undefined, _opts, cmd: Command) => {
            const options = cmd.optsWithGlobals();
            if (!agent && options.input === false) throw new ZentaoError('E2009', { option: 'agent', reason: '--no-input 时必须指定安装目标' });
            const agents = agent ? resolveAgents(agent) : await promptAgentSelection();
            emitResult(agents.flatMap(name => SKILL_NAMES.map(skill => installSkill(name, skill))), options);
        });
    program.command('export').description('导出技能到指定目录').argument('<directory>')
        .action((directory: string, _opts, cmd: Command) => emitResult(exportSkills(directory), cmd.optsWithGlobals()));
}
