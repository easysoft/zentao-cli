# Zentao CLI

禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据，对 AI Agents 友好。

## 主要特性

* ✅ 基于最新的禅道 RESTful API 2.0 实现
* ✅ 使用便捷，可通过 `npx zentao-cli` 立即运行
* ✅ 安全的用户认证管理，支持多用户切换
* ✅ 支持对数据进行摘取、过滤、排序等处理，并自动将 HTML 转换为 Markdown
* ✅ 对 AI Agents 友好，帮助信息完善，支持输出 Markdown
* ✅ 支持以 AI 技能的方式使用，支持通过 `zentao add-skill` 一键安装技能到 AI Agent
* ✅ 支持 MCP 服务，使用 `npx zentao-cli mcp` 启动 MCP 服务
* ✅ 使用现代的 bun 与 TypeScript 开发，具备类型安全
* ✅ 提供完善的测试覆盖，保障代码质量

待实现特性：

* [ ] 支持工作区管理，支持记住用户上次访问的产品、项目和执行信息
* [ ] 支持批量创建和更新操作
* [ ] 对象预设 pick 列表
* [ ] Markdown 输出渲染，提供适合人阅读的终端渲染模式，为 Markdown 内容应用多彩格式，代码块支持高亮
* [ ] 支持适合开发者手动使用的极客版，有友好的 TUI 界面，支持在一个界面提供交互式操作
* [ ] 一键安装脚本，支持自动根据用户环境选择安装方式
* [ ] 国际化支持，支持多语言
* [ ] 多级别日志功能

## 快速使用

```bash
# 全局安装 zentao-cli 工具
npm install -g zentao-cli

# 其他安装与运行方式
# bun install -g zentao-cli  # ← 使用 bun 安装
# npx zentao-cli             # ← 通过 npx 免安装运行
# pnpm dlx zentao-cli        # ← 通过 pnpm 免安装运行

# 首次使用需要进行登录
zentao login -s https://zentao.example.com -u admin -p 123456

# 直接执行获取可用命令帮助
zentao

# 查看禅道产品
zentao product

# 查看指定 ID 的产品
zentao product 1

# 更新禅道产品 #1
zentao product update --id=1 --name=产品1

# 更多功能可通过 help 查看
zentao help

# 查看禅道产品帮助
zentao product help

# 安装 zentao-cli 技能
zentao add-skill
```

## 核心命令

zentao-cli 的命令格式简单直观：`zentao <模块名> [操作] [参数]`。下面通过常见场景快速上手。

### 查看与管理产品

```bash
# 查看产品列表
zentao product

# 查看产品详情
zentao product 1

# 创建产品
zentao product create --name=新产品

# 更新产品名称
zentao product update 1 --name=产品新名称

# 删除产品
zentao product delete 1
```

### 查看与处理 Bug

```bash
# 查看 Bug 列表
zentao bug

# 查看 Bug 详情
zentao bug 329

# 解决 Bug（执行操作）
zentao bug resolve 329 --resolution=fixed
```

### 需求与任务

```bash
# 查看需求列表
zentao story

# 创建任务
zentao task create --name=实现登录功能 --execution=10
```

### 数据筛选与搜索

```bash
# 只显示指定字段
zentao product --pick=id,name

# 按条件过滤
zentao bug --filter 'status:active'

# 模糊搜索
zentao story --search=登录 --search-fields=title

# 按字段排序
zentao bug --sort=id_desc

# JSON 格式输出（适合程序处理）
zentao product --format=json
```

### 查看帮助

```bash
# 查看所有命令
zentao help

# 查看指定模块的帮助（可用操作与参数）
zentao bug help
```

更多功能（环境变量、账户切换、批量操作、管道输入、分页控制等）请参考 [CLI 核心功能详解](docs/cli-usage.md)。

## 在 AI Agents 中使用

### 通过 Zentao CLI 技能使用

支持通过 `zentao-cli` 技能访问和操作禅道数据。安装技能可以通过 `zentao add-skill` 一键安装技能到 AI Agent，目前支持 Claude Code、Cursor、Cherry Studio、Codex、OpenCode、VS Code 等 AI Agent。

详细使用可以参考：[在 Agents 中使用禅道](docs/use-zentao-in-agents.md)，下面简单介绍。

```bash
# 安装 zentao-cli 技能
$ zentao add-skill

请选择要安装的 AI Agent:
  1) Claude Code
  2) Cursor
  3) Cherry Studio
  4) Codex
  5) OpenCode
  6) VS Code
  7) Antigravity
  8) Gemini
  9) 全部安装
请输入编号 (1-9):9

# 安装技能到 Claude Code
$ zentao add-skill claude-code
```

如果还未安装 zentao-cli，可以通过下面的命令，一键安装、登录和配置 Skill：

```bash
# 一键安装、登录和配置 Skill
$ pnpm install -g zentao-cli && zentao login && zentao add-skill all
```

安装技能后即可在对应 Agent 工具中使用禅道 CLI 技能。

```txt
禅道中有哪些产品？

产品 xxx 有哪些研发中的需求？

需求 xxx 有哪些风险？
```

### 通过 MCP 服务使用

Zentao CLI 支持一键配置 MCP 服务，只需要执行 `zentao add-mcp` 命令，然后按照提示输入禅道 URL、用户名和密码即可。

```bash
# 一键配置 MCP 服务
$ zentao add-mcp

请输入禅道 URL: https://zentao.example.com
请输入用户名: admin
请输入密码: 123456

请选择要配置的 AI Agent:
   1) Cursor
   2) Claude Desktop
   3) Claude Code
   4) Windsurf
   5) Cline
   6) Trae
   7) VS Code
   8) Cherry Studio
   9) OpenCode
  10) Codex
  11) 全部配置
请输入编号 (1-11): 7
```

如果还未安装 zentao-cli，可以通过下面的命令，一键安装、登录和配置 MCP 服务：

```bash
# 一键安装、登录和配置 MCP 服务
$ pnpm install -g zentao-cli && zentao login && zentao add-mcp
```

统一支持通过 `npx -y zentao-cli mcp` 手动启动 MCP 服务，然后通过 MCP 客户端访问和操作禅道数据。目前各大 Agents 工具无需提前安装 zentao-cli 本身，只需要在 MCP 服务配置中增加如下配置即可：

```json
{
  "mcpServers": {
    "zentao-cli": {
      "command": "npx",
      "args": ["-y", "zentao-cli", "mcp"],
      "env": {
        "ZENTAO_URL": "https://zentao.example.com",
        "ZENTAO_ACCOUNT": "admin",
        "ZENTAO_PASSWORD": "123456"
      }
    }
  }
}
```

## 文档

| 文档 | 说明 |
| --- | --- |
| [CLI 核心功能详解](docs/cli-usage.md) | 用户验证、数据访问与操作、数据处理、输出格式、配置管理等 |
| [在 Agents 中使用禅道](docs/use-zentao-in-agents.md) | 通过技能或 MCP 在 AI Agents 中使用禅道 |
| [开发指引](docs/development.md) | 技术栈、项目结构、测试 |
| [技术方案与实现细节](docs/implementation.md) | 内部接口调用规则、验证机制与持久化配置 |
| [常见错误排查与参考手册](docs/errors.md) | 错误代码（Exxxx）查阅 |
| [后续计划](docs/roadmap.md) | 待实现的功能和改进计划 |
| [更新日志](CHANGES.md) | 每个版本的变更内容 |
