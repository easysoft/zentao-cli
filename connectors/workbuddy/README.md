# 禅道 WorkBuddy 连接器

接入方式：**CLI + Skill**。连接器版本 `0.1.0`，安装 `zentao-cli@0.3.1`，最低 WorkBuddy 版本 `4.24.0`，由 WorkBuddy 托管 Node.js 22。

本资源包采用**首次在终端登录**的方案，供提交审核和兼容性确认。它没有实现 WorkBuddy 要求的浏览器认证流程，不能据此宣称已经满足全部上架条件。

规范依据：[连接器文档](https://open.workbuddy.cn/docs/connector)、[技能文档](https://open.workbuddy.cn/docs/skill)。

## 打包与内容

在 zentao-cli 仓库根目录运行（需要 Bun 和系统 `zip`、`unzip` 命令）：

```bash
bun run build:workbuddy
```

生成 `release/workbuddy/zentao-workbuddy-0.1.0.zip`，解压后只有一个顶层目录：

```text
zentao/
├── connector-meta.json
├── cli.json
├── icon.png
├── README.md
└── skills/
    └── zentao-cli/
        ├── SKILL.md
        └── references/
            ├── data-output.md
            └── writes.md
```

提交此 ZIP 供 WorkBuddy 团队审核。`source` 采用 `zentao`，是否可注册仍需由平台确认。中英文名称、描述与示例已提供；使用双语示例，因此声明最低版本 `4.24.0`。资源包不包含 MCP 配置。

Skill 和参考资料由仓库 `skills/zentao-cli/` 生成，打包时补入 WorkBuddy 运行约定，并为命令添加专用 `--config` 参数。不要直接编辑 `release/` 中的产物。连接器版本独立于 CLI 版本；升级 CLI 时应同步 `cli.json` 和本目录中的版本说明，再打包验证。

`icon.png` 为用户提供的禅道 LOGO 原图，1024×1024、带 Alpha 通道。文档允许 PNG，64×64 为建议尺寸；本包保留原图，未重新绘制。

## 首次登录

1. 用户在自己的交互终端执行下列命令。终端需具备 Node.js/npm；若已安装 `zentao`，也可将 `npx --yes zentao-cli@0.3.1` 替换为 `zentao`。
2. 按 CLI 提示输入禅道根地址、账号和密码或 Token。凭证不经过 AI 对话，也不写入资源包。
3. 完成后在 WorkBuddy 中启用或重新连接“禅道”。

```bash
npx --yes zentao-cli@0.3.1 --config "~/.config/zentao/workbuddy.json" login
```

WorkBuddy 的 `init` 使用托管 npm 非交互安装 CLI，不依赖系统全局安装；但托管运行时不保证可供系统终端直接使用。首次手动登录的终端环境是本方案的额外前提。

专用凭证位于用户主目录下 `.config/zentao/workbuddy.json`，与 CLI 安装目录分离。Windows 也由 CLI 展开 `~` 到用户主目录。所有业务命令都应带相同的 `--config`，并在当前命令进程中清空四个认证环境变量（见 Skill），避免完整环境凭证覆盖 Profile。

## 生命周期与限制

| 操作 | 当前行为 |
| --- | --- |
| 安装 | macOS/Linux 使用 `npm`；Windows 使用 `npm.cmd`；固定安装 0.3.1 |
| auth | 立即输出终端登录提示并以非零退出码结束，不等待 TTY、不伪造认证 URL |
| status | 调用 `profile --format=json`；退出码为 0 且 `currentProfile` 非空时匹配已连接 |
| unAuth | 删除专用配置文件；未登录时也成功；不会影响默认 `zentao.json` |
| 重启 | 从同一专用配置恢复本地状态，不需要常驻认证进程 |

`status` 不发起 API 请求、不刷新 Token，也不改写 Profile 内容或文件权限。它无法判断凭证是否过期、远端是否撤销授权或服务器是否可达。业务请求出现 `E1003` / `E1004` 时应请用户重新交互登录；连接或超时错误应先核对网络，不能一概认定未登录。

`unAuth` 清理本地专用文件中的所有账号，避免删除当前账号后自动切换到其他账号而仍显示已连接。它不撤销远端 Token；若需要撤销，用户应在禅道服务端处理。

## 本地验证记录

2026-09-20 在 macOS 上完成：

- `bun run typecheck` 通过；`bun test tests/workbuddy.test.ts tests/skill-contract.test.ts` 的 5 项测试通过。
- 在临时安装目录使用 Node.js `22.23.2` 执行配置中的安装命令，从 npm 安装 `zentao-cli@0.3.1`；无 TTY 登录提示、模拟 Profile 的跨进程状态读取、重复断开及普通 CLI 配置隔离均通过。未使用真实账号登录。
- ZIP 完整性、元信息、Skill YAML 必填字段、版本一致性和参考资料路径检查通过；LOGO 与用户提供文件的 SHA-256 一致。

## 提交时须说明的兼容性事项

- WorkBuddy 文档要求 `auth` 在无 TTY 环境输出 HTTPS 认证 URL。本包没有该能力：未预先登录时连接会失败并给出终端登录提示。需请审核方确认能否接受该前置条件；否则应先补齐浏览器认证，再重新提交。
- WorkBuddy 文档要求状态检查无副作用、登出清理授权。本包只读检查本地 Profile，登出仅清理专用文件，远端 Token 不会随之撤销，应一并说明。
- macOS、Linux、Windows 的配置均已提供，但配置存在不代表三平台或真实 WorkBuddy 联调已通过。正式上架前仍需在各平台核对托管安装、手动登录、重启恢复和断开连接，并验证真实站点的认证失效、超时及参数错误。
- 本包不包含 `token-schema.json`，也不将 CLI 接入伪装为 MCP 的自填 Token 模式。若审核要求完整浏览器认证，需要另行扩展 CLI 的认证能力。
