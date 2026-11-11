# 禅道 WorkBuddy 连接器

接入方式为 **CLI + Skill**，连接器版本 `0.2.0`，最低 WorkBuddy 版本 `4.24.0`，使用托管 Node.js 22。安装的 CLI 精确版本由 `cli.json` 指定，必须与 `package.json`、`versionCheck.minVersion` 及实际 npm 发布包一致。

规范依据：[连接器文档](https://open.workbuddy.cn/docs/connector)。

## 构建与发布校验

需要 Bun、Node.js 22、npm、zip 和 unzip。Node.js 22 必须位于 PATH 首位。

```bash
# 发布前：构建、打包、临时安装本地 npm tarball，并执行生命周期验证
bun run build:workbuddy --local

# 发布后：安装 npm 上的精确版本、验证能力和生命周期，再生成提交 ZIP
bun run build:workbuddy
```

本地验证输出 `release/workbuddy-preview/zentao-cli-<version>.tgz`、资源预览目录 `zentao/` 和 `validation.json`，**不会生成提交 ZIP**。本地验证通过不代表该版本已发布。

正式构建从 npm 安装指定版本，检查 `auth login --web --no-open --select`、`auth status --verify`、`auth logout --all --revoke` 的实际能力，并对安装后的 CLI 执行全流程验证；不兼容时直接失败。不要用仓库源码测试替代这一检查，也不要绕过失败手动压缩目录。

当前分支的命令树不同于已发布的 0.4.0/0.4.3。提交前需发布包含所需能力的新 CLI 版本，并同步 CLI/Skill 版本、`cli.json` 安装版本和 `versionCheck.minVersion`。

正式输出为 `release/workbuddy/zentao-workbuddy-0.2.0.zip`，结构如下：

```text
zentao/
├── connector-meta.json
├── cli.json
├── icon.png
├── README.md
└── skills/zentao-cli/
    ├── SKILL.md
    └── references/
        ├── data-output.md
        └── writes.md
```

Skill 来自**实际安装的 npm 包**，打包时补入本目录 `skill-notes.md`，并添加专用 `--config` 参数。不要直接编辑生成目录。图标保留原始 1024×1024 透明 PNG；文档中的 64×64 为建议尺寸。

## 认证生命周期

| 操作 | 行为 |
| --- | --- |
| init | 安装固定版本到 WorkBuddy 托管 npm prefix，凭据与安装目录分离 |
| auth | 无 TTY 启动本机浏览器登录页，立即输出链接；成功后保存并选中专用 Profile |
| status | 单次 `GET api.php/v1/user` 校验当前身份与 Token，无本地写入；有效才返回 0 和 `ok:true` |
| unAuth | 逐个 `POST api.php/v2/users/logout`，确认 Token 已失效后删除对应本地凭据；空配置也成功 |
| 重启 | 从相同专用配置恢复状态，在线检查，不依赖原认证进程 |
| 过期 | status 返回失败；重新连接后浏览器登录可恢复 |

`authWaitForExit: true` 保留登录进程至用户完成或取消，`--no-open` 避免 CLI 与 WorkBuddy 重复打开浏览器。临时页面仅监听 `127.0.0.1`，使用带随机会话标识的回环 HTTP URL；`authUrlDomain: "127.0.0.1"` 对应文档的 `https?://` URL 提取规则。必须在真实 WorkBuddy 验证该回环流程；文档提交清单仍写 HTTPS，不应把模拟验证当作平台审核结论。

凭据只保存于 `~/.config/zentao/workbuddy.json`，不在 AI 对话中收集密码。命令显式指定该路径，并清空四个认证环境变量，普通 CLI 配置不受影响。

状态请求超时 2.5 秒、命令总期限 8 秒，满足 10 秒检测窗口；每次轮询只访问当前用户，不扫描用户列表。认证总期限 290 秒；断开总期限 25 秒。网络失败与 Token 失效均返回非零，但保留各自错误码。

撤销失败不会假报成功或丢弃仍有效的 Token；保留该账号以便重试。已完成项已清理，重试是幂等的。并发重新登录产生的新 Token 不会被旧撤销请求删除。

## 验证范围

自动验证覆盖首次连接、错误密码重试、取消、跨进程恢复、只读状态、单次请求成本、网络超时、Token 失效、重新认证、撤销失败、假成功响应、断开幂等性与配置隔离。CI 对 macOS、Linux、Windows 使用 Node.js 22 安装本地 tarball 后执行同一验证；CI 配置存在不代表三平台已实际通过。

`validation.json` 记录验证来源（本地或 npm 发布版）、时间、CLI/Node 版本、构建产物 SHA-256、测试平台及耗时。真实环境验证使用独立配置和临时会话，不修改禅道业务数据：

```bash
# Node.js 22 位于 PATH；.env.test 提供 ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD
bun --env-file=.env.test scripts/verify-workbuddy-live.ts
```

该脚本验证当前构建与已验收 tarball 的 SHA-256 一致，执行真实登录、状态、失效、重新登录和远端撤销，清理临时会话后输出 `live-validation.json`。它验证 CLI 回调与真实禅道服务，不代表 WorkBuddy 客户端按钮流程已通过。真实客户端操作、其他平台和 `source: zentao` 的平台唯一性仍需单独验收；本次按用户要求跳过实机测试。
