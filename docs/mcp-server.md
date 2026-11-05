# 禅道 MCP 服务部署与 Agent 接入指南

`zentao mcp-server` 将禅道 API v2 以 MCP（Model Context Protocol）服务的形式提供给 Agent。公司管理员统一部署一次，禅道用户在自己的 Agent 中填写服务地址和个人 Token 即可使用，无需安装 zentao-cli。服务不保存账号、密码或 Token，每个请求都按用户本人在禅道中的权限执行。

| 读者 | 阅读内容 |
| --- | --- |
| 公司管理员 | [服务概览](#服务概览)，然后按[管理员部署](#管理员部署)完成部署、验证、发布和维护 |
| 禅道用户 | [用户接入](#用户接入)，优先使用管理员提供的接入页面 |
| 排查问题 | [常见问题](#常见问题)和[接口与请求边界](#接口与请求边界) |

本文只介绍公司统一部署的远程 HTTP 服务。如果希望在个人电脑上安装 CLI 技能，或由 Agent 在本机启动 stdio MCP，请参考[在 Agents 中使用禅道](use-zentao-in-agents.md)和[本地 stdio 模式](cli-usage.md#本地-stdio-模式)。`zentao add-mcp` 生成的是本地 stdio 配置，不用于接入统一部署的服务。

## 服务概览

```text
Agent ──HTTPS──▶ 反向代理（Nginx 等）──HTTP──▶ zentao mcp-server（127.0.0.1:9090）──▶ 禅道 API v2
      每个请求携带用户自己的禅道 Token
```

本文使用以下示例地址，部署和配置时请替换为实际值：

| 地址 | 用途 | 由谁使用 |
| --- | --- | --- |
| `https://zentao.example.com` | 禅道站点地址；部署在子目录时保留子目录，例如 `https://zentao.example.com/zentao` | MCP 服务连接禅道；用户获取 Token |
| `https://mcp.example.com/mcp` | MCP 服务地址，必须包含 `/mcp` 路径 | 用户在 Agent 中配置 |
| `https://mcp.example.com/start` | 用户接入页面 | 用户获取 Token、复制接入说明和手动配置 |

禅道地址和 MCP 地址不能互换。服务的工作方式如下：

- **站点**：每个服务进程固定连接启动时指定的一个禅道站点。连接多个站点时，需要分别启动实例。
- **认证**：每个请求通过 `token: <Token>` 或 `Authorization: Bearer <Token>` 请求头携带用户本人的 Token，两者只能选一个。服务不读取服务器上的登录记录，不保存 Token，也不自动刷新。
- **权限**：管理员通过启动参数决定开放哪些模块、是否只读。在开放范围内，每个操作是否允许由禅道按用户权限判断。
- **传输**：使用无状态的 Streamable HTTP，只接受 `POST /mcp`。不提供旧版 `/sse` 端点，也不支持浏览器跨域调用。

## 管理员部署

### 1. 准备环境

- **运行环境**：一台能访问禅道站点的服务器，安装 Node.js 18.14.1 或更新版本，也可以使用 Bun。
- **用户网络**：用户的 Agent 必须能访问服务对外的 HTTPS 地址。内网部署时，应告知用户内网或 VPN 要求。运行在厂商云端的 Agent 无法访问公司内网地址。
- **对外 HTTPS**：MCP 进程本身只提供 HTTP，对外的 HTTPS 由反向代理提供，见[第 5 步](#5-配置-https-反向代理)。
- **禅道证书**：如果禅道站点使用自签名或公司内部 CA 签发的证书，服务连接禅道时会证书验证失败（`E5002`）。建议通过环境变量 `NODE_EXTRA_CA_CERTS` 指定内部 CA 证书文件。临时方案是启动时加全局选项 `--insecure`，跳过证书验证。

### 2. 安装并试运行

在服务器上执行：

```bash
npm install -g zentao-cli
zentao --version
zentao mcp-server --help

zentao mcp-server https://zentao.example.com
```

服务默认监听 `127.0.0.1:9090`，在前台运行。启动后，终端会输出 MCP 地址、用户接入页面地址和客户端配置示例。禅道地址也可以通过 `--url` 或环境变量 `ZENTAO_URL` 提供：

```bash
zentao mcp-server --url https://zentao.example.com
ZENTAO_URL=https://zentao.example.com zentao mcp-server
```

位置参数和 `--url` 只能用其中一个，同时提供会报 `E2009`；两者都省略时才读取 `ZENTAO_URL`。服务器上不需要执行 `zentao login`，也不需要配置管理员账号或共享 Token。

另开一个终端检查进程：

```bash
curl http://127.0.0.1:9090/healthz
```

返回 `{"status":"ok"}` 表示服务进程可用。这个检查不会连接禅道，也不验证 Token；完整验证见[第 6 步](#6-验证部署)。

### 3. 启动参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `[url]`、`--url <site>` | `ZENTAO_URL` | 固定连接的禅道站点地址，不能包含账号、查询参数或 `#` 片段 |
| `--host <host>` | `127.0.0.1` | 监听地址。同机反向代理保持默认；容器内运行时按需使用 `0.0.0.0` |
| `--port <port>` | `9090` | 监听端口，范围为 1–65535 |
| `--read-only` | 关闭 | 只注册查询工具，执行时也会再次拒绝写入 |
| `--modules <names>` | 全部模块 | 只开放指定的业务模块，用逗号分隔，例如 `product,story,task,bug`；模块名可通过 `zentao help` 查看 |
| `--split-tools` | 关闭 | 将每个模块拆成 `_read` 和 `_write` 两个工具，便于在 Agent 中分别授权 |
| 全局 `--timeout <ms>` | `10000` | 访问禅道时单次请求的超时时间，单位毫秒 |
| 全局 `--insecure` | 关闭 | 跳过禅道站点的 TLS 证书验证 |

`--timeout` 和 `--insecure` 是全局选项，必须写在子命令 `mcp-server` 之前：

```bash
zentao --timeout 20000 mcp-server https://zentao.example.com \
  --read-only --modules product,story,task,bug
```

服务注册的工具如下：

- 每个开放的模块对应一个工具，例如 `zentao_task`；使用 `--split-tools` 时拆为 `zentao_task_read` 和 `zentao_task_write`。
- `zentao_action_help`：查询某个操作的参数、调用示例和最低禅道版本。
- `zentao_profile`：只返回固定的站点信息，不识别当前用户，也不验证 Token。

工具范围在启动时确定，修改参数后需要重启服务。模块名无效时，服务会在启动时报错，不会等到用户调用时才失败。

`zentao mcp --transport http` 与 `zentao mcp-server` 等价，参数相同；本文统一使用 `zentao mcp-server`。

### 4. 配置常驻运行

正式部署应使用进程管理工具保持服务运行。下面以 Linux systemd 为例，先结束上一步的前台进程，避免端口被占用。

创建专用服务账号，并确认可执行文件的位置：

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin zentao-mcp
command -v zentao
command -v node
```

将下面的内容保存为 `/etc/systemd/system/zentao-mcp.service`。

- 将 `ExecStart` 中的 `/usr/local/bin/zentao` 替换为上一步查到的实际路径，并确认服务账号可以执行它。
- `PATH` 中需要包含 Node.js 所在目录。通过 nvm 等方式装在个人目录的 Node.js，服务账号通常无法访问，应改为系统级安装。
- 需要只读、模块限制、`--timeout` 或 `--insecure` 时，按[启动参数](#3-启动参数)的格式写入 `ExecStart`。

```ini
[Unit]
Description=ZenTao MCP Server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=zentao-mcp
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/zentao mcp-server https://zentao.example.com --host 127.0.0.1 --port 9090
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zentao-mcp
sudo systemctl status zentao-mcp
sudo journalctl -u zentao-mcp -n 50 --no-pager
```

服务日志写入标准错误输出，由 systemd 收集。每个请求记录一行方法、路径、状态码和耗时，例如 `[mcp-http] POST /mcp 200 812ms`。日志不记录 Token、认证头、请求体或用户身份，因此不能用于按用户审计；需要审计时，请使用禅道自身的操作记录。

### 5. 配置 HTTPS 反向代理

MCP 进程继续监听回环地址，由反向代理对外提供 HTTPS。代理需要转发三个路径：

| 路径 | 用途 |
| --- | --- |
| `/mcp` | MCP 端点，供 Agent 调用 |
| `/start` | 用户接入页面 |
| `/start/token` | 接入页面用账号密码换取 Token 的接口 |

以下为同机 Nginx 示例，域名和证书路径按实际环境替换：

```nginx
# Place limit_req_zone in the http block.
limit_req_zone $binary_remote_addr zone=zentao_mcp_token:10m rate=10r/m;

server {
    listen 80;
    server_name mcp.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name mcp.example.com;
    ssl_certificate /etc/nginx/tls/mcp.example.com.crt;
    ssl_certificate_key /etc/nginx/tls/mcp.example.com.key;

    location = /mcp {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 65s;
        client_max_body_size 1m;
    }

    location = /start/token {
        limit_req zone=zentao_mcp_token burst=5 nodelay;
        limit_req_status 429;
        error_page 429 = @zentao_mcp_busy;
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_read_timeout 65s;
        client_max_body_size 16k;
    }

    # Lets the /start page show its "busy" message.
    location @zentao_mcp_busy {
        default_type application/json;
        return 429 '{"errorCode":"busy"}';
    }

    location ~ ^/start/?$ {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
    }
}
```

检查配置并重载 Nginx。配置代理时注意以下几点：

- **请求头**：保留客户端的 `token` 或 `Authorization` 头。接入页面还依赖 `Host`（含非默认端口）、`Origin`、`Content-Type` 和 `X-Zentao-Start`，代理不能改写这些头。Nginx 默认会转发它们，上面示例中的 `proxy_set_header Host $http_host` 用于保留原始 `Host`。
- **凭据安全**：代理层不要写死某个账号的 Token。不要把认证头、请求体或响应体写入日志，`/start/token` 的请求和响应中包含密码和 Token。
- **限流**：`/start/token` 会用用户提交的账号密码登录禅道。示例按客户端 IP 限流，防止被用来猜测密码；被限流时返回页面可识别的 JSON，页面会提示稍后重试。服务自身最多同时处理 8 个获取请求，超出时返回 429。
- **超时**：`/mcp` 的响应以 SSE 流返回，需要关闭缓冲。一次工具调用最长执行 60 秒与 `--timeout` 中的较大值，`proxy_read_timeout` 应大于这个值；调大 `--timeout` 时同步调整。
- **跨域**：不需要配置 CORS。`/mcp` 会拒绝带 `Origin` 头的请求，接入页面只访问同源接口。
- **HTTPS**：远程用户只能通过 HTTPS 在接入页面填写账号密码；只有通过 `localhost`、`127.0.0.1` 或 `[::1]` 访问时才允许使用 HTTP。

**使用路径前缀**：如果服务挂在已有域名的子路径下，例如 `https://tools.example.com/zentao-mcp/`，应转发整个前缀并去掉前缀。接入页面会根据浏览器中的地址推算出 `/zentao-mcp/mcp` 和 `/zentao-mcp/start/token`，不要只转发 `/mcp`：

```nginx
location /zentao-mcp/ {
    proxy_pass http://127.0.0.1:9090/;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 65s;
    client_max_body_size 1m;
}
```

此时 MCP 地址为 `https://tools.example.com/zentao-mcp/mcp`，接入页面为 `https://tools.example.com/zentao-mcp/start`。需要限流时，为 `/zentao-mcp/start/token` 单独添加 `location`。

**多个实例**：

- **多个禅道站点**：为每个站点运行一个独立实例，使用不同的端口和对外域名或路径，例如 `--port 9090` 连接站点 A，`--port 9091` 连接站点 B。
- **同一站点多实例负载均衡**：`/mcp` 是无状态的，可以分发到任意实例。`/start/token` 必须由生成该页面的同一个实例处理，否则会返回 403；请开启会话保持（例如 `ip_hash`），或将 `/start` 和 `/start/token` 固定转发到其中一个实例。

### 6. 验证部署

发布前，用一位普通用户的 Token 从外部网络依次检查以下几项。

**1. 通过 HTTPS 调用一次只读工具。** 这一步可以确认代理、Token 和禅道连通性。`read -rs` 用于避免 Token 留在 Shell 历史中：

```bash
read -rs ZENTAO_TOKEN
curl -sS https://mcp.example.com/mcp \
  -H "token: $ZENTAO_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"zentao_product","arguments":{"action":"list","pick":"id,name","recPerPage":5}}}'
```

使用 `--split-tools` 时，工具名改为 `zentao_product_read`。没有开放产品模块时，换成已开放模块的查询操作；将 `method` 改为 `tools/list` 可查看全部工具名，这个请求不访问禅道。

响应为 SSE 格式，正文在 `data:` 行中。结果中有 `structuredContent.data` 表示调用成功；有 `"isError":true` 表示业务失败，按 `structuredContent.error.code` 排查：

| 错误码 | 含义与处理 |
| --- | --- |
| `E1004` | Token 无效或已失效，重新获取 Token |
| `E2006` | 该用户没有对应权限 |
| `E5001` | 访问禅道超时，检查网络或调大 `--timeout` |
| `E5002` | 禅道证书验证失败，见[准备环境](#1-准备环境)中的证书说明 |
| `E2010` | 禅道版本不支持该操作 |

如果直接返回 HTTP 状态码而不是 SSE 内容，请参考[接口与请求边界](#接口与请求边界)。

**2. 检查接入页面。** 在浏览器打开 `https://mcp.example.com/start`，确认页面显示的禅道地址正确，并用账号密码成功获取一次 Token。

**3. 在 Agent 中端到端验证。** 按[用户接入](#用户接入)的步骤在一个 Agent 中完成配置，并成功完成一次只读查询。

### 7. 向用户发布

验证通过后，向用户发送以下连接信息。管理员只分发连接说明，用户各自获取和填写个人 Token：

```text
禅道 MCP 服务已开通：

用户接入页面：https://mcp.example.com/start（推荐，按页面提示完成配置）
MCP 地址：https://mcp.example.com/mcp
禅道地址：https://zentao.example.com
连接方式：Streamable HTTP
认证方式：请求头 token，值为你自己的禅道 Token
网络要求：请填写是否需要公司内网或 VPN
开放功能：请填写实际开放的模块，以及是否只读
接入指南：https://github.com/easysoft/zentao-cli/blob/main/docs/mcp-server.md#用户接入
```

- 接入页面和 Agent 接入说明默认用"查询产品列表"来验证连接。如果没有开放产品模块，请在通知中给出可用的验证问题。
- 用户无法访问 GitHub 时，可以将本文的[用户接入](#用户接入)部分发布到公司内部文档，并替换通知中的链接。

### 8. 升级与维护

- **升级**：建议安装指定版本，例如 `npm install -g zentao-cli@<版本号>`，升级后用 `zentao --version` 确认，再重启服务。
- **重启后检查**：升级或修改启动参数后，执行 `sudo systemctl restart zentao-mcp`，然后重新检查 `/healthz`，并重复[第 6 步](#6-验证部署)中的只读调用。
- **重启的影响**：服务退出时停止接收新请求，最多等待 5 秒后取消未完成的请求，被取消的写入可能已经生效。重启后，用户已打开的接入页面会失效，需要刷新后再获取 Token。
- **Token 失效**：服务不保存也不刷新 Token。用户的 Token 失效后，由用户重新获取并更新 Agent 配置，管理员无需操作。

## 用户接入

### 接入前准备

向管理员确认以下信息：

- 接入页面地址（例如 `https://mcp.example.com/start`）或 MCP 地址（例如 `https://mcp.example.com/mcp`）
- 是否需要连接公司内网或 VPN
- 开放了哪些模块，是否只读

你只需要准备自己的禅道账号，不需要安装 zentao-cli，也不需要在本机启动 MCP 服务。Token 代表你在禅道中的访问权限，请保存在个人配置或 Agent 支持的密钥位置，不要提交到项目仓库；也不要把禅道密码提供给 Agent。

### 使用接入页面

推荐使用这种方式。打开管理员提供的接入页面，例如 `https://mcp.example.com/start`：

1. 确认页面上的禅道地址与你的账号所属站点一致。选择「账号密码获取」并填写禅道用户名和密码，或选择「已有 Token」粘贴个人 Token。
2. 点击「复制接入说明」，发送给正在使用的 Agent，让它协助完成配置。复制内容默认使用 Token 占位符，之后在本机配置中填写；勾选「复制内容包含我的 Token」后，才会复制真实 Token。
3. 需要自己配置时，展开「手动配置」，选择所用的 Agent，按提示合并配置。页面支持 Claude Code、Cursor、Codex、VS Code Copilot、Cherry Studio、OpenCode、Gemini CLI 和 Cline。
4. 重载或重启 Agent，按[验证连接](#验证连接并开始使用)的步骤确认可用。

密码只用于本次换取 Token，服务不保存账号、密码或 Token。Token 只保留在当前页面内存中，刷新或离开页面后清除。页面上的「清除」按钮不会让 Token 失效，也不会删除已保存到 Agent 配置或剪贴板中的内容。

### 让 Agent 协助配置

无法打开接入页面时，可以先将下面的说明中的地址替换为管理员提供的实际地址，再发送给正在使用的 Agent。Token 获取方式见[下一节](#获取个人-token)，可以先保留占位符，等 Agent 准备好配置后再在本机填写。

```text
请帮我在当前使用的 Agent 中配置公司的禅道 MCP 服务。

服务名称：zentao-remote
禅道地址：https://zentao.example.com
MCP 服务地址：https://mcp.example.com/mcp
传输方式：Streamable HTTP
认证请求头：token: <我的禅道 Token>

请按当前 Agent 的官方文档合并到用户级 MCP 配置，保留已有服务。
本机无需安装 zentao-cli 或启动 MCP 进程。不要向我索要禅道密码。
Token 只用于请求头；如果还是占位符，请指导我在本机填写。不要在回复中显示真实 Token，也不要提交到项目仓库。
如果无法直接配置，请告诉我具体入口。完成后说明是否需要重载或重启 Agent。
最后验证连接：请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。
```

### 获取个人 Token

请使用自己的禅道账号，并确认获取 Token 的禅道站点与管理员提供的站点一致。除了接入页面，还可以用以下两种方式获取。

**方式一：调用禅道 API 获取。** 在自己的终端执行，将地址、用户名和密码替换为实际值。禅道部署在子目录时保留子目录，例如 `https://zentao.example.com/zentao/api.php/v2/users/login`：

```bash
curl -X POST "https://zentao.example.com/api.php/v2/users/login" \
  -H "Content-Type: application/json" \
  -d '{"account":"用户名","password":"密码"}'
```

成功后，复制响应中 `token` 字段的值，不要复制整段 JSON，也不要带上引号。命令中含有明文密码，不要在共享终端中执行，也不要把命令保存到共享记录中。

**方式二：使用 zentao-cli 读取。** 如果已经安装 CLI 并登录过，执行：

```bash
zentao token
```

默认输出当前账号已保存的 Token。需要读取另一个已登录账号时，指定账号和站点：

```bash
zentao token 'your-account@https://zentao.example.com'
```

`zentao token` 只读取本地保存的 Token，不联网验证或自动刷新。尚未登录或 Token 已失效时，先执行 `zentao login --web` 登录。其他用法见 [CLI 获取 Token](cli-usage.md#获取-token)。

### 手动配置 Agent

所有 Agent 都使用完整的 `/mcp` 地址和你自己的 Token。认证头只配置一种：`token: <Token>` 或 `Authorization: Bearer <Token>`，不能同时配置。服务不提供 OAuth 登录，客户端提示 OAuth 时选择不使用。

| Agent | 配置位置 | 格式要点 | 官方文档 |
| --- | --- | --- | --- |
| Claude Code | `claude mcp add` 命令，或 `~/.claude.json` | `mcpServers`，`type: "http"` | [连接 MCP 服务](https://code.claude.com/docs/en/mcp) |
| Cursor | `~/.cursor/mcp.json` | `mcpServers`，`type: "http"`；在 MCP 设置中启用 | [MCP 配置与使用](https://cursor.com/docs/mcp) |
| Codex | `~/.codex/config.toml` | `mcp_servers`，`http_headers` 或 `env_http_headers` | [MCP 配置说明](https://developers.openai.com/codex/mcp/) |
| VS Code Copilot | 命令面板 `MCP: Open User Configuration` | 顶层 `servers`，`type: "http"` | [添加 MCP 服务](https://code.visualstudio.com/docs/agent-customization/mcp-servers) · [配置格式](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Cherry Studio | 「设置 → MCP → MCP 服务器 → 添加」 | 类型选 Streamable HTTP；之后在「工作 → Agent 菜单 → 编辑 → MCP」绑定给所用 Agent | [MCP 与外部工具](https://docs.cherryai.com.cn/advanced-basic/extensions/mcp) |
| OpenCode | `~/.config/opencode/opencode.json` | 顶层 `mcp`，`type: "remote"`，`oauth: false` | [MCP servers](https://opencode.ai/docs/mcp-servers/) |
| Gemini CLI | `~/.gemini/settings.json` | `mcpServers`，使用 `httpUrl`；`url` 字段表示旧版 SSE，不能替代 | [MCP servers with Gemini CLI](https://geminicli.com/docs/tools/mcp-server/) |
| Cline | MCP Servers → Configure → Configure MCP Servers | `mcpServers`，`type: "streamableHttp"` | [MCP 配置与远程服务](https://docs.cline.bot/mcp/mcp-overview) |

以下示例中的 `<your-zentao-token>` 需替换为你的 Token，地址替换为管理员提供的地址。请合并到已有配置，不要覆盖其他服务。

**Claude Code**：`--scope user` 让配置对当前用户的所有项目生效。配置后在会话中输入 `/mcp` 查看状态：

```bash
claude mcp add --transport http --scope user \
  --header "token: <your-zentao-token>" \
  zentao-remote https://mcp.example.com/mcp
```

**Claude Code（`~/.claude.json`）、Cursor（`~/.cursor/mcp.json`）**：合并到顶层的 `mcpServers`。Cline 使用相同结构，只需将 `type` 改为 `"streamableHttp"`：

```json
{
  "mcpServers": {
    "zentao-remote": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": { "token": "<your-zentao-token>" }
    }
  }
}
```

Cursor 也支持项目内的 `.cursor/mcp.json`，但项目配置容易被提交到仓库，配置 Token 时请使用用户级文件。

**VS Code Copilot**：顶层字段是 `servers`，不是 `mcpServers`：

```json
{
  "servers": {
    "zentao-remote": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": { "token": "<your-zentao-token>" }
    }
  }
}
```

**Gemini CLI**：必须使用 `httpUrl`：

```json
{
  "mcpServers": {
    "zentao-remote": {
      "httpUrl": "https://mcp.example.com/mcp",
      "headers": { "token": "<your-zentao-token>" }
    }
  }
}
```

**OpenCode**：

```json
{
  "mcp": {
    "zentao-remote": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "headers": { "token": "<your-zentao-token>" },
      "oauth": false,
      "enabled": true
    }
  }
}
```

**Codex**：合并到 `~/.codex/config.toml`：

```toml
[mcp_servers.zentao-remote]
url = "https://mcp.example.com/mcp"
http_headers = { token = "<your-zentao-token>" }
```

如果希望从环境变量读取 Token，可将 `http_headers` 替换为 `env_http_headers = { token = "ZENTAO_TOKEN" }`。环境变量必须对启动 Codex 的进程可见；在另一个终端中设置的变量，不会传给已经打开的应用。

**Cherry Studio**：在添加 MCP 服务器的界面中填写：

```text
名称：zentao-remote
类型：Streamable HTTP
URL：https://mcp.example.com/mcp
请求头：token: <your-zentao-token>
认证：个人 Token（无需 OAuth）
```

改用 Bearer 认证时，将请求头 `token: <your-zentao-token>` 替换为 `Authorization: Bearer <your-zentao-token>`。例如 JSON 中写 `"headers": { "Authorization": "Bearer <your-zentao-token>" }`，Codex 中写 `http_headers = { Authorization = "Bearer <your-zentao-token>" }`。

### 验证连接并开始使用

保存配置后，按 Agent 的提示重载 MCP 服务或重新打开会话，确认服务已启用，并允许当前会话使用它的工具。然后发送一次只读请求：

```text
请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。
```

如果管理员没有开放产品模块，请改为查询已开放模块中的数据。确认 Agent 实际调用了禅道 MCP 工具，并返回了业务数据。以下几种情况都不能证明 Token 有效：Agent 显示「已连接」、工具列表能列出来、`zentao_profile` 调用成功。`zentao_profile` 在这个服务中只返回站点信息，不识别当前用户。

连接成功后，可以继续提问：

```text
产品 1 当前有哪些未解决的 Bug？请按优先级整理。

查看任务 123 的详情，帮我整理需要完成的工作。

查看执行 10 的进展，列出可能影响交付的风险。
```

使用时请注意：

- **写入操作**：创建、修改或删除数据前，先让 Agent 展示拟操作的对象和内容，确认后再执行。管理员开启只读时只能查询；即使没有只读限制，也受你在禅道中的权限约束。
- **超时与重试**：写入操作超时或中断后，可能已经生效。先查询结果，再决定是否重试。
- **附件**：不能通过本服务从本地路径上传附件，需要上传时请使用本地 CLI 或 stdio MCP。
- **Token 失效**：服务不会自动刷新 Token。失效后重新获取，并更新 Agent 配置。

## 常见问题

**接入和使用**

| 现象 | 原因与处理 |
| --- | --- |
| 无法连接，或返回 HTTP 502 | 确认使用了完整的 `/mcp` 地址。检查 Agent 实际运行环境的内网或 VPN、代理和证书；仍失败时联系管理员检查服务进程 |
| 返回 HTTP 401 | 认证头缺失、值带多余空白，或同时配置了 `token` 和 `Authorization`；MCP 地址带了 `?` 查询参数也会返回 401。如果客户端配置正确，请管理员检查代理是否转发了认证头 |
| 返回 HTTP 403，提示不支持 Origin 请求 | 请求带了 `Origin` 头。该服务只接受原生 MCP 客户端，不提供浏览器跨域接入 |
| 返回 HTTP 405，或访问 `/sse` 返回 404 | 在客户端中选择 Streamable HTTP，并配置 `/mcp` 地址。浏览器直接打开 `/mcp` 返回 405 属于正常现象，不表示服务不可用 |
| 返回 HTTP 413 | 单次请求超过 1 MiB，请减少一次提交的内容 |
| 返回 HTTP 504，或连接在执行中断开 | 工具调用超过执行时限。写入操作先查询是否已生效；经常出现时请管理员调整超时 |
| 工具已列出，但业务查询返回 `E1004` | Token 无效或已失效。从对应的禅道站点重新获取 Token，更新 Agent 配置后重新连接 |
| 业务查询返回 `E2006` | 账号在禅道中没有该数据的访问权限，请联系禅道管理员 |
| 业务查询返回 `E2010` | 当前禅道版本不支持该操作 |
| `zentao_profile` 返回 `account=null` | 正常现象。该服务不根据 Token 识别账号，这个工具也不验证 Token |
| 看不到工具，或不能执行某个操作 | 检查服务是否已绑定到当前 Agent、工具是否已启用，以及管理员设置的只读和模块限制 |
| 无法上传本地附件 | 该服务不支持从本地路径上传文件，请使用本地 CLI 或 stdio MCP |

**接入页面**

| 页面提示 | 原因与处理 |
| --- | --- |
| 请求来源不正确或服务已重启，请刷新页面后重试 | 服务已重启，或代理没有保留 `Host`、`Origin`、`X-Zentao-Start` 头。用户刷新页面即可；刷新后仍出现时，管理员检查代理配置和负载均衡的会话保持 |
| 请通过管理员提供的 HTTPS 地址获取 Token | 通过非本机的 HTTP 地址访问了页面，请改用 HTTPS 地址 |
| 获取 Token 的用户较多，请稍后重试 | 同时获取 Token 的请求超过 8 个，或触发了代理限流，请稍后重试 |
| 禅道的 HTTPS 证书验证失败 | 服务无法验证禅道站点的证书，管理员按[准备环境](#1-准备环境)中的证书说明处理 |
| 连接禅道超时 | 服务访问禅道超时，管理员检查服务器到禅道的网络，或调大 `--timeout` |
| 连接失败，请检查网络后重试 | 浏览器没有收到服务的正常响应，例如网络中断、代理返回 502，或代理返回了非 JSON 的错误页。管理员检查代理是否转发了 `/start/token` |

更多错误码说明见[错误排查手册](errors.md#http-mcp-排查)。

## 接口与请求边界

服务提供以下接口：

| 请求 | 认证 | 行为 |
| --- | --- | --- |
| `POST /mcp` | 需要 Token | 处理 MCP 请求；结果通过协议内的 SSE 流返回，客户端需声明接受 `application/json` 和 `text/event-stream` |
| `GET /mcp`、`DELETE /mcp` | — | 返回 HTTP 405；服务是无状态的，不维护会话 |
| `GET /healthz` | 无需认证 | 只检查服务进程，不检查禅道是否可用或 Token 是否有效 |
| `GET /start` | 无需认证 | 用户接入页面 |
| `POST /start/token` | 页面密钥 | 只接受接入页面发出的同源 JSON 请求，向固定的禅道站点换取 Token |

请求限制：

- **请求体**：`/mcp` 最大 1 MiB，`/start/token` 最大 16 KiB。请求体需要在 30 秒内接收完成。
- **执行时限**：一次工具调用的执行时限是 60 秒与 `--timeout` 中的较大值，每次访问禅道的请求仍受 `--timeout` 限制。
- **取消**：客户端断开连接会取消该请求中尚未完成的禅道调用；已经发出的写入可能已生效。
- **并发**：`/start/token` 最多同时处理 8 个请求，超出时返回 429。
- **日志与缓存**：服务日志不记录 Token、认证头和请求体。密码和 Token 不写入磁盘，接入页面和 `/start/token` 的响应禁止缓存。

与本地 CLI 和 stdio MCP 相比，HTTP 模式有以下区别：

- 凭据只从每个请求的请求头中读取。不读取服务器上的登录记录、配置文件中的分页等偏好，也不读取 `ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD`、`ZENTAO_TOKEN` 环境变量。
- 不注册切换账号的 `zentao_switch_profile` 工具。`zentao_profile` 只返回站点信息，`account`、`user` 均为 `null`，`userFound` 为 `false`。
- 禁用需要读取本地文件路径的上传操作（例如 `file/create`），避免远程用户读取服务器上的文件。`zentao_action_help` 对这类操作返回 `available=false`；附件的更新、删除等其他操作不受影响。
- 不支持会话恢复、事件重放或跨请求取消。

工具参数、返回格式和本地数据处理规则在两种传输方式下相同，见 [CLI 文档的 MCP 工具与返回格式](cli-usage.md#共用工具与返回格式)。
