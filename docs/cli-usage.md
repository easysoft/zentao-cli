# CLI 核心功能详解

本文档详细介绍 zentao-cli 的所有核心功能，包括用户验证、数据访问与操作、数据处理、输出格式、配置管理等。

快速使用请参考 [README](../README.md)，在 AI Agents 中使用请参考 [在 Agents 中使用禅道](./use-zentao-in-agents.md)。

逐项查询所有命令、操作及参数，请参考 [命令、参数与用法参考](./command-reference.md)。

## 用户验证

### 登录验证

执行 `zentao login` 时，桌面环境会打开本机浏览器，在页面填写禅道地址、用户名和密码完成登录。登录成功后会记住用户信息（包括禅道 URL、账号和 Token，不包括密码），方便后续使用。业务命令缺少凭证时只提示登录，不会自行弹出页面。

可以显式选择浏览器或终端交互登录：

```bash
# 浏览器登录（适合由 Agent 发起，再由用户填写）
zentao login --web

# 终端交互登录
zentao login --no-browser
```

浏览器页面仅由本机临时服务提供，登录完成、取消或超时后关闭服务。浏览器未自动打开时，手动访问命令输出的链接，并保持 CLI 进程运行。通过 `--server` 和 `--user` 可预填地址和账号；密码和 Token 不会预填。远程服务器或容器中的本机链接指 CLI 执行端，可在同一执行环境使用终端交互登录。

登录页支持简体中文、繁体中文和英文，首次按浏览器语言选择，也可在页面中手动切换。主题可选择“跟随系统 / 浅色 / 深色”，默认跟随操作系统，切换立即生效。语言和主题偏好仅保存在当前临时登录地址下，下次登录的地址可能变化，不保证沿用。

简体中文界面的登录页副标题默认为“完成登录后，回到 ZenTao CLI 即可继续使用禅道。”，可通过 `--message <text>` 设置纯文本提示；自定义内容在切换语言时保持原文。例如指引用户回到当前 Agent：

```bash
zentao login --web --message "完成登录后，回到 Codex 即可继续使用禅道。"
```

默认 `zentao login` 若打开浏览器失败且当前有交互终端，会关闭临时服务并改用终端登录；显式 `--web` 始终保留链接供手动打开。登录页面最多等待 5 分钟。

完整参数 `--server <url> --user <account> --password <password>`（或 `--token <token>`）仍可直接登录，同时提供密码和 Token 时优先使用 Token。`--web` 不能与 `--no-browser`、`--useEnv`、`--password` 或 `--token` 混用。非交互环境未选择浏览器且没有完整凭证时，会报错而不等待终端输入。

### 环境变量

`zentao-cli` 支持从环境变量中读取禅道服务地址、用户账号和密码或 Token。业务命令优先使用完整环境凭证，再回退到当前本地登录记录；`zentao login` 则通过 `--useEnv` 显式选择环境变量登录。

使用完整环境凭证执行业务命令时，不读取或写入本地 Profile，也不改变本地默认账号。即使配置文件缺失、损坏或不可访问，也可以运行。此时使用 CLI 默认配置，可通过 `--timeout`、`--insecure`、`--format` 等命令行选项覆盖，不继承本地 Profile 的配置。

需要使用环境变量重新验证并保存登录记录时，执行 `zentao login --useEnv`。

支持如下环境变量：

* `ZENTAO_URL`：禅道服务地址
* `ZENTAO_ACCOUNT`：用户账号
* `ZENTAO_PASSWORD`：密码
* `ZENTAO_TOKEN`：Token，同时提供密码时优先使用 Token

### 账户切换

`zentao-cli` 支持登录多个禅道服务，或在同一服务下登录多个账号。登录成功后，默认将最后一次登录的服务账号设为当前账户。可以通过 `zentao profile` 查看当前用户信息并切换当前用户。

```bash
# 查看当前用户信息
$ zentao profile

* admin@https://zentao.example.com (当前)
* dev1@https://zentao.example.com

# 切换当前用户
$ zentao profile dev1@https://zentao.example.com

* admin@https://zentao.example.com
* dev1@https://zentao.example.com (当前)
```

执行 `zentao profile --effective --format=json` 可只读查看业务命令实际使用的认证来源。输出包含 `source`（`environment` 或 `profile`）、`server`、`account`、`credentialType`（`token` 或 `password`）和 `configFile`。环境凭证完整时优先使用环境变量，`configFile` 为 `null`，且不会读取本地配置；环境凭证不完整时回退到当前保存的 Profile。

此命令不显示 Token 或密码，不发起网络请求或登录，`verified` 固定为 `false`；如需验证连接，应执行目标范围内的只读业务查询。`--effective` 不能与切换账号的参数同时使用；不加该选项时，`profile` 仍只查看或切换本地账号。

### 退出登录

使用 `zentao logout` 可退出当前用户，同时移除 `~/.config/zentao/zentao.json` 文件中的对应用户信息。

```bash
# 退出当前用户
$ zentao logout

# 退出指定用户
$ zentao logout dev1@https://zentao.example.com
```

### 自定义配置文件

默认情况下，zentao-cli 会将用户配置保存在 `~/.config/zentao/zentao.json`。也可以通过全局选项 `--config <config_file>` 或环境变量 `ZENTAO_CONFIG_FILE` 指定自定义配置文件路径；此时所有读写均作用于该文件，不再使用默认路径。

使用已保存的 Profile 执行业务命令时，不会更新最近使用时间、重写配置文件或修改文件权限，因此配置文件及其所在目录可以只读。登录、退出、切换账号和修改配置仍需写入权限；在支持 POSIX 权限的平台上，写入后的配置文件权限为 `0600`（仅当前用户可读写），新建配置目录权限为 `0700`。

保存或删除 Profile 时，账号列表与当前账号会在一次原子写入中更新，避免出现只更新其中一项的中间状态。

配置读取失败返回 `E1005`；使用 `--format=json` 时，`error.details.reason` 区分 `invalid_json`（JSON 格式错误）、`invalid_structure`（配置结构错误）和 `unreadable`（文件无法读取）。配置写入失败返回 `E1011`，原系统错误码（如 `EACCES`）放在 `error.details.systemCode`，错误信息不包含凭据内容。缺失的配置文件仍视为尚未配置；损坏的文件不会自动清空或覆盖。

```bash
# 通过 --config 选项使用自定义配置文件
$ zentao --config /path/to/zt.json profile

# 通过环境变量指定（便于在 shell 中持久设置）
$ ZENTAO_CONFIG_FILE=~/work/zt.json zentao product
```

路径支持 `~` 展开与相对路径（相对当前工作目录）。当 `--config` 与 `ZENTAO_CONFIG_FILE` 同时存在时，`--config` 优先。

## MCP 服务

`zentao mcp` 提供 stdio 和 HTTP 两种传输方式，共用业务工具、参数校验和返回格式。

### 本地 stdio 模式

```bash
zentao mcp
zentao mcp --transport stdio
zentao --config ./zentao.json mcp --read-only --modules product,story,task,bug
```

stdio 是默认模式，由 MCP 客户端启动并管理进程。通过 `zentao login` 保存本地账号，或在客户端启动配置中提供 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 与 `ZENTAO_TOKEN`/`ZENTAO_PASSWORD`。`zentao add-mcp` 只生成这种本地配置；HTTP 客户端需要手动配置。

stdio 在首次业务调用时绑定账号和站点，环境凭证不会写入本地 Profile。`zentao_switch_profile` 只切换当前 stdio MCP 实例，不改变 CLI 或其他实例的当前账号；在 CLI 中切换账号也不会改变已运行的实例。显式选择的本地 Profile 会读取同一账号的 Token 和配置更新，删除该 Profile 后后续调用会报错。

stdio 的 `zentao_profile` 返回绑定的 `account`、`server`、远端详情 `user` 和 `userFound`。详情按账号过滤并按需翻页，仅返回 ID、账号、姓名、部门、角色；未找到时 `user=null`、`userFound=false`。远端权限、Token 或业务错误会明确报错。

### 远程 HTTP 模式

```bash
# 固定一个禅道站点，默认监听 127.0.0.1:9090
zentao mcp --transport http --url https://zentao.example.com

# 也可由 ZENTAO_URL 提供站点，显式 --url 优先
ZENTAO_URL=https://zentao.example.com zentao mcp --transport http

# 调整监听地址、端口和上游请求超时，并限定工具范围
zentao --timeout 15000 mcp --transport http --host 127.0.0.1 --port 9090 \
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
zentao mcp --transport http --port 9090 --url https://zentao-a.example.com
zentao mcp --transport http --port 9091 --url https://zentao-b.example.com
```

### 共用工具与返回格式

`zentao_action_help` 接受 `module` 和 `action`，查询路径、必填参数、参数类型、`minVersion` 和调用示例，例如 `{"module":"doc","action":"createMyDoc"}`。查询帮助不调用禅道，也不需要本地登录；HTTP 请求仍须携带 Token 头。示例中的占位 ID 和文本需替换为实际值；`available` 表示当前启动选项是否开放该操作。

`--read-only` 只开放查询工具，并在执行入口校验允许的动作；stdio 账号切换工具也不注册。`--modules product,story,task` 只注册指定业务模块，未知或空模块名会报错。`--split-tools` 按模块拆为 `_read` / `_write`，例如 `zentao_task_read` 和 `zentao_task_write`，不存在对应动作的分组不注册；默认使用 `zentao_task` 等工具名。三个选项可以组合使用，开放范围在进程启动时固定；禅道仍按账号权限授权。

业务参数使用 `params` 中的正式名称，例如任务列表 `{"action":"list","params":{"executionID":3}}`。`id`、`product`、`project`、`execution` 是按动作定义映射的兼容简写，与正式参数冲突时会报错。请求体直接使用 JSON 对象；MCP 不读取 CLI 管道或 `@-` 输入。

MCP 发送请求前按动作定义检查必填字段、JSON 类型、明确枚举和未知参数。路径 ID 使用非负整数，`page` 从 1 开始，`recPerPage` 范围为 1–1000；业务字段仍按自身定义处理，例如预计工时允许小数、根模块允许 0。更新时可由详情自动补齐的请求体字段允许省略。

所有工具都声明 `outputSchema`，成功时通过 `structuredContent.data` 返回数据；列表还包含 `pager` 和 `meta`。文本结果保留原有 JSON 形态（列表带 `data`，详情直接返回对象）。业务错误设置 `isError=true` 并返回 `structuredContent.error`，包含 `code`、`message` 及适用的 `module`、`action`；协议和顶层 schema 校验错误由 MCP SDK 返回。

`filter`、`search`、`sort` 仅处理当前页。列表的 `meta.processingScope="page"`、`meta.returnedCount` 表示实际返回条数；`pager.recTotal` 是远端总数，`meta.totalScope="serverBeforeLocalProcessing"` 表明总数未经过本地筛选。跨页筛选需使用操作支持的 `params.filters` 等服务端参数，并逐页请求。

## 禅道数据访问和操作

### API 覆盖与版本兼容

CLI 使用 `zentao-api 0.7.0` 的注册表，提供 26 个模块、229 个操作。除原有模块外，新增问题（`issue`）、风险（`risk`）、会议（`meeting`）、工作流（`workflow`）、文档（`doc`）、待办（`todo`）和地盘（`my`），并支持项目集/项目/执行下的关联列表、需求层级、附件上传和 Markdown 文档正文。

每个操作都带有最低禅道版本要求。SDK 0.5.5 及之前已有的操作与之后新增的操作分别使用以下基线，具体以操作帮助为准：

| 操作 | 开源版 | 企业版 | 旗舰版 | IPD 版 |
| --- | --- | --- | --- | --- |
| 原有操作 | 22.0 | biz13.0 | max8.0 | ipd5.0 |
| 新增操作 | 22.5 | biz13.5 | max8.5 | ipd5.5 |

版本只在同一系列内比较，未列出的系列不受支持。目前支持点分数字正式版本，不接受 alpha、beta、rc 等后缀。

登录和业务请求通过 SDK 获取站点根地址的 `?mode=getconfig`，配置请求不携带 Token。SDK 在同一客户端内缓存配置最多 24 小时；普通 CLI 命令各自启动进程，stdio MCP 和批量操作会复用客户端缓存，切换账户后使用目标服务器的配置。HTTP MCP 为每个请求创建独立客户端。CLI 的登录记录不用于跳过版本检查。

配置获取失败默认中止调用；版本不足时返回 `E2010`，提示操作、当前版本和最低版本，更新操作的自动补全预读也不会执行。版本格式错误返回 `E2011`，配置缺少有效版本字段返回 `E2012`。`raw` 输出同样执行版本检查。

帮助和自动补全在未登录时仍可使用，并列出完整注册表；CLI 帮助和 MCP 的 `zentao_action_help` 展示最低版本要求，执行时以实际服务器版本为准。

```bash
# 不需要对象 ID 的命名列表
zentao story getGrades
zentao my tasks --pick=id,name,status

# 直接查询项目下的执行
zentao execution projectExecutions --projectID=5 --browseType=all

# 创建 Markdown 文档：多个路径 ID 必须分别传入
zentao doc createMyDoc --spaceID=1 --libID=2 --data '{"title":"开发说明","content":"# 开发说明","contentType":"doc"}'

# 修改文档库，自动从同一路径的详情接口补全已有字段
zentao doc updateLib --libID=2 --name=开发文档

# SDK 自动按 multipart/form-data 上传本地文件（默认上限 50 MiB）
zentao file create --file=/path/to/screenshot.png --objectType=bug --objectID=1

# 查看路径、查询、请求体参数和最低版本
zentao doc createMyDoc --help
```

`id` 或首个位置参数只是首个路径 ID 的简写，其他路径参数需使用各自的名称。`doc`、`my` 等没有默认 `list` 的模块，在省略操作时会显示帮助。命名的列表、详情、创建、更新和删除操作遵循各自的类型，删除操作仍需确认或显式 `--yes`。

### 命令调用方式

禅道数据访问和操作支持两种调用方式：

第一种：**原始方式**，通过如下 `ls`、`get` 等命令访问和操作禅道数据，具体包括：

* `zentao ls`：获取对象列表
* `zentao get <moduleName> <objectID>`：获取单个对象
* `zentao delete <moduleName> <objectID>`：删除对象
* `zentao create <moduleName> [params]`：创建对象
* `zentao update <moduleName> <objectID> [params]`：更新对象
* `zentao do <moduleName> <action> <objectID> [params]`：执行对象操作
* `zentao help <moduleName>`：获取模块帮助信息

第二种：**简写方式**，通过如下 `zentao <moduleName>` 命令访问和操作禅道数据，具体包括：

* `zentao <moduleName>`：获取对象列表
* `zentao <moduleName> <objectID>`：获取单个对象
* `zentao <moduleName> props`：获取对象属性定义
* `zentao <moduleName> delete <objectID>`：删除对象
* `zentao <moduleName> create [params]`：创建对象
* `zentao <moduleName> update <objectID> [params]`：更新对象
* `zentao <moduleName> <action> <objectID> [params]`：执行对象操作
* `zentao <moduleName> help`：获取模块帮助信息

> [!TIP]
> 推荐优先使用简写方式。当简写方式中的模块名与命令行一级命令冲突时，必须改用原始方式调用。

### 获取禅道对象列表

支持通过 `zentao <moduleName>` 的方式获取指定模块的对象列表。

```bash
# 获取禅道产品列表
$ zentao product

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品列表，并输出 JSON 格式
$ zentao product --format=json

{
    "status": "success",
    "data": [
        {"id": 1, "name": "产品1", ...},
        {"id": 2, "name": "产品2", ...}
    ],
    "pager": {
        "total": 2,
        "page": 1,
        "recPerPage": 100,
        "totalPage": 1
    }
}

# 查询项目下的执行（要求 22.5 / biz13.5 / max8.5 / ipd5.5）
$ zentao execution projectExecutions --projectID=5 --browseType=all

# 旧版服务器：以全局列表当前页返回值做客户端项目过滤，汇总时需逐页读取
$ zentao execution --browseType=all --filter='project=5'

# 输出略
```

<details>
<summary>原始方式</summary>

通过 `zentao ls <moduleName>` 获取指定模块的对象列表。

```bash
# 获取禅道产品列表
$ zentao ls product

# 输出略

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品列表，并输出 JSON 格式
$ zentao ls product --format=json

# 输出略
```

</details>

### 获取禅道对象属性定义

使用 `zentao <moduleName> props` 获取模块对应对象的属性名及中文说明。属性定义来自本地 `zentao-api` 注册表，不会连接禅道服务，也不要求登录。

```bash
$ zentao product props

* id: 编号
* program: 所属项目集
* name: 产品名称
* code: 产品代号
* ...

$ zentao product props --format=json

{
    "id": "编号",
    "program": "所属项目集",
    "name": "产品名称",
    "code": "产品代号"
}
```

### 获取禅道单个对象

支持通过 `zentao <moduleName> <objectID>` 获取指定模块、指定 ID 的对象信息。

```bash
# 获取禅道产品 #1 信息
$ zentao product 1

* id: 1
* name: 产品1
* ...
```

<details>
<summary>原始方式</summary>

通过 `zentao get <moduleName> <objectID>` 获取指定模块、指定 ID 的对象信息。

```bash
# 获取禅道产品 #1 信息
$ zentao get product 1

# 输出略
```

</details>

### 删除禅道对象

支持通过 `zentao <moduleName> delete <objectIDs>` 删除指定模块中的指定 ID 对象。删除多个对象时，可使用逗号分隔多个 ID。默认删除前会输出待删除对象的详细信息供用户确认；如果无需确认，可通过 `--yes` 参数强制删除。

```bash
# 删除禅道产品 #1
$ zentao product delete 1

要删除的产品 #1：

* id: 1
* name: 产品1
* ...

是否继续？（y/n）: y
已删除 产品 #1

# 删除禅道产品 #1 和 #2
$ zentao product delete 1,2

要删除的产品（共 2 个）：

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

是否继续？（y/n）: y
已删除 2 个产品

# 强制删除禅道产品 #1 和 #2
$ zentao product delete 1,2 --yes

操作成功：1, 2
操作失败：无

# 使用 JSON 输出
$ zentao product delete 1,2 --yes --format=json

{
    "status": "success",
    "result": {
        "success": [1, 2],
        "failed": [],
        "skipped": [],
        "errors": []
    }
}
```

<details>
<summary>原始方式</summary>

通过 `zentao delete <moduleName> <objectIDs>` 删除指定模块中的指定 ID 对象。删除多个对象时，可通过逗号分隔多个 ID。

```bash
# 删除禅道产品 #1
$ zentao delete product 1

# 输出略

# 删除禅道产品 #1 和 #2
$ zentao delete product 1,2

# 输出略
```

</details>

### 创建禅道对象

支持通过 `zentao <moduleName> create [params]` 创建指定模块中的对象。

```bash
# 创建禅道产品
$ zentao product create --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定创建对象所需的 JSON 数据。

```bash
# 创建禅道产品，并指定 JSON 数据
$ zentao product create --data='{"name": "产品1"}'
```

<details>
<summary>原始方式</summary>

通过 `zentao create <moduleName> [params]` 创建指定模块中的对象。

```bash
# 创建禅道产品
$ zentao create product --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定创建对象所需的 JSON 数据。

```bash
# 创建禅道产品，并指定 JSON 数据
$ zentao create product --data='{"name": "产品1"}'
```

</details>

### 更新禅道对象

支持通过 `zentao <moduleName> update [objectID] [params]` 更新指定模块中指定 ID 的对象。

```bash
# 更新禅道产品 #1
$ zentao product update 1 --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定更新对象所需的 JSON 数据。

```bash
# 更新禅道产品 #1，并指定 JSON 数据
$ zentao product update 1 --data='{"name": "产品1"}'
```

<details>
<summary>原始方式</summary>

通过 `zentao update <moduleName> [objectID] [params]` 更新指定模块中指定 ID 的对象。

```bash
# 更新禅道产品 #1
$ zentao update product 1 --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定更新对象所需的 JSON 数据。

```bash
# 更新禅道产品 #1，并指定 JSON 数据
$ zentao update product 1 --data='{"name": "产品1"}'
```

</details>

### 其他操作

支持通过 `zentao <moduleName> <action> <objectID> [params]` 对指定模块、指定 ID 的对象执行特定操作。

```bash
# 解决禅道 BUG #1
$ zentao bug resolve 1 --resolution=fixed --comment "已解决"
```

不同对象支持的操作不同，具体可通过 `zentao <moduleName> <action> --help` 查看对应模块支持的操作。

<details>
<summary>原始方式</summary>

通过 `zentao do <moduleName> <action> <objectID> [params]` 对指定模块、指定 ID 的对象执行特定操作。

```bash
# 解决禅道 BUG #1
$ zentao do bug resolve 1 --resolution=fixed --comment "已解决"
```

不同对象支持的操作不同，具体可通过 `zentao do <moduleName> help` 查看对应模块支持的操作。

</details>

## 命令行管道与标准输入 (Stdin) 支持

支持通过命令行管道与标准输入（Stdin）传递 `--data` 参数。例如，创建产品时可以通过管道传入 JSON 数据：

```bash
# 创建禅道产品，通过管道传递 JSON 数据
$ cat products.json | zentao product create --data @-

# 或者直接通过管道传递
echo '{"name": "新产品"}' | zentao product create
```

## 批量操作错误处理

进行批量操作时，默认会在某个对象出错后自动跳过该对象，并继续执行后续操作。如果希望在出错后立即停止，可使用 `--batch-fail-fast` 参数。

也可以通过 `batchFailFast` 配置项在全局范围内开启此行为。下面是批量删除产品出错时的输出示例：

```bash
# 批量删除 5 个产品，但在第三个产品时出错
$ zentao product delete 1,2,3,4,5 --yes

操作成功：1, 2, 4, 5
操作失败：3
3: E2006: 当前用户没有权限执行此操作

# 批量删除 5 个产品，但在第三个产品时出错，使用 batchFailFast 选项
$ zentao product delete 1,2,3,4,5 --yes --batch-fail-fast

操作成功：1, 2
操作失败：3
已跳过：4, 5
3: E2006: 当前用户没有权限执行此操作

# 使用 JSON 输出
$ zentao product delete 1,2,3,4,5 --yes --batch-fail-fast --format=json

{
    "status": "failed",
    "result": {
        "success": [1, 2],
        "failed": [3],
        "skipped": [4, 5],
        "errors": [
            {
                "objectID": 3,
                "error": {
                    "code": "2006",
                    "message": "当前用户没有权限执行此操作"
                }
            }
        ]
    }
}
```

## 静默模式

支持通过 `--silent` 参数在执行命令时启用静默模式。启用后，不再输出普通信息，仅在出错时输出错误信息。

```bash
# 启用静默模式，仅在出错时输出错误信息
$ zentao product create --silent
```

也可以通过 `silent` 配置项在全局范围内开启该功能。

```bash
# 设置全局静默模式
$ zentao config set silent true
```

## 获取帮助

支持通过 `zentao help` 获取所有一级命令的帮助信息，也支持通过 `zentao <command> help` 获取指定命令的帮助信息。

```bash
# 获取所有一级命令帮助信息
$ zentao help

# 获取指定命令的帮助信息
$ zentao <command> help
```

## 输出格式

支持通过 `--format=json|markdown|raw` 参数指定输出格式。默认输出 Markdown 格式，其中 `raw` 表示输出原始 JSON 数据。

```bash
# 获取禅道产品信息，并输出 Markdown 格式
$ zentao product

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 如果获取的是单个对象，则以列表形式输出
$ zentao product 1

* id: 1
* name: 产品1
* ...

# 获取禅道产品信息，并输出 JSON 格式
$ zentao product --format=json

{
    status: "success",
    data: [
        {"id": 1, "name": "产品1", ...},
        {"id": 2, "name": "产品2", ...}
    ],
    pager: {
        total: 2,
        page: 1,
        recPerPage: 100,
        totalPage: 1,
    }
}

# 获取禅道产品信息，并输出原始 JSON 格式
$ zentao product --format=raw

{
    "status": "success",
    "products": [
        {"id": 1, "name": "产品1", ...},
        {"id": 2, "name": "产品2", ...}
    ],
    "pager": {
        "recTotal": 5,
        "recPerPage": 20,
        "pageTotal": 1,
        "pageID": 1
    }
}
```

## 数据处理

`zentao-cli` 支持对数据进行摘取、过滤、排序等处理，方便用户快速获取所需信息。

### 摘取给定属性

支持通过 `--pick=<field1>,<field2>,...` 参数指定需要输出的字段。多个字段用逗号分隔，支持通过 `.` 访问子字段；JSON 输出会保留嵌套对象结构，不存在的字段路径会被忽略。

```bash
# 获取禅道产品信息，并摘取产品名称和 ID
$ zentao product --pick=id,name

| id | name |
| --- | --- |
| 1 | 产品1 |
| 2 | 产品2 |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

### 过滤数据

支持通过 `--filter=<field1><operator><value>,<field2><operator><value>,...` 参数指定过滤条件。多个条件用逗号分隔，字段名支持通过 `.` 访问子字段。当参数值中包含逗号时，需要使用引号包裹；`[a,b]` 数组值中的逗号不会被拆分。

在同一个 `--filter` 参数内使用逗号分隔多个条件时，会按 AND 逻辑进行过滤。如果需要 OR 逻辑，则可使用多个 `--filter` 参数。

支持的运算符：

* `=` 等于（推荐）
* `:` 等于（兼容旧写法）
* `!=` 不等于
* `>` 大于
* `<` 小于
* `>=` 大于等于
* `<=` 小于等于
* `~` 包含
* `!~` 不包含

下面是一些使用示例：

```bash
# 获取禅道产品信息，并过滤名称包含 "产品" 的产品
$ zentao product --filter 'name~产品'

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品信息，并过滤名称包含 "产品" 或名称为 "项目1" 的产品
$ zentao product --filter 'name~产品' --filter 'name=项目1'

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |
| 3 | 项目1 | ... |
| 4 | 项目2 | ... |

已显示 4 项，共 4 项，当前第 1 页，每页 100 条

# 当参数值中包含逗号时，需要使用引号包裹，例如：
$ zentao product --filter 'name="产品1,产品2"'

# 输出略
```

### 模糊搜索

当输出结果为列表时，支持通过 `--search=<keyword>,<keyword>,...` 参数进行大小写不敏感的模糊搜索。同一参数内多个关键词使用逗号分隔并按 AND 匹配；多个 `--search` 参数之间按 OR 匹配。通过 `--search-fields=<field1>,<field2>,...` 指定搜索字段，多个字段用逗号分隔并支持通过 `.` 访问子字段；未指定字段时会递归搜索嵌套对象和数组中的值。

```bash
# 获取禅道产品信息，并搜索名称或描述中包含 "产品" 的产品
$ zentao product --search=产品 --search-fields=name,desc

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品信息，并搜索名称中包含 "产品1" 或 "产品2" 的产品
$ zentao product --search=产品1 --search=产品2

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

### 排序数据

支持通过 `--sort=<field1>:asc,<field2>:desc,...` 参数指定排序条件。多个排序条件用逗号分隔，字段名支持通过 `.` 访问子字段；同时兼容原有的 `<field>_asc`、`<field>_desc` 写法。

```bash
# 获取禅道产品信息，并按产品名称排序
$ zentao ls product --sort=name:asc

| id | name |
| --- | --- |
| 1 | 产品1 |
| 2 | 产品2 |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

### 分页数据

当输出结果为列表时，可以通过如下选项控制分页：

* `--page=<pageNumber>`：指定页码，默认值为 1
* `--recPerPage=<recPerPage>`：指定分页大小，默认值为 20
* `--limit=<number>`：截取当前返回页的数据；仅非负有限数值生效，小数向下取整

CLI 当前不会自动翻页。仅当该列表操作的 `--help` 显示 `--page` / `--recPerPage` 时才可使用这两个参数；需要全量数据且返回了 pager 时，重复调整 `--page`，直到已读取条数覆盖总数。

```bash
# 获取禅道产品信息，并分页获取
$ zentao product --page=1 --recPerPage=100

| id | name |
| --- | --- |
| 1 | 产品1 |
| 2 | 产品2 |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

## 设置默认配置

支持通过 `zentao config set <key> <value>` 设置默认配置，支持的配置项包括：

* `defaultOutputFormat`：默认输出格式，支持 `markdown`、`json`、`raw`
* `defaultRecPerPage`：默认分页大小
* `insecure`：是否忽略 SSL/TLS 证书验证
* `timeout`：请求超时时间
* `htmlToMarkdown`：是否将对象属性中的 HTML 转换为 Markdown
* `batchFailFast`：是否在批量操作出错时停止执行后续操作
* `pagers`：分页配置，支持 `product`、`project`、`execution` 等模块
* `silent`：是否启用静默模式，默认值为 `false`
* `jsonPretty`：是否在 JSON 格式化时添加空格，默认值为 `false`

```bash
# 设置默认输出格式为 JSON
$ zentao config set defaultOutputFormat json

```

通过 `zentao config get [key]` 查看默认配置；如果不指定 `key`，则返回全部默认配置。

```bash
# 查看默认输出格式
$ zentao config get defaultOutputFormat

json

# 查看所有默认配置
$ zentao config get

defaultOutputFormat: "json"
defaultRecPerPage: 20
insecure: false
timeout: 10000
htmlToMarkdown: true
batchFailFast: false
```

## 获取版本信息

通过 `zentao version` 获取 `zentao-cli` 版本信息；如果已经登录禅道，还会同时输出当前登录的禅道版本信息。

```bash
# 获取 zentao-cli 版本信息
$ zentao version

Zentao CLI: 0.1.0
Zentao Server: 22.1 (https://zentao.example.com)
```

## 自动补全

支持通过 `zentao autocomplete` 命令生成自动补全脚本，支持 `zsh`、`bash` 和 `fish` 三种 shell。

```bash
# 生成 zsh 自动补全脚本
$ zentao autocomplete zsh

# 生成 bash 自动补全脚本
$ zentao autocomplete bash

# 生成 fish 自动补全脚本
$ zentao autocomplete fish
```
