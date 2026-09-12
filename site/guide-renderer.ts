import { readFileSync } from "node:fs";
import { agentGuides, type AgentGuide } from "./src/agent-guides.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

function renderAgentLogo(guide: AgentGuide): string {
  // Inline the vendored monochrome SVG at build time so it inherits the theme.
  const svg = readFileSync(
    new URL(`./public/brand/agents/${guide.icon}.svg`, import.meta.url),
    "utf8",
  ).replace("<svg ", '<svg focusable="false" ');
  return `<span class="agent-logo" aria-hidden="true">${svg}</span>`;
}

function copyButton(
  target: string,
  label: string,
  options: { multiline?: boolean; message?: string } = {},
): string {
  return `<button type="button" class="guide-copy" data-copy-target="${escapeHtml(target)}" aria-label="${escapeHtml(label)}"${options.multiline ? " data-copy-multiline" : ""}${options.message ? ` data-copy-message="${escapeHtml(options.message)}"` : ""}><span data-icon="copy"></span></button>`;
}

function renderMcp(guide: AgentGuide): string {
  const { mcp } = guide;
  const codeId = `guide-mcp-${guide.id}`;
  const method = `<div class="guide-method">
    <h4>${escapeHtml(mcp.label)}</h4>
    ${mcp.path ? `<p class="guide-path"><code>${escapeHtml(mcp.path)}</code></p>` : ""}
    <div class="guide-code">
      <pre><code id="${escapeHtml(codeId)}">${escapeHtml(mcp.code)}</code></pre>
      ${copyButton(codeId, `复制${guide.name} MCP ${mcp.kind === "command" ? "接入命令" : "配置"}`, { multiline: mcp.kind !== "command" })}
    </div>
    <p class="guide-note">${escapeHtml(mcp.note)}</p>
    <p class="guide-verify verify">${escapeHtml(mcp.verify)}</p>
  </div>`;

  return guide.skill
    ? `<details class="guide-alternative"><summary>使用 MCP 接入<span data-icon="plus"></span></summary>${method}</details>`
    : method;
}

function renderPanel(guide: AgentGuide, isSelected: boolean): string {
  const skillCodeId = `guide-skill-${guide.id}`;
  const promptId = `guide-prompt-${guide.id}`;
  const skill = guide.skill
    ? `<div class="guide-method">
      <h4>安装 AI Skill</h4>
      <div class="guide-code">
        <code id="${escapeHtml(skillCodeId)}">${escapeHtml(guide.skill.command)}</code>
        ${copyButton(skillCodeId, `复制${guide.name} Skill 安装命令`)}
      </div>
      <p class="guide-path"><code>${escapeHtml(guide.skill.path)}</code></p>
      <p class="guide-note">${escapeHtml(guide.skill.note)}</p>
      <p class="guide-verify verify">${escapeHtml(guide.skill.verify)}</p>
    </div>`
    : "";
  const docs = guide.docs
    .map((doc) => {
      if (new URL(doc.url).protocol !== "https:") {
        throw new Error(
          `Agent guide documentation must use HTTPS: ${guide.id}`,
        );
      }
      return `<a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.label)}<span data-icon="arrow-up-right"></span></a>`;
    })
    .join("\n");

  return `<section class="integration-panel" id="guide-panel-${escapeHtml(guide.id)}" role="tabpanel" aria-labelledby="guide-tab-${escapeHtml(guide.id)}" tabindex="0"${isSelected ? "" : " hidden"}>
    <div class="guide-heading"><h3>${renderAgentLogo(guide)}<span>${escapeHtml(guide.name)}</span></h3><p>${escapeHtml(guide.summary)}</p></div>
    ${skill}
    ${renderMcp(guide)}
    <div class="guide-try">
      <h4>在新对话中试试</h4>
      <blockquote id="${escapeHtml(promptId)}">${escapeHtml(guide.prompt)}</blockquote>
      ${copyButton(promptId, `复制${guide.name}示例提问`, { message: "提问已复制" })}
    </div>
    <div class="guide-docs">${docs}</div>
  </section>`;
}

export function renderAgentGuides(guides: AgentGuide[] = agentGuides): string {
  const orderedGuides = [
    ...guides.filter((guide) => guide.id === "claude-code"),
    ...guides.filter((guide) => guide.id !== "claude-code"),
  ];
  const tabs = orderedGuides
    .map(
      (guide, index) =>
        `<button type="button" class="agent-option" id="guide-tab-${escapeHtml(guide.id)}" role="tab" aria-label="${escapeHtml(guide.name)}" aria-selected="${index === 0}" aria-controls="guide-panel-${escapeHtml(guide.id)}" tabindex="${index === 0 ? "0" : "-1"}" data-guide="${escapeHtml(guide.id)}">${renderAgentLogo(guide)}<span class="agent-selector-name">${escapeHtml(guide.name)}</span><span class="agent-selector-kind">${guide.skill ? "Skill" : "MCP"}</span><span data-icon="arrow-right"></span></button>`,
    )
    .join("\n");

  return `<div class="integration-layout">
    <div class="agent-selector" role="tablist" aria-label="选择你的Agent" aria-orientation="vertical">${tabs}</div>
    <div class="integration-panels">${orderedGuides.map((guide, index) => renderPanel(guide, index === 0)).join("\n")}</div>
  </div>`;
}
