# 技术方案与实现细节

本文档解析 zentao-cli 的核心功能内部实现规则。

## 用户配置管理

用户配置使用 [configstore](https://github.com/sindresorhus/configstore) 管理，配置文件保存在 `~/.config/zentao/zentao.json` 中。首次创建该文件时，会强制设置文件权限为 `600`，以防止同一主机上的其他用户越权读取。

下面是一个配置文件示例：

```json
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

            /* 当前工作区 GID */
            "currentWorkspace": 1,

            /* 工作区列表 */
            "workspaces": [
                {
                    "id": 1,
                    "product":   {"id": 1, "name": "产品1"},
                    "project":   {"id": 1, "name": "项目1"},
                    "execution": {"id": 1, "name": "执行1"}
                },
                {
                    "id": 2,
                    "product":   {"id": 1, "name": "产品1"},
                    "project":   {"id": 2, "name": "项目2"},
                    "execution": {"id": 3, "name": "执行3"}
                }
            ],

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

                /* 界面语言 */
                "lang": "zh-CN",

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

                /* 是否自动设置工作区 */
                "autoSetWorkspace": true,

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
当有自定义配置文件时，则不使用默认的 `~/.config/zentao/zentao.json` 文件。

路径解析规则：

- 支持 `~` 展开，`~/foo/zt.json` 会被展开为用户家目录下的 `foo/zt.json`；
- 相对路径基于当前工作目录解析为绝对路径；
- 若自定义文件不存在，会按默认流程由 configstore 自动创建；首次写入后同样会把权限收紧为 `600`。

除了 `--config` 选项，也可以通过环境变量 `ZENTAO_CONFIG_FILE` 指定自定义配置文件路径。当二者同时存在时，`--config` 选项优先。三者优先级从高到低为：

1. 全局选项 `--config <config_file>`
2. 环境变量 `ZENTAO_CONFIG_FILE`
3. 默认路径 `~/.config/zentao/zentao.json`

## 用户验证过程

调用禅道 API 需要在请求头中增加 `token` 字段，其值为获取到的 TOKEN。获取 TOKEN 的过程如下：

1. 检查 `~/.config/zentao/zentao.json` 文件是否存在；如果存在，则读取其中的信息，并执行步骤 3；如果不存在，则执行步骤 2
2. 从环境变量 `ZENTAO_URL`、`ZENTAO_ACCOUNT`、`ZENTAO_TOKEN` 或 `ZENTAO_PASSWORD` 中读取禅道服务地址、用户账号和 TOKEN/密码，如果没有 TOKEN 但有密码，则先执行登录请求获取 TOKEN；
3. 使用获取到的 TOKEN 发起所需的请求（获取用户列表信息）。如果请求成功，则只需后续流程，如果请求失败，且原因是 Token 失效，则重新从环境变量获取账户避免登录，执行步骤2；
4. 在终端提示用户使用 `zentao login -s <zentao_url> -u <account> -p <password>` 命令手动登录

## 禅道 API 调用

禅道 API 2.0 的基础路径 `$BASE_URL` 为 `$ZENTAO_URL/api.php/v2`。仓库中的 [zentao-openapi.json](../data/zentao-openapi.json) 文件保存了禅道 API 2.0 的 OpenAPI 规范，可据此了解 API 详情。

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
