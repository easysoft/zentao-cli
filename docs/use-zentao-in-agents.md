# 在 Agents 中使用禅道

你是否希望在 AI Agents 中使用禅道？没问题，可以通过安装禅道 CLI 技能来实现。CLI 技能会利用 [zentao-cli](https://github.com/easysoft/zentao-cli) 工具来访问和操作禅道数据。

关于 zentao-cli 的主要特性，请参考 [README](../README.md#主要特性)。

## 支持的 Agents 工具

支持在所有支持技能或 MCP 的 Agents 工具中使用，下面以上手难度从易到难列举可以使用的工具：

- Cherry Studio，可配置国内模型 API，智能体能力稍弱
- Cursor，可免费使用，推荐新手使用
- VS Code Copilot，可免费试用，推荐
- Trae，需要付费订阅
- Cline，可配置国内模型 API，推荐开发者使用
- Codex，需要付费订阅以及特殊网络环境，推荐有条件的用户
- Antigravity，需要付费订阅以及特殊网络环境，推荐有条件的用户
- OpenClaw，可配置国内模型 API，推荐开发者使用
- OpenCode，可配置国内模型 API，推荐开发者使用
- Claude Code，可配置国内模型 API，推荐开发者使用
- Codex CLI，可配置国内模型 API

## 安装方式

现代的 Agents 工具都支持自动发现安装技能，可以将如下内容发送给 Agent 来进行安装：

```sh
参考 https://github.com/easysoft/zentao-cli 来安装 zentao-cli，并安装仓库内的所有技能。
```

如果你是开发者，可以直接在终端中执行命令来安装：

```sh
# 全局安装 zentao-cli 工具
$ npm install -g zentao-cli

# 其他安装与运行方式
# bun install -g zentao-cli  # ← 使用 bun 安装
# npx zentao-cli             # ← 通过 npx 免安装运行
# pnpm dlx zentao-cli        # ← 通过 pnpm 免安装运行

# 安装完成之后可以一键安装技能到 Agents
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
```

如果需要将技能用于其他支持 Skills 的工具，也可以将所有内置技能导出到指定目录：

```sh
$ zentao add-skill --output ./skills

# 将生成：
# ./skills/zentao-cli/
# ./skills/zentao-tour/
```

## 账号登录

安装完成后，推荐让 Agent 发起浏览器登录：

```sh
zentao login --web
```

Agent 应保持命令进程运行，提示用户在本机浏览器中输入禅道地址、用户名和密码。浏览器没有自动打开时，将命令输出的本机链接交给用户手动打开。登录成功后 CLI 保存 Token 并退出，Agent 再重试原业务命令。不要在对话中收集密码或 Token，也不要替用户读取浏览器表单中的凭据。

可添加 `--message "完成登录后，回到 Codex 即可继续使用禅道。"` 自定义登录页副标题，指引用户回到当前 Agent；提示按纯文本显示。

桌面环境直接运行 `zentao login` 也会自动打开浏览器。远程服务器或容器中的本机链接属于 CLI 执行端，不能在另一台电脑上直接打开；此时可让用户在相同执行环境中运行 `zentao login --no-browser` 完成终端交互登录。沿用原业务命令的 `--config` 或 `ZENTAO_CONFIG_FILE`，确保登录记录保存在相同位置。

已有自动化环境可提供完整环境凭据直接执行业务命令，无需先登录或保存配置；仅在需要验证并保存环境凭据时执行 `zentao login --useEnv`。业务命令缺少凭证时只报错，Agent 应显式启动登录，不会自动弹出页面。

## Agent、CI 与容器中的凭据

先通过 `zentao profile --help` 确认安装版本支持 `--effective`，再检查实际生效的认证来源：

```sh
zentao profile --effective --format=json
```

`source=environment` 表示完整环境凭据，`source=profile` 表示当前保存的账号。输出只包含站点、账号、凭据类型和实际使用的配置路径；环境凭据的 `configFile` 为 `null`。该命令不请求服务器，`verified=false` 表示尚未验证凭据。确认站点和账号后，在用户指定范围内执行一次只读查询来验证连接。

### 方式一：由运行环境注入凭据

让 Agent 启动器或 CI 的 Secret 配置注入 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 和 `ZENTAO_TOKEN`；也可用 `ZENTAO_PASSWORD` 代替 Token，同时存在时优先 Token。不要让 Agent 打印环境变量、读取凭据文件，或把真实 Token 写入聊天、命令参数与仓库。

```sh
# 完整凭据已由运行环境注入
zentao profile --effective --format=json
zentao product --pick=id,name --page=1 --recPerPage=5 --format=json
```

这种方式不读取或写入本地 Profile，不继承本地账号的配置。需要调整超时等参数时，显式使用 `--timeout` 等命令选项。环境密码仅在业务请求的认证过程中换取 Token，诊断命令不会登录。

### 方式二：只读挂载已有配置

先在宿主机完成人工登录，再由运行环境把配置目录只读挂载到例如 `/run/zentao`。运行 CLI 的用户需要能读取文件并访问其父目录：

```sh
zentao --config /run/zentao/zentao.json profile --effective --format=json
zentao --config /run/zentao/zentao.json product --pick=id,name --page=1 --recPerPage=5 --format=json
```

读取与业务认证不会修改配置内容、最近使用时间或文件权限。登录、退出、切换本地账号和修改配置仍需写入权限；只读挂载环境的凭据更新由宿主机或部署端负责。若环境同时注入了完整凭据，业务命令仍优先使用环境来源。

### 方式三：指定可访问的配置路径

由运行环境提供 Agent 可以访问的配置目录，例如 `/agent-config`，并在同一路径完成人工登录：

```sh
# 本机人工登录；远程执行端可改用 login --no-browser
zentao --config /agent-config/zentao.json login --web

# Agent 后续调用沿用相同的配置文件
ZENTAO_CONFIG_FILE=/agent-config/zentao.json zentao profile --effective --format=json
ZENTAO_CONFIG_FILE=/agent-config/zentao.json zentao product --pick=id,name --page=1 --recPerPage=5 --format=json
```

需要统一配置根目录时，可设置 `XDG_CONFIG_HOME=/agent-config`，此时默认文件为 `/agent-config/zentao/zentao.json`。优先级为 `--config` → `ZENTAO_CONFIG_FILE` → 绝对路径 `XDG_CONFIG_HOME` → `~/.config`。显式更换目录后不会迁移或回退读取旧文件；登录与后续调用要使用相同路径。凭据目录应位于仓库之外，目录选择也不会改变操作系统或 Agent 沙箱授予的权限。

### 根据错误处理

| 结果 | 下一步 |
| --- | --- |
| 生效来源或账号不符合预期 | 检查启动器注入的凭据和配置路径；切换本地 Profile 不会覆盖完整环境凭据 |
| `E1006` | 当前来源缺少可用凭据；沿用所选路径登录，或由运行环境补齐环境凭据 |
| `E1005` | 按 JSON 输出的 `error.details.reason` 区分 JSON 损坏、结构错误和不可读；核对路径与权限，保留原文件 |
| `E1011` | 写入失败，检查目录权限和磁盘空间；`error.details.systemCode` 提供系统错误码，不要重复发起登录 |
| 业务请求返回 `E1004` | Token 被禅道拒绝；由对应凭据来源的维护者更新后重试 |

这些规则适用于 CLI 和本地 stdio MCP。HTTP MCP 的 Token 由每次请求提供，见 [MCP 使用说明](cli-usage.md#mcp-服务)；完整错误说明见 [排查手册](errors.md)。

## 使用示例

安装登录完成之后，可以在对应 Agent 工具中使用禅道 CLI 技能，下面为一些使用示例：

创建产品：

```txt
我想创建一个产品，用来在线收集用户信息，请帮我整理下思路，然后生成第一版需求和计划。如果有问题尽管问我。
```

查询最新的需求：

```txt
上周增加了哪些新的需求？哪些需求比较难？我想针对比较难的需求提前制定方案。
```

查询 BUG，尝试分析原因和方案：

```txt
BUG 329 是什么问题？可能的原因是什么？有解决方案吗？
```

查看迭代情况，分析可能的风险：

```txt
迭代 10 的执行情况如何？有哪些风险？
```

## 升级

如果禅道 CLI 本身或者技能有新版本发布，可以通过如下命令来升级：

```sh
# 升级 CLI 本身
$ zentao upgrade

# 然后通过 add-skill 命令升级技能
$ zentao add-skill
```

也可以要求 Agent 帮你升级：

```txt
请帮我升级 zentao-cli，并通过 zentao add-skill 命令重新安装最新的技能。
```

## FAQ

### 与之前发布的 [zentao-api](https://github.com/easysoft/zentao-skills/tree/main/skills/zentao-api) 技能有何不同？我该用哪个？

推荐使用禅道 CLI 技能，CLI 支持更多功能，而且更省 Token，大模型不需要关注 API 调用细节，可以更专注于解决真实的问题。
[zentao-api](https://github.com/easysoft/zentao-skills/tree/main/skills/zentao-api) 技能是基于禅道 API 实现的技能，大模型需要关注 API 调用细节，且存在更多出错的情况。

### 我不懂 Agents、技能等概念，我该怎么使用？

在 AI 没有接管地球之前，无需着急，可以慢慢熟悉这些概念，慢慢来。目前受限于 Agents 能力，并不能完全代替禅道 GUI 使用，但可以作为一个辅助工具优先推荐给开发和测试人员使用。

如果你已经使用上了 Agents，并且安装了 CLI 技能，推荐先使用内置的 `zentao-tour` 技能，它会通过有趣的方式引导你以不同的角色体验在 Agents 中使用禅道。

### 可以在禅道 AI 里面使用吗？

目前还不支持在禅道内使用 CLI 提供的功能，不过我们在加速开发 ZAI Agents 平台，后续也可以在禅道里面直接安装技能来实现同样效果。

### 目前一些操作好像无法实现，比如操作模块、读写禅道文档等，这个无法支持吗？

CLI 目前以来禅道 API 2.0，一些接口还在完善中，我们正在加速开发中，敬请期待。
