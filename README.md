# Zentao CLI

禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据，对 AI Agents 友好。

## 主要特性

* ✅ 基于最新的禅道 RESTful API 2.0 实现
* ✅ 覆盖 26 个模块、229 个 API 操作，调用前按禅道版本检查接口兼容性
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

当前使用 `zentao-api 0.6.8`，支持文档、待办、地盘、问题、风险、会议和工作流等模块。各操作的最低禅道版本可通过 `zentao <模块> <操作> --help` 查看；开源版、企业版、旗舰版和 IPD 版分别比较，版本不足时会在发送业务请求前报错。详见[API 覆盖与版本兼容](docs/cli-usage.md#api-覆盖与版本兼容)。

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
zentao bug --product=1

# 查看 Bug 详情
zentao bug 329

# 解决 Bug（执行操作）
zentao bug resolve 329 --resolution=fixed
```

### 需求与任务

```bash
# 查看需求列表
zentao story --product=1

# 创建任务
zentao task create --name=实现登录功能 --executionID=10
```

### 数据筛选与搜索

```bash
# 只显示指定字段
zentao product --pick=id,name

# 按条件过滤
zentao bug --product=1 --filter 'status=active'

# 模糊搜索
zentao story --product=1 --search=登录 --search-fields=title

# 按字段排序
zentao bug --product=1 --sort=id:desc

# JSON 格式输出（适合程序处理）
zentao product --format=json
```

### 查看帮助

```bash
# 查看所有命令
zentao help

# 查看指定模块的帮助（可用操作与参数）
zentao bug --help
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

# 将所有内置技能导出到指定目录
$ zentao add-skill --output ./skills
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

Zentao CLI 支持一键配置 MCP 服务。先通过 `zentao login` 登录，再执行 `zentao add-mcp`；命令会复用当前 Profile 中的 Token，不会将禅道密码写入 Agent 配置。

```bash
# 一键配置 MCP 服务
$ zentao login
$ zentao add-mcp
# 然后选择目标 Agent
```

如果还未安装 zentao-cli，可以通过下面的命令，一键安装、登录和配置 MCP 服务：

```bash
# 一键安装、登录和配置 MCP 服务
$ pnpm install -g zentao-cli && zentao login && zentao add-mcp
```

支持通过 `zentao mcp` 手动启动 MCP 服务，然后通过 MCP 客户端访问和操作禅道数据。`zentao add-mcp` 会写入如下配置：

```json
{
  "mcpServers": {
    "zentao-cli": {
      "command": "zentao",
      "args": ["mcp"],
      "env": {
        "ZENTAO_URL": "https://zentao.example.com",
        "ZENTAO_ACCOUNT": "admin",
        "ZENTAO_TOKEN": "<your-token>"
      }
    }
  }
}
```

`zentao add-mcp` 在 macOS/Linux 上会将写入的 Agent 配置权限收紧为 `0600`。手动配置时也应避免写入账号密码，并限制 Token 配置文件的访问权限。
为避免破坏已有注释，包含注释或尾逗号的 JSONC 配置不会被自动重写；命令会保持原文件不变并提示手动配置。

## 文档

| 文档 | 说明 |
| --- | --- |
| [交互式命令参考（HTML）](docs/command-reference.html) | 浏览器直接打开，搜索命令与参数，按模块和操作类型筛选 |
| [命令、参数与用法参考](docs/command-reference.md) | 全部内置命令、业务操作、参数类型、必填项、可选值和用法 |
| [CLI 核心功能详解](docs/cli-usage.md) | 用户验证、数据访问与操作、数据处理、输出格式、配置管理等 |
| [在 Agents 中使用禅道](docs/use-zentao-in-agents.md) | 通过技能或 MCP 在 AI Agents 中使用禅道 |
| [开发指引](docs/development.md) | 技术栈、项目结构、测试 |
| [技术方案与实现细节](docs/implementation.md) | 内部接口调用规则、验证机制与持久化配置 |
| [常见错误排查与参考手册](docs/errors.md) | 错误代码（Exxxx）查阅 |
| [后续计划](docs/roadmap.md) | 待实现的功能和改进计划 |
| [更新日志](CHANGES.md) | 每个版本的变更内容 |
