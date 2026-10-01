# 错误代码与排查手册

列举 zentao-cli 可能会抛出的业务异常，以及对应的问题原因解释。

## 错误提示

当执行命令或调用禅道 API 出错时，会输出错误信息，并提示用户检查配置或参数。当前可能存在如下错误：

| 错误代码 | 错误原因 |
| --- | --- |
| **认证与配置 (10xx)** | |
| 1001 | 必须提供有效的禅道服务地址、用户名和密码或 TOKEN |
| 1002 | 所提供的禅道服务地址 xxx 无法访问 |
| 1003 | 当前用户名和密码不正确 |
| 1004 | 所提供的 Token 已失效，请提供密码重新登录，或提供新的 TOKEN |
| 1005 | 配置文件损坏或无法读取，请检查 {path}（默认路径为 `~/.config/zentao/zentao.json`，可能被 `--config` 或 `ZENTAO_CONFIG_FILE` 覆盖） |
| 1006 | 未找到可用的用户配置，请执行 `zentao login --web` 在浏览器中登录；终端登录使用 `zentao login --no-browser` |
| 1007 | 指定的用户配置不存在，请通过 `zentao profile` 查看可用配置 |
| 1008 | 浏览器登录已取消 |
| 1009 | 浏览器登录等待超时，请重新执行 `zentao login --web` |
| 1010 | 无法启动本地登录服务，请检查本机网络权限，或使用 `zentao login --no-browser` |
| **API 调用 (20xx)** | |
| 2001 | 未找到指定的模块（moduleName），请通过 `zentao help` 查看支持的模块 |
| 2002 | 未找到指定的对象（objectType #id），请检查对象 ID 是否正确 |
| 2003 | 缺少必要参数 field1,field2,...，请通过 `zentao <moduleName> help` 查看必要参数 |
| 2004 | field1 参数值 field1Value 无效，请检查参数格式是否正确 |
| 2005 | 不支持的操作，请通过 `zentao <moduleName> help` 查看支持的操作 |
| 2006 | 当前用户没有权限执行此操作 |
| 2007 | `--data` 参数中的 JSON 数据格式无效 |
| 2008 | 禅道服务端返回错误（Url：{url}，Status：{status}），请查看详细错误信息：{serverResponse} |
| 2009 | 选项 {option} 的值无效，{reason} |
| 2010 | 当前禅道版本不支持该操作；按错误提示升级对应系列的禅道版本，操作帮助可查看最低版本 |
| 2011 | 禅道版本格式无法识别；仅支持点分数字正式版本，如 22.5、biz13.5、max8.5、ipd5.5 |
| 2012 | 站点根地址的 `?mode=getconfig` 未返回包含有效 version 字段的 JSON 对象 |
| **网络通信 (50xx)** | |
| 5001 | 请求超时，请检查网络连接或禅道服务是否正常 |
| 5002 | SSL/TLS 证书验证失败，请检查禅道服务地址是否正确 |
| 5003 | 请求已取消；取消后不再发送后续请求，已发送的写入应查询结果后再决定是否重试 |
| 5004 | 无法启动 MCP HTTP 服务：{reason}；检查监听地址、端口占用与网络权限 |

下面是一个常见错误输出：

```bash
# 在未登录验证的情况下访问禅道数据
$ zentao product

Error(E1006): 未找到可用的用户配置，请执行 `zentao login --web` 在浏览器中登录；终端登录使用 `zentao login --no-browser`

# 以 JSON 格式执行
$ zentao product --format=json

{
    "error": {
        "code": "1006",
        "message": "未找到可用的用户配置，请执行 `zentao login --web` 在浏览器中登录；终端登录使用 `zentao login --no-browser`"
    }
}
```

## HTTP MCP 排查

启动参数无效使用 `E2009`，例如未指定禅道站点、端口不在 1–65535 范围，或在 stdio 模式下使用 HTTP 专用选项。监听失败使用 `E5004`。

| HTTP 状态或现象 | 排查方式 |
| --- | --- |
| 401 | 每个请求只提供一个非空 `token` 头，或一个 `Authorization: Bearer <token>` 头；不能同时提供。Basic、密码和查询参数凭证不受支持 |
| 403，且请求带 `Origin` | HTTP MCP 面向原生客户端，不提供浏览器跨域接入 |
| 404，连接地址为 `/sse` | 不提供旧版 SSE 端点；客户端应改用 Streamable HTTP 的 `/mcp` |
| 405 | MCP 使用 `POST /mcp`；不支持 `GET /mcp`、`DELETE /mcp` |
| 413 | JSON 请求体超过 1 MiB；缩小本次提交内容 |
| 连接在接收或执行期间关闭 | 检查 30 秒接收时限、接收完成后的执行时限、客户端断开及代理超时；已发送的写入应先查询结果 |
| 工具返回 `E1004` | 禅道拒绝了该 Token；在客户端更换 Token，HTTP MCP 不接受密码登录或自动刷新 |
| `/healthz` 正常，业务调用失败 | 健康检查只检查服务进程；继续检查禅道地址、Token、账号权限和版本要求 |
| `zentao_profile` 返回 `account=null` | HTTP Token 模式的预期行为，不表示匿名业务调用；该工具不解析 Token，也不验证其有效性 |

认证头格式通过检查后，权限和 Token 有效性由禅道业务接口决定。HTTP 传输状态与 MCP 工具结果需要分别检查：业务失败通过工具的 `isError` 和 `structuredContent.error` 返回。部署参数见 [HTTP MCP 使用说明](cli-usage.md#远程-http-模式)。
