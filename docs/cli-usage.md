# CLI 核心功能


<a id="usage"></a>
## 命令格式与传参

开发分支的新命令契约（2026-10-23）。这是不兼容调整，尚未发布；安装版本不同请以本机 `--help` 为准。

```bash
zentao <resource> <action> [target] [options]
zentao bug list --product 12
zentao bug get 123
zentao bug resolve 123 --resolution fixed
zentao db table zt_user
zentao help bug create --format=json
```

资源名称沿用 SDK，动作和选项使用 kebab-case，例如 `doc create-my-doc --space-id 1 --lib-id 2`。无动作时只显示帮助。根级 CRUD、`do`、隐式 list/get、`--id`、`--params`、位置 JSON 已移除。

- `--title 内容` 与 `--title=内容` 等价。字符串 `007`、`true` 保留原文。
- 数字、布尔和数组按当前动作的 schema 校验；`--count` / `--no-count` 或 `--count=false` 明确设置布尔值。
- 简单数组可重复选项（`--lib-ids 12 --lib-ids 18`），复杂数组使用 JSON。JSON 内保留 SDK 字段名和类型。
- 请求体使用 `--data '{"title":"示例"}'`、`--data @body.json` 或显式 `--data @-`。没有 `@-` 就不读取 stdin；POST 查询也遵守同一规则。
- 与全局或输出选项重名的业务字段加 `data-` 前缀，例如 `task update 123 --data-deadline 2026-10-30` 和工作流的 `--data-fields`；JSON 字段名保持原样。
- 未知字段、非法值、重复来源冲突和多个范围会在认证之前失败。省略、空字符串与 null 不混同；null 仅在 schema 允许时有效。
- `--ids 123,124` 仅用于支持批量的对象操作，与单个目标互斥，先校验全部 ID 再去重。创建多条记录请显式逐条调用 create，不将对象 ID 当成批量创建输入。
- 删除需要确认；非交互调用必须 `--yes`。批量部分失败会保留逐项结果并返回非零退出码；`--batch-fail-fast` 跳过后续项，不回滚。
- 更新只自动补全动作声明的可写字段，存在匹配详情操作时才生效。

<a id="examples"></a>
## 常用示例

```bash
zentao auth login --web
zentao profile list
zentao profile use 'admin@https://zentao.example.com'
zentao auth status --verify --format=json
zentao --profile 'admin@https://zentao.example.com' product list --page-size 20
zentao bug create --product 12 --title '登录失败' --opened-build trunk
cat query.json | zentao db query --data @- --format=json
zentao knowledge search --keywords 登录 --keywords 超时 --lib-ids 12 --page 2
zentao bug resolve --ids 123,124 --resolution fixed --format=json
zentao bug delete --ids 123,124 --yes --no-input --format=json
zentao config set timeout 30000
zentao config unset timeout
zentao completion zsh > ~/.zentao-completion.zsh
zentao skill install codex
zentao skill export ./exported-skills
zentao mcp install codex
zentao mcp serve --read-only --modules product,story,task,bug
zentao mcp serve --transport http --url https://zentao.example.com
```

<a id="data-options"></a>
## 分页与输出

默认只取一页。支持分页的动作才有 `--page`、`--page-size` 和 `--all`；`--all` 与 `--page` 互斥。`--max-items` 限制最终结果数量，服务端原生 `limit` 不再用于本地截断。SQL 查询的 `--page-size` 映射到请求体 limit；向量搜索的 `--limit` 仍是服务器字段。

`--filter`、`--search` 和 `--sort` 只处理已获取的范围：默认当前页，`--all` 时为全部页面。全量抓取后统一处理，再按 `--max-items` 截断。复杂处理也可通过 JSON 管道交给 jq。服务端遗漏分页信息、返回重复页或空页却宣称还有数据时，`--all` 报错，避免虚报完整结果。

- `table`：默认终端精简列，长值以 `…` 标记截断；`--fields` 自定义字段。
- `markdown`：文档表格或详情，保留完整文本。
- `json`：稳定封装 `{ok,data,meta}`，保留原始字段类型及 HTML；需要转换时显式加 `--html-to-markdown`。
- `raw`：原始业务响应，拒绝批量、字段摘取、本地处理和自动翻页；内置命令不提供 raw。

列表 meta 包含 returned、fetched、page、pageSize、total、hasMore、truncated、processingScope。total 是服务器处理前的总数；未知值为 null。过滤后空页仍保留 hasMore。批量 data 为逐项 objectID/ok/data/error，meta 为成功、失败与跳过数量。

<a id="errors"></a>
## 身份、交互与错误

认证优先级：`--profile` → 完整环境凭据 → 保存的默认账号。不完整的环境凭据直接报错；同账号或同主机简写存在多个匹配时必须使用完整 key。

`auth login` 只保存凭据，不改变默认身份；`profile use` 才选择默认身份。普通业务调用和 `auth status` 默认不修改配置。`auth status --verify` 才在线验证。配置写入以短事务串行化，只更新目标字段，网络等待不占锁；进程被强制终止后如遗留 `.lock` 目录，先确认没有 CLI 写入进程，再删除该锁目录后重试。

stdout 用于结果和批量报告；stderr 用于进度、诊断和无法产生结果的错误。JSON 模式的参数错误也是 `{ok:false,error}`。退出码：0 成功、1 执行失败、2 用法错误、130 取消。

`--no-input` 禁止浏览器和所有提示；`--yes` 只确认明确操作；`--quiet` 压制进度，保留结果和错误。`--color auto|always|never` 独立控制终端颜色。`--timeout` 限制单个请求，`--deadline` 限制整次命令，包括登录、预取与执行。

MCP 保留 structuredContent/outputSchema 与执行时策略检查。知识 POST 搜索可供只读工具使用；SQL 查询保守地留在写工具组。HTTP MCP 不发现或执行本地文件上传；stdio 可上传。取消涵盖认证和业务调用，取消一个并发调用不会终止其他调用。

<a id="review-summary"></a>
## 优化交付与手动验收

本分支逐项实施引用聊天中的批量、输入、命令树、分页、输出、身份、交互、MCP 和发现机制建议。详见 [实施记录](optimization-progress.md) 与 [HTML 验收报告](optimization-report.html)。报告会区分本地验证、真实测试环境结果和服务器能力限制。

## MCP 服务

`zentao mcp serve` 提供 stdio 和 HTTP 两种传输方式，共用业务工具、参数校验和返回格式。

### 本地 stdio 模式

```bash
zentao mcp
zentao mcp serve --transport stdio
zentao --config ./zentao.json mcp serve --read-only --modules product,story,task,bug
```

stdio 是默认模式，由 MCP 客户端启动并管理进程。通过 `zentao auth login` 保存本地账号，或在客户端启动配置中提供 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 与 `ZENTAO_TOKEN`/`ZENTAO_PASSWORD`。`zentao mcp install` 只生成这种本地配置；HTTP 客户端需要手动配置。

stdio 在首次业务调用时绑定账号和站点，环境凭证不会写入本地 Profile。`zentao_switch_profile` 只切换当前 stdio MCP 实例，不改变 CLI 或其他实例的当前账号；在 CLI 中切换账号也不会改变已运行的实例。显式选择的本地 Profile 会读取同一账号的 Token 和配置更新，删除该 Profile 后后续调用会报错。

stdio 的 `zentao_profile` 返回绑定的 `account`、`server`、远端详情 `user` 和 `userFound`。详情按账号过滤并按需翻页，仅返回 ID、账号、姓名、部门、角色；未找到时 `user=null`、`userFound=false`。远端权限、Token 或业务错误会明确报错。

### 远程 HTTP 模式

```bash
# 固定一个禅道站点，默认监听 127.0.0.1:9090
zentao mcp serve --transport http --url https://zentao.example.com

# 也可由 ZENTAO_URL 提供站点，显式 --url 优先
ZENTAO_URL=https://zentao.example.com zentao mcp serve --transport http

# 调整监听地址、端口和上游请求超时，并限定工具范围
zentao --timeout 15000 mcp serve --transport http --host 127.0.0.1 --port 9090 \
  --url https://zentao.example.com --read-only --modules product,story,task,bug
```

启动成功后，终端会输出可复制的 `mcpServers` JSON 配置示例：`url` 使用实际监听端口，全地址监听时使用对应的回环地址，`headers.token` 使用待替换的 Token 占位符，并提示可改用 `Authorization: Bearer <token>`。远程客户端连接时，应将示例 URL 替换为客户端可访问的 HTTPS 地址。

HTTP 模式需要 Node.js 18.14.1 或更新版本，或 Bun。每个进程只连接启动时指定的一个禅道站点。`--url` 和 `ZENTAO_URL` 都未提供时启动失败；不会回退到本地 Profile。`ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD`、`ZENTAO_TOKEN` 和服务机的登录记录不作为客户端凭证。

| 选项 | 默认值 | 用途 |
| --- | --- | --- |
| `--transport stdio\|http` | `stdio` | MCP 传输方式 |
| `--url <site>` | `ZENTAO_URL` | HTTP 模式的固定禅道站点地址 |
| `--host <host>` | `127.0.0.1` | HTTP 监听地址；容器按需使用 `0.0.0.0` |
| `--port <port>` | `9090` | HTTP 监听端口，范围 1–65535 |
| 全局 `--timeout <ms>` | `10000` | 单次上游请求超时，毫秒 |
| 全局 `--insecure` | 关闭 | 跳过上游禅道的 TLS 证书验证，不为 MCP 监听端提供 HTTPS |

`--url`、`--host`、`--port` 仅适用于 HTTP 模式，在 stdio 模式下使用会报错。HTTP 模式使用默认业务配置，并应用启动时显式指定的 `--timeout`、`--insecure`；不会读取任何本地账号的分页或其他偏好。`--read-only`、`--modules`、`--split-tools` 在两种传输方式下均可使用。

客户端连接地址为 `https://mcp.example.com/mcp`。每个请求必须携带客户端自己的**禅道 Token**，以下两种请求头任选其一。客户端的具体配置字段以其文档为准；支持 `mcpServers`、`url`、`headers` 的客户端可参考：

```json
{
  "mcpServers": {
    "zentao-remote": {
      "url": "https://mcp.example.com/mcp",
      "headers": { "token": "<your-zentao-token>" }
    }
  }
}
```

或者使用 Bearer 形式：

```json
{
  "mcpServers": {
    "zentao-remote": {
      "url": "https://mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer <your-zentao-token>" }
    }
  }
}
```

不同客户端使用各自的 Token，禅道按该 Token 的权限处理业务请求。缺失、格式错误或同时提供两种认证头均返回 HTTP 401。凭证只从请求头读取，不接受 URL 查询参数、用户名密码、Basic 或 OAuth 登录。Token 不保存到服务机的 Profile，也不会自动刷新。

HTTP 模式不注册 `zentao_switch_profile`。`zentao_profile` 仅返回固定站点信息，`account=null`、`user=null`、`userFound=false`；服务不会根据 Token 推断账号，这个工具也不验证 Token 是否有效。业务调用时由禅道验证 Token，失效后需由客户端更换。

现有 `file/create` 从运行 CLI 的主机读取本地文件路径，再由 SDK 上传。HTTP 模式禁用这类 multipart/本地路径上传操作，避免远程客户端读取服务机文件；`zentao_action_help` 对这些操作返回 `available=false`，执行时会在获取业务认证上下文和调用 SDK 前拒绝。附件上传请使用本地 CLI 或 stdio；附件更新、删除及其他业务工具仍按启动选项和禅道权限执行。HTTP 模式不提供替代上传格式。

### HTTP 部署与请求边界

原生 MCP 客户端使用无状态 Streamable HTTP，通过 `POST /mcp` 发送请求，调用结果默认通过协议内的 SSE 流返回；客户端应按协议声明支持 `application/json` 和 `text/event-stream`。这里的 SSE 是 `/mcp` 的响应格式，不提供旧版 `/sse` 传输端点。

| 请求 | 行为 |
| --- | --- |
| `POST /mcp` | 需要 Token；处理 MCP 请求 |
| `GET /mcp`、`DELETE /mcp` | HTTP 405；不维护独立会话 |
| `GET /healthz` | 无需认证；用于进程健康检查，不检测禅道可用性或 Token 权限 |

服务拒绝带 `Origin` 的请求，不提供浏览器 CORS 接入。每个请求独立创建凭证上下文，不支持跨请求取消、会话恢复或事件重放；客户端断开会取消该请求的上游工作。已发送的写入可能已生效，取消或超时后应先查询结果，再决定是否重试。

请求体上限为 1 MiB，接收超时为 30 秒。接收完成后，工具调用的整体执行时限为 60 秒与启动时上游超时中的较大值；上游各次调用仍受 `--timeout` 限制。收到退出信号后停止接收新请求，最多等待 5 秒再取消剩余请求。服务日志不记录 Token、认证头或请求体。

远程访问使用 HTTPS 反向代理，MCP 进程保持监听回环地址。以下为 Nginx 示例，证书路径按部署环境替换：

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.com;
    ssl_certificate /etc/nginx/tls/mcp.example.com.crt;
    ssl_certificate_key /etc/nginx/tls/mcp.example.com.key;

    location = /mcp {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 65s;
        client_max_body_size 1m;
    }
}
```

Nginx 默认转发客户端的 `Authorization` 和 `token` 请求头；代理层不要写死某个账号的 Token，也不要将认证头加入访问日志。若增大上游超时，应相应增加 `proxy_read_timeout`。本机可通过 `curl http://127.0.0.1:9090/healthz` 检查进程。

需要连接两个禅道站点时，运行两个独立实例，并在代理中配置对应的域名或路由：

```bash
# 分别在两个进程中运行
zentao mcp serve --transport http --port 9090 --url https://zentao-a.example.com
zentao mcp serve --transport http --port 9091 --url https://zentao-b.example.com
```

### 共用工具与返回格式

`zentao_action_help` 接受 `module` 和 `action`，查询路径、必填参数、参数类型、`minVersion` 和调用示例，例如 `{"module":"doc","action":"createMyDoc"}`。查询帮助不调用禅道，也不需要本地登录；HTTP 请求仍须携带 Token 头。示例中的占位 ID 和文本需替换为实际值；`available` 表示当前启动选项是否开放该操作。

`--read-only` 只开放查询工具，并在执行入口校验允许的动作；stdio 账号切换工具也不注册。`--modules product,story,task` 只注册指定业务模块，未知或空模块名会报错。`--split-tools` 按模块拆为 `_read` / `_write`，例如 `zentao_task_read` 和 `zentao_task_write`，不存在对应动作的分组不注册；默认使用 `zentao_task` 等工具名。三个选项可以组合使用，开放范围在进程启动时固定；禅道仍按账号权限授权。

业务参数使用 `params` 中的正式名称，例如任务列表 `{"action":"list","params":{"executionID":3}}`。`id`、`product`、`project`、`execution` 是按动作定义映射的数字 ID 简写，与正式参数冲突时会报错。数组字段不使用数字简写，例如创建代码库用 `{"action":"create","params":{"space":10,"product":[12,13],"name":"demo_repo"}}`。请求体直接使用 JSON 对象；MCP 不读取 CLI 管道或 `@-` 输入。

MCP 发送请求前按动作定义检查必填字段、JSON 类型、明确枚举和未知参数，以及已声明的整数、数值范围、字符串长度/格式、数组长度和元素类型。路径 ID 使用非负整数，`page` 从 1 开始，`recPerPage` 范围为 1–1000；业务字段仍按自身定义处理，例如预计工时允许小数、根模块允许 0。更新时可由详情自动补齐的请求体字段允许省略。权限和字段间业务规则由服务端校验。

所有工具都声明 `outputSchema`，成功时通过 `structuredContent.data` 返回数据；列表还包含 `pager` 和 `meta`。文本结果保留原有 JSON 形态（列表带 `data`，详情直接返回对象）。业务错误设置 `isError=true` 并返回 `structuredContent.error`，包含 `code`、`message` 及适用的 `module`、`action`；协议和顶层 schema 校验错误由 MCP SDK 返回。

`filter`、`search`、`sort` 仅处理当前页。列表的 `meta.processingScope="page"`、`meta.returnedCount` 表示实际返回条数；`pager.recTotal` 是远端总数，`meta.totalScope="serverBeforeLocalProcessing"` 表明总数未经过本地筛选。跨页筛选需使用操作支持的 `params.filters` 等服务端参数，并逐页请求。
