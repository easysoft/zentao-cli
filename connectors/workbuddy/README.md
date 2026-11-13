# 禅道MCP 连接器（WorkBuddy）

接入方式为 **stdio MCP + 原生凭证表单**，连接器版本 `0.4.4`，最低 WorkBuddy 版本 `5.0.0`。WorkBuddy 托管 Node.js 22，通过 `npx --yes zentao-cli@0.4.4` 启动本地 MCP；用户无需自行安装 CLI。

规范依据：[WorkBuddy 连接器文档](https://open.workbuddy.cn/docs/connector)。

## 用户连接

在 WorkBuddy 连接器表单中填写：

| 字段 | 要求 |
| --- | --- |
| 禅道地址 | 必填，填写站点根地址；部署在子目录时保留子目录 |
| 账号 | 必填，使用禅道登录账号 |
| 密码 | 与 Token 至少填写一项；首次调用自动登录获取 Token |
| Token | 可直接填写已有 Token；同时填写密码时优先使用 Token |

密码和 Token 都使用隐藏输入框。原生表单只支持各字段的必填标记，无法表达跨字段的二选一约束，因此两项均设为选填，由 MCP 拒绝缺少凭证的业务调用。空的可选字段显式传空字符串，避免继承机器上同名的认证环境变量。

凭据由 WorkBuddy 保存在本机，并通过环境变量传给 MCP。密码模式换取的 Token 只保留在进程内存中，不写入 CLI Profile。连接器通过 `${PLUGIN_ROOT}/empty-config.json` 引用随包空配置，避免缺少凭据时读取用户的普通 CLI 账号；该文件不会保存登录信息。`zentao_switch_profile` 已屏蔽，切换账号或站点请修改表单并重新连接。

工具发现不访问禅道。首次调用 `zentao_profile` 或业务工具时认证，密码登录与并发请求共用一次登录，后续复用 Token 和站点配置。连接器 Skill 引导 Agent 首次调用 `zentao_profile`，避免将 MCP 连接成功当作凭据验证成功。

密码错误时修改表单并重新连接；密码模式的会话失效后，重新连接会再次获取 Token。直接填写的 Token 失效时需要更新 Token；如改用密码，请先清空旧 Token。两者同时填写时，失效的 Token 不会自动回退密码。

断开连接结束本地 MCP 进程，不撤销禅道远端 Token。旧 CLI 连接器的 `auth` / `status` / `unAuth` 回调不再使用；旧版 `~/.config/zentao/workbuddy.json` 登录记录不会自动迁移或删除。

## 构建与发布校验

需要 Bun、Node.js 22、npm；生成正式 ZIP 时还需要 zip 和 unzip。Node.js 22 必须位于 PATH 首位。

```bash
# 打包并临时安装本地 npm tarball，验证 stdio 与两种认证方式，生成预览
fnm exec --using=22 bun run build:workbuddy --local

# 验证 npm 上的精确版本后，生成正式提交 ZIP
fnm exec --using=22 bun run build:workbuddy
```

`--local` 输出 `release/workbuddy-preview/zentao-cli-0.4.4.tgz`、资源预览目录 `zentao-mcp/` 和 `validation.json`，不生成提交 ZIP。正式构建必须从 npm 安装 `mcp.json` 声明的精确版本，验证实际入口的 MCP 能力和认证行为后才打包；本地预览通过不能替代发布包验证。

连接器 `source` 和 MCP Server 标识均为 `zentao-mcp`。正式输出路径为 `release/workbuddy/zentao-mcp-workbuddy-0.4.4.zip`：

```text
zentao-mcp/
├── connector-meta.json
├── mcp.json
├── token-schema.json
├── empty-config.json
├── icon.png
├── README.md
└── skills/zentao-mcp/SKILL.md
```

MCP 专用 Skill 来自本目录，不再打包引导执行 shell 命令的 CLI Skill。修改 CLI 版本时同步 `mcp.json` 中的 npm 版本；连接器版本由 `connector-meta.json` 独立管理。生成目录会先清理，避免残留旧 `cli.json` 和 CLI Skill。stdio 参数中的包内文件使用 `${PLUGIN_ROOT}`，构建会拒绝 `~/...`、POSIX 绝对路径和 Windows 绝对路径。

## 验证范围

`bun test tests/workbuddy.test.ts` 和构建脚本使用真实 stdio 子进程与本机模拟禅道 API，覆盖密码登录、直接 Token、Token 优先级、缺失凭据、错误密码、并发登录复用、会话失效、修改凭据后重连、配置隔离和输出脱敏。测试按含空格的临时包目录展开 `${PLUGIN_ROOT}`，验证凭据全空时读取随包空配置且不回退用户配置。性能检查要求同一进程的三次业务查询只登录一次、只获取一次站点配置。

CI 在 macOS、Linux、Windows 使用 Node.js 22 安装本地 tarball 后执行同一验证。`validation.json` 记录来源（本地或 npm）、CLI/Node 版本、构建产物 SHA-256、平台和耗时。

真实环境验证只读查询身份，并创建和撤销独立测试会话：

```bash
# Node.js 22 位于 PATH；.env.test 提供 ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD
bun --env-file=.env.test scripts/verify-workbuddy-live.ts
```

该脚本在 MCP 外获取可追踪、可清理的 Token，再验证真实 stdio 身份查询、失效检测和更新 Token 后重连；密码环境变量自动登录由上述模拟验证覆盖。两种验证均不代表 WorkBuddy 客户端的表单渲染、空字段注入、工具屏蔽和重新连接流程已通过，仍需在客户端验收。
