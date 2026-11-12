# Zentao CLI

![npm](https://img.shields.io/npm/v/zentao-cli) ![Node.js](https://img.shields.io/node/v/zentao-cli) ![License](https://img.shields.io/npm/l/zentao-cli)

简体中文 | [English](README.en.md)

禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据，对 AI Agents 友好。

## 主要特性

* 基于禅道 RESTful API 2.0，覆盖 40 多个模块、300 多个 API 操作，调用前按禅道版本检查接口兼容性
* 可通过 `npx zentao-cli` 免安装运行
* 通过浏览器登录，只保存 Token、不保存密码，支持多账号切换
* 支持对数据进行摘取、过滤、排序，可显式将 HTML 转换为 Markdown
* 对 AI Agents 友好：帮助信息完善，支持 Markdown 与 JSON 输出
* 通过 `zentao skill install` 一键安装技能到 AI Agent
* 提供本地 stdio 与远程 HTTP MCP 服务，多个客户端可使用各自的禅道 Token

## 环境要求

* Node.js 18 或更高版本
* 禅道开源版 22.0、企业版 biz13.0、旗舰版 max8.0 或 IPD 版 ipd5.0 及以上

部分操作要求更高的禅道版本，CLI 会在发送请求前检查并提示。详见 [API 覆盖与版本兼容](docs/cli-usage.md#api-覆盖与版本兼容)。

## 快速开始

以下示例适用于 0.4.4 及以上版本；0.4.3 及更早版本请以本机 `--help` 为准。

```bash
# 全局安装
npm install -g zentao-cli

# 也可以使用 bun 安装，或免安装运行
# bun install -g zentao-cli
# npx zentao-cli
# pnpm dlx zentao-cli

# 登录：自动打开浏览器，输入禅道地址、用户名和密码
zentao login

# 查看产品列表
zentao product list
```

没有图形界面的终端可使用 `zentao login --no-browser` 交互登录。环境变量登录、多账号切换和退出登录见 [用户验证](docs/cli-usage.md#用户验证)。

## 常用命令

命令格式为 `zentao <模块名> <操作> [目标] [选项]`。使用 `list` 查看列表、`get` 查看详情；省略操作时显示帮助。

### 产品

```bash
# 查看产品列表
zentao product list

# 查看产品详情
zentao product get 1

# 创建产品
zentao product create --name=新产品

# 更新产品名称
zentao product update 1 --name=产品新名称

# 删除产品
zentao product delete 1
```

### Bug

```bash
# 查看产品 #1 的 Bug 列表
zentao bug list --product=1

# 查看 Bug 详情
zentao bug get 329

# 解决 Bug
zentao bug resolve 329 --resolution=fixed
```

### 需求与任务

```bash
# 查看产品 #1 的需求列表
zentao story list --product=1

# 在执行 #10 中创建任务
zentao task create --name=实现登录功能 --execution-id=10
```

### 筛选与输出格式

```bash
# 只显示指定字段
zentao product list --fields=id,name

# 按条件过滤
zentao bug list --product=1 --filter 'status=active'

# 模糊搜索
zentao story list --product=1 --search=登录 --search-fields=title

# 按字段排序
zentao bug list --product=1 --sort=id:desc

# JSON 格式输出，适合程序处理
zentao product list --format=json
```

### 查看帮助

```bash
# 查看所有命令
zentao help

# 查看模块的可用操作与参数
zentao bug --help

# 查看操作的参数和最低禅道版本
zentao bug resolve --help
```

### 获取 Token

脚本或 MCP 配置需要 Token 时，可用 `zentao token` 读取：

```bash
# 读取当前账号或指定账号已保存的 Token
zentao token
zentao token 'admin@https://zentao.example.com'

# 临时获取新 Token，不保存到 CLI 配置
zentao token --server https://zentao.example.com --user admin --password '<password>'
```

默认只输出一行 Token。读取已保存的 Token 不会联网验证，也不会修改配置或切换账号。详见 [获取 Token](docs/cli-usage.md#获取-token)。

管道输入、批量操作、分页控制和配置管理等更多功能见 [CLI 核心功能详解](docs/cli-usage.md)。

CLI 默认发送带版本的操作来源标记，MCP 自动区分 stdio/HTTP。用 `--assistant 'AI <codex>'` 自定义本次标记，`--assistant ''` 本次关闭，或 `zentao config set autoAssistant false` 关闭当前 profile 的自动标记。MCP 工具可用顶层 `assistant` 参数逐次覆盖。详见[操作来源标记](docs/cli-usage.md#操作来源标记)。

## 在 AI Agents 中使用

可以通过以下三种方式在 AI Agents 中使用禅道：

| 方式 | 适用场景 | 是否需要安装 CLI |
| --- | --- | --- |
| 技能（Skill） | 个人使用，Agent 在终端中调用 CLI | 需要 |
| 本地 MCP | 个人使用，Agent 通过 MCP 工具调用 CLI | 需要 |
| 远程 MCP | 公司统一部署，用户用个人 Token 接入 | 不需要 |

完整说明见 [在 Agents 中使用禅道](docs/use-zentao-in-agents.md)。

### 通过技能使用

```bash
# 一键安装、登录并安装技能（交互选择目标 Agent）
npm install -g zentao-cli && zentao login && zentao skill install

# 直接指定目标 Agent，all 表示全部安装
zentao skill install claude-code
zentao skill install all

# 将所有内置技能导出到指定目录
zentao skill export ./skills
```

支持 Claude Code、Cursor、Cherry Studio、Codex、OpenCode、VS Code、Antigravity 和 Gemini。安装后即可在 Agent 中用自然语言提问：

```txt
禅道中有哪些产品？

产品 xxx 有哪些研发中的需求？

需求 xxx 有哪些风险？
```

由 Agent 发起登录时，使用 `zentao login --web` 并保持进程运行，等用户在浏览器中完成验证后再继续。在 CI 或容器中，可以注入环境凭据或挂载配置文件；Agent 可先执行 `zentao auth status --format=json` 确认实际使用的账号，输出不包含 Token 或密码。详见 [Agent、CI 与容器中的凭据](docs/use-zentao-in-agents.md#agentci-与容器中的凭据)。

### 通过本地 MCP 使用

```bash
# 一键安装、登录并配置本地 stdio MCP（交互选择目标 Agent）
npm install -g zentao-cli && zentao login && zentao add-mcp
```

`zentao add-mcp` 会复用当前账号的 Token，不会将禅道密码写入 Agent 配置。可在 MCP 配置的 `args` 中追加启动选项来限制开放范围：

```bash
# 只开放查询，并限定业务模块
zentao mcp --read-only --modules product,story,task,bug

# 将每个模块拆分为查询和写入两个工具，方便客户端分别授权
zentao mcp --split-tools --modules product,story,task,bug
```

生成的配置格式和全部启动选项见 [MCP 服务](docs/cli-usage.md#mcp-服务)。

### 通过远程 MCP 使用

`zentao mcp-server` 适合由公司管理员统一部署。用户只需服务地址和自己的禅道 Token，无需安装 zentao-cli；禅道按各自账号的权限处理请求。

```bash
# 管理员在服务器上启动服务，固定连接一个禅道站点
zentao mcp-server https://zentao.example.com
```

启动后打开 `http://127.0.0.1:9090/start`，用户可在页面上获取个人 Token，并复制接入说明让 Agent 协助配置。管理员需通过 HTTPS 反向代理同时提供 `/start` 和 `/mcp`。

* 管理员部署：[禅道 MCP 服务部署指南](docs/mcp-server.md)
* 用户接入：[在 Agent 中接入禅道 MCP 服务](docs/mcp-user-guide.md)

## 文档

| 文档 | 说明 |
| --- | --- |
| [交互式命令参考（HTML）](docs/command-reference.html) | 浏览器直接打开，搜索命令与参数，按模块和操作类型筛选 |
| [命令、参数与用法参考](docs/command-reference.md) | 全部内置命令、业务操作、参数类型、必填项、可选值和用法 |
| [CLI 核心功能详解](docs/cli-usage.md) | 用户验证、数据访问与操作、数据处理、输出格式、配置管理等 |
| [在 Agents 中使用禅道](docs/use-zentao-in-agents.md) | 通过技能或 MCP 在 AI Agents 中使用禅道 |
| [禅道 MCP 服务部署指南](docs/mcp-server.md) | 管理员统一部署远程 MCP 服务、配置 HTTPS 反向代理并向用户发布 |
| [在 Agent 中接入禅道 MCP 服务](docs/mcp-user-guide.md) | 禅道用户获取个人 Token，并在 Agent 中配置远程 MCP |
| [开发指引](docs/development.md) | 技术栈、项目结构、测试与构建 |
| [技术方案与实现细节](docs/implementation.md) | 内部接口调用规则、验证机制与持久化配置 |
| [常见错误排查与参考手册](docs/errors.md) | 错误代码（Exxxx）查阅 |
| [后续计划](docs/roadmap.md) | 待实现的功能和改进计划 |
| [更新日志](CHANGES.md) | 每个版本的变更内容 |

<!-- repository-only:start -->
## 参与贡献

欢迎提交 Issue 和 Pull Request。开发环境、项目结构、测试和构建方法见 [开发指引](docs/development.md)。
<!-- repository-only:end -->

## 许可证

[MIT](LICENSE)
