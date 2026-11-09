# 在 Agent 中接入禅道 MCP 服务

公司管理员部署了禅道 MCP 服务后，你只需在自己的 Agent（Claude Code、Cursor、Codex 等）中填写服务地址和个人 Token，就能让 Agent 查询和操作禅道数据。本机无需安装 zentao-cli，每个请求都按你本人在禅道中的权限执行。

本文面向禅道用户。管理员部署服务见[禅道 MCP 服务部署指南](mcp-server.md)；在个人电脑上使用 CLI 技能或本地 stdio MCP，见[在 Agents 中使用禅道](use-zentao-in-agents.md)。

先向管理员确认以下信息，下文的示例地址请替换为实际值：

| 信息 | 示例 |
| --- | --- |
| 用户接入页面 | `https://mcp.example.com/start` |
| MCP 服务地址（必须包含 `/mcp`） | `https://mcp.example.com/mcp` |
| 禅道地址 | `https://zentao.example.com` |
| 网络要求、开放的模块、是否只读 | 以管理员通知为准 |

> **保护好 Token。** Token 相当于你的禅道密码。只把它填写在本机的 Agent 配置或密钥位置，不要发给 AI，不要提交到项目仓库，也不要把禅道密码告诉 Agent。

## 使用接入页面（推荐）

打开管理员提供的接入页面，例如 `https://mcp.example.com/start`：

1. 确认页面上的禅道地址与你的账号所属站点一致，然后用禅道用户名和密码获取 Token，或粘贴已有 Token。
2. 点击「复制接入说明」，发给正在使用的 Agent。说明中的 Token 是占位符，Agent 会告诉你需要修改的配置文件和字段，再由你在本机填写真实 Token。也可以切换到「手动配置」，按页面提示自己修改配置。
3. 重载或重启 Agent，然后[验证连接](#验证连接并开始使用)。

页面上「附带 Token」的选项默认不勾选，请保持关闭。密码只用于本次换取 Token，Token 只保留在当前页面内存中，刷新后清除。

## 不使用接入页面时

**获取 Token**：在自己的终端调用禅道登录接口，复制响应中 `token` 字段的值（不带引号）。命令中含有明文密码，不要在共享终端中执行。

```bash
curl -X POST "https://zentao.example.com/api.php/v2/users/login" \
  -H "Content-Type: application/json" \
  -d '{"account":"用户名","password":"密码"}'
```

已经安装并登录过 zentao-cli 时，也可以执行 `zentao token` 读取本地保存的 Token，见 [CLI 获取 Token](cli-usage.md#获取-token)。

**让 Agent 协助配置**：将下面说明中的地址替换为实际地址，保留 Token 占位符，发给正在使用的 Agent：

```text
请帮我在当前使用的 Agent 中配置公司的禅道 MCP 服务。

服务名称：zentao-remote
禅道地址：https://zentao.example.com
MCP 服务地址：https://mcp.example.com/mcp
传输方式：Streamable HTTP
认证请求头：token: <your-zentao-token>

请按当前 Agent 的官方文档准备用户级 MCP 配置，保留已有服务。
请告知需要修改的 MCP 配置文件完整路径，以及设置 token 请求头的具体字段和方法；若通过界面配置，请给出入口和字段。
Token 为占位符时，由我在本机填写真实值。不要要求我在对话中提供禅道密码或 Token。
本机无需安装 zentao-cli 或启动 MCP 进程。
Token 只用于请求头。不要在回复中显示真实 Token，也不要提交到项目仓库。
等我在本机设置好 Token 后，再指导我重载或重启 Agent。
最后验证连接：请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。
```

## 手动配置 Agent

所有 Agent 都使用完整的 `/mcp` 地址，并通过请求头 `token: <Token>` 认证。也可以改用 `Authorization: Bearer <Token>`，但两者只能配置一种。服务不提供 OAuth，客户端提示时选择不使用。

| Agent | 配置位置 | 格式要点 |
| --- | --- | --- |
| [Claude Code](https://code.claude.com/docs/en/mcp) | `claude mcp add --transport http --scope user`，或 `~/.claude.json` | `mcpServers`，`type: "http"` |
| [Cursor](https://cursor.com/docs/mcp) | `~/.cursor/mcp.json` | `mcpServers`，`type: "http"`；在 MCP 设置中启用 |
| [Codex](https://developers.openai.com/codex/mcp/) | `~/.codex/config.toml` | `[mcp_servers.zentao-remote]`，`url` 和 `http_headers` |
| [VS Code Copilot](https://code.visualstudio.com/docs/agent-customization/mcp-servers) | 命令面板 `MCP: Open User Configuration` | 顶层是 `servers`，不是 `mcpServers` |
| [Cherry Studio](https://docs.cherryai.com.cn/advanced-basic/extensions/mcp) | 「设置 → MCP → MCP 服务器 → 添加」 | 类型选 Streamable HTTP，再绑定给所用 Agent |
| [OpenCode](https://opencode.ai/docs/mcp-servers/) | `~/.config/opencode/opencode.json` | 顶层 `mcp`，`type: "remote"`，`oauth: false` |
| [Gemini CLI](https://geminicli.com/docs/tools/mcp-server/) | `~/.gemini/settings.json` | `mcpServers`，必须用 `httpUrl`，不能用 `url` |
| [Cline](https://docs.cline.bot/mcp/mcp-overview) | MCP Servers → Configure | `mcpServers`，`type: "streamableHttp"` |

以 Cursor 和 Claude Code 为例，合并到用户级配置文件，不要覆盖其他服务，也不要写在会提交到仓库的项目级配置中：

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

其他 Agent 按上表调整字段。接入页面的「手动配置」会为每个 Agent 生成完整配置。

## 验证连接并开始使用

保存配置后重载 Agent，确认服务已启用，然后发送一次只读请求：

```text
请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。
```

Agent 必须实际调用禅道工具并返回业务数据，才说明配置成功。显示「已连接」或能列出工具，都不能证明 Token 有效。管理员没有开放产品模块时，改为查询已开放的模块。

使用时请注意：

- **写入操作**：创建、修改或删除前，先让 Agent 展示拟操作的内容，确认后再执行。写入超时或中断后可能已经生效，先查询结果再决定是否重试。
- **附件**：本服务不支持从本地路径上传附件，需要时请使用本地 CLI 或 stdio MCP。
- **Token 失效**：服务不会自动刷新 Token。失效后重新获取，并更新 Agent 配置。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 无法连接，或返回 HTTP 502 | 确认使用了完整的 `/mcp` 地址，检查 Agent 所在环境的内网、VPN 和代理；仍失败时联系管理员 |
| 返回 HTTP 401 | 认证头缺失、带多余空白，或同时配置了 `token` 和 `Authorization`；地址带 `?` 查询参数也会返回 401 |
| 返回 HTTP 405，或 `/sse` 返回 404 | 在客户端中选择 Streamable HTTP 并使用 `/mcp` 地址。浏览器直接打开 `/mcp` 返回 405 属于正常现象 |
| 返回 HTTP 504，或执行中断开 | 调用超过执行时限。写入操作先查询是否已生效；经常出现时联系管理员 |
| 工具返回 `E1004` | Token 无效或已失效，从对应的禅道站点重新获取 |
| 工具返回 `E2006`，或看不到某些工具 | 账号在禅道中没有权限，或管理员设置了只读、模块限制 |
| 接入页面提示请求来源不正确 | 刷新页面后重试；仍出现时联系管理员 |

更多现象和错误码见[错误排查手册](errors.md#http-mcp-排查)。
