import { Command } from 'commander';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { GlobalOptions } from '../types/index.js';
import { ensureAuth } from '../auth/flow.js';

/* ── Types ── */

type ConfigFormat = 'mcpServers' | 'vscode' | 'opencode' | 'codex' | 'cherry-studio';

interface McpAgentTarget {
    label: string;
    configPath: string;
    format: ConfigFormat;
}

interface McpCredentials {
    url: string;
    account: string;
    token: string;
}

/* ── Constants ── */

const MCP_NAME = 'zentao-cli';
const home = homedir();

function platformAppData(...segments: string[]): string {
    switch (process.platform) {
        case 'darwin':
            return join(home, 'Library', 'Application Support', ...segments);
        case 'win32':
            return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), ...segments);
        default:
            return join(home, '.config', ...segments);
    }
}

const AGENT_TARGETS: Record<string, McpAgentTarget> = {
    'cursor':         { label: 'Cursor',         configPath: join(home, '.cursor', 'mcp.json'),                                   format: 'mcpServers' },
    'claude-desktop': { label: 'Claude Desktop',  configPath: platformAppData('Claude', 'claude_desktop_config.json'),              format: 'mcpServers' },
    'claude-code':    { label: 'Claude Code',     configPath: join(home, '.claude', 'settings.json'),                              format: 'mcpServers' },
    'windsurf':       { label: 'Windsurf',        configPath: join(home, '.codeium', 'windsurf', 'mcp_config.json'),               format: 'mcpServers' },
    'cline':          { label: 'Cline',           configPath: join(home, '.cline', 'data', 'settings', 'cline_mcp_settings.json'), format: 'mcpServers' },
    'trae':           { label: 'Trae',            configPath: join(home, '.trae', 'mcp.json'),                                     format: 'mcpServers' },
    'vscode':         { label: 'VS Code',         configPath: platformAppData('Code', 'User', 'mcp.json'),                         format: 'vscode' },
    'cherry-studio':  { label: 'Cherry Studio',   configPath: '',                                                                  format: 'cherry-studio' },
    'opencode':       { label: 'OpenCode',        configPath: join(home, '.config', 'opencode', 'opencode.json'),                  format: 'opencode' },
    'codex':          { label: 'Codex',           configPath: join(home, '.codex', 'config.toml'),                                 format: 'codex' },
    'antigravity':    { label: 'Antigravity',     configPath: join(home, '.gemini', 'antigravity', 'mcp_config.json'),             format: 'mcpServers' },
    'gemini':         { label: 'Gemini',          configPath: join(home, '.gemini', 'mcp_config.json'),                            format: 'mcpServers' },
};

export const AGENT_NAMES = Object.keys(AGENT_TARGETS);

/* ── Helpers ── */

function tildeDisplay(absPath: string): string {
    return absPath.startsWith(home) ? absPath.replace(home, '~') : absPath;
}

function readJsonFile(filePath: string): Record<string, unknown> {
    if (!existsSync(filePath)) return {};
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return {};
    try {
        const parsed = JSON.parse(content) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Config root must be an object');
        }
        return parsed as Record<string, unknown>;
    } catch {
        throw new Error(`无法安全更新包含注释或无效 JSON 的配置文件，请手动配置: ${filePath}`);
    }
}

function deepSet(obj: Record<string, unknown>, keyPath: string[], value: unknown): void {
    let current = obj;
    for (let i = 0; i < keyPath.length - 1; i++) {
        const key = keyPath[i];
        if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }
    current[keyPath[keyPath.length - 1]] = value;
}

function writeJsonFile(filePath: string, data: Record<string, unknown>): void {
    writePrivateFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

function writePrivateFile(filePath: string, content: string): void {
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    try {
        writeFileSync(tempPath, content, { encoding: 'utf-8', mode: 0o600 });
        if (process.platform !== 'win32') chmodSync(tempPath, 0o600);
        renameSync(tempPath, filePath);
        if (process.platform !== 'win32') chmodSync(filePath, 0o600);
    } catch (error) {
        if (existsSync(tempPath)) unlinkSync(tempPath);
        throw error;
    }
}

/* ── Credential Resolution ── */

async function resolveCredentials(options: { insecure?: boolean; timeout?: number }): Promise<McpCredentials> {
    const { profile } = await ensureAuth(options);
    return { url: profile.server, account: profile.account, token: profile.token };
}

/* ── Agent Selection ── */

async function promptAgentSelection(): Promise<string[]> {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new Error(
            `未指定 agent，请在交互终端中选择，或显式传入: ${AGENT_NAMES.join('|')}|all`,
        );
    }

    const choices = [...AGENT_NAMES, 'all'];
    const labels = [
        ...AGENT_NAMES.map((name) => AGENT_TARGETS[name].label),
        '全部配置',
    ];

    const rl = createInterface({ input: process.stdin, output: process.stderr });

    process.stderr.write('请选择要配置的 AI Agent:\n');
    labels.forEach((label, index) => {
        const num = String(index + 1).padStart(2);
        process.stderr.write(`  ${num}) ${label}\n`);
    });

    try {
        const answer = await rl.question(`请输入编号 (1-${choices.length}): `);
        const idx = Number(answer.trim());
        if (!Number.isInteger(idx) || idx < 1 || idx > choices.length) {
            throw new Error(`无效选择: ${answer || '(empty)'}`);
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
    throw new Error(
        `不支持的 agent: ${agent}\n可用选项: ${AGENT_NAMES.join('、')}、all`,
    );
}

/* ── Config Writers ── */

function buildStandardEntry(creds: McpCredentials) {
    return {
        command: 'zentao',
        args: ['mcp'],
        env: {
            ZENTAO_URL: creds.url,
            ZENTAO_ACCOUNT: creds.account,
            ZENTAO_TOKEN: creds.token,
        },
    };
}

function writeMcpServersConfig(configPath: string, creds: McpCredentials): void {
    const config = readJsonFile(configPath);
    deepSet(config, ['mcpServers', MCP_NAME], buildStandardEntry(creds));
    writeJsonFile(configPath, config);
}

function writeVscodeConfig(configPath: string, creds: McpCredentials): void {
    const config = readJsonFile(configPath);
    deepSet(config, ['servers', MCP_NAME], {
        type: 'stdio',
        ...buildStandardEntry(creds),
    });
    writeJsonFile(configPath, config);
}

function writeOpenCodeConfig(configPath: string, creds: McpCredentials): void {
    const config = readJsonFile(configPath);
    deepSet(config, ['mcp', MCP_NAME], {
        type: 'local',
        command: ['zentao', 'mcp'],
        env: {
            ZENTAO_URL: creds.url,
            ZENTAO_ACCOUNT: creds.account,
            ZENTAO_TOKEN: creds.token,
        },
        enabled: true,
    });
    writeJsonFile(configPath, config);
}

function writeCodexToml(configPath: string, creds: McpCredentials): void {
    let content = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '';

    const sectionHeader = `[mcp_servers.${MCP_NAME}]`;
    const section = [
        sectionHeader,
        'command = "zentao"',
        'args = ["mcp"]',
        `env = { ZENTAO_URL = ${JSON.stringify(creds.url)}, ZENTAO_ACCOUNT = ${JSON.stringify(creds.account)}, ZENTAO_TOKEN = ${JSON.stringify(creds.token)} }`,
    ].join('\n') + '\n';

    const target = /^[ \t]*\[mcp_servers\.zentao-cli\][ \t]*(?:#[^\r\n]*)?\r?$/m.exec(content);
    if (target) {
        const nextSection = /^[ \t]*\[{1,2}[^\r\n]+\]{1,2}[ \t]*(?:#[^\r\n]*)?\r?$/gm;
        nextSection.lastIndex = target.index + target[0].length;
        const next = nextSection.exec(content);
        content = content.slice(0, target.index) + section + content.slice(next?.index ?? content.length);
    } else {
        const trimmed = content.trimEnd();
        content = (trimmed ? trimmed + '\n\n' : '') + section;
    }

    writePrivateFile(configPath, content);
}

function printCherryStudioConfig(silent: boolean): void {
    if (silent) return;
    process.stderr.write('\nCherry Studio 不支持文件配置，请在 Settings > MCP Server 中手动添加（运行时复用当前登录）:\n\n');
    console.log(JSON.stringify({
        name: MCP_NAME,
        type: 'stdio',
        command: 'zentao',
        args: ['mcp'],
    }, null, 2));
}

/* ── Main Install Logic ── */

function installMcp(agent: string, creds: McpCredentials, silent: boolean): void {
    const target = AGENT_TARGETS[agent];

    switch (target.format) {
        case 'mcpServers':
            writeMcpServersConfig(target.configPath, creds);
            break;
        case 'vscode':
            writeVscodeConfig(target.configPath, creds);
            break;
        case 'opencode':
            writeOpenCodeConfig(target.configPath, creds);
            break;
        case 'codex':
            writeCodexToml(target.configPath, creds);
            break;
        case 'cherry-studio':
            printCherryStudioConfig(silent);
            return;
    }

    if (!silent) {
        console.log(`已配置 MCP 到 ${target.label}: ${tildeDisplay(target.configPath)}`);
    }
}

/* ── Command Registration ── */

/** 注册 `zentao add-mcp`：配置禅道 MCP 服务到 AI Agent */
export function registerAddMcpCommand(program: Command): void {
    program
        .command('add-mcp')
        .description('配置禅道 MCP 服务到 AI Agent')
        .argument('[agent]', `目标 Agent (${AGENT_NAMES.join('|')}|all)`)
        .action(async (agent?: string) => {
            const globalOpts = program.opts() as GlobalOptions;
            const silent = !!globalOpts.silent;

            const agents = agent ? resolveAgents(agent) : await promptAgentSelection();
            const creds = await resolveCredentials({
                insecure: globalOpts.insecure,
                timeout: globalOpts.timeout,
            });

            for (const a of agents) {
                installMcp(a, creds, silent);
            }
        });
}
