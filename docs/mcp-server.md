# 禅道 MCP 服务部署与 Agent 接入指南

`zentao mcp-server` 适合由公司管理员统一部署，再让禅道用户在自己的 Agent 中连接。管理员维护服务地址和开放的功能，每位用户使用自己的禅道 Token，按本人在禅道中的权限查询和操作数据。

普通用户不需要安装 zentao-cli，也不需要在自己的电脑上启动 MCP 服务。准备好管理员提供的 MCP 地址和个人 Token，就可以让 Agent 协助完成配置。

- **公司管理员**：按[管理员部署](#管理员部署)启动服务，再将连接信息和本文档发给用户。
- **普通用户**：优先打开管理员提供的 `/start` [接入页面](#使用接入页面)，也可以阅读[让 Agent 协助配置](#让-agent-协助配置)，需要时参考[获取个人 Token](#获取个人-token)和[常用 Agent 配置](#常用-agent-配置)。

如果希望在个人电脑上安装 CLI 技能，或由 Agent 启动本地 stdio MCP，请参考[在 Agents 中使用禅道](use-zentao-in-agents.md)和[本地 stdio 模式](cli-usage.md#本地-stdio-模式)。`zentao add-mcp` 配置的是本地 stdio，不用于接入公司统一部署的服务。

## 管理员部署

### 1. 准备部署环境

准备一台能访问公司禅道 API v2 的服务器，安装 Node.js 18.14.1 或更新版本，也可以使用 Bun。用户的 Agent 所在环境需要能访问这台服务器对外提供的 HTTPS 地址；公司内网部署时，应向用户说明内网或 VPN 要求。

本文使用两个示例地址，请分别替换：

| 地址 | 用途 | 由谁使用 |
| --- | --- | --- |
| `https://zentao.example.com` | 禅道站点地址；部署在子目录时保留子目录，例如 `/zentao` | MCP 服务连接禅道；用户获取 Token |
| `https://mcp.example.com/mcp` | 对外提供的 MCP 服务地址，包含 `/mcp` 路径 | 用户在 Agent 中配置 |
| `https://mcp.example.com/start` | 用户接入页面 | 用户获取 Token、复制接入说明和查看手动配置 |

禅道地址与 MCP 地址不能互换。每个 MCP 服务进程固定连接一个禅道站点；多个站点需分别启动实例并分配端口和访问地址。

### 2. 安装并启动服务

在服务器上执行：

```bash
npm install -g zentao-cli
zentao mcp-server --help

zentao mcp-server https://zentao.example.com
```

默认监听 `127.0.0.1:9090`，MCP 端点为 `/mcp`，用户接入页面为 `http://127.0.0.1:9090/start`。命令在前台运行，启动后会输出接入页面地址和客户端配置示例。也可以使用 `--url` 或 `ZENTAO_URL` 提供禅道地址：

```bash
zentao mcp-server --url https://zentao.example.com
ZENTAO_URL=https://zentao.example.com zentao mcp-server
```

位置参数与 `--url` 二选一；均未提供时才读取 `ZENTAO_URL`。不需要在服务器上执行 `zentao login`，也不需要配置管理员账号或共享 Token。服务不使用服务器上的本地登录记录，用户凭证由每次请求提供。

按公司需要限制开放范围，例如只开放产品、需求、任务和 Bug 的查询：

```bash
zentao mcp-server https://zentao.example.com \
  --host 127.0.0.1 --port 9090 \
  --read-only --modules product,story,task,bug
```

| 选项 | 说明 |
| --- | --- |
| `--host`、`--port` | 修改监听地址和端口；同机反向代理使用默认回环地址即可 |
| `--read-only` | 仅开放查询，并在执行时禁止业务写入 |
| `--modules product,story,task,bug` | 仅开放指定业务模块 |
| `--split-tools` | 将每个模块拆成 `_read` 和 `_write` 工具，便于 Agent 分别授权 |

默认会开放可用的查询和写入操作，最终权限仍由禅道按用户 Token 判断。工具范围在启动时确定，调整选项后需要重启服务。完整参数见 [MCP 服务参考](cli-usage.md#mcp-服务)。

另开终端检查进程：

```bash
curl http://127.0.0.1:9090/healthz
```

返回 `{"status":"ok"}` 表示 MCP 进程可用，不代表已经连通禅道或验证了用户 Token。

### 3. 配置常驻运行

正式部署应使用进程管理工具保持服务运行。下面以 Linux systemd 为例；先结束上一步的前台进程，避免占用同一个端口。

创建专用服务账号，并确认可执行文件的位置：

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin zentao-mcp
command -v zentao
command -v node
```

将下面内容保存为 `/etc/systemd/system/zentao-mcp.service`。将 `ExecStart` 中的 `/usr/local/bin/zentao` 替换为实际路径，并确保服务账号可以执行它；Node.js 所在目录需包含在 `PATH` 中。个人目录内的安装可能需要改为服务账号可访问的共享安装。

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

[Install]
WantedBy=multi-user.target
```

如果需要只读或模块限制，将相应选项加入 `ExecStart`，然后启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zentao-mcp
sudo systemctl status zentao-mcp
sudo journalctl -u zentao-mcp -n 50 --no-pager
```

升级 zentao-cli 或修改启动参数后，重启服务并重新检查 `/healthz` 和一次实际的只读业务查询。

### 4. 提供 HTTPS 访问地址

使用 HTTPS 反向代理对外提供 `/mcp`，MCP 进程继续监听回环地址。以下为同机 Nginx 示例，域名和证书路径按部署环境替换：

```nginx
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

    # The page and its same-origin POST /start/token endpoint.
    location /start {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_read_timeout 65s;
        client_max_body_size 16k;
    }
}
```

检查配置并按服务器的管理方式重载 Nginx。代理应保留客户端的 `token` 或 `Authorization` 请求头，不要写死某个账号的 Token，也不要将认证头加入访问日志。若增大 MCP 的上游请求超时，应相应增加代理超时。

`/start` 通过同源的 `/start/token` 向固定禅道站点获取 Token，不读取或写入服务机 Profile。代理必须保留浏览器访问地址的 `Host`（含非默认端口）、`Origin`、`Content-Type` 和 `X-Zentao-Start`；无需添加 CORS。不要记录请求体或响应中的密码和 Token。远程填写凭据需要 HTTPS，本机支持 `localhost`、`127.0.0.1` 和 `[::1]` 的 HTTP 地址。

页面根据浏览器访问地址生成 `/mcp` 地址。若代理使用路径前缀，应同时将 `<前缀>/start`、`<前缀>/start/token`、`<前缀>/mcp` 转发并去掉前缀；不要只转发 `/mcp`。

服务使用 **Streamable HTTP**，没有旧版 `/sse` 端点。`/mcp` 面向原生 MCP 客户端，仍拒绝浏览器 Origin 请求；普通用户通过浏览器打开 `/start`。直接打开 `/mcp` 收到 HTTP 405，不能据此判断服务不可用。

### 5. 向用户提供连接信息

部署完成后，用普通用户的 Token 在 Agent 中完成一次只读业务查询，再向用户提供以下信息。管理员只分发连接说明，用户各自获取和填写个人 Token。

```text
禅道 MCP 服务已开通：

禅道地址：https://zentao.example.com
用户接入页面：https://mcp.example.com/start
MCP 地址：https://mcp.example.com/mcp
连接方式：Streamable HTTP
认证方式：请求头 token，值为你自己的禅道 Token
网络要求：请填写是否需要公司内网或 VPN
开放功能：请填写实际开放的模块，以及是否只读
接入指南：https://github.com/easysoft/zentao-cli/blob/main/docs/mcp-server.md
```

## 普通用户接入

### 使用接入页面

打开管理员提供的地址，例如 `https://mcp.example.com/start`。本机部署时使用 `http://127.0.0.1:9090/start`。

1. **准备 Token**：确认页面上的禅道地址与自己的账号所属站点一致。选择「账号登录」获取 Token，或选择「已有 Token」粘贴个人 Token；也可以稍后填写，先看配置。
2. **配置 Agent**：选择「让 Agent 配置」，复制接入说明发送给 Agent，说明默认预览两行，点击可展开全文；或切换到「手动配置」，选择客户端并合并配置。两种方式共用个人 Token 区域，可显示、复制、更换或清除 Token。默认复制占位符，主动勾选「复制说明或配置时附带 Token」才会加入真实 Token，预览始终遮蔽。无需向 Agent 提供密码。
3. **验证连接**：重载或重启 Agent，发送「请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。」。检查返回的产品 ID 和名称；列表为空时确认账号的产品访问权限，服务未开放 `product` 模块时联系管理员。

页面支持中文、英文及浅色、深色外观；首次语言跟随浏览器，手动选择会保存。手动配置支持 Claude Code、Cursor、Codex、VS Code Copilot、Cherry Studio、OpenCode、Gemini CLI 和 Cline，并提供官方文档链接。

密码只用于本次换取 Token，请求完成后清空；服务不保存账号密码或 Token。Token 仅保留在当前页面内存中，刷新或离开后清除。页面中的「清除 Token」不撤销 Token，也不会删除已保存到 Agent 配置或剪贴板中的内容。Token 失效后重新获取并更新 Agent 配置。

### 让 Agent 协助配置

优先将下面的说明发送给正在使用的 Agent，让它根据自己的配置格式协助接入。先将地址替换为管理员提供的实际地址；Token 获取方式见[下一节](#获取个人-token)。

```text
请帮我在当前使用的 Agent 中配置公司的禅道 MCP 服务。

服务名称：zentao-remote
禅道地址：https://zentao.example.com
MCP 服务地址：https://mcp.example.com/mcp
传输方式：Streamable HTTP
认证请求头：token: <我的禅道 Token>
接入文档：https://github.com/easysoft/zentao-cli/blob/main/docs/mcp-server.md

请根据当前 Agent 的官方文档，将服务合并到我的用户级 MCP 配置，保留已有服务。
这是公司统一部署的远程服务，本机无需安装 zentao-cli 或启动 MCP 进程。
Token 只用于请求头；如果支持密钥或环境变量，请指导我在本机填写，不要在回复中显示 Token。
如果你无法直接修改配置，请告诉我具体入口和需要填写的内容。
完成后告诉我是否需要重载或重启 Agent，并通过禅道 MCP 查询我有权访问的产品列表来验证连接。
```

可以先保留 Token 占位符，让 Agent 准备好配置，再在本机填写真实值。Token 对应你的禅道访问权限，请保存在个人配置或 Agent 支持的密钥位置，避免提交到项目仓库；无需向 Agent 提供禅道密码。

### 获取个人 Token

使用自己的禅道账号，并确认获取 Token 的禅道站点与管理员提供的站点一致。以下两种方式任选其一。

#### 方式一：调用禅道 API V2 接口获取 Token

在自己的终端执行，将域名、用户名和密码替换为实际值：

```bash
curl -X POST "http://您的禅道域名/api.php/v2/users/login" \
   -H "Content-Type: application/json" \
   -d '{"account":"用户名","password":"密码"}'
```

实际使用公司提供的 HTTPS 地址；如果禅道部署在子目录，保留子目录，例如 `https://zentao.example.com/zentao/api.php/v2/users/login`。密码只用于向禅道登录接口请求 Token，避免将含真实密码的命令留在共享记录中。

成功后，复制响应中的 `token` 字段值，作为 MCP 配置的个人 Token；不要复制整段 JSON，也不要带上外层引号。

#### 方式二：已安装 zentao-cli 时使用 zentao token

如果已经通过 CLI 登录，直接执行：

```bash
zentao token
```

默认输出一行当前账号已保存的 Token。需要读取另一个已登录账号时，可以指定账号和站点：

```bash
zentao token 'your-account@https://zentao.example.com'
```

尚未登录，或保存的 Token 已失效时，先在自己的电脑上登录，再读取：

```bash
zentao login --web
zentao token
```

`zentao token` 默认只读取本地 Token，不联网验证或自动刷新。还支持通过完整的 `--server`、`--user`、`--password` 临时获取 Token，详见 [CLI 获取 Token](cli-usage.md#获取-token)。未安装 CLI 的用户可以直接使用方式一。

### 常用 Agent 配置

需要手动配置时，按所用工具的官方指导操作。所有工具都使用管理员提供的完整 `/mcp` 地址和你自己的 Token；只配置一种认证头：`token: <Token>`，或 `Authorization: Bearer <Token>`，不能同时提供。该服务不提供 OAuth 登录。

| Agent | 配置入口和要点 | 官方配置指导 |
| --- | --- | --- |
| Claude Code | 用 `claude mcp add --transport http` 添加远程服务，选择 `--scope user`，通过 `--header` 设置 Token；在 `/mcp` 查看状态 | [连接 MCP 服务](https://code.claude.com/docs/en/mcp) |
| Cursor | 在用户级 `~/.cursor/mcp.json` 的 `mcpServers` 中添加服务，填写 `url` 和 `headers`，在 MCP 设置中启用 | [MCP 配置与使用](https://cursor.com/docs/mcp) |
| Codex | 在 `~/.codex/config.toml` 的 `mcp_servers` 中配置 `url` 和 `http_headers`；也支持 `env_http_headers` 从环境变量读取 Token | [MCP 配置说明](https://developers.openai.com/codex/mcp/) |
| VS Code Copilot | 运行命令面板的 `MCP: Add Server`，选择 HTTP 和用户配置；VS Code 格式使用顶层 `servers`，HTTP 条目填写 `type`、`url`、`headers` | [添加 MCP 服务](https://code.visualstudio.com/docs/agent-customization/mcp-servers) · [配置格式](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Cherry Studio | 在「设置 → MCP → MCP 服务器 → 添加」配置远程 HTTP 服务和认证，启动后在「工作 → Agent 菜单 → 编辑 → MCP」绑定给所用 Agent | [MCP 与外部工具](https://docs.cherryai.com.cn/advanced-basic/extensions/mcp) |
| OpenCode | 在 `mcp` 中添加 `type: "remote"`、`url`、`headers`；使用个人 Token 认证时设置 `oauth: false` | [MCP servers](https://opencode.ai/docs/mcp-servers/) |
| Gemini CLI | 在 `settings.json` 的 `mcpServers` 中使用 `httpUrl` 和 `headers`；`url` 字段用于旧 SSE，不能替代 `httpUrl` | [MCP servers with Gemini CLI](https://geminicli.com/docs/tools/mcp-server/) |
| Cline | 在 MCP Servers 中添加远程服务，选择 Streamable HTTP 并配置请求头；JSON 使用 `type: "streamableHttp"` | [MCP 配置与远程服务](https://docs.cline.bot/mcp/mcp-overview) |

以下给出常用配置示例。请替换占位符，并合并到已有配置，不要覆盖其他服务。不同 Agent 的字段名称不同，其他工具请按上表中的官方文档转换。

**Claude Code**：在终端执行，`--scope user` 让配置在当前用户的各个项目中可用：

```bash
claude mcp add --transport http --scope user \
  --header "token: <your-zentao-token>" \
  zentao-remote https://mcp.example.com/mcp
```

也可以在 `~/.claude.json` 顶层的 `mcpServers` 中合并下面的 JSON。**Cursor** 使用 `~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "zentao-remote": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "token": "<your-zentao-token>"
      }
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

如果由运行环境提供 Token，可将 `http_headers` 替换为 `env_http_headers = { token = "ZENTAO_TOKEN" }`，并确保启动 Codex 的进程能读取该环境变量。仅在另一个终端设置变量不会自动传给已经打开的应用。

### 验证连接并开始使用

保存配置后，按 Agent 的提示重载 MCP 服务或重新打开会话，确认服务已启用，并允许当前会话使用它的工具。先发送一次明确的只读请求：

```text
请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称，不修改数据。
```

查看 Agent 是否实际调用了禅道 MCP 工具并返回业务结果。仅显示「已连接」、列出工具或调用 `zentao_profile`，都不能证明 Token 有效；HTTP 模式的 `zentao_profile` 只返回固定站点信息，不识别当前用户。

连接成功后，可以继续提问：

```text
产品 1 当前有哪些未解决的 Bug？请按优先级整理。

查看任务 123 的详情，帮我整理需要完成的工作。

查看执行 10 的进展，列出可能影响交付的风险。
```

涉及创建、修改或删除数据时，先让 Agent 展示拟操作的对象和内容，再按需要执行。管理员启用了 `--read-only` 时只能查询；未启用只读限制也仍受你在禅道中的权限约束。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 无法连接或 HTTP 502 | 确认使用管理员提供的完整 MCP 地址；检查 Agent 实际运行环境的内网或 VPN、代理、证书和 MCP 进程 |
| 连接返回 HTTP 401 | 检查 Token 请求头是否缺失、带了多余空白，或同时配置了 `token` 和 `Authorization`；确认代理保留认证头 |
| 工具已列出，但业务查询提示 Token 无效或 `E1004` | 从对应禅道站点重新获取个人 Token，更新 Agent 配置并重新连接；服务不会自动刷新 Token |
| 业务查询提示无权限或 `E2006` | 确认账号在禅道中有访问该数据的权限；联系禅道管理员调整 |
| 返回 HTTP 403，提示不支持 Origin 请求 | 使用原生 MCP 客户端连接；该服务不提供浏览器 CORS 接入 |
| 浏览器访问 `/mcp` 返回 HTTP 405，或 `/sse` 返回 404 | 配置 Streamable HTTP 的 `/mcp` 地址；服务通过 `POST /mcp` 工作，不提供旧 SSE 端点 |
| Agent 看不到工具，或不能执行某个操作 | 检查服务是否绑定到当前 Agent，工具是否启用，以及管理员的只读、模块限制和禅道版本支持情况 |
| 无法上传本地附件 | HTTP 模式不接受从本地路径上传文件；此类操作需使用本地 CLI 或 stdio MCP |

写入操作超时后，先查询是否已经生效，再决定是否重试。更完整的传输边界、工具行为和错误说明见 [MCP 服务参考](cli-usage.md#mcp-服务)与[错误排查手册](errors.md)。
