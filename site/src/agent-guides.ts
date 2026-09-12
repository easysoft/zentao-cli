/** Keep integration recipes aligned with CLI behavior and the linked client documentation. */
export type AgentGuide = {
  id: string;
  name: string;
  icon: string;
  summary: string;
  skill?: { command: string; path: string; note: string; verify: string };
  mcp: {
    kind: "command" | "config" | "fields";
    label: string;
    code: string;
    path?: string;
    note: string;
    verify: string;
  };
  prompt: string;
  docs: { label: string; url: string }[];
};

const standardMcp = JSON.stringify(
  { mcpServers: { zentao: { command: "zentao", args: ["mcp"] } } },
  null,
  2,
);
const vscodeMcp = JSON.stringify(
  { servers: { zentao: { type: "stdio", command: "zentao", args: ["mcp"] } } },
  null,
  2,
);
const opencodeMcp = JSON.stringify(
  {
    mcp: {
      zentao: { type: "local", command: ["zentao", "mcp"], enabled: true },
    },
  },
  null,
  2,
);
const taskPrompt = "列出我在禅道中的任务，显示编号、名称和状态，并按状态分组。";
const skillNote = "同时安装 zentao-cli 操作技能与 zentao-tour 上手引导。";
const skillVerify = "重新打开 Agent 会话，让它使用 zentao-cli 技能查询禅道。";

export const agentGuides: AgentGuide[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    icon: "claudecode",
    summary: "让 Claude 在理解代码的同时，读取需求、分析 Bug、跟进任务。",
    skill: {
      command: "zentao add-skill claude-code",
      path: "~/.claude/skills/",
      note: skillNote,
      verify: skillVerify,
    },
    mcp: {
      kind: "command",
      label: "用 Claude Code 注册本地 MCP 服务",
      code: "claude mcp add --transport stdio --scope user zentao -- zentao mcp",
      path: "~/.claude.json",
      note: "在安装了 Claude Code 的终端运行，注册为当前用户可用的本地服务。",
      verify: "打开 Claude Code，运行 /mcp，检查 zentao 服务及其工具。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Claude Code Skills",
        url: "https://code.claude.com/docs/en/skills",
      },
      { label: "Claude Code MCP", url: "https://code.claude.com/docs/en/mcp" },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "cursor",
    summary: "在编辑器的 Agent 对话中，把禅道需求和问题带到代码旁。",
    skill: {
      command: "zentao add-skill cursor",
      path: "~/.cursor/skills/",
      note: skillNote,
      verify: "重新打开 Cursor 的 Agent 会话，让它使用禅道技能查询任务。",
    },
    mcp: {
      kind: "config",
      label: "合并到 Cursor 的 MCP 配置",
      code: standardMcp,
      path: "~/.cursor/mcp.json",
      note: "也可写入项目的 .cursor/mcp.json。将 zentao 条目合并进现有 mcpServers，保留其他服务。",
      verify:
        "在 Cursor 设置的 MCP 服务列表中启用 zentao，然后在 Agent 模式下发起查询。",
    },
    prompt: taskPrompt,
    docs: [
      { label: "Cursor Skills", url: "https://cursor.com/docs/skills" },
      { label: "Cursor MCP", url: "https://cursor.com/docs/mcp" },
    ],
  },
  {
    id: "codex",
    name: "Codex",
    icon: "codex",
    summary: "让 Codex 带着禅道中的任务和需求上下文开展开发工作。",
    skill: {
      command: "zentao add-skill codex",
      path: "~/.agents/skills/",
      note: "安装到 Codex 支持的个人技能目录，包含操作技能与上手引导。",
      verify: skillVerify,
    },
    mcp: {
      kind: "command",
      label: "用 Codex 注册本地 MCP 服务",
      code: "codex mcp add zentao -- zentao mcp",
      path: "~/.codex/config.toml",
      note: "在已安装 Codex CLI 的终端运行。Codex 应用和 CLI 可使用该用户配置。",
      verify: "运行 codex mcp list 检查注册结果，再开启新会话查询禅道。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Codex Skills",
        url: "https://developers.openai.com/codex/skills/",
      },
      { label: "Codex MCP", url: "https://developers.openai.com/codex/mcp/" },
    ],
  },
  {
    id: "vscode",
    name: "VS Code Copilot",
    icon: "githubcopilot",
    summary: "在 Copilot 的 Agent 模式中使用禅道技能或 MCP 工具。",
    skill: {
      command: "zentao add-skill vscode",
      path: "~/.copilot/skills/",
      note: skillNote,
      verify: "重新打开 Copilot Chat 并选择 Agent 模式，发送下面的提问。",
    },
    mcp: {
      kind: "config",
      label: "添加到 VS Code 的 MCP 用户配置",
      code: vscodeMcp,
      path: "命令面板 → MCP: Open User Configuration",
      note: "将 zentao 条目合并到 servers 中。仅供当前项目使用时，可写入 .vscode/mcp.json。",
      verify:
        "在 MCP 配置中启动 zentao，按 VS Code 提示确认服务信任，再在 Agent 模式选择其工具。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Copilot Agent Skills",
        url: "https://code.visualstudio.com/docs/agent-customization/agent-skills",
      },
      {
        label: "VS Code MCP",
        url: "https://code.visualstudio.com/docs/agents/reference/mcp-configuration",
      },
    ],
  },
  {
    id: "opencode",
    name: "OpenCode",
    icon: "opencode",
    summary: "让终端中的 OpenCode 读取禅道信息，延续你的开发流程。",
    skill: {
      command: "zentao add-skill opencode",
      path: "~/.config/opencode/skills/",
      note: skillNote,
      verify: skillVerify,
    },
    mcp: {
      kind: "config",
      label: "合并到 OpenCode 用户配置",
      code: opencodeMcp,
      path: "~/.config/opencode/opencode.json",
      note: "也支持项目级 opencode.json 或 opencode.jsonc。把 zentao 条目合并到 mcp 中，保留其他配置。",
      verify: "重新打开 OpenCode 会话，检查 MCP 服务状态，再让它调用禅道工具。",
    },
    prompt: taskPrompt,
    docs: [
      { label: "OpenCode Skills", url: "https://opencode.ai/docs/skills/" },
      { label: "OpenCode MCP", url: "https://opencode.ai/docs/mcp-servers/" },
    ],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    icon: "geminicli",
    summary: "在 Gemini CLI 的对话中查询禅道，也可通过 MCP 暴露项目工具。",
    skill: {
      command: "zentao add-skill gemini",
      path: "~/.gemini/skills/",
      note: skillNote,
      verify:
        "重新打开 Gemini CLI，通过 /skills 检查技能，并让它查询禅道任务。",
    },
    mcp: {
      kind: "command",
      label: "用 Gemini CLI 注册 MCP 服务",
      code: "gemini mcp add --scope user zentao zentao mcp",
      path: "~/.gemini/settings.json",
      note: "在已安装 Gemini CLI 的终端运行，使用其官方配置管理命令。",
      verify:
        "运行 gemini mcp list，或在 Gemini CLI 中运行 /mcp 检查 zentao 服务。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Gemini CLI Skills",
        url: "https://geminicli.com/docs/cli/using-agent-skills/",
      },
      {
        label: "Gemini CLI MCP",
        url: "https://geminicli.com/docs/tools/mcp-server/",
      },
    ],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    icon: "antigravity",
    summary: "在 Antigravity IDE 的项目中使用禅道技能，或通过设置添加 MCP。",
    skill: {
      command: "zentao add-skill --output .agents/skills",
      path: "当前项目/.agents/skills/",
      note: "在项目根目录运行，将技能导出到 Antigravity IDE 当前支持的工作区目录。",
      verify: "重新打开该项目的 Agent 会话，让它使用 zentao-cli 技能查询禅道。",
    },
    mcp: {
      kind: "config",
      label: "从 IDE 打开 MCP 配置并合并",
      code: standardMcp,
      path: "Agent 面板 … → MCP Servers → Manage MCP Servers → View raw config",
      note: "通过 IDE 打开实际使用的配置文件，将 zentao 条目合并到 mcpServers 中。",
      verify: "保存后回到 MCP 服务面板刷新，确认 zentao 可用，再开启查询。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Antigravity Skills",
        url: "https://antigravity.google/docs/skills",
      },
      { label: "Antigravity MCP", url: "https://antigravity.google/docs/mcp" },
    ],
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    icon: "claude",
    summary: "通过本地 MCP 服务，在 Claude 桌面版对话中查询和操作禅道。",
    mcp: {
      kind: "config",
      label: "添加本地 MCP 服务",
      code: standardMcp,
      path: "Settings → Developer → Edit Config",
      note: "在 macOS 或 Windows 桌面版中打开配置，将 zentao 合并到现有 mcpServers。",
      verify:
        "完全退出并重启 Claude Desktop，在新会话的工具列表中检查 zentao。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Claude Desktop 本地 MCP 指南",
        url: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
      },
    ],
  },
  {
    id: "cherry-studio",
    name: "Cherry Studio",
    icon: "cherrystudio",
    summary: "使用 STDIO 服务接入禅道，并在支持工具调用的会话中启用。",
    mcp: {
      kind: "fields",
      label: "在设置中手动添加 MCP 服务器",
      code: "名称：zentao\n类型：STDIO\n命令：zentao\n参数：mcp",
      path: "设置 → MCP → MCP 服务器 → 添加",
      note: "把上述内容分别填入对应字段。选择支持工具调用的模型；新服务器需要手动绑定到 Agent。",
      verify:
        "启动 zentao 并检查工具，再到 工作 → Agent 菜单 → 编辑 → MCP 启用 zentao，开启对话查询。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Cherry Studio MCP 配置",
        url: "https://docs.cherryai.com.cn/advanced-basic/extensions/mcp",
      },
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf / Cascade",
    icon: "windsurf",
    summary: "为 Windsurf 的 Cascade 添加禅道 MCP 工具。",
    mcp: {
      kind: "config",
      label: "编辑 Cascade 的 MCP 配置",
      code: standardMcp,
      path: "~/.codeium/windsurf/mcp_config.json",
      note: "从 Cascade 右上角 MCPs 或 MCP Servers 设置打开 raw config，将 zentao 合并到 mcpServers。此方法用于 Cascade。",
      verify: "保存并刷新 MCP 服务，在 Cascade 中启用 zentao 后发起查询。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Cascade MCP 配置",
        url: "https://docs.devin.ai/desktop/cascade/mcp",
      },
    ],
  },
  {
    id: "cline",
    name: "Cline",
    icon: "cline",
    summary: "在 Cline 的开发对话中，通过 MCP 查询禅道需求与任务。",
    mcp: {
      kind: "config",
      label: "添加到 Cline 的 MCP 配置",
      code: JSON.stringify(
        {
          mcpServers: {
            zentao: {
              command: "zentao",
              args: ["mcp"],
              disabled: false,
              autoApprove: [],
            },
          },
        },
        null,
        2,
      ),
      path: "MCP Servers → Configure → Configure MCP Servers",
      note: "在打开的配置中合并 zentao 条目；autoApprove 为空时，不预先自动批准工具调用。",
      verify: "保存后检查 zentao 的服务状态和工具列表，再向 Cline 发起查询。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "Cline MCP 指南",
        url: "https://docs.cline.bot/mcp/mcp-overview",
      },
    ],
  },
  {
    id: "trae",
    name: "TRAE",
    icon: "trae",
    summary: "在 TRAE 中添加本地 MCP 服务，将禅道带入智能体工作流。",
    mcp: {
      kind: "config",
      label: "通过 TRAE 设置手动添加服务",
      code: standardMcp,
      path: "设置 → MCP → 添加 → 手动添加",
      note: "在手动添加界面粘贴配置并确认，再为使用的智能体启用该服务。",
      verify: "检查 MCP 列表中的 zentao 服务是否可用，在会话中发送下面的提问。",
    },
    prompt: taskPrompt,
    docs: [
      {
        label: "TRAE 添加 MCP Server",
        url: "https://docs.trae.cn/ide_add-mcp-servers",
      },
    ],
  },
];
