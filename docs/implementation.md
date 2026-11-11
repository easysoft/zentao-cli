# 技术方案与实现细节

CLI 负责命令、认证、配置、渲染与 MCP。HTTP、模块注册表、路径解析、请求组装、更新自动补全和响应提取由 `zentao-api` 提供。开发运行时是 Bun；npm 构建面向 Node.js 18+。

## 命令与输入

`src/cli.ts` 构建可复用的 Commander 命令树；`src/index.ts` 管理进程入口、配置路径、退出码和取消。`register-modules.ts` 为每个 SDK 动作生成真实子命令，不依赖未知参数透传。

`src/modules/contract.ts` 汇总动作的参数、批量能力、分页字段、只读策略与字段展示建议。CLI、机器帮助、MCP 发现、补全和 HTML 参考共用这些定义。生成的文档通过 `bun run scripts/generate-command-reference.ts --check` 检查，CI 和发布前检查都执行它。

`cli-input.ts` 按 schema 解析选项，保留字符串，规范化别名，检查重复来源和批量目标；`validation.ts` 是 CLI/MCP 共享的参数校验入口。JSON、文件或显式 stdin 请求体根据 `requestBody` 能力提供，不根据动作名称猜测。冲突或非法值在认证前失败。

## 身份与配置

认证优先级为显式 profile、完整环境凭据、保存的默认 profile。部分环境凭据失败；环境凭据不读取本地账号偏好。保存登录凭据与选择默认账号分离，`profile use` 或 `auth login --select` 设置默认身份；兼容入口 `login` 保留登录后选择账号的行为。

配置路径优先级为 `--config`、`ZENTAO_CONFIG_FILE`、绝对 XDG 配置根目录、默认 `~/.config`。读取不修改文件。Zod 校验已知字段并保留未知字段；缺失文件视为空配置，损坏文件保留并报结构化错误。

写入使用同目录 `.lock` 短事务：取得跨进程锁后重新读取最新内容，只修改目标字段，由 configstore 原子替换文件。网络请求不占锁。登录完成时合并最新偏好，避免覆盖期间发生的配置更新或账号切换。文件权限为 0600，新建目录为 0700。进程遭强杀而留下锁时，需先确认无活动写入，再移除遗留锁。

## 执行、分页与输出

`executor.ts` 调用 SDK request；根据动作能力设置页码和页大小。单页是默认行为；全量模式显式遍历、检测停滞和不完整分页，聚合后统一过滤、排序、字段摘取与截断。原生 limit 与最终 max-items 分开。

CLI JSON 成功为 `{ok,data,meta}`，失败为 `{ok:false,error}`。JSON 默认保留 HTML；终端表格默认精简列并标记截断，Markdown 和 JSON 不截断。raw 保留服务器业务响应，拒绝批量与本地加工。结果写 stdout，诊断写 stderr；quiet 保留结果。

## 生命周期与 MCP

一个 CLI 命令对应一个 AbortController，整次 deadline 和 SIGINT 覆盖 stdin、认证、更新预取、文件上传及业务请求；timeout 单独限制每次 HTTP 请求。批量取消后不继续请求。已完成写入不回滚。

MCP 保留逐请求上下文与 structuredContent/outputSchema。并发认证使用引用计数：取消一个调用只退出该等待者，全部等待者取消才终止共享认证。用户查找统一分页；HTTP 模式过滤本地文件操作，知识 POST 搜索显式标注只读，SQL 保守保留在写工具组。

## HTTP MCP 的请求隔离

`zentao mcp --transport http` 使用 MCP SDK 的无状态 Streamable HTTP 传输。Node 运行时使用 `node:http` 和 `StreamableHTTPServerTransport`；Bun 运行时使用原生 `Bun.serve` 和 Web Standard 传输，以正确处理客户端断开。两种运行时共用工具、认证和请求处理逻辑。一个进程在启动时固定一个禅道站点，每个 `POST /mcp` 独立创建 MCP server、transport 和 SDK client，业务工具注册与 stdio 共用。请求结束后关闭该请求的 MCP 资源。

凭证仅取自当前请求的 `token` 或 `Authorization: Bearer` 请求头；缺失、重复或格式错误的凭证被拒绝。远程模式不进入 CLI 的环境凭证和本地 Profile 选择流程，不保存 Token，不开放 `zentao_switch_profile`。MCP 上下文单独提供 client、业务配置和站点信息；HTTP 的账号为空，因此 `zentao_profile` 不查询用户列表，也不验证 Token。

HTTP 模式强制关闭本地文件上传能力。现有 `file/create` 的文件参数是服务端本地路径，SDK 会读取该路径，因此 multipart/本地路径上传操作在获取业务认证上下文和调用 SDK 前被拒绝，动作帮助的 `available` 同步为 `false`。CLI 和 stdio 仍可上传本地文件；附件更新、删除等操作不受此限制。

上游客户端使用默认配置和启动时的 `--timeout`、`--insecure`，不会继承本地账号的偏好。取消信号绑定到当前请求，上游配置获取、更新预读和业务写入均使用该信号；一个客户端断开不会取消其他客户端的请求。服务不重放失败或已取消的写操作，也不保存跨请求会话。

HTTP 层限制请求体为 1 MiB、接收时长为 30 秒；接收完成后的工具调用整体执行时限为 60 秒与上游超时中的较大值。退出时停止接收新请求，最多等待 5 秒，再取消仍在运行的请求。日志不包含认证头或请求体。

HTTP 服务提供以下接口：

| 请求 | 认证 | 行为 |
| --- | --- | --- |
| `POST /mcp` | Token 请求头 | 处理 MCP 请求；结果通过 SSE 流返回，客户端需声明接受 `application/json` 和 `text/event-stream` |
| `GET /mcp`、`DELETE /mcp` | — | 返回 405；服务无状态，不维护会话 |
| `GET /healthz` | 无 | 只检查服务进程，不检查禅道是否可用或 Token 是否有效 |
| `GET /start` | 无 | 用户接入页面 |
| `POST /start/token` | 页面密钥 | 只接受该实例生成的接入页面发出的同源 JSON 请求，向固定的禅道站点换取 Token；请求体最大 16 KiB，最多同时处理 8 个，超出返回 429 |

HTTP 模式不读取服务器上的登录记录、配置文件偏好或 `ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD`、`ZENTAO_TOKEN` 环境变量。密码和 Token 不写入磁盘，接入页面和 `/start/token` 的响应禁止缓存。部署示例见[禅道 MCP 服务部署指南](mcp-server.md)。

## 验证与构建

Bun 单元测试覆盖纯函数、模拟 HTTP、CLI 子进程、stdio/HTTP MCP、跨进程配置更新和取消。真实环境测试与发布分开记录。`bun run build` 生成 Node 入口；`bun run build:sf` 生成当前平台独立程序。`scripts/verify-build-artifacts.ts` 验证打包后的技能导出。

测试、构建与真实环境验收结果见 [HTML 验收报告](optimization-report.html)。新增命令契约尚未发布；合并保留 main 的版本号，不将源码验收视为 npm 包或 WorkBuddy 客户端验收。
