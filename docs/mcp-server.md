# 禅道 MCP 服务部署指南

禅道 MCP 服务由禅道 CLI 实现，安装后可以通过 `zentao mcp-server` 命令将禅道 API v2 以 MCP（Model Context Protocol）服务的形式提供给 Agent。管理员统一部署一次，禅道用户在自己的 Agent 中填写服务地址和个人 Token 即可使用，本机无需安装 zentao-cli。服务不保存账号、密码或 Token，每个请求都按用户本人在禅道中的权限执行。

本文面向管理员，按 5 个步骤完成部署和发布。禅道用户请阅读[在 Agent 中接入禅道 MCP 服务](mcp-user-guide.md)；在个人电脑上使用 CLI 技能或本地 stdio MCP，见[在 Agents 中使用禅道](use-zentao-in-agents.md)。

```text
Agent ──HTTPS──▶ 反向代理（Nginx 等）──HTTP──▶ zentao mcp-server（127.0.0.1:9090）──▶ 禅道 API v2
      每个请求携带用户自己的禅道 Token
```

本文使用以下示例地址，请替换为实际值：

| 地址 | 用途 |
| --- | --- |
| `https://zentao.example.com` | 禅道站点地址；部署在子目录时保留子目录，例如 `https://zentao.example.com/zentao` |
| `https://mcp.example.com/mcp` | MCP 服务地址，用户在 Agent 中配置，必须包含 `/mcp` |
| `https://mcp.example.com/start` | 用户接入页面，用于获取 Token 和复制接入说明 |

## 部署前确认


- 服务器能访问禅道站点，并安装了 Node.js 18.14.1 或更新版本（也可以使用 Bun）。
- 用户的 Agent 能访问服务对外的 HTTPS 地址。部署在内网时，运行在厂商云端的 Agent 无法访问。
- 禅道使用自签名或内部 CA 证书时，服务连接禅道会报 `E5002`。用环境变量 `NODE_EXTRA_CA_CERTS` 指定 CA 证书文件；临时方案是加全局选项 `--insecure`。

## 1. 安装并试运行

```bash
npm install -g zentao-cli
zentao mcp-server https://zentao.example.com
```

服务默认在前台监听 `127.0.0.1:9090`。服务器上不需要执行 `zentao login`，也不需要管理员账号或共享 Token。另开一个终端检查进程：

```bash
curl http://127.0.0.1:9090/healthz   # {"status":"ok"}
```

这个检查不连接禅道，也不验证 Token。按需要用下列参数限制开放范围：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `[url]` 或 `--url <site>` | `ZENTAO_URL` | 固定连接的禅道站点。位置参数和 `--url` 只能用一个 |
| `--host <host>` | `127.0.0.1` | 监听地址。容器内运行时按需使用 `0.0.0.0` |
| `--port <port>` | `9090` | 监听端口 |
| `--read-only` | 关闭 | 只开放查询操作 |
| `--modules <names>` | 全部模块 | 只开放指定模块，用逗号分隔，例如 `product,story,task,bug` |
| `--split-tools` | 关闭 | 每个模块拆成 `_read` 和 `_write` 两个工具，便于分别授权 |
| 全局 `--timeout <ms>` | `10000` | 访问禅道的单次请求超时 |
| 全局 `--insecure` | 关闭 | 跳过禅道站点的 TLS 证书验证 |

全局选项必须写在 `mcp-server` 之前。参数在启动时确定，修改后需要重启：

```bash
zentao --timeout 20000 mcp-server https://zentao.example.com --read-only --modules product,story,task,bug
```

## 2. 配置常驻运行

以 Linux systemd 为例。先结束前台进程，创建服务账号，并用 `command -v zentao` 确认可执行文件路径：

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin zentao-mcp
```

保存为 `/etc/systemd/system/zentao-mcp.service`。`ExecStart` 中的路径改为实际路径，启动参数按第 1 步追加。`PATH` 需要包含 Node.js 所在目录；装在个人目录（如 nvm）的 Node.js 服务账号通常无法访问，应改为系统级安装。

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

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zentao-mcp
sudo journalctl -u zentao-mcp -n 50 --no-pager
```

日志每个请求一行，例如 `[mcp-http] POST /mcp 200 812ms`。日志不记录 Token 和用户身份，按用户审计请使用禅道的操作记录。

## 3. 配置 HTTPS 反向代理

MCP 进程只监听本机，由反向代理对外提供 HTTPS，并转发 `/mcp`、`/start` 和 `/start/token` 三个路径。Nginx 示例：

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

修改示例时注意：

- **请求头**：保留客户端的 `token` 和 `Authorization` 头。接入页面还依赖原始的 `Host`、`Origin` 和 `X-Zentao-Start` 头，不要改写。
- **凭据**：不要在代理层写死 Token，也不要记录认证头、请求体或响应体，`/start/token` 中包含密码和 Token。
- **限流**：`/start/token` 会用提交的账号密码登录禅道，需要按 IP 限流，防止被用于猜测密码。
- **超时**：`/mcp` 以 SSE 流返回，需要关闭缓冲。`proxy_read_timeout` 应大于 60 秒和 `--timeout` 中的较大值。

**挂在子路径下**：例如 `https://tools.example.com/zentao-mcp/`，应转发整个前缀并去掉前缀（`location /zentao-mcp/ { proxy_pass http://127.0.0.1:9090/; ... }`），不要只转发 `/mcp`。此时 MCP 地址为 `.../zentao-mcp/mcp`，接入页面为 `.../zentao-mcp/start`。

**多个实例**：每个禅道站点运行一个实例，使用不同端口。同一站点多实例负载均衡时，`/mcp` 可以分发到任意实例，但 `/start` 和 `/start/token` 必须到达同一实例，请开启会话保持（例如 `ip_hash`）。

## 4. 验证并发布

用一位普通用户的 Token 从外部网络调用一次只读工具（`read -rs` 避免 Token 留在 Shell 历史中）：

```bash
read -rs ZENTAO_TOKEN
curl -sS https://mcp.example.com/mcp \
  -H "token: $ZENTAO_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"zentao_product","arguments":{"action":"list","pick":"id,name","recPerPage":5}}}'
```

响应的 `data:` 行中有 `structuredContent.data` 表示成功；有 `"isError":true` 时，按 `structuredContent.error.code` 查[常见问题](#常见问题)。没有开放产品模块时换成已开放的模块；使用 `--split-tools` 时工具名为 `zentao_product_read`。

然后在浏览器打开 `https://mcp.example.com/start`，确认禅道地址正确并能获取 Token；再按[用户接入指南](mcp-user-guide.md)在一个 Agent 中完成一次查询。

验证通过后，向用户发送通知：

```text
禅道 MCP 服务已开通：

用户接入页面：https://mcp.example.com/start（推荐，按页面提示完成配置）
MCP 地址：https://mcp.example.com/mcp
禅道地址：https://zentao.example.com
连接方式：Streamable HTTP
认证方式：请求头 token，值为你自己的禅道 Token
网络要求：请填写是否需要公司内网或 VPN
开放功能：请填写实际开放的模块，以及是否只读
接入指南：https://github.com/easysoft/zentao-cli/blob/main/docs/mcp-user-guide.md
```

没有开放产品模块时，请在通知中给出可用的验证问题。用户无法访问 GitHub 时，可将[用户接入指南](mcp-user-guide.md)发布到内部文档。

## 5. 升级与维护

```bash
npm install -g zentao-cli@<版本号>
sudo systemctl restart zentao-mcp
curl http://127.0.0.1:9090/healthz
```

升级或修改参数后，重复第 4 步的只读调用。重启时，未完成的请求最多等待 5 秒后取消，已发出的写入可能已经生效；用户需要刷新已打开的接入页面。用户的 Token 失效由用户自行更新，管理员无需操作。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 无法连接，或返回 HTTP 502 | 确认使用了完整的 `/mcp` 地址，检查 Agent 所在环境的内网、VPN 和代理；仍失败时检查服务进程和反向代理 |
| 返回 HTTP 401 | 认证头缺失、带多余空白，或同时配置了 `token` 和 `Authorization`；地址带 `?` 查询参数也会返回 401。客户端配置正确时，检查代理是否转发了认证头 |
| 返回 HTTP 405，或 `/sse` 返回 404 | 在客户端中选择 Streamable HTTP 并使用 `/mcp` 地址。浏览器直接打开 `/mcp` 返回 405 属于正常现象 |
| 返回 HTTP 504，或执行中断开 | 调用超过执行时限。写入操作先查询是否已生效；经常出现时调大 `--timeout` 和代理的 `proxy_read_timeout` |
| 工具返回 `E1004` | Token 无效或已失效，用户从对应的禅道站点重新获取 |
| 工具返回 `E2006`，或看不到某些工具 | 账号在禅道中没有权限，或启动时设置了 `--read-only`、`--modules` 限制 |
| 工具返回 `E5001` / `E5002` | 服务访问禅道超时 / 证书验证失败，检查网络、`--timeout` 或[部署前确认](#部署前确认)中的证书配置 |
| 接入页面提示请求来源不正确 | 服务已重启，用户刷新页面即可；仍出现时，检查代理是否保留了 `Host`、`Origin`、`X-Zentao-Start` 头，以及多实例的会话保持 |

更多现象、接入页面提示和错误码见[错误排查手册](errors.md#http-mcp-排查)；接口列表和请求限制见[实现说明](implementation.md#http-mcp-的请求隔离)。
