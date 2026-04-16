import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { GlobalOptions } from '../types/index.js';
import { getCurrentProfile } from '../config/store.js';

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
    password: string;
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
    'vscode':         { label: 'VS Code',         configPath: platformAppData('Code', 'User', 'settings.json'),                    format: 'vscode' },
    'cherry-studio':  { label: 'Cherry Studio',   configPath: '',                                                                  format: 'cherry-studio' },
    'opencode':       { label: 'OpenCode',        configPath: join(home, '.config', 'opencode', 'opencode.json'),                  format: 'opencode' },
    'codex':          { label: 'Codex',           configPath: join(home, '.codex', 'config.toml'),                                 format: 'codex' },
};

const AGENT_NAMES = Object.keys(AGENT_TARGETS);

/* ── Helpers ── */

function tildeDisplay(absPath: string): string {
    return absPath.startsWith(home) ? absPath.replace(home, '~') : absPath;
}

/** Strip JS-style comments and trailing commas from JSONC text */
function stripJsonComments(text: string): string {
    let result = '';
    let i = 0;
    let inString = false;

    while (i < text.length) {
        if (inString) {
            if (text[i] === '\\') {
                result += text[i] + (text[i + 1] ?? '');
                i += 2;
                continue;
            }
            if (text[i] === '"') inString = false;
            result += text[i++];
            continue;
        }
        if (text[i] === '"') {
            inString = true;
            result += text[i++];
            continue;
        }
        if (text[i] === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            continue;
        }
        if (text[i] === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        result += text[i++];
    }
    return result.replace(/,(\s*[}\]])/g, '$1');
}

function readJsonFile(filePath: string, jsonc = false): Record<string, unknown> {
    if (!existsSync(filePath)) return {};
    let content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return {};
    if (jsonc) content = stripJsonComments(content);
    try {
        return JSON.parse(content);
    } catch {
        if (!jsonc) return readJsonFile(filePath, true);
        throw new Error(`无法解析配置文件: ${filePath}`);
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
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function tomlEscape(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/* ── Credential Resolution ── */

async function resolveCredentials(): Promise<McpCredentials> {
    const profile = getCurrentProfile();
    if (!profile) {
        throw new Error('未登录禅道，请先运行 zentao login');
    }

    const { server: url, account } = profile;

    if (process.env.ZENTAO_PASSWORD) {
        return { url, account, password: process.env.ZENTAO_PASSWORD };
    }

    if (!process.stdin.isTTY || !process.stderr.isTTY) {
        throw new Error('非交互模式下请设置 ZENTAO_PASSWORD 环境变量');
    }

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve, reject) => {
        rl.question(`请输入禅道密码 [${account}@${url}]: `, (password) => {
            rl.close();
            if (!password.trim()) {
                reject(new Error('密码不能为空'));
                return;
            }
            resolve({ url, account, password: password.trim() });
        });
    });
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

/* ── Config Writers ── */

function buildStandardEntry(creds: McpCredentials) {
    return {
        command: 'npx',
        args: ['-y', 'zentao-cli', 'mcp'],
        env: {
            ZENTAO_URL: creds.url,
            ZENTAO_ACCOUNT: creds.account,
            ZENTAO_PASSWORD: creds.password,
        },
    };
}

function writeMcpServersConfig(configPath: string, creds: McpCredentials): void {
    const config = readJsonFile(configPath);
    deepSet(config, ['mcpServers', MCP_NAME], buildStandardEntry(creds));
    writeJsonFile(configPath, config);
}

function writeVscodeConfig(configPath: string, creds: McpCredentials): void {
    const config = readJsonFile(configPath, true);
    deepSet(config, ['mcp', 'servers', MCP_NAME], {
        type: 'stdio',
        ...buildStandardEntry(creds),
    });
    writeJsonFile(configPath, config);
}

function writeOpenCodeConfig(configPath: string, creds: McpCredentials): void {
    const config = readJsonFile(configPath);
    deepSet(config, ['mcp', MCP_NAME], {
        type: 'local',
        command: ['npx', '-y', 'zentao-cli', 'mcp'],
        env: {
            ZENTAO_URL: creds.url,
            ZENTAO_ACCOUNT: creds.account,
            ZENTAO_PASSWORD: creds.password,
        },
        enabled: true,
    });
    writeJsonFile(configPath, config);
}

function writeCodexToml(configPath: string, creds: McpCredentials): void {
    mkdirSync(dirname(configPath), { recursive: true });

    let content = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '';

    const sectionHeader = `[mcp_servers.${MCP_NAME}]`;
    const section = [
        sectionHeader,
        'command = "npx"',
        'args = ["-y", "zentao-cli", "mcp"]',
        `env = { ZENTAO_URL = "${tomlEscape(creds.url)}", ZENTAO_ACCOUNT = "${tomlEscape(creds.account)}", ZENTAO_PASSWORD = "${tomlEscape(creds.password)}" }`,
    ].join('\n') + '\n';

    const headerIdx = content.indexOf(sectionHeader);
    if (headerIdx >= 0) {
        let nextSectionIdx = content.indexOf('\n[', headerIdx + sectionHeader.length);
        if (nextSectionIdx < 0) {
            content = content.substring(0, headerIdx) + section;
        } else {
            content = content.substring(0, headerIdx) + section + content.substring(nextSectionIdx);
        }
    } else {
        const trimmed = content.trimEnd();
        content = (trimmed ? trimmed + '\n\n' : '') + section;
    }

    writeFileSync(configPath, content, 'utf-8');
}

function printCherryStudioConfig(creds: McpCredentials, silent: boolean): void {
    if (silent) return;
    const entry = buildStandardEntry(creds);
    process.stderr.write('\nCherry Studio 不支持文件配置，请在 Settings > MCP Server 中手动添加:\n\n');
    console.log(JSON.stringify({ name: MCP_NAME, type: 'stdio', ...entry }, null, 2));
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
            printCherryStudioConfig(creds, silent);
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

            try {
                const agents = agent ? resolveAgents(agent) : await promptAgentSelection();
                const creds = await resolveCredentials();

                for (const a of agents) {
                    installMcp(a, creds, silent);
                }
            } catch (error) {
                console.error(String((error as Error).message ?? error));
                process.exit(1);
            }
        });
}
