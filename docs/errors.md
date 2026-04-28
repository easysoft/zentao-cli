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
| 1006 | 未找到指定的用户配置，请先使用 `zentao login -s <zentao_url> -u <account> -p <password> -t <token>` 登录 |
| 1007 | 指定的用户配置不存在，请通过 `zentao profile` 查看可用配置 |
| 1008 | 当前禅道版本不受支持，请使用禅道 22.0 及以上版本 |
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
| **数据处理 (30xx)** | |
| 3001 | `--pick` 指定的字段不存在 |
| 3002 | `--filter` 表达式格式无效，请检查过滤条件格式 |
| 3003 | `--sort` 表达式格式无效，请检查排序条件格式 |
| **工作区 (40xx)** | |
| 4001 | 未找到指定的工作区，请通过 `zentao workspace ls` 查看可用工作区 |
| 4002 | 当前未设置工作区，请通过 `zentao workspace set` 设置工作区 |
| **网络通信 (50xx)** | |
| 5001 | 请求超时，请检查网络连接或禅道服务是否正常 |
| 5002 | SSL/TLS 证书验证失败，请检查禅道服务地址是否正确 |

下面是一个常见错误输出：

```bash
# 在未登录验证的情况下访问禅道数据
$ zentao product

Error(E1001): 必须提供有效的禅道服务地址、用户名和密码

# 以 JSON 格式执行
$ zentao product --format=json

{
    "error": {
        "code": "1001",
        "message": "必须提供有效的禅道服务地址、用户名和密码"
    },
}
```
