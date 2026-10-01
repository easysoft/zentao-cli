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

已有自动化环境仍可提供 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 以及 `ZENTAO_TOKEN` 或 `ZENTAO_PASSWORD`；使用 `zentao login --useEnv` 可验证并保存环境凭证。业务命令缺少凭证时只报错，Agent 应显式启动登录，不会自动弹出页面。

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
