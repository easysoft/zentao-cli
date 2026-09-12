# ZenTao CLI 宣传网站

面向 AI Agent 使用者的宣传网站，重点介绍如何在常用 Agent 中使用禅道，并保留 CLI 能力和安装入门。页面依次为 Agent 使用场景、Agent 选择与接入、CLI 能力、安装登录和常见问题。

采用独立的 Vite + TypeScript 静态网站，使用 Bun 安装依赖和运行工具。网站配置和依赖均位于 `site/`，与项目根目录的 CLI 构建分开。

## 开发

```bash
cd site
bun install
bun run dev
```

开发服务器仅监听本机地址，默认访问 `http://127.0.0.1:5173`。页面中的命令和输出为演示数据，不会连接禅道实例或执行真实请求。

## 构建与预览

```bash
cd site
bun run build
bun run preview
```

构建会先进行 TypeScript 检查，再生成 `site/dist/`。Agent 接入指南在构建时写入 HTML，无需浏览器请求数据或运行服务端渲染。预览服务器默认地址为 `http://127.0.0.1:4173`。开发、构建和预览中的 Vite 均显式使用 Bun 运行。

## Agent 接入指南

当前提供 12 个客户端的接入方法：

- Claude Code、Cursor、Codex、VS Code Copilot、OpenCode、Gemini CLI、Antigravity：优先显示 AI Skill 安装方法，MCP 方法可展开查看。
- Claude Desktop、Cherry Studio、Windsurf / Cascade、Cline、TRAE：直接显示 MCP 方法。

接入步骤要求先在 Agent 所在电脑全局安装 ZenTao CLI、完成禅道登录，并用 `zentao product` 确认能够查询。页面中的本地 MCP 服务执行 `zentao mcp`，复用本机的登录信息；Agent 必须能够找到 `zentao` 命令。切换账号后应重连 MCP 服务，操作权限仍由禅道账号决定。安装区中的 `npx` 方式用于体验 CLI，执行本页 Agent 接入命令前仍需完成全局安装。

[`src/agent-guides.ts`](./src/agent-guides.ts) 是接入指南的唯一数据源，统一维护客户端名称、Skill 命令与目录、MCP 命令或配置、验证步骤、示例提问和官方来源链接。[`guide-renderer.ts`](./guide-renderer.ts) 将这些数据转成 HTML，由 `vite.config.ts` 的 `transformIndexHtml` 替换 `index.html` 中的 `<!-- agent-guides -->`。开发和生产构建使用同一渲染器；所有文本和属性均做 HTML 转义。

`src/main.ts` 只负责指南切换和复制交互，不再维护另一份接入内容。默认选择 Claude Code；禁用 JavaScript 时仍可阅读全部静态指南。命令按单行复制，JSON 配置和表单字段保留换行。

## 站内文档

首页“文档”“使用文档”和“全部命令”进入网站内的文档区。`docs/index.html` 为项目概览，其余文档保持源文件名并使用 `.html` 后缀；`CHANGES.md` 对应 `docs/changelog.html`。

- `docs-generator.ts` 直接读取根目录 `README.md`、`CHANGES.md` 和 `docs/` 内全部 Markdown，在开发与生产构建时生成页面。正文只在原 Markdown 中维护，新增 `docs/*.md` 会自动加入目录。
- `docs-template.html` 定义阅读布局，`src/docs.css` 与 `src/docs.ts` 提供文档目录、页内目录、搜索和代码复制。共享的主题、图标、移动导航和复制反馈在 `src/ui.ts`，首页继续由 `src/main.ts` 处理其交互。
- 文档相对链接及本仓库 GitHub 文档链接映射为站内页面，保留原有章节锚点、表格、折叠内容和代码原文。GitHub 仓库、Issue、Release 与外部项目文档仍保留外链。
- 全文搜索按章节索引，首次搜索时才加载 `docs/search-index.json`；结果可直接定位章节。原 `docs/command-reference.html` 的模块、操作类型和参数筛选功能在 `docs/command-explorer.html` 保留，由 `command-explorer.ts` 增加站内返回入口及品牌资源，`src/explorer.css` 将原阅读器变量映射到共享主题；开发与构建均加载首页的共享样式，不另维护配色和字体。
- Markdown 解析与 HTML 清理仅在开发服务器和构建时运行，不进入浏览器脚本。输出的所有文档页可在普通静态服务器直接打开、刷新和分享，无需 SPA 回退配置。

维护时运行 `bun run build`，检查所有文档、内链与锚点、全文搜索和无结果状态、代码复制、折叠示例及手机布局。对部署子路径的改动，还需用 `BASE_PATH=/zentao-cli/` 构建核对资源与文档地址。首页与文档共用主题和品牌资源。

## 部署

将 `site/dist/` 中的全部内容部署到静态托管服务。默认使用相对资源路径，支持部署在站点根目录或子目录。若托管服务要求固定路径，可在构建时指定：

```bash
BASE_PATH=/zentao-cli/ bun run build
```

当前未配置正式域名，因此未添加 canonical URL。确认部署地址后，可再配置站点的正式 URL 和分享元数据。

## 品牌与资源

品牌资源来自 `/Users/hao/Projects/logo-factory/zentao-cli/pixel-logo-final`，复制到 `public/brand/`，保留 SVG 和主版 512 PNG 的原文件名。`favicon.png` 使用原始 flat 32 PNG。字体通过 Fontsource 随站点构建，图标使用 Phosphor Icons，不依赖远程字体服务。

Agent 客户端 LOGO 使用 [lobe-icons](https://github.com/lobehub/lobe-icons) 的单色 SVG，按需保存在 `public/brand/agents/`。`src/agent-guides.ts` 的 `icon` 指定文件名，指南渲染器在构建时内联到选择项和标题中，以继承浅深主题颜色；页面不需要额外下载图标库或访问 CDN。版本、来源和 MIT 许可证见 `public/licenses/`。

Manrope 与 JetBrains Mono 使用 SIL Open Font License 1.1，Phosphor Icons 使用 MIT 许可证。原始许可证从对应已安装包的 `LICENSE` 文件完整复制到 [`public/licenses/`](./public/licenses/)，来源、版权与版本见 [`THIRD-PARTY-NOTICES.txt`](./public/licenses/THIRD-PARTY-NOTICES.txt)。Vite 会将这些文件一并输出到 `dist/licenses/`，部署时保留该目录。

## 维护

- 页面结构和宣传内容在 `index.html`，Agent 指南数据在 `src/agent-guides.ts`，交互在 `src/main.ts`；视觉方向见 [`DESIGN.md`](./DESIGN.md)，样式和语义 tokens 统一维护在 `src/styles.css`。
- 修改接入方法时，核对指南 `docs` 中对应客户端的官方文档，以及项目 [`add-skill`](../src/commands/add-skill.ts)、[`add-mcp`](../src/commands/add-mcp.ts) 命令的实际行为。注意个人与项目目录、客户端配置格式和重启或刷新步骤的差异；保留可追溯的官方来源链接，不将静态构建通过等同于客户端接入已实测。
- 更新模块数、操作数和命令示例时，以项目文档与实际 CLI 行为核对，保留演示数据标识，不引入真实账号或项目数据。
- 更新字体、图标依赖后，同步 `bun.lock`、对应许可证及第三方资源清单中的版本信息。
- 修改后运行 `bun run build`，确认 `dist/index.html` 包含全部 Agent 指南且不再包含占位符。用 `bun run preview` 检查桌面和移动布局、浅深主题、键盘切换、导航及复制反馈；确保长客户端名称和长命令不会导致页面横向溢出。
- 逐项检查 Agent 切换后的标题、命令、配置与官方链接，核对方向键、Home/End 和焦点状态，以及 MCP 展开与收起。复制多行 JSON 后检查换行与 JSON 可解析性；Cherry Studio 的字段文本按多行核对，示例提问及安装方式的复制文本也应与显示内容一致。
