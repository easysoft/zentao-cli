# 禅道 MCP 与接入配置

已有禅道 MCP 时直接使用，工具在宿主中可能带命名空间前缀。CLI 帮助与 MCP 参数不是同一层接口，以可调用工具的 schema 为准。

## 离线发现操作

先调用 `zentao_action_help`，例如：

```json
{"module":"doc","action":"createMyDoc"}
```

该工具无需认证或网络，返回 `module`、`action`、`display`、`type`、`path`、`minVersion`、`parameters`。用它确认动作名称、多个路径参数、必填项和最低版本，再调用业务工具。`zentao_<module>_props` 只描述返回对象属性，不是写入 schema。

业务工具名为 `zentao_<module>`，必须提供实际注册动作名 `action`；不能直接搬 CLI 别名或省略为默认列表。例如 `zentao_my`：

```json
{"action":"tasks","pick":"id,name,status"}
```

- `id`、`product`、`project`、`execution`、`page`、`recPerPage` 使用数值。
- `params` 是对象，用于动作特有的路径、查询与请求体字段；多路径 ID 分别放在其中。
- `pick`、`sort`、`searchFields` 是字符串；`filter`、`search` 是字符串数组。
- 仅当该动作的帮助参数声明了分页时才传 `page` / `recPerPage`；业务工具列出通用分页字段不代表每个动作都支持，例如 `doc/myDocs` 无分页参数。
- 不要添加 CLI 专用的顶层 `data`、`format`、`yes`、`limit` 或批量选项；不支持把逗号 ID 字符串传给数值 `id`。

例如查询文档目录中的文档，调用 `zentao_doc`：

```json
{"action":"myDocs","params":{"spaceID":1,"libID":2}}
```

MCP 列表结果为 `{data,pager?}`，pager 字段为 `pageID`、`recPerPage`、`recTotal`，不是 CLI JSON 的 `page`、`total`。详情直接返回对象；写入返回业务数据或归一化响应。工具内容可能位于 `content` 文本块中，需要解析其 JSON 并检查 `isError`。分页原则沿用 [data-output.md](data-output.md)，使用相应字段判断是否读完。

## 账号选择

`zentao_profile` 需要认证，会查询服务器用户列表并返回当前用户，未匹配时可能回退到缓存用户或空对象；它与只列本地配置的 CLI `profile` 不同。需要可切换账号的键时使用 CLI `zentao profile --format=json`。需显式选择账号时调用 `zentao_switch_profile`，参数为 `{"profileKey":"admin@https://zentao.example.com"}`。显式切换的 Profile 在本 MCP 会话内优先于环境凭证，业务权限仍需以目标查询验证。

## 用户要求安装或配置时

```bash
zentao add-mcp --help
zentao add-mcp codex
zentao add-skill codex
zentao add-skill --output ./exported-skills
```

- `add-mcp <agent>` 配置指定宿主，复用已登录 Token，由 CLI 写入凭证；不需要手工读取密码或 Token。非交互运行须显式选择宿主，不为配置一个宿主使用 `all`。
- `zentao mcp` 是 stdio 服务，应由宿主启动；不要在普通查询过程中启动后等待它输出业务结果。
- `add-skill <agent>` 安装/更新随包的两个技能；`--output` 导出到自定义目录，与 agent 参数互斥，递归包含参考资料。
- 安装和接入按用户指定目标进行；已有连接无需重写配置。重跑会覆盖目标中的同名技能文件或 MCP 项，先保留用户需要的定制。
- CLI 拒绝修改含注释、无效 JSON 或非对象根的 JSON 配置时，说明受限文件，保留现有内容，不用空对象覆盖。
