import type { McpHttpOptions } from './http.js';
import { mcpStartMessages, type McpStartLocale } from './start-messages.js';
import { mcpStartScript } from './start-script.js';

export const mcpStartGuides = [
    { id: 'claude', name: 'Claude Code', docs: 'https://code.claude.com/docs/en/mcp', steps: '将配置合并到 ~/.claude.json 的 mcpServers 中。重新打开会话，在 /mcp 中检查连接。', stepsEn: "Merge into mcpServers in ~/.claude.json. Reopen the session and check the connection with /mcp." },
    { id: 'cursor', name: 'Cursor', docs: 'https://cursor.com/docs/mcp', steps: '将配置合并到用户级 ~/.cursor/mcp.json。在设置的 MCP 页面启用服务，再打开 Agent 会话。', stepsEn: "Merge into ~/.cursor/mcp.json. Enable the server in MCP settings, then open an Agent session." },
    { id: 'codex', name: 'Codex', docs: 'https://developers.openai.com/codex/mcp/', steps: '将配置合并到 ~/.codex/config.toml。重新加载 MCP 或重启应用 / CLI，再确认 zentao-remote 已启用。', stepsEn: "Merge into ~/.codex/config.toml. Reload MCP or restart the app / CLI, then check that zentao-remote is enabled." },
    { id: 'vscode', name: 'VS Code Copilot', docs: 'https://code.visualstudio.com/docs/agent-customization/mcp-servers', steps: '从命令面板运行 MCP: Open User Configuration，将配置合并到用户配置。在 Agent 模式中启用该服务的工具。', stepsEn: "Run MCP: Open User Configuration from the command palette and merge into that config. Enable the server’s tools in Agent mode." },
    { id: 'cherry', name: 'Cherry Studio', docs: 'https://docs.cherryai.com.cn/advanced-basic/extensions/mcp', steps: '在「设置 → MCP → MCP 服务器 → 添加」填写下列信息。启用服务后，在「工作 → Agent 菜单 → 编辑 → MCP」绑定给当前 Agent。', stepsEn: "Open Settings → MCP → MCP Servers → Add and enter these values. Enable the server, then bind it to your Agent in Work → Agent menu → Edit → MCP." },
    { id: 'opencode', name: 'OpenCode', docs: 'https://opencode.ai/docs/mcp-servers/', steps: '将配置合并到用户级 ~/.config/opencode/opencode.json。重新打开 OpenCode，检查 MCP 服务状态。', stepsEn: "Merge into ~/.config/opencode/opencode.json. Reopen OpenCode and check the MCP server status." },
    { id: 'gemini', name: 'Gemini CLI', docs: 'https://geminicli.com/docs/tools/mcp-server/', steps: '将配置合并到 ~/.gemini/settings.json。重新打开 Gemini CLI，通过 /mcp 查看状态。httpUrl 用于 Streamable HTTP。', stepsEn: "Merge into ~/.gemini/settings.json. Reopen Gemini CLI and check the status with /mcp. httpUrl uses Streamable HTTP." },
    { id: 'cline', name: 'Cline', docs: 'https://docs.cline.bot/mcp/mcp-overview', steps: '打开 MCP Servers → Configure → Configure MCP Servers，将配置合并到打开的 JSON 文件，启用服务并检查工具列表。', stepsEn: "Open MCP Servers → Configure → Configure MCP Servers. Merge into the JSON file, enable the server and check its tools." },
];

/** Self-contained so the same serializer can run in the bundled page and in tests. */
export function mcpClientConfig(agent: string, url: string, token: string, locale: McpStartLocale = 'zh'): string {
    if (agent === 'codex') return `[mcp_servers.zentao-remote]\nurl = ${JSON.stringify(url)}\nhttp_headers = { token = ${JSON.stringify(token)} }`;
    if (agent === 'cherry' && locale === 'en') return `Name: zentao-remote\nType: Streamable HTTP\nURL: ${url}\nHeader: token: ${token}\nAuthentication: Personal token (no OAuth)`;
    if (agent === 'cherry') return `名称：zentao-remote\n类型：Streamable HTTP\nURL：${url}\n请求头：token: ${token}\n认证：个人 Token（无需 OAuth）`;
    const headers = { token };
    if (agent === 'opencode') return JSON.stringify({ mcp: { 'zentao-remote': { type: 'remote', url, headers, oauth: false, enabled: true } } }, null, 2);
    const entry = agent === 'gemini' ? { httpUrl: url, headers }
        : { type: agent === 'cline' ? 'streamableHttp' : 'http', url, headers };
    return JSON.stringify({ [agent === 'vscode' ? 'servers' : 'mcpServers']: { 'zentao-remote': entry } }, null, 2);
}

export function mcpAgentPrompt(site: string, url: string, token: string, locale: McpStartLocale = 'zh'): string {
    if (locale === 'en') return [
        'Help me configure our ZenTao MCP service in the Agent I am currently using.', '',
        'Server name: zentao-remote', `ZenTao site: ${site}`, `MCP server URL: ${url}`,
        'Transport: Streamable HTTP', `Authentication header: token: ${token}`, '',
        'Follow the official documentation for this Agent to prepare the user-level MCP configuration, preserving existing services.',
        'Tell me the full path of the MCP configuration file to edit, the field for the token request header, and how to set it. For settings managed through a UI, give me the entry point and field.',
        'If the token is a placeholder, I will fill in the real value locally. Do not ask me to send my ZenTao password or token in this conversation.',
        'There is no need to install zentao-cli or start an MCP process locally.',
        'Use the token only in request headers. Do not display the real token in replies or commit it to a repository.',
        'Wait until I have set the token locally, then explain how to reload or restart the Agent.',
        'Finally, verify the connection: Use the zentao-remote MCP to query the products I can access. Show only their IDs and names.',
    ].join('\n');
    return [
        '请帮我在当前使用的 Agent 中配置公司的禅道 MCP 服务。', '',
        '服务名称：zentao-remote', `禅道地址：${site}`, `MCP 服务地址：${url}`,
        '传输方式：Streamable HTTP', `认证请求头：token: ${token}`, '',
        '请按当前 Agent 的官方文档准备用户级 MCP 配置，保留已有服务。',
        '请告知需要修改的 MCP 配置文件完整路径，以及设置 token 请求头的具体字段和方法；若通过界面配置，请给出入口和字段。',
        'Token 为占位符时，由我在本机填写真实值。不要要求我在对话中提供禅道密码或 Token。',
        '本机无需安装 zentao-cli 或启动 MCP 进程。',
        'Token 只用于请求头。不要在回复中显示真实 Token，也不要提交到项目仓库。',
        '等我在本机设置好 Token 后，再指导我重载或重启 Agent。',
        '最后验证连接：请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。',
    ].join('\n');
}

/** A self-contained page: only appearance preferences persist, never credentials. */
export function renderMcpStartPage(options: McpHttpOptions & { nonce: string; key: string }): string {
    const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const t = (key: keyof typeof mcpStartMessages.zh) => escape(mcpStartMessages.zh[key]);
    const data = JSON.stringify({ site: options.url, key: options.key, readOnly: !!options.readOnly, modules: options.modules, guides: mcpStartGuides, messages: mcpStartMessages }).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark"><meta name="referrer" content="no-referrer">
  <title>${t('title')} · ZenTao</title>
  <script nonce="${escape(options.nonce)}">
    try {
      const theme = localStorage.getItem('zentao-mcp-theme');
      if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
    } catch {}
  </script>
  <style nonce="${escape(options.nonce)}">

:root {
  --zt-page: light-dark(#f3f6f7, #06111e);
  --zt-surface: light-dark(#fcfdfd, #0b2032);
  --zt-soft: light-dark(#eaf0f2, #102b3e);
  --zt-ink: light-dark(#0b2a43, #e0ebef);
  --zt-muted: light-dark(#4e6878, #a1bac6);
  --zt-accent: light-dark(#174d70, #91b9cb);
  --zt-on-accent: light-dark(#ffffff, #06111e);
  --zt-hover: light-dark(#245e80, #b5d4e1);
  --zt-line: light-dark(#cbd8de, #304b5e);
  --zt-input-line: light-dark(#728f9e, #58798c);
  --zt-success: light-dark(#176345, #9ddbbb);
  --zt-sans: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --zt-mono: "SFMono-Regular", Consolas, "PingFang SC", monospace;
  background: var(--zt-page); color: var(--zt-ink); font: 15px/1.6 var(--zt-sans);
  color-scheme: light; scrollbar-gutter: stable;
  scrollbar-color: var(--zt-input-line) var(--zt-page); scrollbar-width: thin;
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
body { margin: 0; padding: 0 36px 28px; }
body * { box-sizing: border-box; }
[hidden] { display: none !important; }
body h1, body h2, body p { margin: 0; }
.zt-topbar { max-width: 1000px; margin: auto; min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--zt-line); }
.zt-brand { display: flex; align-items: center; gap: 10px; font: 600 16px var(--zt-mono); white-space: nowrap; }
.zt-logo { width: 29px; height: 29px; color: var(--zt-ink); }
.zt-brand-separator { color: var(--zt-muted); font-weight: 400; }
.zt-preferences { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.zt-language { display: flex; align-items: center; position: relative; color: var(--zt-muted); }
.zt-language > .zt-icon { z-index: 1; position: absolute; left: 9px; pointer-events: none; }
.zt-language select { appearance: auto; border: 1px solid transparent; border-radius: var(--zt-control-radius); background: var(--zt-page); padding: 7px 5px 7px 31px; width: 112px; font-size: 12px; min-height: 36px; }
.zt-language select:hover { background: var(--zt-soft); }
.zt-theme-switch { width: 68px; height: 36px; flex-shrink: 0; border: 1px solid var(--zt-line); border-radius: 20px; background: var(--zt-soft); padding: 3px; position: relative; display: flex; justify-content: space-around; align-items: center; gap: 6px; }
.zt-theme-switch::before { content: ""; position: absolute; width: 28px; height: 28px; left: 3px; top: 3px; background: var(--zt-surface); border-radius: 50%; box-shadow: 0 1px 3px light-dark(#0b2a4326, #00000040); transition: transform .18s ease, background .18s ease; }
.zt-theme-switch .zt-icon { position: relative; z-index: 1; color: var(--zt-muted); width: 15px; height: 15px; transition: color .18s ease; }
.zt-theme-switch[aria-checked="false"] .zt-sun { color: var(--zt-accent); }
.zt-theme-switch[aria-checked="true"]::before { transform: translateX(32px); background: var(--zt-accent); }
.zt-theme-switch[aria-checked="true"] .zt-moon { color: var(--zt-on-accent); }
.zt-theme-switch:hover { border-color: var(--zt-accent); }
.zt-main { max-width: 520px; margin: 28px auto 0; }
.zt-heading { margin-bottom: 18px; }
.zt-heading h1 { font-size: 28px; font-weight: 600; line-height: 1.4; letter-spacing: -.03em; }
.zt-site { margin-top: 8px; display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--zt-muted); }
.zt-site a { color: var(--zt-muted); text-decoration: none; }
.zt-panel { border: 1px solid var(--zt-line); background: var(--zt-surface); border-radius: var(--zt-radius); }
.zt-steps { display: grid; grid-template-columns: 1fr minmax(12px, 32px) 1fr minmax(12px, 32px) 1fr; align-items: start; gap: 8px; padding: 19px 24px 17px; border-bottom: 1px solid var(--zt-line); }
.zt-step { padding: 0; min-height: 48px; display: flex; flex-direction: column; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--zt-muted); white-space: nowrap; font-size: 12px; }
.zt-step span:first-child { width: 23px; height: 23px; display: inline-grid; place-items: center; border: 1px solid var(--zt-input-line); border-radius: 2px; font: 12px var(--zt-mono); }
.zt-step[aria-current="step"] { color: var(--zt-ink); font-weight: 600; }
.zt-step[aria-current="step"] span:first-child { color: var(--zt-on-accent); border-color: var(--zt-accent); background: var(--zt-accent); }
.zt-step-connector { height: 1px; margin-top: 12px; background: var(--zt-line); }
.zt-panel-body { padding: 22px 28px 18px; }
.zt-methods { display: flex; align-items: center; gap: 4px; background: var(--zt-soft); padding: 4px; border-radius: var(--zt-control-radius); margin-bottom: 18px; }
.zt-method { flex: 1; position: relative; text-align: center; }
.zt-method input { position: absolute; opacity: 0; width: 100%; height: 100%; inset: 0; margin: 0; }
.zt-method span { display: block; font-size: 13px; padding: 7px 10px; border-radius: 2px; color: var(--zt-muted); border: 1px solid transparent; }
.zt-method input:checked + span { background: var(--zt-surface); color: var(--zt-ink); border-color: var(--zt-line); font-weight: 600; }
.zt-method input:focus-visible + span { outline: 2px solid var(--zt-accent); outline-offset: 2px; }
.zt-field + .zt-field { margin-top: 17px; }
.zt-label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 500; }
.zt-input { width: 100%; min-width: 0; height: 43px; padding: 9px 12px; font: 14px var(--zt-sans); border: 1px solid var(--zt-input-line); border-radius: var(--zt-control-radius); background: var(--zt-surface); color: var(--zt-ink); }
.zt-input::placeholder { color: var(--zt-muted); opacity: 1; }
.zt-password { display: flex; align-items: center; position: relative; }
.zt-password .zt-input { padding-right: 48px; }
.zt-reveal { position: absolute; right: 4px; top: 3px; bottom: 3px; width: 36px; min-height: 36px; background: transparent; border: 0; display: grid; place-items: center; color: var(--zt-muted); padding: 0; }
body button, body select { font-family: var(--zt-sans); color: inherit; }
.zt-button { min-height: 42px; padding: 9px 14px; border-radius: var(--zt-control-radius); border: 1px solid var(--zt-input-line); background: var(--zt-surface); font-size: 13px; font-weight: 500; }
body .zt-primary { display: flex; width: 100%; align-items: center; justify-content: center; gap: 9px; min-height: 44px; border: 1px solid var(--zt-accent); border-radius: var(--zt-control-radius); background: var(--zt-accent); color: var(--zt-on-accent); font-size: 14px; font-weight: 600; padding: 10px 16px; }
.zt-continue { margin-top: 20px; }
.zt-caption { color: var(--zt-muted); font-size: 12px; line-height: 1.7; }
.zt-trust { margin-top: 12px !important; }
.zt-panel-footer { border-top: 1px solid var(--zt-line); padding: 10px 28px; text-align: center; }
.zt-link { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; min-height: 28px; padding: 2px 0; color: var(--zt-accent); font-size: 12px; text-decoration: none; }
body button:disabled { opacity: .5; cursor: not-allowed; }
body :is(.zt-link,a,summary):hover { color: var(--zt-hover); }
.zt-reveal:hover, .zt-button:hover { background: var(--zt-soft); }
body .zt-primary:hover { background: var(--zt-hover); }
body :is(button,a,select,input,pre):focus-visible, body summary:focus-visible { outline: 2px solid var(--zt-accent); outline-offset: 3px; }
.zt-token-card { border: 1px solid var(--zt-line); border-radius: var(--zt-control-radius); padding: 14px; margin-bottom: 22px; }
.zt-token-heading-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.zt-token-heading { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; margin: 0; }
.zt-token-state { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--zt-success); }
.zt-token-state[data-empty="true"] { color: var(--zt-muted); }
.zt-token-tools { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 6px; }
.zt-clear { margin-left: auto; }
.zt-setup-title { font-size: 21px; font-weight: 600; letter-spacing: -.02em; line-height: 1.5; }
.zt-verify-note { margin: 19px 0 18px !important; }
.zt-verification-prompt { margin: 18px 0; font: 14px/1.85 var(--zt-sans); }
.zt-verify-feedback { min-height: 34px; padding-top: 9px; }
.zt-setup-text { font-size: 13px; color: var(--zt-muted); margin-top: 5px !important; }
.zt-checkbox { display: flex; align-items: center; gap: 8px; font-size: 13px; margin: 12px 0 0; }
.zt-checkbox input { width: 16px; height: 16px; accent-color: var(--zt-accent); margin: 0; }
.zt-copy { margin-top: 19px; }
.zt-feedback { color: var(--zt-success); font-size: 12px; }
.zt-details { border-top: 1px solid var(--zt-line); }
.zt-details summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; padding: 14px 0; min-height: 48px; }
.zt-details summary::-webkit-details-marker { display: none; }
.zt-details summary i, .zt-details summary svg { transition: transform .15s; }
.zt-details[open] summary i, .zt-details[open] summary svg { transform: rotate(90deg); }
.zt-details-body { padding: 0 0 18px; }
body select.zt-input { font-size: 13px; }
.zt-code { font: 12px/1.8 var(--zt-mono); white-space: pre-wrap; overflow-wrap: anywhere; padding: 15px; background: var(--zt-soft); border-radius: var(--zt-control-radius); margin: 12px 0; color: var(--zt-ink); }
.zt-page-footer { margin-top: 17px; }
.zt-page-footer .zt-details { border: 0; }
.zt-page-footer summary { color: var(--zt-muted); padding: 7px 0; min-height: 32px; width: fit-content; gap: 6px; font-size: 12px; }
.zt-page-footer .zt-details-body { padding: 8px 0; font-size: 12px; color: var(--zt-muted); }
.zt-page-footer p + p { margin-top: 5px; }
body a { color: var(--zt-accent); text-underline-offset: 3px; }
.zt-icon { width: 16px; height: 16px; flex-shrink: 0; }
.zt-screenreader { position: absolute; clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; white-space: nowrap; }
@media (max-width: 560px) {
  body { padding: 0 18px 20px; }
  .zt-topbar { min-height: 63px; }
  .zt-brand { gap: 7px; font-size: 14px; }
  .zt-logo { width: 25px; height: 25px; }
  .zt-main { margin-top: 27px; }
  .zt-heading h1 { font-size: 25px; }
  .zt-panel-body { padding: 22px 20px 18px; }
  .zt-steps { padding: 18px 16px 15px; gap: 4px; grid-template-columns: 1fr 12px 1fr 12px 1fr; }
  .zt-step { gap: 7px; font-size: 12px; }
  .zt-input { font-size: 16px; }
  .zt-preferences { gap: 8px; }
  .zt-language select { width: 100px; }
}
@media (max-width: 460px) {
  .zt-brand-separator { display: none; }
  .zt-topbar { gap: 10px; }
  .zt-language > .zt-icon { display: none; }
  .zt-language select { width: 73px; padding-left: 6px; }
}
@media (prefers-reduced-motion: reduce) { body * { transition: none !important; } }

fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
button, summary, select, .zt-method input { cursor: pointer; }
.zt-site { flex-wrap: wrap; }
.zt-site a, .zt-page-footer code { overflow-wrap: anywhere; }
.zt-feedback { min-height: 40px; overflow-wrap: anywhere; }
.zt-feedback[data-tone="error"], input[aria-invalid="true"] { color: var(--zt-error); }
input[aria-invalid="true"] { border-color: var(--zt-error); }
.zt-feedback:not([data-tone="success"]):not([data-tone="error"]) { color: var(--zt-muted); }
.zt-action-feedback { padding-top: 8px; }
.zt-token-feedback { min-height: 0; line-height: 1.7; }
.zt-token-feedback:not(:empty), #zt-include-warning { margin-top: 8px !important; }
.zt-prompt-card { margin-top: 14px; border: 1px solid var(--zt-line); border-radius: var(--zt-control-radius); overflow: hidden; }
.zt-preview-trigger { display: block; width: 100%; padding: 12px 14px; text-align: left; border: 0; background: var(--zt-soft); }
.zt-preview-trigger:hover { background: var(--zt-page); }
.zt-preview-trigger:focus-visible { outline-offset: -3px; }
.zt-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--zt-muted); font: 12px/1.6 var(--zt-sans); }
#zt-preview-action { color: var(--zt-accent); }
.zt-prompt-excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; max-height: 3.6em; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.8 var(--zt-mono); margin-top: 8px; }
.zt-prompt-card .zt-code { margin: 0; border-radius: 0; border-top: 1px solid var(--zt-line); }
.zt-code:focus-visible { outline-offset: -3px; }
.zt-code { max-height: 320px; overflow: auto; }
.zt-notice { border: 1px solid var(--zt-error); padding: 12px; color: var(--zt-error); margin-bottom: 16px !important; font-size: 13px; }
.zt-guide-text { margin: 12px 0 !important; }
.zt-label { width: fit-content; }
:root { --zt-error: light-dark(#a32024, #ffb4b4); --zt-scroll-hover: light-dark(#4e7185, #a1bac6); --zt-radius: 4px; --zt-control-radius: 3px; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: var(--zt-page); }
*::-webkit-scrollbar-thumb { background: var(--zt-input-line); }
*::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:active { background: var(--zt-scroll-hover); }
button:active:not(:disabled) { opacity: .85; }
.zt-eye-off { display: none; }
[aria-pressed="true"] .zt-eye { display: none; }
[aria-pressed="true"] .zt-eye-off { display: block; }
@media (forced-colors: active) {
  :root { --zt-ink: CanvasText; --zt-muted: CanvasText; --zt-accent: LinkText; --zt-on-accent: Canvas; --zt-line: ButtonText; --zt-input-line: ButtonText; --zt-surface: Canvas; --zt-soft: Canvas; --zt-page: Canvas; scrollbar-color: auto; }
  .zt-theme-switch::before { border: 1px solid ButtonText; }
}
  </style>
</head>
<body>

    <header class="zt-topbar">
      <div class="zt-brand"><svg class="zt-logo" viewBox="0 0 100 100" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" transform="scale(6.25)" d="M6 1h4v1H6z M4 2h8v1H4z M3 3h10v1H3z M2 4h2v1H2z M9 4h5v1H9z M2 5h1v1H2z M4 5h2v1H4z M10 5h4v1h-4z M1 6h5v1H1z M11 6h4v1h-4z M1 7h4v1H1z M6 7h4v1H6z M13 7h2v1h-2z M1 8h3v1H1z M5 8h3v1H5z M10 8h5v1h-5z M1 9h3v1H1z M5 9h2v1H5z M8 9h1v1H8z M11 9h4v1h-4z M2 10h2v1H2z M5 10h5v1H5z M11 10h3v1h-3z M2 11h2v1H2z M6 11h3v1H6z M11 11h3v1h-3z M3 12h2v1H3z M10 12h3v1h-3z M4 13h8v1H4z M6 14h4v1H6z"/></svg><span>ZenTao <span class="zt-brand-separator">/ MCP</span></span></div>
      <div class="zt-preferences">
        <label class="zt-language"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 8 6 6m-7 0 6-6 2-4H2m5-2h1m6 20 5-11 5 11m-8-4h6"/></svg><select id="zt-language"  data-i18n-aria="language" aria-label="语言"><option value="zh">中文</option><option value="en">English</option></select></label>
        <button type="button" id="zt-theme-switch" class="zt-theme-switch" role="switch" aria-checked="false" aria-label="深色模式"><svg class="zt-icon zt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="zt-icon zt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg></button>
      </div>
    </header>
    <main class="zt-main">
      <div class="zt-heading">
        <h1 data-i18n="title">接入禅道 MCP</h1>
        <div class="zt-site"><span data-i18n="site">禅道站点</span><a  href="${escape(options.url)}" target="_blank" rel="noreferrer">${escape(options.url.replace(/^https?:\/\//, ''))} ↗</a></div>
      </div>
      <noscript><p class="zt-notice">${t('noScript')}</p></noscript>
      <p id="zt-insecure" class="zt-notice" data-i18n="insecure" hidden></p>
      <section class="zt-panel" data-i18n-aria="steps" aria-label="接入步骤">
        <nav class="zt-steps" data-i18n-aria="progress" aria-label="接入进度">
          <button type="button" id="zt-go-token" class="zt-step" aria-current="step"><span id="zt-first-number">1</span><span data-i18n="step1">准备 Token</span></button>
          <span class="zt-step-connector" aria-hidden="true"></span>
          <button type="button" id="zt-go-setup" class="zt-step"><span id="zt-second-number">2</span><span data-i18n="step2">配置 Agent</span></button>
          <span class="zt-step-connector" aria-hidden="true"></span>
          <button type="button" id="zt-go-verify" class="zt-step"><span>3</span><span data-i18n="step3">验证连接</span></button>
        </nav>
        <section id="zt-token-panel" data-i18n-aria="step1" aria-label="准备 Token">
          <div class="zt-panel-body">
            <fieldset id="zt-credentials" disabled>
            <div class="zt-methods" role="group" data-i18n-aria="method" aria-label="Token 获取方式">
              <label class="zt-method"><input  type="radio" name="zt-method" value="login" checked><span data-i18n="login">账号登录</span></label>
              <label class="zt-method"><input  type="radio" name="zt-method" value="token"><span data-i18n="existing">已有 Token</span></label>
            </div>
            <form id="zt-login-form" novalidate>
              <fieldset id="zt-login-fields">
                <div class="zt-field"><label class="zt-label" for="zt-account" data-i18n="username">用户名</label><input id="zt-account" class="zt-input" type="text" data-i18n-placeholder="usernamePlaceholder" placeholder="禅道用户名" name="username" autocomplete="username" maxlength="256" required aria-describedby="zt-login-feedback"></div>
                <div class="zt-field"><label class="zt-label" for="zt-password" data-i18n="password">密码</label><div class="zt-password"><input id="zt-password" class="zt-input" type="password" data-i18n-placeholder="passwordPlaceholder" placeholder="输入密码" name="password" autocomplete="current-password" maxlength="4096" required aria-describedby="zt-login-feedback"><button type="button" class="zt-reveal" data-reveal="zt-password" aria-label="显示密码" aria-pressed="false"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="zt-eye" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle class="zt-eye" cx="12" cy="12" r="3"/><path class="zt-eye-off" d="m3 3 18 18M10.5 5.1 12 5c7 0 10 7 10 7a20 20 0 0 1-3 4M6 6a22 22 0 0 0-4 6s3 7 10 7a11 11 0 0 0 5-1.2M10 10a3 3 0 0 0 4 4"/></svg></button></div></div>
              </fieldset>
              <div id="zt-existing-token" hidden><div class="zt-field"><label class="zt-label" for="zt-existing" data-i18n="personalToken">个人 Token</label><div class="zt-password"><input id="zt-existing" class="zt-input" type="password" autocomplete="off" spellcheck="false" aria-describedby="zt-login-feedback"><button type="button" class="zt-reveal" data-reveal="zt-existing" aria-label="显示 Token" aria-pressed="false"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="zt-eye" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle class="zt-eye" cx="12" cy="12" r="3"/><path class="zt-eye-off" d="m3 3 18 18M10.5 5.1 12 5c7 0 10 7 10 7a20 20 0 0 1-3 4M6 6a22 22 0 0 0-4 6s3 7 10 7a11 11 0 0 0 5-1.2M10 10a3 3 0 0 0 4 4"/></svg></button></div></div></div>
              <button type="submit" id="zt-continue" class="zt-primary zt-continue"><span>获取 Token 并继续</span><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
              <p id="zt-login-feedback" class="zt-caption zt-feedback zt-trust" role="status" aria-live="polite"></p>
            </form>
            </fieldset>
          </div>
          <div class="zt-panel-footer"><button type="button" id="zt-skip" class="zt-link"><span data-i18n="skip">稍后填写 Token，先看配置</span><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button></div>
        </section>
        <section id="zt-setup-panel" data-i18n-aria="step2" aria-label="配置 Agent" hidden>
          <div class="zt-panel-body">
            <div class="zt-methods" role="group" data-i18n-aria="setupMethod" aria-label="配置方式">
              <label class="zt-method"><input type="radio" name="zt-setup-method" value="agent" checked><span data-i18n="agentSetup">让 Agent 配置</span></label>
              <label class="zt-method"><input type="radio" name="zt-setup-method" value="manual"><span data-i18n="manual">手动配置</span></label>
            </div>
            <section class="zt-token-card" aria-labelledby="zt-token-heading">
              <div class="zt-token-heading-row"><h3 id="zt-token-heading" class="zt-token-heading"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="15.5" cy="8.5" r="5.5"/><path d="m11.5 12.5-8.5 8.5H1v-3l3-3h3v-3h4"/></svg><span data-i18n="personalToken">个人 Token</span></h3><span id="zt-token-status" class="zt-token-state" data-empty="true">未填写</span></div>
              <div id="zt-token-empty"><button type="button" id="zt-add-token" class="zt-button" data-i18n="enterToken">填写 Token</button></div>
              <div id="zt-token-filled" hidden>
                <label class="zt-screenreader" for="zt-current-token" data-i18n="personalToken">个人 Token</label>
                <div class="zt-password"><input id="zt-current-token" class="zt-input" type="password" readonly autocomplete="off" spellcheck="false"><button type="button" class="zt-reveal" data-reveal="zt-current-token" aria-label="显示 Token" aria-pressed="false"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="zt-eye" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle class="zt-eye" cx="12" cy="12" r="3"/><path class="zt-eye-off" d="m3 3 18 18M10.5 5.1 12 5c7 0 10 7 10 7a20 20 0 0 1-3 4M6 6a22 22 0 0 0-4 6s3 7 10 7a11 11 0 0 0 5-1.2M10 10a3 3 0 0 0 4 4"/></svg></button></div>
                <div class="zt-token-tools">
                  <button type="button" id="zt-copy-token" class="zt-link" data-i18n="copyToken">复制 Token</button>
                  <button type="button" id="zt-change-token" class="zt-link" data-i18n="changeToken">更换 Token</button>
                  <button type="button" id="zt-clear-token" class="zt-link zt-clear" data-i18n="clearToken">清除 Token</button>
                </div>
                <label class="zt-checkbox"><input id="zt-include" type="checkbox" aria-describedby="zt-include-warning" disabled><span data-i18n="includeToken">${t('includeToken')}</span></label>
                <p id="zt-include-warning" class="zt-caption" data-i18n="includeWarning" role="status" hidden>${t('includeWarning')}</p>
              </div>
              <p id="zt-token-feedback" class="zt-feedback zt-token-feedback" role="status" aria-live="polite"></p>
            </section>
            <div id="zt-assisted-setup">
              <p class="zt-setup-text" data-i18n="setupIntro">${t('setupIntro')}</p>
              <div class="zt-prompt-card">
                <button type="button" id="zt-preview-toggle" class="zt-preview-trigger" aria-expanded="false" aria-controls="zt-prompt-preview" aria-label="展开接入说明">
                  <span class="zt-preview-heading"><span data-i18n="previewPrompt">预览说明</span><span id="zt-preview-action">展开</span></span>
                  <span id="zt-prompt-excerpt" class="zt-prompt-excerpt"></span>
                </button>
                <pre id="zt-prompt-preview" class="zt-code" hidden tabindex="0"></pre>
              </div>
              <button id="zt-copy-prompt" type="button" class="zt-primary zt-copy"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span data-i18n="copyInstructions">复制接入说明</span></button>
              <p id="zt-copy-feedback" class="zt-feedback zt-action-feedback" role="status" aria-live="polite"></p>
            </div>
            <div id="zt-manual" hidden>
              <label class="zt-label" for="zt-client" data-i18n="chooseAgent">选择 Agent</label><select id="zt-client" class="zt-input">${mcpStartGuides.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}</select>
              <p id="zt-agent-steps" class="zt-caption zt-guide-text"></p>
              <a id="zt-agent-docs" class="zt-caption" target="_blank" rel="noreferrer" data-i18n="officialDocs"></a>
              <pre id="zt-config" class="zt-code" tabindex="0"></pre>
              <p class="zt-caption" data-i18n="mergeHint"></p>
              <button id="zt-copy-config" type="button" class="zt-primary zt-copy"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span data-i18n="copyConfig">复制配置</span></button>
              <p id="zt-config-feedback" class="zt-feedback zt-action-feedback" role="status" aria-live="polite"></p>
            </div>
          </div>
          <div class="zt-panel-footer"><button type="button" id="zt-next-verify" class="zt-link"><span data-i18n="nextVerify">配置好了，去验证</span><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button></div>
        </section>
        <section id="zt-verify-panel" data-i18n-aria="step3" aria-label="验证连接" hidden>
          <div class="zt-panel-body">
            <h2 class="zt-setup-title" data-i18n="verifyTitle">在 Agent 中验证</h2>
            <p class="zt-setup-text" data-i18n="verifyIntro">重载或重启 Agent 后，发送这条提问：</p>
            <pre id="zt-verify-prompt" class="zt-code zt-verification-prompt" data-i18n="verifyPrompt" tabindex="0">请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。</pre>
            <button type="button" id="zt-copy-verify" class="zt-primary"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span data-i18n="copyVerify">复制验证提问</span></button>
            <p id="zt-verify-feedback" class="zt-feedback zt-verify-feedback" role="status" aria-live="polite"></p>
            <p class="zt-caption zt-verify-note" data-i18n="verifyResult">检查返回的产品 ID 和名称。列表为空时，请确认账号的产品访问权限。</p>
            <details class="zt-details"><summary ><span data-i18n="troubleshoot">没有连接成功？</span><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></summary><div class="zt-details-body"><p class="zt-caption" data-i18n="troubleshootText">确认 MCP 服务已启用，且 Agent 能访问服务地址。Token 失效时，重新获取并更新 Agent 配置。</p></div></details>
          </div>
          <div class="zt-panel-footer"><button type="button" id="zt-back-setup" class="zt-link"><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6 6-6-6 6-6"/></svg><span data-i18n="backSetup">返回配置</span></button></div>
        </section>
      </section>
      <footer class="zt-page-footer"><details class="zt-details"><summary ><span data-i18n="details">接入详情</span><svg class="zt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></summary><div class="zt-details-body"><p><span data-i18n="mcpAddress">MCP 地址：</span><code id="zt-mcp-url"></code></p><p id="zt-address-hint"></p><p id="zt-permissions">${t(options.readOnly ? 'readOnly' : 'readWrite')} · ${escape(options.modules?.join('、') || mcpStartMessages.zh.allModules)} · ${t('accountPermissions')}</p><p><a  href="https://github.com/easysoft/zentao-cli/blob/main/docs/mcp-user-guide.md" target="_blank" rel="noreferrer" data-i18n="guide">完整接入指南 ↗</a></p></div></details></footer>
    </main>

<script nonce="${escape(options.nonce)}">
  const data = ${data};
  const makeConfig = ${mcpClientConfig.toString()};
  const makePrompt = ${mcpAgentPrompt.toString()};
  ${mcpStartScript}
</script>
</body></html>`;
}
