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

完整参数 `--server <url> --user <account> --password <password>`（或 `--token <token>`）仍可直接登录，同时提供密码和 Token 时优先使用 Token。`--web` 不能与 `--no-browser`、`--use-env`、`--password` 或 `--token` 混用。非交互环境未选择浏览器且没有完整凭证时，会报错而不等待终端输入。

### 环境变量

`zentao-cli` 支持从环境变量中读取禅道服务地址、用户账号和密码或 Token。业务命令按 `--profile`、完整环境凭证、当前本地登录记录的顺序选择身份；不完整环境凭据会报错；`zentao login` 则通过 `--use-env` 显式选择环境变量登录。

使用完整环境凭证执行业务命令时，不读取或写入本地 Profile，也不改变本地默认账号。即使配置文件缺失、损坏或不可访问，也可以运行。此时使用 CLI 默认配置，可通过 `--timeout`、`--insecure`、`--format` 等命令行选项覆盖，不继承本地 Profile 的配置。

需要使用环境变量重新验证并保存登录记录时，执行 `zentao login --use-env`。

支持如下环境变量：

* `ZENTAO_URL`：禅道服务地址
* `ZENTAO_ACCOUNT`：用户账号
* `ZENTAO_PASSWORD`：密码
* `ZENTAO_TOKEN`：Token，同时提供密码时优先使用 Token

### 账户切换

`zentao login` 登录并选择当前账号；`zentao auth login` 默认只保存凭据，显式添加 `--select` 才选择账号。两种入口均支持 `--web --no-open`，供宿主打开输出的登录链接。

```bash
zentao profile list
zentao profile use 'dev1@https://zentao.example.com'
zentao auth status --format=json
zentao auth status --verify --format=json
```

`auth status` 只读显示实际认证来源、站点、账号、凭据类型和配置路径，不显示 Token 或密码；`--verify` 才联网验证。完整环境凭据不读取本地 Profile，部分环境凭据会报错。`--profile <key>` 仅选择本次命令的身份，不改变默认账号。

### 获取 Token

使用 `zentao token [profileKey]` 读取已登录账号保存的 Token。省略 `profileKey` 时使用当前账号；指定账号时沿用 `profile` 的查找规则，支持完整的 `account@server`、账号名或 `account@主机名`。读取过程不联网验证或刷新，返回的 Token 可能已经过期。

```bash
# 读取当前账号的 Token
zentao token

# 读取指定账号的 Token，不切换当前账号
zentao token 'admin@https://zentao.example.com'

# 通过账号密码临时获取新 Token
zentao token --server https://zentao.example.com --user admin --password '<password>'

# 简写参数，并输出结构化结果
zentao token -s https://zentao.example.com -u admin -p '<password>' --format json
```

临时获取必须同时提供 `--server`、`--user`、`--password`（简写 `-s`、`-u`、`-p`），不能与 `profileKey` 混用。命令只调用登录接口，不查询用户资料或服务端配置，不读取或写入本地 Profile；配置文件缺失、损坏或只读时也可使用。网络请求支持全局 `--timeout` 和 `--insecure`。

两种方式都不修改 CLI 配置、更新时间戳或切换当前账号。读取保存的 Token 时遵循 `--config`、`ZENTAO_CONFIG_FILE` 和默认配置路径；认证环境变量 `ZENTAO_URL`、`ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD`、`ZENTAO_TOKEN` 不参与本命令的凭证选择。参数不完整时直接报错，不打开浏览器或交互询问密码。

默认及 `--format markdown` 只输出 Token 和一个换行，不带标签或颜色；`--format json` 和 `--format raw` 输出包含 `status`（`success`）、`server`、`account`、`token` 的 JSON 对象。`--silent` 抑制成功输出，错误仍写入标准错误流并返回非零退出码。无可用当前 Token 返回 `E1006`，指定 Profile 不存在返回 `E1007`，临时凭证不完整返回 `E1001`，两种模式混用返回 `E2009`。

### 退出登录

使用 `zentao logout` 可退出当前用户，同时移除当前配置文件中的对应用户信息。

```bash
# 退出当前用户
$ zentao logout

# 退出指定用户
$ zentao logout dev1@https://zentao.example.com
```

### 自定义配置文件

配置文件按以下优先级选择，所有读写均作用于选中的文件：

1. 全局选项 `--config <config_file>`。
2. 环境变量 `ZENTAO_CONFIG_FILE`。
3. `XDG_CONFIG_HOME` 为绝对路径时，使用 `$XDG_CONFIG_HOME/zentao/zentao.json`。
4. `XDG_CONFIG_HOME` 未设置、为空或为相对路径时，使用 `~/.config/zentao/zentao.json`。

未设置 XDG 时，原有配置路径保持不变。显式设置 XDG 后不会迁移、覆盖或回退读取旧路径；如需继续使用旧配置，可指定 `--config "$HOME/.config/zentao/zentao.json"`。这能避免新目录尚未登录时意外使用另一个目录中的账号。XDG 路径中的 `~` 不会展开，应使用如 `XDG_CONFIG_HOME="$HOME/work/config"` 的绝对路径。

`completion` 将补全脚本写入 stdout，由调用方选择保存路径；`--config` 和 `ZENTAO_CONFIG_FILE` 仅改变账号配置文件的位置。

使用已保存的 Profile 执行业务命令时，不会更新最近使用时间、重写配置文件或修改文件权限，因此配置文件及其所在目录可以只读。登录、退出、切换账号和修改配置仍需写入权限；在支持 POSIX 权限的平台上，写入后的配置文件权限为 `0600`（仅当前用户可读写），新建配置目录权限为 `0700`。

保存或删除 Profile 时，账号列表与当前账号会在一次原子写入中更新，避免出现只更新其中一项的中间状态。

配置读取失败返回 `E1005`；使用 `--format=json` 时，`error.details.reason` 区分 `invalid_json`（JSON 格式错误）、`invalid_structure`（配置结构错误）和 `unreadable`（文件无法读取）。配置写入失败返回 `E1011`，原系统错误码（如 `EACCES`）放在 `error.details.systemCode`，错误信息不包含凭据内容。缺失的配置文件仍视为尚未配置；损坏的文件不会自动清空或覆盖。

```bash
# 通过 --config 选项使用自定义配置文件
$ zentao --config /path/to/zt.json profile list

# 通过环境变量指定（便于在 shell 中持久设置）
$ ZENTAO_CONFIG_FILE=~/work/zt.json zentao product list
```

路径支持 `~` 展开与相对路径（相对当前工作目录）。当 `--config` 与 `ZENTAO_CONFIG_FILE` 同时存在时，`--config` 优先。

## MCP 服务

`zentao mcp` 提供 stdio 和 HTTP 两种传输方式，共用业务工具、参数校验和返回格式。

- **本地 stdio 模式**：由 Agent 在本机启动 CLI 进程，使用本机登录的账号，见下文。
- **远程 HTTP 模式**：由公司管理员统一部署 `zentao mcp-server`，用户在 Agent 中配置服务地址和个人 Token。部署见[禅道 MCP 服务部署指南](mcp-server.md)，用户接入见[在 Agent 中接入禅道 MCP 服务](mcp-user-guide.md)。

### 本地 stdio 模式

```bash
zentao mcp
zentao mcp --transport stdio
zentao --config ./zentao.json mcp --read-only --modules product,story,task,bug
```

stdio 是默认模式，由 MCP 客户端启动并管理进程。通过 `zentao login` 保存本地账号，或在客户端启动配置中提供 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 与 `ZENTAO_TOKEN`/`ZENTAO_PASSWORD`。`zentao add-mcp` 只生成这种本地配置；HTTP 客户端需要手动配置。

`zentao add-mcp` 复用当前 Profile 中的 Token，写入如下配置：

```json
{
  "mcpServers": {
    "zentao-cli": {
      "command": "zentao",
      "args": ["mcp", "serve"],
      "env": {
        "ZENTAO_URL": "https://zentao.example.com",
        "ZENTAO_ACCOUNT": "admin",
        "ZENTAO_TOKEN": "<your-token>"
      }
    }
  }
}
```

在 macOS/Linux 上，写入的 Agent 配置文件权限会收紧为 `0600`。手动配置时也应避免写入账号密码，并限制配置文件的访问权限。包含注释或尾逗号的 JSONC 配置不会被自动重写，命令会保持原文件不变并提示手动配置。

stdio 在首次业务调用时绑定账号和站点，环境凭证不会写入本地 Profile。`zentao_switch_profile` 只切换当前 stdio MCP 实例，不改变 CLI 或其他实例的当前账号；在 CLI 中切换账号也不会改变已运行的实例。显式选择的本地 Profile 会读取同一账号的 Token 和配置更新，删除该 Profile 后后续调用会报错。

stdio 的 `zentao_profile` 返回绑定的 `account`、`server`、远端详情 `user` 和 `userFound`。详情按账号过滤并按需翻页，仅返回 ID、账号、姓名、部门、角色；未找到时 `user=null`、`userFound=false`。远端权限、Token 或业务错误会明确报错。

### 远程 HTTP 模式

```bash
zentao mcp-server https://zentao.example.com
zentao mcp --transport http --url https://zentao.example.com
```

`zentao mcp-server [url]` 固定使用 HTTP，与 `zentao mcp --transport http` 等价，不接受 `--transport`。`--url`、`--host`、`--port` 只适用于 HTTP 模式，在 stdio 模式下使用会报 `E2009`；`--read-only`、`--modules`、`--split-tools` 在两种模式下均可使用。HTTP 模式的完整说明见：

- [启动参数](mcp-server.md#1-安装并试运行)：站点地址、监听地址和端口、`--timeout`、`--insecure`
- [配置 HTTPS 反向代理](mcp-server.md#3-配置-https-反向代理)：Nginx 示例、路径前缀和多实例部署
- [手动配置 Agent](mcp-user-guide.md#手动配置-agent)：Claude Code、Cursor、Codex 等客户端的配置格式
- [HTTP MCP 的请求隔离](implementation.md#http-mcp-的请求隔离)：接口列表、请求限制，以及与 stdio 模式的区别

### 共用工具与返回格式

`zentao_action_help` 接受 `module` 和 `action`，查询路径、必填参数、参数类型、`minVersion` 和调用示例，例如 `{"module":"doc","action":"createMyDoc"}`。查询帮助不调用禅道，也不需要本地登录；HTTP 请求仍须携带 Token 头。示例中的占位 ID 和文本需替换为实际值；`available` 表示当前启动选项是否开放该操作。

`--read-only` 只开放查询工具，并在执行入口校验允许的动作；stdio 账号切换工具也不注册。`--modules product,story,task` 只注册指定业务模块，未知或空模块名会报错。`--split-tools` 按模块拆为 `_read` / `_write`，例如 `zentao_task_read` 和 `zentao_task_write`，不存在对应动作的分组不注册；默认使用 `zentao_task` 等工具名。三个选项可以组合使用，开放范围在进程启动时固定；禅道仍按账号权限授权。

业务参数使用 `params` 中的正式名称，例如任务列表 `{"action":"list","params":{"executionID":3}}`。`id`、`product`、`project`、`execution` 是按动作定义映射的数字 ID 简写，与正式参数冲突时会报错。数组字段不使用数字简写，例如创建代码库用 `{"action":"create","params":{"space":10,"product":[12,13],"name":"demo_repo"}}`。请求体直接使用 JSON 对象；MCP 不读取 CLI 管道或 `@-` 输入。

MCP 发送请求前按动作定义检查必填字段、JSON 类型、明确枚举和未知参数，以及已声明的整数、数值范围、字符串长度/格式、数组长度和元素类型。路径 ID 使用非负整数，`page` 从 1 开始，`recPerPage` 范围为 1–1000；业务字段仍按自身定义处理，例如预计工时允许小数、根模块允许 0。更新时可由详情自动补齐的请求体字段允许省略。权限和字段间业务规则由服务端校验。

所有工具都声明 `outputSchema`，成功时通过 `structuredContent.data` 返回数据；列表还包含 `pager` 和 `meta`。文本结果保留原有 JSON 形态（列表带 `data`，详情直接返回对象）。业务错误设置 `isError=true` 并返回 `structuredContent.error`，包含 `code`、`message` 及适用的 `module`、`action`；协议和顶层 schema 校验错误由 MCP SDK 返回。

`filter`、`search`、`sort` 仅处理当前页。列表的 `meta.processingScope="page"`、`meta.returnedCount` 表示实际返回条数；`pager.recTotal` 是远端总数，`meta.totalScope="serverBeforeLocalProcessing"` 表明总数未经过本地筛选。跨页筛选需使用操作支持的 `params.filters` 等服务端参数，并逐页请求。

## 禅道数据访问和操作

### API 覆盖与版本兼容

CLI 使用 `zentao-api 0.8.4` 的注册表，提供 42 个模块、361 个操作，覆盖问题（`issue`）、风险（`risk`）、会议（`meeting`）、工作流（`workflow`）、文档（`doc`）、待办（`todo`）、地盘（`my`）和代码库（`repo`）等模块，并支持项目集/项目/执行下的关联列表、需求层级、附件上传和 Markdown 文档正文。

SDK 0.8.2 修正了 `story`、`requirement`、`epic` 的 `create` / `change`：未提供有效评审人时发送 `needNotReview: "1"`，状态默认 `active`；显式传入的非空状态会保留，空字符串仍回落为 `active`。提供有效评审人时状态为 `reviewing`，优先于显式状态。CLI 支持 `--status=draft` 或 `--data '{"status":"draft"}'`；MCP 使用 `params.status` 或 `params.data.status`。`change` 不会自动读取并保留原状态，需要保留草稿时应明确传入 `draft`。

SDK 0.8.0 按禅道 22.7 调整了地盘（`my`）列表的 `browseType` 默认值和可选值，例如任务与 Bug 默认 `assignedTo`（区分大小写），项目默认 `doing`。依赖旧筛选范围的脚本应查看对应操作的 `--help`，显式传入受支持的值。

SDK 0.8.1 的解除关联改为 `zentao relation unlink 8 --yes`，请求 `DELETE /relations/8`。从 `relation list` 的结果中选择 `relationType=custom` 的关系，读取其 `relationID`；这个值是关系记录 ID，不是关联对象 ID 或 `relationKey`。此动作的位置目标表示 `relationID`。旧的 `objectType`、`objectID`、`relatedObjectType`、`relatedObjectID`、`relationName` 参数会被拒绝，脚本需显式迁移。

新增 `zentao deliverable options --project-id=2 --format=json`，返回可提交的交付物定义 ID 到名称的映射对象，不分页；已提交交付物仍通过 `deliverable list` 查询分页数组。列表新增 `wait`（未提交）、`mine`（我提交）、`reviewing`（评审中）筛选；`normal` 默认值表示已提交，`pending` 表示待评审，`submitbyme` 表示由我发起。详情中的 `docInfo` 按字符串处理。地盘十个搜索接口的 `param` 和待办的 `status` 参数继续保留。

每个操作都带有最低禅道版本要求。常见版本基线如下，具体以操作帮助为准：

| 操作 | 开源版 | 企业版 | 旗舰版 | IPD 版 |
| --- | --- | --- | --- | --- |
| 原有操作 | 22.0 | biz13.0 | max8.0 | ipd5.0 |
| 22.5 扩展操作 | 22.5 | biz13.5 | max8.5 | ipd5.5 |
| 22.7 扩展操作（如 `repo list`） | 22.7 | biz13.7 | max8.7 | ipd5.7 |

版本只在同一系列内比较，未列出的系列不受支持。目前支持点分数字正式版本，不接受 alpha、beta、rc 等后缀。

登录和业务请求通过 SDK 获取站点根地址的 `?mode=getconfig`，配置请求不携带 Token。SDK 在同一客户端内缓存配置最多 24 小时；普通 CLI 命令各自启动进程，stdio MCP 和批量操作会复用客户端缓存，切换账户后使用目标服务器的配置。HTTP MCP 为每个请求创建独立客户端。CLI 的登录记录不用于跳过版本检查。

配置获取失败默认中止调用；版本不足时返回 `E2010`，提示操作、当前版本和最低版本，更新操作的自动补全预读也不会执行。版本格式错误返回 `E2011`，配置缺少有效版本字段返回 `E2012`。`raw` 输出同样执行版本检查。

帮助和自动补全在未登录时仍可使用，并列出完整注册表；CLI 帮助和 MCP 的 `zentao_action_help` 展示最低版本要求，执行时以实际服务器版本为准。

```bash
# 不需要对象 ID 的命名列表
zentao story get-grades
zentao my tasks --fields=id,name,status

# 直接查询项目下的执行
zentao execution project-executions --project-id=5 --browse-type=all

# 创建 Markdown 文档：多个路径 ID 必须分别传入
zentao doc create-my-doc --space-id=1 --lib-id=2 --data '{"title":"开发说明","content":"# 开发说明","contentType":"doc"}'

# 修改文档库，自动从同一路径的详情接口补全已有字段
zentao doc update-lib --lib-id=2 --name=开发文档

# SDK 自动按 multipart/form-data 上传本地文件（默认上限 50 MiB）
zentao file create --file=/path/to/screenshot.png --object-type=bug --object-id=1

# 查看路径、查询、请求体参数和最低版本
zentao doc create-my-doc --help
```

首个位置参数是首个路径目标的简写，其他路径参数使用各自的 kebab-case 选项。`doc`、`my` 等没有默认 `list` 的模块，在省略操作时会显示帮助。命名的列表、详情、创建、更新和删除操作遵循各自的类型，删除操作仍需确认或显式 `--yes`。

<a id="usage"></a>
## 命令格式与传参

开发分支的新命令契约（2026-10-23）。这是不兼容调整，尚未发布；安装版本不同请以本机 `--help` 为准。

```bash
zentao <resource> <action> [target] [options]
zentao bug list --product 12
zentao bug get 123
zentao bug resolve 123 --resolution fixed
zentao db table zt_user
zentao help bug create --format=json
```

资源名称沿用 SDK，动作和选项使用 kebab-case，例如 `doc create-my-doc --space-id 1 --lib-id 2`。无动作时只显示帮助。根级 CRUD、`do`、隐式 list/get、`--id`、`--params`、位置 JSON 已移除。

- `--title 内容` 与 `--title=内容` 等价。字符串 `007`、`true` 保留原文。
- 数字、布尔和数组按当前动作的 schema 校验；`--count` / `--no-count` 或 `--count=false` 明确设置布尔值。
- 简单数组可重复选项（`--lib-ids 12 --lib-ids 18`），复杂数组使用 JSON。JSON 内保留 SDK 字段名和类型。
- 请求体使用 `--data '{"title":"示例"}'`、`--data @body.json` 或显式 `--data @-`。没有 `@-` 就不读取 stdin；POST 查询也遵守同一规则。
- 与全局或输出选项重名的业务字段加 `data-` 前缀，例如 `task update 123 --data-deadline 2026-10-30` 和工作流的 `--data-fields`；JSON 字段名保持原样。
- 未知字段、非法值、重复来源冲突和多个范围会在认证之前失败。省略、空字符串与 null 不混同；null 仅在 schema 允许时有效。
- `--ids 123,124` 仅用于支持批量的对象操作，与单个目标互斥，先校验全部 ID 再去重。创建多条记录请显式逐条调用 create，不将对象 ID 当成批量创建输入。
- 删除需要确认；非交互调用必须 `--yes`。批量部分失败会保留逐项结果并返回非零退出码；`--batch-fail-fast` 跳过后续项，不回滚。
- 更新只自动补全动作声明的可写字段，存在匹配详情操作时才生效。

<a id="examples"></a>
## 常用示例

```bash
zentao auth login --web
zentao profile list
zentao profile use 'admin@https://zentao.example.com'
zentao auth status --verify --format=json
zentao --profile 'admin@https://zentao.example.com' product list --page-size 20
zentao bug create --product 12 --title '登录失败' --opened-build trunk
cat query.json | zentao db query --data @- --format=json
zentao knowledge search --keywords 登录 --keywords 超时 --lib-ids 12 --page 2
zentao bug resolve --ids 123,124 --resolution fixed --format=json
zentao bug delete --ids 123,124 --yes --no-input --format=json
zentao config set timeout 30000
zentao config unset timeout
zentao completion zsh > ~/.zentao-completion.zsh
zentao skill install codex
zentao skill export ./exported-skills
zentao mcp install codex
zentao mcp serve --read-only --modules product,story,task,bug
zentao mcp serve --transport http --url https://zentao.example.com
```

<a id="data-options"></a>
## 分页与输出

默认只取一页。支持分页的动作才有 `--page`、`--page-size` 和 `--all`；`--all` 与 `--page` 互斥。`--max-items` 限制最终结果数量，服务端原生 `limit` 不再用于本地截断。SQL 查询的 `--page-size` 映射到请求体 limit；向量搜索的 `--limit` 仍是服务器字段。

`--filter`、`--search` 和 `--sort` 只处理已获取的范围：默认当前页，`--all` 时为全部页面。全量抓取后统一处理，再按 `--max-items` 截断。复杂处理也可通过 JSON 管道交给 jq。服务端遗漏分页信息、返回重复页或空页却宣称还有数据时，`--all` 报错，避免虚报完整结果。

- `table`：默认终端精简列，长值以 `…` 标记截断；`--fields` 自定义字段。
- `markdown`：文档表格或详情，保留完整文本。
- `json`：稳定封装 `{ok,data,meta}`，保留原始字段类型及 HTML；需要转换时显式加 `--html-to-markdown`。
- `raw`：原始业务响应，拒绝批量、字段摘取、本地处理和自动翻页；内置命令仅 `token` 保留原有 JSON/raw Token 输出。

列表 meta 包含 returned、fetched、page、pageSize、total、hasMore、truncated、processingScope。total 是服务器处理前的总数；未知值为 null。过滤后空页仍保留 hasMore。批量 data 为逐项 objectID/ok/data/error，meta 为成功、失败与跳过数量。

<a id="errors"></a>
## 身份、交互与错误

认证优先级：`--profile` → 完整环境凭据 → 保存的默认账号。不完整的环境凭据直接报错；同账号或同主机简写存在多个匹配时必须使用完整 key。

`auth login` 默认只保存凭据，不改变默认身份；使用 `profile use` 或登录时显式添加 `--select` 选择身份。宿主负责打开链接时使用 `auth login --web --no-open --select`。普通业务调用和 `auth status` 默认不修改配置；`auth status --verify` 使用已有 Token 时通过一次当前用户会话查询在线验证。

`auth logout --revoke` 先撤销远端会话，并核实 Token 已失效，再删除本地记录；失败时保留记录以便重试。加上 `--all` 会处理当前配置文件中的全部账号，未登录时也成功。配置写入以短事务串行化，只更新目标字段，网络等待不占锁；并发重新登录的 Token 不会被旧登出请求删除。进程被强制终止后如遗留 `.lock` 目录，先确认没有 CLI 写入进程，再删除该锁目录后重试。

stdout 用于结果和批量报告；stderr 用于进度、诊断和无法产生结果的错误。JSON 模式的参数错误也是 `{ok:false,error}`。退出码：0 成功、1 执行失败、2 用法错误、130 取消。

`--no-input` 禁止浏览器和所有提示；`--yes` 只确认明确操作；`--quiet` 压制进度，保留结果和错误。`--color auto|always|never` 独立控制终端颜色。`--timeout` 限制单个请求，`--deadline` 限制整次命令，包括登录、预取与执行。

MCP 保留 structuredContent/outputSchema 与执行时策略检查。知识 POST 搜索可供只读工具使用；SQL 查询保守地留在写工具组。HTTP MCP 不发现或执行本地文件上传；stdio 可上传。取消涵盖认证和业务调用，取消一个并发调用不会终止其他调用。


## 操作来源标记

CLI 默认通过 `ZenTao-Action-Assistant` 请求头发送 `CLI <zentao-cli VERSION>`，供支持该功能的禅道服务端记录操作来源；VERSION 为实际 CLI 版本。stdio MCP 和 HTTP MCP 分别使用 `AI <zentao-cli VERSION, mcp: stdio>` 和 `AI <zentao-cli VERSION, mcp: http>`。

```bash
# 自定义一次命令的标记，覆盖默认值
zentao --assistant 'AI <codex 0.164.0, model: gpt-6.1-sol>' product list
# 本次关闭；也支持 --assistant=
zentao --assistant '' product list
# 关闭当前 profile 的自动标记；unset 恢复默认开启
zentao config set autoAssistant false
zentao config unset autoAssistant
```

示例中的 Agent 版本和模型须替换为已确认的信息，未知项省略。自定义标记不追加默认内容，不编码或截断，须符合原生 HTTP 请求头限制；中文等非 Latin-1 字符或非法换行会在认证前报 `E2009`。

优先级为 **MCP 工具单次 `assistant` → 命令行 `--assistant` → profile 的 `autoAssistant` → 入口默认值**。每一层的空字符串都表示关闭；profile 关闭自动标记后，显式非空标记仍可生效。自定义标记仅在运行时有效，不保存到 profile，也不会进入业务请求体。

一次 CLI 命令中的登录、在线验证、撤销、上传、分页、批量和内部预读沿用有效标记，匿名服务配置探测不携带。完整环境凭据、显式登录和临时 Token 使用运行时选项及默认值，不读取本地 profile 的开关。

MCP 业务工具（含 `_read`/`_write`）和 `zentao_profile` 接受顶层 `assistant` 字符串，省略继承服务设置，空字符串关闭。stdio 会随已选 profile 的切换和配置变化刷新默认标记；共享的环境密码登录使用服务默认标记，逐次覆盖用于该次工具的业务请求及内部请求。HTTP 不读取本地 profile，服务默认标记可在启动时覆盖，例如 `zentao --assistant '' mcp-server https://zentao.example.com`；工具参数仍可逐次覆盖。

## 配置、版本与补全

`config list` 列出全部配置，`config get <key>` 读取单项，`config set <key> <value>` 修改，`config unset <key>` 恢复默认值。`version` 离线显示 CLI、SDK 与运行时版本。

```bash
zentao config list
zentao config set defaultOutputFormat json
zentao completion zsh > ~/.zentao-completion.zsh
source ~/.zentao-completion.zsh
```
