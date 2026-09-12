import { Command } from 'commander';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseTOML, type AST } from 'toml-eslint-parser';
import type { GlobalOptions } from '../types/index.js';
import { ensureAuth } from '../auth/flow.js';
import { ZentaoError } from '../errors.js';

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
    'claude-code':    { label: 'Claude Code',     configPath: join(home, '.claude.json'),                                          format: 'mcpServers' },
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
        environment: {
            ZENTAO_URL: creds.url,
            ZENTAO_ACCOUNT: creds.account,
            ZENTAO_TOKEN: creds.token,
        },
        enabled: true,
    });
    writeJsonFile(configPath, config);
}

function getTableLineRange(content: string, table: AST.TOMLTable): [number, number] {
    const start = content.lastIndexOf('\n', table.range[0] - 1) + 1;
    const newline = content.indexOf('\n', table.range[1]);
    return [start, newline < 0 ? content.length : newline + 1];
}

function replaceCodexServerSection(content: string, section: string, newline: string): string {
    const ast = parseTOML(content);
    const tables = ast.body[0].body.filter((node): node is AST.TOMLTable =>
        node.type === 'TOMLTable'
        && node.resolvedKey[0] === 'mcp_servers'
        && node.resolvedKey[1] === MCP_NAME,
    );
    const ranges = tables.map((table) => getTableLineRange(content, table));
    let updated = content;

    if (ranges.length > 0) {
        // Replace the first target table and remove every descendant, even if
        // unrelated tables occur between them. Source ranges preserve other text.
        for (let i = ranges.length - 1; i >= 0; i--) {
            const [start, end] = ranges[i];
            updated = updated.slice(0, start) + (i === 0 ? section : '') + updated.slice(end);
        }
    } else {
        const separator = !content || content.endsWith(newline + newline)
            ? '' : content.endsWith('\n') ? newline : newline + newline;
        updated = content + separator + section;
    }

    // Inline or dotted declarations can conflict with the new table. Validate
    // before writing rather than risk replacing unrelated configuration.
    parseTOML(updated);
    return updated;
}

function writeCodexToml(configPath: string, creds: McpCredentials): void {
    try {
        const content = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '';
        const newline = content.match(/\r?\n/)?.[0] ?? '\n';
        const section = [
            `[mcp_servers.${MCP_NAME}]`,
            'command = "zentao"',
            'args = ["mcp"]',
            `env = { ZENTAO_URL = ${JSON.stringify(creds.url)}, ZENTAO_ACCOUNT = ${JSON.stringify(creds.account)}, ZENTAO_TOKEN = ${JSON.stringify(creds.token)} }`,
        ].join(newline) + newline;

        writePrivateFile(configPath, replaceCodexServerSection(content, section, newline));
    } catch {
        // Parser errors may contain configuration values, including credentials.
        throw new ZentaoError('E1005', { path: configPath });
    }
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
