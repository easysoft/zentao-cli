# 技术方案与实现细节

本文档解析 zentao-cli 的核心功能内部实现规则。

## 用户配置管理

用户配置使用 [configstore](https://github.com/sindresorhus/configstore) 管理，默认文件为 `$XDG_CONFIG_HOME/zentao/zentao.json`；没有有效的绝对 XDG 路径时，保存在 `~/.config/zentao/zentao.json` 中。在支持 POSIX 权限的平台上，创建或保存文件后权限为 `0600`，新建目录为 `0700`；读取不会修改文件权限。

配置读取通过 Zod 校验已知字段，保留未知字段及缺少时间戳的旧 Profile；文件缺失按空配置处理，格式错误、结构错误或不可读分别以 `E1005` 的结构化原因返回。保存、删除 Profile 时，将 `profiles` 与 `currentProfile` 一次传给 configstore，复用其原子文件替换；写入失败返回 `E1011` 和系统错误码。这保证单次更新不留下两个字段分别写入的中间状态，不提供跨进程更新锁。

下面是一个配置文件示例：

```jsonc
{
    /* 当前用户配置的账号@禅道服务地址 */
    "currentProfile": "admin@https://zentao.example.com",

    /* 用户配置列表 */
    "profiles": [
        {
            /* 禅道服务地址 */
            "server": "https://zentao.example.com",

            /* 用户账号 */
            "account": "admin",

            /* TOKEN */
            "token": "xxxxxx",

            /* 登录验证通过后用户在禅道中的信息 */
            "user": {
                /* 用户在禅道中的 ID */
                "id": 1,

                /* 用户姓名 */
                "realname": "Admin",

                // ... 其他属性
            },

            /* 登录时间 */
            "loginTime": "2026-04-10 10:00:00",

            /* 最后使用时间 */
            "lastUsedTime": "2026-04-10 10:00:00",

            /* 服务器配置 */
            "serverConfig": {
                /* 禅道版本 */
                "version": "ipd5.0",
                "systemMode": "PLM",
                "sprintConcept": "0",
                "requestType": "PATH_INFO",
                "requestFix":"-",
                "moduleVar":"m",
                "methodVar":"f",
                "viewVar":"t",
                "sessionVar":"zentaosid"
            },

            /* 客户端配置 */
            "config": {
                /* 默认输出格式 */
                "defaultOutputFormat": "markdown",

                /* 默认分页大小 */
                "defaultRecPerPage": 20,

                /* 是否忽略 SSL/TLS 证书验证 */
                "insecure": false,

                /* 是否将对象属性中的 HTML 转换为 Markdown */
                "htmlToMarkdown": true,

                /* 请求超时时间 */
                "timeout": 10000,

                /* 是否在批量操作出错时停止执行后续操作 */
                "batchFailFast": false,

                /* 是否在 JSON 格式化时添加空格 */
                "jsonPretty": false,

                /* 分页配置 */
                "pagers": {
                    "product": 50   // 产品分页大小
                },
            }
        },
        {
            "server": "https://zentao.example.com",
            "account": "dev1",
            "token": "xxxxxx",
            "loginTime": "2026-04-10 10:00:00",
            "lastUsedTime": "2026-04-10 10:00:00",
        }
    ],
}
```

## 自定义配置文件

用户可以通过全局选项 `--config <config_file>` 指定自定义配置文件路径，并执行后续流程。
当有自定义配置文件时，所有读写都使用选中的文件。

路径解析规则：

- 支持 `~` 展开，`~/foo/zt.json` 会被展开为用户家目录下的 `foo/zt.json`；
- 相对路径基于当前工作目录解析为绝对路径；
- 若自定义文件不存在，读取返回空配置，首次写入时才创建目录与文件；写入后将文件权限收紧为 `0600`。

除了 `--config` 选项，也可以通过环境变量 `ZENTAO_CONFIG_FILE` 指定自定义配置文件路径。优先级从高到低为：

1. 全局选项 `--config <config_file>`
2. 环境变量 `ZENTAO_CONFIG_FILE`
3. `XDG_CONFIG_HOME` 为绝对路径时的 `$XDG_CONFIG_HOME/zentao/zentao.json`
4. `XDG_CONFIG_HOME` 未设置、为空或为相对路径时的 `~/.config/zentao/zentao.json`

XDG 不做 `~` 展开，不读取其他目录作为后备配置，也不自动迁移旧文件。补全脚本使用相同的 XDG 默认目录；指定账号配置文件不改变补全脚本位置。

## 用户验证过程

调用禅道 API 需要在请求头中增加 `token` 字段，其值为获取到的 TOKEN。CLI 命令和 stdio MCP 使用以下凭证解析过程：

1. 若 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 以及 `ZENTAO_TOKEN`/`ZENTAO_PASSWORD` 之一齐全，优先使用这组显式身份；如果只有密码，则先登录获取 Token；
2. 否则读取所选配置文件中的当前 Profile 及其 Token；
3. 使用解析出的 Token 发起请求；
4. 若两种来源都不完整，提示执行 `zentao login --web`，由用户在本机浏览器完成验证并保存 Token；终端交互登录可使用 `zentao login --no-browser`。

认证过程不保存 Profile，也不更新已保存 Profile 的最近使用时间。完整环境凭证直接构建进程内的认证上下文，不读取本地 Profile 或继承其配置；显式命令行选项覆盖 CLI 默认配置。需要将环境凭证验证并保存到本地时，执行 `zentao login --useEnv`。

`resolveAuthSource` 共用于业务认证和 `profile --effective`，只解析来源而不请求网络。诊断命令按白名单输出来源、站点、账号、凭据类型及所用配置文件，`verified` 固定为 `false`。显式传入的 Profile（如 stdio MCP 已绑定的账号）优先于环境凭据。

## HTTP MCP 的请求隔离

`zentao mcp --transport http` 使用 MCP SDK 的无状态 Streamable HTTP 传输。Node 运行时使用 `node:http` 和 `StreamableHTTPServerTransport`；Bun 运行时使用原生 `Bun.serve` 和 Web Standard 传输，以正确处理客户端断开。两种运行时共用工具、认证和请求处理逻辑。一个进程在启动时固定一个禅道站点，每个 `POST /mcp` 独立创建 MCP server、transport 和 SDK client，业务工具注册与 stdio 共用。请求结束后关闭该请求的 MCP 资源。

凭证仅取自当前请求的 `token` 或 `Authorization: Bearer` 请求头；缺失、重复或格式错误的凭证被拒绝。远程模式不进入 CLI 的环境凭证和本地 Profile 选择流程，不保存 Token，不开放 `zentao_switch_profile`。MCP 上下文单独提供 client、业务配置和站点信息；HTTP 的账号为空，因此 `zentao_profile` 不查询用户列表，也不验证 Token。

HTTP 模式强制关闭本地文件上传能力。现有 `file/create` 的文件参数是服务端本地路径，SDK 会读取该路径，因此 multipart/本地路径上传操作在获取业务认证上下文和调用 SDK 前被拒绝，动作帮助的 `available` 同步为 `false`。CLI 和 stdio 仍可上传本地文件；附件更新、删除等操作不受此限制。

上游客户端使用默认配置和启动时的 `--timeout`、`--insecure`，不会继承本地账号的偏好。取消信号绑定到当前请求，上游配置获取、更新预读和业务写入均使用该信号；一个客户端断开不会取消其他客户端的请求。服务不重放失败或已取消的写操作，也不保存跨请求会话。

HTTP 层限制请求体为 1 MiB、接收时长为 30 秒；接收完成后的工具调用整体执行时限为 60 秒与上游超时中的较大值。退出时停止接收新请求，最多等待 5 秒，再取消仍在运行的请求。日志不包含认证头或请求体。部署示例、认证头和协议边界见 [HTTP MCP 使用说明](cli-usage.md#远程-http-模式)。

## 禅道 API 调用

禅道 API 2.0 的基础路径 `$BASE_URL` 为 `$ZENTAO_URL/api.php/v2`。禅道 API 2.0 的封装由 [`zentao-api`](https://github.com/easysoft/zentao-api) SDK 提供，可参考其文档与内置模块定义了解 API 详情。

下面说明常见的 API 调用方式。

### 获取用户 Token

请求地址：`POST $BASE_URL/users/login`，请求体：

```json
{
    "account": "admin",
    "password": "123456"
}
```

返回结果：

```json
{
    "status": "success",
    "token": "xxxxxx"
}
```

#### 获取用户列表信息

请求地址：`GET $BASE_URL/users`，请求参数：

```json
{
    "browseType": "inside",
    "recPerPage": 100
}
```

返回结果：

```json
{
    "status": "success",
    "users": [
        {
            "id": 1,
            "name": "Admin"
        }
    ]
}
```

#### 创建产品

请求地址：`POST $BASE_URL/products`，请求体：

```json
{
    "name": "产品1"
}
```

返回结果：

```json
{
    "status": "success",
    "id": 1
}
```
