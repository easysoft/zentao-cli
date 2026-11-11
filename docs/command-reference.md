# 命令、参数与用法参考

<a id="usage"></a>
## 命令格式与传参

当前源码使用显式命令契约，尚未发布；已安装的 0.4.3 请以本机 `--help` 为准。

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

`login` / `logout` 保留根级入口，`login` 默认选中账号。`token` 保留纯文本和 JSON/raw 输出，`mcp` 直接启动服务，`mcp-server` 保留 HTTP 快捷入口；`mcp serve` / `mcp install` 同样可用。

MCP 保留 structuredContent/outputSchema 与执行时策略检查。知识 POST 搜索可供只读工具使用；SQL 查询保守地留在写工具组。HTTP MCP 不发现或执行本地文件上传；stdio 可上传。取消涵盖认证和业务调用，取消一个并发调用不会终止其他调用。

<a id="review-summary"></a>
## 优化交付与手动验收

本分支逐项实施引用聊天中的批量、输入、命令树、分页、输出、身份、交互、MCP 和发现机制建议。详见 [实施记录](optimization-progress.md) 与 [HTML 验收报告](optimization-report.html)。报告会区分本地验证、真实测试环境结果和服务器能力限制。

<!-- BEGIN GENERATED COMMAND REFERENCE -->

<a id="coverage"></a>

## 覆盖范围

开发版本 CLI **0.4.3** / SDK **0.8.5**，14 个内置一级命令、42 个模块、361 个业务动作。数量、参数和实际 Commander 命令来自同一注册表。

<a id="global-options"></a>

## 全局选项

| 选项 | 说明 |
| --- | --- |
| -V, --version | 显示 CLI 版本号 |
| --format &lt;format&gt; | 输出格式 |
| --profile &lt;key&gt; | 仅本次命令选择账号（优先于环境凭据） |
| --config &lt;file&gt; | 配置文件路径（也支持 ZENTAO_CONFIG_FILE） |
| --no-input | 禁止浏览器、输入提示和选择菜单 |
| -y, --yes | 确认操作，不补全缺失参数 |
| --quiet | 压制进度和提示，保留结果和错误 |
| --color &lt;mode&gt; | 颜色控制 |
| --insecure | 跳过 TLS 证书验证 |
| --timeout &lt;ms&gt; | 单次 HTTP 请求超时 |
| --deadline &lt;ms&gt; | 整次命令期限，含认证和预取 |

环境变量：ZENTAO_URL、ZENTAO_ACCOUNT、ZENTAO_TOKEN 或 ZENTAO_PASSWORD；配置路径 --config → ZENTAO_CONFIG_FILE → 绝对路径 XDG_CONFIG_HOME/zentao/zentao.json → ~/.config/zentao/zentao.json。完整环境凭据不读取本地账号。

<a id="configuration"></a>

## 配置项默认值

| 配置项 | 默认值 |
| --- | --- |
| defaultOutputFormat | "table" |
| defaultRecPerPage | 20 |
| insecure | false |
| timeout | 10000 |
| htmlToMarkdown | true |
| batchFailFast | false |
| pagers | {} |
| jsonPretty | false |

<a id="command-help"></a>

## zentao help

```text
Usage: zentao help [options] [command] [action]

离线文本或 JSON 命令定义

Options:
  -h, --help  显示命令帮助
```

<a id="command-login"></a>

## zentao login

```text
Usage: zentao login [options]

登录禅道服务

Options:
  -s, --server <url>         禅道服务地址
  -u, --user <account>       用户名
  -p, --password <password>  密码
  -t, --token <token>        Token
  --use-env                  强制使用环境变量登录
  --web                      通过本机浏览器页面登录
  --no-open                  仅输出浏览器登录链接，由调用方打开（需 --web）
  --select                   登录成功后将该账号设为当前配置 (default: true)
  --message <text>           自定义浏览器登录页面的副标题提示语
  --no-browser               使用终端交互登录，不打开浏览器
  -h, --help                 显示命令帮助
```

<a id="command-logout"></a>

## zentao logout

```text
Usage: zentao logout [options] [key]

删除本地登录记录

Options:
  --all       清理选定配置文件中的全部账号；空配置也成功
  --revoke    先撤销并验证远端会话；失败时保留该账号以便重试
  -h, --help  显示命令帮助
```

<a id="command-token"></a>

## zentao token

```text
Usage: zentao token [options] [profileKey]

获取 Token（默认输出纯文本，不保存配置）

Arguments:
  profileKey                 已登录的用户配置（account@server，省略时使用当前账号）

Options:
  -s, --server <url>         临时获取 Token 的禅道服务地址
  -u, --user <account>       临时获取 Token 的用户名
  -p, --password <password>  临时获取 Token 的密码
  --silent                   不输出 Token，错误仍写入 stderr
  -h, --help                 显示命令帮助
```

<a id="command-auth"></a>

## zentao auth

```text
Usage: zentao auth [options] [command]

认证与凭据

Options:
  -h, --help              显示命令帮助

Commands:
  login [options]         登录禅道服务
  logout [options] [key]  删除本地登录记录
  status [options]        显示认证来源；默认离线
```

<a id="command-auth-login"></a>

## zentao auth login

```text
Usage: zentao auth login [options]

登录禅道服务

Options:
  -s, --server <url>         禅道服务地址
  -u, --user <account>       用户名
  -p, --password <password>  密码
  -t, --token <token>        Token
  --use-env                  强制使用环境变量登录
  --web                      通过本机浏览器页面登录
  --no-open                  仅输出浏览器登录链接，由调用方打开（需 --web）
  --select                   登录成功后将该账号设为当前配置
  --message <text>           自定义浏览器登录页面的副标题提示语
  --no-browser               使用终端交互登录，不打开浏览器
  -h, --help                 显示命令帮助
```

<a id="command-auth-logout"></a>

## zentao auth logout

```text
Usage: zentao auth logout [options] [key]

删除本地登录记录

Options:
  --all       清理选定配置文件中的全部账号；空配置也成功
  --revoke    先撤销并验证远端会话；失败时保留该账号以便重试
  -h, --help  显示命令帮助
```

<a id="command-auth-status"></a>

## zentao auth status

```text
Usage: zentao auth status [options]

显示认证来源；默认离线

Options:
  --verify    连接服务器验证凭据
  -h, --help  显示命令帮助
```

<a id="command-profile"></a>

## zentao profile

```text
Usage: zentao profile [options] [command]

管理已保存账号；use 才改变默认身份

Options:
  -h, --help    显示命令帮助

Commands:
  list          列出已保存账号
  show [key]    查看账号，不验证凭据
  use <key>     设置默认身份
  remove <key>  删除本地账号记录
```

<a id="command-profile-list"></a>

## zentao profile list

```text
Usage: zentao profile list [options]

列出已保存账号

Options:
  -h, --help  显示命令帮助
```

<a id="command-profile-show"></a>

## zentao profile show

```text
Usage: zentao profile show [options] [key]

查看账号，不验证凭据

Arguments:
  key         完整 key 或唯一简写

Options:
  -h, --help  显示命令帮助
```

<a id="command-profile-use"></a>

## zentao profile use

```text
Usage: zentao profile use [options] <key>

设置默认身份

Options:
  -h, --help  显示命令帮助
```

<a id="command-profile-remove"></a>

## zentao profile remove

```text
Usage: zentao profile remove [options] <key>

删除本地账号记录

Options:
  -h, --help  显示命令帮助
```

<a id="command-config"></a>

## zentao config

```text
Usage: zentao config [options] [command]

查询配置来源并修改已保存账号的偏好

Options:
  -h, --help         显示命令帮助

Commands:
  path               显示配置文件路径
  list               列出有效配置及来源
  get <key>          查看一个配置项
  set <key> <value>  修改一个配置项
  unset <key>        恢复默认值
```

<a id="command-config-path"></a>

## zentao config path

```text
Usage: zentao config path [options]

显示配置文件路径

Options:
  -h, --help  显示命令帮助
```

<a id="command-config-list"></a>

## zentao config list

```text
Usage: zentao config list [options]

列出有效配置及来源

Options:
  -h, --help  显示命令帮助
```

<a id="command-config-get"></a>

## zentao config get

```text
Usage: zentao config get [options] <key>

查看一个配置项

Options:
  -h, --help  显示命令帮助
```

<a id="command-config-set"></a>

## zentao config set

```text
Usage: zentao config set [options] <key> <value>

修改一个配置项

Options:
  -h, --help  显示命令帮助
```

<a id="command-config-unset"></a>

## zentao config unset

```text
Usage: zentao config unset [options] <key>

恢复默认值

Options:
  -h, --help  显示命令帮助
```

<a id="command-version"></a>

## zentao version

```text
Usage: zentao version [options]

离线显示 CLI、SDK 和运行时版本

Options:
  -h, --help  显示命令帮助
```

<a id="command-completion"></a>

## zentao completion

```text
Usage: zentao completion [options] [command]

将补全脚本写入 stdout

Options:
  -h, --help  显示命令帮助

Commands:
  bash
  zsh
  fish
```

<a id="command-completion-bash"></a>

## zentao completion bash

```text
Usage: zentao completion bash [options]

Options:
  -h, --help  显示命令帮助
```

<a id="command-completion-zsh"></a>

## zentao completion zsh

```text
Usage: zentao completion zsh [options]

Options:
  -h, --help  显示命令帮助
```

<a id="command-completion-fish"></a>

## zentao completion fish

```text
Usage: zentao completion fish [options]

Options:
  -h, --help  显示命令帮助
```

<a id="command-skill"></a>

## zentao skill

```text
Usage: zentao skill [options] [command]

安装或导出技能

Options:
  -h, --help          显示命令帮助

Commands:
  install [agent]     安装技能到指定 Agent
  export <directory>  导出技能到指定目录
```

<a id="command-skill-install"></a>

## zentao skill install

```text
Usage: zentao skill install [options] [agent]

安装技能到指定 Agent

Arguments:
  agent       claude-code|cursor|cherry-studio|codex|opencode|vscode|antigravity|gemini|all

Options:
  -h, --help  显示命令帮助
```

<a id="command-skill-export"></a>

## zentao skill export

```text
Usage: zentao skill export [options] <directory>

导出技能到指定目录

Options:
  -h, --help  显示命令帮助
```

<a id="command-mcp"></a>

## zentao mcp

```text
Usage: zentao mcp [options] [command]

启动 MCP 服务，支持本地 stdio 或多客户端 HTTP 访问禅道数据

Options:
  --transport <type>  传输方式 (stdio|http) (default: "stdio")
  --host <host>       HTTP 监听地址（默认 127.0.0.1）
  --port <port>       HTTP 监听端口（默认 9090）
  --url <url>         HTTP 模式的固定禅道站点地址（亦可通过 ZENTAO_URL 设置）
  --read-only         仅提供查询工具，禁止业务写入和账号切换
  --modules <names>   仅提供指定业务模块（逗号分隔，如 product,story,task）
  --split-tools       按模块分为 _read 查询工具和 _write 写入工具
  -h, --help          显示命令帮助

Commands:
  serve [options]     启动 MCP 服务
  install [agent]     配置禅道 MCP 服务到 AI Agent
```

<a id="command-mcp-serve"></a>

## zentao mcp serve

```text
Usage: zentao mcp serve [options]

启动 MCP 服务

Options:
  --transport <type>  传输方式 (stdio|http) (default: "stdio")
  --host <host>       HTTP 监听地址（默认 127.0.0.1）
  --port <port>       HTTP 监听端口（默认 9090）
  --url <url>         HTTP 模式的固定禅道站点地址（亦可通过 ZENTAO_URL 设置）
  --read-only         仅提供查询工具，禁止业务写入和账号切换
  --modules <names>   仅提供指定业务模块（逗号分隔，如 product,story,task）
  --split-tools       按模块分为 _read 查询工具和 _write 写入工具
  -h, --help          显示命令帮助
```

<a id="command-mcp-install"></a>

## zentao mcp install

```text
Usage: zentao mcp install [options] [agent]

配置禅道 MCP 服务到 AI Agent

Arguments:
  agent       目标 Agent
              (cursor|claude-desktop|claude-code|windsurf|cline|trae|vscode|cherry-studio|opencode|codex|antigravity|gemini|all)

Options:
  -h, --help  显示命令帮助
```

<a id="command-mcp-server"></a>

## zentao mcp-server

```text
Usage: zentao mcp-server [options] [url]

启动 HTTP MCP 服务，供多个客户端访问固定禅道站点

Arguments:
  url                禅道站点地址，与 --url 二选一；省略时读取 ZENTAO_URL

Options:
  --host <host>      HTTP 监听地址（默认 127.0.0.1）
  --port <port>      HTTP 监听端口（默认 9090）
  --url <url>        HTTP 模式的固定禅道站点地址（亦可通过 ZENTAO_URL 设置）
  --read-only        仅提供查询工具，禁止业务写入和账号切换
  --modules <names>  仅提供指定业务模块（逗号分隔，如 product,story,task）
  --split-tools      按模块分为 _read 查询工具和 _write 写入工具
  -h, --help         显示命令帮助
```

<a id="command-add-mcp"></a>

## zentao add-mcp

```text
Usage: zentao add-mcp [options] [agent]

配置禅道 MCP 服务到 AI Agent

Arguments:
  agent       目标 Agent
              (cursor|claude-desktop|claude-code|windsurf|cline|trae|vscode|cherry-studio|opencode|codex|antigravity|gemini|all)

Options:
  -h, --help  显示命令帮助
```

<a id="command-self"></a>

## zentao self

```text
Usage: zentao self [options] [command]

管理本机 CLI 安装

Options:
  -h, --help        显示命令帮助

Commands:
  update [options]  检查并升级 CLI 到最新版本
```

<a id="command-self-update"></a>

## zentao self update

```text
Usage: zentao self update [options]

检查并升级 CLI 到最新版本

Options:
  -y, --yes   跳过确认，直接升级
  -h, --help  显示命令帮助
```

<a id="module-user"></a>

## 用户 · user

```text
Usage: zentao user [options] [command]

用户

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options]             获取用户列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  create [options]           创建用户（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]     获取用户详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改用户信息（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]  删除用户（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-user-list"></a>

## zentao user list

```text
Usage: zentao user list [options]

获取用户列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --browse-type <value>     浏览类型
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：realname(姓名，示例：admin)；email(邮箱，示例：关键字)；dept(部门，示例：all)；account(用户名，示例：admin)；role(职位，枚举：dev
                            研发 | qa 测试 | pm 项目经理 | po 产品经理 | td 研发主管 | pd 产品主管 |
                            qd 测试主管 | top 高层管理 | others
                            其他)；phone(电话，示例：关键字)；visions(界面类型，枚举：rnd 研发综合界面 |
                            lite
                            运营管理界面)；join(入职日期，示例：2026-01-01)；id(用户编号，示例：1)；commiter(源代码帐号，示例：all)；gender(性别，枚举：m
                            男 | f
                            女)；qq(QQ，示例：关键字)；skype(Skype，示例：关键字)；dingding(钉钉，示例：关键字)；weixin(微信，示例：关键字)；slack(Slack，示例：关键字)；whatsapp(WhatsApp，示例：关键字)；address(通讯地址，示例：关键字)；zipcode(邮编，示例：关键字)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 浏览类型<br>{"options":[{"value":"inside","label":"内部用户"},{"value":"outside","label":"内部用户"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"realname_asc","label":"姓名 升序"},{"value":"realname_desc","label":"姓名 降序"},{"value":"account_asc","label":"用户名 升序"},{"value":"account_desc","label":"用户名 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：realname(姓名，示例：admin)；email(邮箱，示例：关键字)；dept(部门，示例：all)；account(用户名，示例：admin)；role(职位，枚举：dev 研发 \| qa 测试 \| pm 项目经理 \| po 产品经理 \| td 研发主管 \| pd 产品主管 \| qd 测试主管 \| top 高层管理 \| others 其他)；phone(电话，示例：关键字)；visions(界面类型，枚举：rnd 研发综合界面 \| lite 运营管理界面)；join(入职日期，示例：2026-01-01)；id(用户编号，示例：1)；commiter(源代码帐号，示例：all)；gender(性别，枚举：m 男 \| f 女)；qq(QQ，示例：关键字)；skype(Skype，示例：关键字)；dingding(钉钉，示例：关键字)；weixin(微信，示例：关键字)；slack(Slack，示例：关键字)；whatsapp(WhatsApp，示例：关键字)；address(通讯地址，示例：关键字)；zipcode(邮编，示例：关键字)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-user-create"></a>

## zentao user create

```text
Usage: zentao user create [options]

创建用户（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --account <value>       登录名（必填）
  --realname <value>      姓名（必填）
  --password <value>      密码（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --account | account | body | string | 是 | — | 登录名<br>{} |
| --realname | realname | body | string | 是 | — | 姓名<br>{} |
| --password | password | body | string | 是 | — | 密码<br>{} |

<a id="action-user-get"></a>

## zentao user get

```text
Usage: zentao user get [options] [target]

获取用户详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 userID；也可使用命名参数

Options:
  --user-id <value>   用户ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --user-id | userID | path | integer | 是 | — | 用户ID<br>{} |

<a id="action-user-update"></a>

## zentao user update

```text
Usage: zentao user update [options] [target]

修改用户信息（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 userID；也可使用命名参数

Options:
  --user-id <value>       用户ID（必填）
  --realname <value>      真实姓名
  --dept <value>          部门
  --join <value>          入职日期
  --group <value>         权限分组
  --email <value>         邮箱
  --visions <value>       界面类型(研发综合界面 rnd | 运营管理界面 lite)
  --mobile <value>        手机
  --weixin <value>        微信
  --password <value>      密码
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --user-id | userID | path | integer | 是 | — | 用户ID<br>{} |
| --realname | realname | body | string | 否 | — | 真实姓名<br>{} |
| --dept | dept | body | integer | 否 | — | 部门<br>{"format":"int32"} |
| --join | join | body | string | 否 | — | 入职日期<br>{} |
| --group | group | body | array | 否 | — | 权限分组<br>{"items":{"type":"string"}} |
| --email | email | body | string | 否 | — | 邮箱<br>{} |
| --visions | visions | body | array | 否 | — | 界面类型(研发综合界面 rnd \| 运营管理界面 lite)<br>{"items":{"type":"string"}} |
| --mobile | mobile | body | string | 否 | — | 手机<br>{} |
| --weixin | weixin | body | string | 否 | — | 微信<br>{} |
| --password | password | body | string | 否 | — | 密码<br>{} |

<a id="action-user-delete"></a>

## zentao user delete

```text
Usage: zentao user delete [options] [target]

删除用户（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target             单个 userID；也可使用命名参数

Options:
  --user-id <value>  用户ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --user-id | userID | path | integer | 是 | — | 用户ID<br>{} |

<a id="module-program"></a>

## 项目集 · program

```text
Usage: zentao program [options] [command]

项目集

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options]             获取项目集列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  create [options]           创建项目集（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]     获取项目集详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改项目集（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]  删除项目集（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-program-list"></a>

## zentao program list

```text
Usage: zentao program list [options]

获取项目集列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --browse-type <value>     浏览类型
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：name(项目集名称，示例：关键字)；PM(负责人，用户，示例：admin)；openedDate(创建时间，示例：2026-01-01)；status(状态，枚举：wait
                            未开始 | doing 进行中 | suspended 已挂起 | closed
                            已关闭)；openedBy(创建者，用户，示例：admin)；begin(计划开始，示例：2026-01-01)；end(计划完成，示例：2026-01-01)；realBegan(实际开始，示例：2026-01-01)；realEnd(实际完成，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后编辑日期，示例：2026-01-01)；desc(项目集描述，示例：关键字)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 浏览类型<br>{"options":[{"value":"all","label":"全部"},{"value":"unclosed","label":"未关闭"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"},{"value":"suspended","label":"已挂起"},{"value":"delayed","label":"已延期"},{"value":"closed","label":"已关闭"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(项目集名称，示例：关键字)；PM(负责人，用户，示例：admin)；openedDate(创建时间，示例：2026-01-01)；status(状态，枚举：wait 未开始 \| doing 进行中 \| suspended 已挂起 \| closed 已关闭)；openedBy(创建者，用户，示例：admin)；begin(计划开始，示例：2026-01-01)；end(计划完成，示例：2026-01-01)；realBegan(实际开始，示例：2026-01-01)；realEnd(实际完成，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后编辑日期，示例：2026-01-01)；desc(项目集描述，示例：关键字)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-program-create"></a>

## zentao program create

```text
Usage: zentao program create [options]

创建项目集（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --name <value>          项目集名称（必填）
  --begin <value>         计划开始日期（必填）
  --end <value>           计划完成日期（必填）
  --pm <value>            计划完成日期
  --desc <value>          项目集描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 项目集名称<br>{} |
| --begin | begin | body | string | 是 | — | 计划开始日期<br>{} |
| --end | end | body | string | 是 | — | 计划完成日期<br>{} |
| --pm | PM | body | string | 否 | — | 计划完成日期<br>{} |
| --desc | desc | body | string | 否 | — | 项目集描述<br>{} |

<a id="action-program-get"></a>

## zentao program get

```text
Usage: zentao program get [options] [target]

获取项目集详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                单个 programID；也可使用命名参数

Options:
  --program-id <value>  项目集ID（必填）
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --fields <fields>     返回字段，逗号分隔
  --html-to-markdown    显式将富文本字段转换为 Markdown
  -h, --help            显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --program-id | programID | path | integer | 是 | — | 项目集ID<br>{} |

<a id="action-program-update"></a>

## zentao program update

```text
Usage: zentao program update [options] [target]

修改项目集（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 programID；也可使用命名参数

Options:
  --program-id <value>    项目集ID（必填）
  --name <value>          项目集名称（必填）
  --begin <value>         计划开始日期（必填）
  --end <value>           计划完成日期（必填）
  --pm <value>            计划完成日期
  --desc <value>          项目集描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --program-id | programID | path | integer | 是 | — | 项目集ID<br>{} |
| --name | name | body | string | 是 | — | 项目集名称<br>{} |
| --begin | begin | body | string | 是 | — | 计划开始日期<br>{} |
| --end | end | body | string | 是 | — | 计划完成日期<br>{} |
| --pm | PM | body | string | 否 | — | 计划完成日期<br>{} |
| --desc | desc | body | string | 否 | — | 项目集描述<br>{} |

<a id="action-program-delete"></a>

## zentao program delete

```text
Usage: zentao program delete [options] [target]

删除项目集（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                单个 programID；也可使用命名参数

Options:
  --program-id <value>  项目集ID（必填）
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --yes                 确认删除
  -h, --help            显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --program-id | programID | path | integer | 是 | — | 项目集ID<br>{} |

<a id="module-product"></a>

## 产品 · product

```text
Usage: zentao product [options] [command]

产品

Options:
  -h, --help                                 显示命令帮助

Commands:
  props                                      返回对象字段定义（离线）
  list [options]                             获取产品列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  program-products [options] [target]        获取项目集的产品列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create [options]                           创建产品（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]                   关闭产品（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-story-module [options] [target]     创建产品的需求模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-bug-module [options] [target]       创建产品的Bug模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-testcase-module [options] [target]  创建产品的用例模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get [options] [target]                     获取产品详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]                  修改产品（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]                  删除产品（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  repos [options] [target]                   获取产品关联的代码库列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-product-list"></a>

## zentao product list

```text
Usage: zentao product list [options]

获取产品列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --browse-type <value>     浏览类型
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 浏览类型<br>{"options":[{"value":"all","label":"全部"},{"value":"noclosed","label":"未关闭"},{"value":"closed","label":"已结束"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"名称 升序"},{"value":"title_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-product-program-products"></a>

## zentao product program-products

```text
Usage: zentao product program-products [options] [target]

获取项目集的产品列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 programID；也可使用命名参数

Options:
  --program-id <value>      项目集ID（必填）
  --browse-type <value>     状态，默认是noclosed
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --program-id | programID | path | integer | 是 | — | 项目集ID<br>{} |
| --browse-type | browseType | query | string | 否 | "noclosed" | 状态，默认是noclosed<br>{"options":[{"value":"all","label":"全部"},{"value":"noclosed","label":"未关闭"},{"value":"closed","label":"已结束"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-product-create"></a>

## zentao product create

```text
Usage: zentao product create [options]

创建产品（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --name <value>          产品名称（必填）
  --program <value>       所属项目集
  --line <value>          所属产品线
  --type <value>          类型(normal 正常 | branch 多分支 | platform 多平台)
  --po <value>            产品负责人
  --reviewer <value>      评审人
  --desc <value>          产品描述
  --qd <value>            测试负责人
  --rd <value>            发布负责人
  --acl <value>           访问控制(open 公开 | private 私有)
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 产品名称<br>{} |
| --program | program | body | integer | 否 | — | 所属项目集<br>{"format":"int32"} |
| --line | line | body | integer | 否 | — | 所属产品线<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 类型(normal 正常 \| branch 多分支 \| platform 多平台)<br>{} |
| --po | PO | body | string | 否 | — | 产品负责人<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人<br>{"items":{"type":"string"}} |
| --desc | desc | body | string | 否 | — | 产品描述<br>{} |
| --qd | QD | body | string | 否 | — | 测试负责人<br>{} |
| --rd | RD | body | string | 否 | — | 发布负责人<br>{} |
| --acl | acl | body | string | 否 | "open" | 访问控制(open 公开 \| private 私有)<br>{} |

<a id="action-product-close"></a>

## zentao product close

```text
Usage: zentao product close [options] [target]

关闭产品（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --comment <value>       备注
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-product-create-story-module"></a>

## zentao product create-story-module

```text
Usage: zentao product create-story-module [options] [target]

创建产品的需求模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --name <value>          模块名称
  --parent-id <value>     父模块
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-product-create-bug-module"></a>

## zentao product create-bug-module

```text
Usage: zentao product create-bug-module [options] [target]

创建产品的Bug模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --name <value>          模块名称
  --parent-id <value>     父模块
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-product-create-testcase-module"></a>

## zentao product create-testcase-module

```text
Usage: zentao product create-testcase-module [options] [target]

创建产品的用例模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --name <value>          模块名称
  --parent-id <value>     父模块
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-product-get"></a>

## zentao product get

```text
Usage: zentao product get [options] [target]

获取产品详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                单个 productID；也可使用命名参数

Options:
  --product-id <value>  产品ID（必填）
  --product <id>        productID 或 scope/scopeID 别名
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --fields <fields>     返回字段，逗号分隔
  --html-to-markdown    显式将富文本字段转换为 Markdown
  -h, --help            显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |

<a id="action-product-update"></a>

## zentao product update

```text
Usage: zentao product update [options] [target]

修改产品（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --name <value>          产品名称（必填）
  --program <value>       所属项目集
  --line <value>          所属产品线
  --type <value>          类型(normal 正常 | branch 多分支 | platform 多平台)
  --po <value>            产品负责人
  --reviewer <value>      评审人
  --desc <value>          产品描述
  --qd <value>            测试负责人
  --rd <value>            发布负责人
  --acl <value>           访问控制(open 公开 | private 私有)
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --name | name | body | string | 是 | — | 产品名称<br>{} |
| --program | program | body | integer | 否 | — | 所属项目集<br>{"format":"int32"} |
| --line | line | body | integer | 否 | — | 所属产品线<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 类型(normal 正常 \| branch 多分支 \| platform 多平台)<br>{} |
| --po | PO | body | string | 否 | — | 产品负责人<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人<br>{"items":{"type":"string"}} |
| --desc | desc | body | string | 否 | — | 产品描述<br>{} |
| --qd | QD | body | string | 否 | — | 测试负责人<br>{} |
| --rd | RD | body | string | 否 | — | 发布负责人<br>{} |
| --acl | acl | body | string | 否 | "open" | 访问控制(open 公开 \| private 私有)<br>{} |

<a id="action-product-delete"></a>

## zentao product delete

```text
Usage: zentao product delete [options] [target]

删除产品（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                单个 productID；也可使用命名参数

Options:
  --product-id <value>  产品ID（必填）
  --product <id>        productID 或 scope/scopeID 别名
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --yes                 确认删除
  -h, --help            显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |

<a id="action-product-repos"></a>

## zentao product repos

```text
Usage: zentao product repos [options] [target]

获取产品关联的代码库列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品 ID，正整数（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

需部署代码库 API 2.0 实现，具备 repo.browse 权限及产品访问权限。仅返回未删除、非导入中且当前用户可访问的代码库，不分页、不保证排序；url.http、url.ssh 可能缺省。产品不存在、已删除或不可访问时为业务失败。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品 ID，正整数<br>{} |

<a id="module-project"></a>

## 项目 · project

```text
Usage: zentao project [options] [command]

项目

Options:
  -h, --help                           显示命令帮助

Commands:
  props                                返回对象字段定义（离线）
  list [options]                       获取项目列表（最低版本：22.0 / biz13.0 / max8.0 /
                                       ipd5.0）
  program-projects [options] [target]  获取项目集的项目列表（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  team [options]                       获取项目团队列表（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  project-members [options] [target]   获取项目成员列表（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  create [options]                     创建项目（最低版本：22.0 / biz13.0 / max8.0 /
                                       ipd5.0）
  close [options] [target]             关闭项目（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  create-story [options] [target]      创建项目需求（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  create-bug [options] [target]        创建项目Bug（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  create-task [options] [target]       创建项目任务（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  create-risk [options] [target]       创建项目风险（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
  link-stories [options] [target]      项目关联需求（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
  update [options] [target]            修改项目（最低版本：22.0 / biz13.0 / max8.0 /
                                       ipd5.0）
  delete [options] [target]            删除项目（最低版本：22.0 / biz13.0 / max8.0 /
                                       ipd5.0）
  members [options] [target]           维护项目成员（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
```

<a id="action-project-list"></a>

## zentao project list

```text
Usage: zentao project list [options]

获取项目列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --browse-type <value>     项目状态，默认是undone
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：name(项目名称，示例：关键字)；code(项目代号，示例：关键字)；id(项目ID，示例：1)；model(项目管理方式，枚举：scrum
                            Scrum | waterfall 瀑布 | kanban 看板 | agileplus 融合敏捷 |
                            waterfallplus 融合瀑布)；hasProduct(项目类型，枚举：1 产品型 | 0
                            项目型)；parent(所属项目集，示例：all)；status(状态，枚举：wait 未开始 |
                            doing 进行中 | suspended 已挂起 | closed 已关闭 | delay
                            已延期)；desc(项目描述，示例：关键字)；PM(负责人，用户，示例：admin)；teamCount(人数，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；begin(计划开始，示例：2026-01-01)；end(计划完成，示例：2026-01-01)；realBegan(实际开始，示例：2026-01-01)；realEnd(实际完成，示例：2026-01-01)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedDate(最后编辑日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "undone" | 项目状态，默认是undone<br>{"options":[{"value":"all","label":"全部"},{"value":"undone","label":"未完成"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(项目名称，示例：关键字)；code(项目代号，示例：关键字)；id(项目ID，示例：1)；model(项目管理方式，枚举：scrum Scrum \| waterfall 瀑布 \| kanban 看板 \| agileplus 融合敏捷 \| waterfallplus 融合瀑布)；hasProduct(项目类型，枚举：1 产品型 \| 0 项目型)；parent(所属项目集，示例：all)；status(状态，枚举：wait 未开始 \| doing 进行中 \| suspended 已挂起 \| closed 已关闭 \| delay 已延期)；desc(项目描述，示例：关键字)；PM(负责人，用户，示例：admin)；teamCount(人数，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；begin(计划开始，示例：2026-01-01)；end(计划完成，示例：2026-01-01)；realBegan(实际开始，示例：2026-01-01)；realEnd(实际完成，示例：2026-01-01)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedDate(最后编辑日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-project-program-projects"></a>

## zentao project program-projects

```text
Usage: zentao project program-projects [options] [target]

获取项目集的项目列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 programID；也可使用命名参数

Options:
  --program-id <value>      项目集ID（必填）
  --browse-type <value>     项目状态，默认是undone
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --program-id | programID | path | integer | 是 | — | 项目集ID<br>{} |
| --browse-type | browseType | query | string | 否 | "undone" | 项目状态，默认是undone<br>{"options":[{"value":"all","label":"全部"},{"value":"undone","label":"未完成"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-project-team"></a>

## zentao project team

```text
Usage: zentao project team [options]

获取项目团队列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --project-id <value>      项目ID（必填）
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | query | number | 是 | — | 项目ID<br>{} |

<a id="action-project-project-members"></a>

## zentao project project-members

```text
Usage: zentao project project-members [options] [target]

获取项目成员列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |

<a id="action-project-create"></a>

## zentao project create

```text
Usage: zentao project create [options]

创建项目（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --name <value>            项目名称（必填）
  --model <value>           项目管理方式(scrum 敏捷 | waterfall 瀑布 | kanban 看板 |
                            agileplus 融合敏捷 | waterfallplus 融合瀑布)（必填）
  --begin <value>           开始日期（必填）
  --end <value>             结束日期（必填）
  --products <value>        关联产品
  --parent <value>          所属项目集
  --workflow-group <value>  项目流程，付费版功能，开源版可以不填（必填）
  --pm <value>              项目负责人
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 项目名称<br>{} |
| --model | model | body | string | 是 | — | 项目管理方式(scrum 敏捷 \| waterfall 瀑布 \| kanban 看板 \| agileplus 融合敏捷 \| waterfallplus 融合瀑布)<br>{} |
| --begin | begin | body | string | 是 | — | 开始日期<br>{} |
| --end | end | body | string | 是 | — | 结束日期<br>{} |
| --products | products | body | array | 否 | — | 关联产品<br>{"items":{"type":"string"}} |
| --parent | parent | body | integer | 否 | — | 所属项目集<br>{"format":"int32"} |
| --workflow-group | workflowGroup | body | integer | 是 | — | 项目流程，付费版功能，开源版可以不填<br>{"format":"int32"} |
| --pm | PM | body | string | 否 | — | 项目负责人<br>{} |

<a id="action-project-close"></a>

## zentao project close

```text
Usage: zentao project close [options] [target]

关闭项目（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --real-end <value>      实际完成日期（必填）
  --comment <value>       备注
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --real-end | realEnd | body | string | 是 | — | 实际完成日期<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-project-create-story"></a>

## zentao project create-story

```text
Usage: zentao project create-story [options] [target]

创建项目需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --product-id <value>    所属产品；项目型项目可不传，产品型项目必须传
  --title <value>         需求标题（必填）
  --spec <value>          需求描述
  --pri <value>           优先级
  --category <value>      类别
  --reviewer <value>      评审人
  --product <id>          productID 或 scope/scopeID 别名
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --product-id | productID | body | integer | 否 | — | 所属产品；项目型项目可不传，产品型项目必须传<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 需求标题<br>{} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --category | category | body | string | 否 | — | 类别<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人<br>{"items":{"type":"string"}} |

<a id="action-project-create-bug"></a>

## zentao project create-bug

```text
Usage: zentao project create-bug [options] [target]

创建项目Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --product-id <value>    所属产品；项目型项目可不传，产品型项目必须传
  --title <value>         Bug标题（必填）
  --opened-build <value>  影响版本，主干是trunk，其他版本使用版本ID（必填）
  --severity <value>      严重程度
  --pri <value>           优先级
  --type <value>          Bug类型
  --steps <value>         重现步骤
  --product <id>          productID 或 scope/scopeID 别名
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --product-id | productID | body | integer | 否 | — | 所属产品；项目型项目可不传，产品型项目必须传<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | Bug标题<br>{} |
| --opened-build | openedBuild | body | array | 是 | — | 影响版本，主干是trunk，其他版本使用版本ID<br>{"items":{"type":"string"}} |
| --severity | severity | body | integer | 否 | — | 严重程度<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | Bug类型<br>{} |
| --steps | steps | body | string | 否 | — | 重现步骤<br>{} |

<a id="action-project-create-task"></a>

## zentao project create-task

```text
Usage: zentao project create-task [options] [target]

创建项目任务（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                   单个 projectID；也可使用命名参数

Options:
  --project-id <value>     项目ID（必填）
  --name <value>           任务名称（必填）
  --execution-id <value>   所属执行；无执行项目可不传，有执行项目必须传
  --type <value>           任务类型
  --assigned-to <value>    指派给
  --est-started <value>    预计开始
  --data-deadline <value>  截止日期
  --pri <value>            优先级
  --estimate <value>       预计工时
  --module <value>         所属模块
  --story <value>          相关需求
  --desc <value>           任务描述
  --project <id>           projectID 或 scope/scopeID 别名
  --execution <id>         executionID 或 scope/scopeID 别名
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  -h, --help               显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | string | 是 | — | 任务名称<br>{} |
| --execution-id | executionID | body | integer | 否 | — | 所属执行；无执行项目可不传，有执行项目必须传<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 任务类型<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --est-started | estStarted | body | string | 否 | — | 预计开始<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --desc | desc | body | string | 否 | — | 任务描述<br>{} |

<a id="action-project-create-risk"></a>

## zentao project create-risk

```text
Usage: zentao project create-risk [options] [target]

创建项目风险（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                         单个 projectID；也可使用命名参数

Options:
  --project-id <value>           项目ID（必填）
  --name <value>                 风险名称。（必填）
  --source <value>               风险来源。
  --execution <value>            所属执行 ID，项目级风险传 0。
  --category <value>             风险类型。
  --strategy <value>             应对策略。
  --impact <value>               影响程度，1-5。
  --probability <value>          发生概率，1-5。
  --rate <value>                 风险系数，通常为 impact * probability。
  --pri <value>                  优先级，1 高、2 中、3 低。
  --identified-date <value>      识别日期。
  --planned-closed-date <value>  计划关闭日期。
  --assigned-to <value>          指派人账号。
  --prevention <value>           应对措施。
  --remedy <value>               响应措施。
  --project <id>                 projectID 或 scope/scopeID 别名
  --data <json|@file|@->         JSON 对象、文件或显式标准输入
  -h, --help                     显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | string | 是 | — | 风险名称。<br>{} |
| --source | source | body | string | 否 | — | 风险来源。<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级风险传 0。<br>{"format":"int32"} |
| --category | category | body | string | 否 | — | 风险类型。<br>{} |
| --strategy | strategy | body | string | 否 | — | 应对策略。<br>{} |
| --impact | impact | body | integer | 否 | — | 影响程度，1-5。<br>{"format":"int32"} |
| --probability | probability | body | integer | 否 | — | 发生概率，1-5。<br>{"format":"int32"} |
| --rate | rate | body | integer | 否 | — | 风险系数，通常为 impact * probability。<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级，1 高、2 中、3 低。<br>{"format":"int32"} |
| --identified-date | identifiedDate | body | string | 否 | — | 识别日期。<br>{} |
| --planned-closed-date | plannedClosedDate | body | string | 否 | — | 计划关闭日期。<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派人账号。<br>{} |
| --prevention | prevention | body | string | 否 | — | 应对措施。<br>{} |
| --remedy | remedy | body | string | 否 | — | 响应措施。<br>{} |

<a id="action-project-link-stories"></a>

## zentao project link-stories

```text
Usage: zentao project link-stories [options] [target]

项目关联需求（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --stories <value>       要关联到项目的需求 ID 列表。（必填）
  --story-type <value>    需求类型，默认 story；可按项目需求类型传 requirement、epic 等。
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --stories | stories | body | array | 是 | — | 要关联到项目的需求 ID 列表。<br>{"items":{"type":"string"}} |
| --story-type | storyType | body | string | 否 | — | 需求类型，默认 story；可按项目需求类型传 requirement、epic 等。<br>{} |

<a id="action-project-update"></a>

## zentao project update

```text
Usage: zentao project update [options] [target]

修改项目（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --name <value>            项目名称（必填）
  --model <value>           项目管理方式(scrum 敏捷 | waterfall 瀑布 | kanban 看板 |
                            agileplus 融合敏捷 | waterfallplus 融合瀑布)（必填）
  --begin <value>           开始日期（必填）
  --end <value>             结束日期（必填）
  --products <value>        关联产品
  --parent <value>          所属项目集
  --workflow-group <value>  项目流程，付费版功能，开源版可以不填（必填）
  --pm <value>              项目负责人
  --project <id>            projectID 或 scope/scopeID 别名
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | string | 是 | — | 项目名称<br>{} |
| --model | model | body | string | 是 | — | 项目管理方式(scrum 敏捷 \| waterfall 瀑布 \| kanban 看板 \| agileplus 融合敏捷 \| waterfallplus 融合瀑布)<br>{} |
| --begin | begin | body | string | 是 | — | 开始日期<br>{} |
| --end | end | body | string | 是 | — | 结束日期<br>{} |
| --products | products | body | array | 否 | — | 关联产品<br>{"items":{"type":"string"}} |
| --parent | parent | body | integer | 否 | — | 所属项目集<br>{"format":"int32"} |
| --workflow-group | workflowGroup | body | integer | 是 | — | 项目流程，付费版功能，开源版可以不填<br>{"format":"int32"} |
| --pm | PM | body | string | 否 | — | 项目负责人<br>{} |

<a id="action-project-delete"></a>

## zentao project delete

```text
Usage: zentao project delete [options] [target]

删除项目（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                单个 projectID；也可使用命名参数

Options:
  --project-id <value>  项目ID（必填）
  --project <id>        projectID 或 scope/scopeID 别名
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --yes                 确认删除
  -h, --help            显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |

<a id="action-project-members"></a>

## zentao project members

```text
Usage: zentao project members [options] [target]

维护项目成员（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --account <value>       成员账号，多人时按顺序设置。例如 account=["admin","dev1"] 时，role[0] 对应
                          admin，role[1] 对应 dev1（必填）
  --role <value>          成员角色，与account顺序一一对应
  --days <value>          可用工作日，与account顺序一一对应
  --hours <value>         每日工时，与account顺序一一对应
  --limited <value>       是否限制日期，与account顺序一一对应
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --account | account | body | array | 是 | — | 成员账号，多人时按顺序设置。例如 account=["admin","dev1"] 时，role[0] 对应 admin，role[1] 对应 dev1<br>{"items":{"type":"string"}} |
| --role | role | body | array | 否 | — | 成员角色，与account顺序一一对应<br>{"items":{"type":"string"}} |
| --days | days | body | array | 否 | — | 可用工作日，与account顺序一一对应<br>{"items":{"type":"string"}} |
| --hours | hours | body | array | 否 | — | 每日工时，与account顺序一一对应<br>{"items":{"type":"string"}} |
| --limited | limited | body | array | 否 | — | 是否限制日期，与account顺序一一对应<br>{"items":{"type":"string"}} |

<a id="module-execution"></a>

## 执行 · execution

```text
Usage: zentao execution [options] [command]

执行

Options:
  -h, --help                             显示命令帮助

Commands:
  props                                  返回对象字段定义（离线）
  list [options]                         获取执行列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  project-executions [options] [target]  获取项目的执行列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  team [options]                         获取执行团队列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  execution-members [options] [target]   获取执行成员列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create [options]                       创建执行（迭代/阶段/看板）（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]               关闭执行（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-task-module [options] [target]  创建执行的任务模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  link-stories [options] [target]        执行关联需求（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get [options] [target]                 获取执行详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]              修改执行（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]              删除执行（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  members [options] [target]             维护执行成员（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
```

<a id="action-execution-list"></a>

## zentao execution list

```text
Usage: zentao execution list [options]

获取执行列表（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --browse-type <value>     执行状态，默认是undone
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedDate,assignedDate,assignedTo,canceledBy,canceledDate,closedBy,closedDate,closedReason,consumed,deadline,desc,estStarted,estimate,execution,finishedBy,finishedDate,fromBug,id,keywords,lastEditedBy,lastEditedDate,left,mailto,module,name,openedBy,openedDate,pri,project,realStarted,status,story,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "undone" | 执行状态，默认是undone<br>{"options":[{"value":"all","label":"全部"},{"value":"undone","label":"未完成"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"rawID_asc","label":"RAWID 升序"},{"value":"rawID_desc","label":"RAWID 降序"},{"value":"nameCol_asc","label":"名称 升序"},{"value":"nameCol_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedDate,assignedDate,assignedTo,canceledBy,canceledDate,closedBy,closedDate,closedReason,consumed,deadline,desc,estStarted,estimate,execution,finishedBy,finishedDate,fromBug,id,keywords,lastEditedBy,lastEditedDate,left,mailto,module,name,openedBy,openedDate,pri,project,realStarted,status,story,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-execution-project-executions"></a>

## zentao execution project-executions

```text
Usage: zentao execution project-executions [options] [target]

获取项目的执行列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --browse-type <value>     执行状态，默认是undone
  --order-by <value>        排序
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "undone" | 执行状态，默认是undone<br>{"options":[{"value":"all","label":"全部"},{"value":"undone","label":"未完成"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"rawID_asc","label":"RAWID 升序"},{"value":"rawID_desc","label":"RAWID 降序"},{"value":"nameCol_asc","label":"名称 升序"},{"value":"nameCol_desc","label":"名称 降序"},{"value":"begin_asc","label":"计划开始 升序"},{"value":"begin_desc","label":"计划开始 降序"},{"value":"end_asc","label":"计划结束 升序"},{"value":"end_desc","label":"计划结束 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-execution-team"></a>

## zentao execution team

```text
Usage: zentao execution team [options]

获取执行团队列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --execution-id <value>    执行ID（必填）
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | query | number | 是 | — | 执行ID<br>{} |

<a id="action-execution-execution-members"></a>

## zentao execution execution-members

```text
Usage: zentao execution execution-members [options] [target]

获取执行成员列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 executionID；也可使用命名参数

Options:
  --execution-id <value>    执行ID（必填）
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |

<a id="action-execution-create"></a>

## zentao execution create

```text
Usage: zentao execution create [options]

创建执行（迭代/阶段/看板）（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --project <value>       所属项目（必填）
  --name <value>          迭代/阶段名称（必填）
  --type <value>          类型(sprint 迭代 | stage 阶段 | kanban
                          看板)。默认按项目模型推导：scrum→sprint、kanban→kanban、waterfall/waterfallplus→stage；IPD
                          项目创建阶段时必须显式传 stage
  --parent <value>        父执行/父阶段ID；创建子阶段时传父阶段ID，不传为顶层阶段
  --attribute <value>     阶段类型(mix 综合 | request 需求 | design 设计 | dev 开发 | qa 测试
                          | release 发布 | review 总结评审 | other 其他；IPD: concept 概念
                          | plan 计划 | develop 开发 | qualify 验证 | launch
                          发布)。不传为空，有 parent 时继承父阶段
  --lifetime <value>      周期(short 短期，迭代 | long 长期，阶段 | ops 运维)
  --begin <value>         开始日期（必填）
  --end <value>           结束日期（必填）
  --days <value>          可用工作日
  --products <value>      关联产品；waterfall/waterfallplus 项目创建阶段时必填（必填）
  --plans <value>         关联计划，必须是产品+planID的二维数组
  --po <value>            产品负责人
  --qd <value>            测试负责人
  --pm <value>            执行负责人
  --rd <value>            发布负责人
  --acl <value>           访问控制(open 公开 | private 私有)
  --milestone <value>     是否里程碑(0 否| 1 是)
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project | project | body | integer | 是 | — | 所属项目<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 迭代/阶段名称<br>{} |
| --type | type | body | string | 否 | — | 类型(sprint 迭代 \| stage 阶段 \| kanban 看板)。默认按项目模型推导：scrum→sprint、kanban→kanban、waterfall/waterfallplus→stage；IPD 项目创建阶段时必须显式传 stage<br>{} |
| --parent | parent | body | integer | 否 | — | 父执行/父阶段ID；创建子阶段时传父阶段ID，不传为顶层阶段<br>{"format":"int32"} |
| --attribute | attribute | body | string | 否 | — | 阶段类型(mix 综合 \| request 需求 \| design 设计 \| dev 开发 \| qa 测试 \| release 发布 \| review 总结评审 \| other 其他；IPD: concept 概念 \| plan 计划 \| develop 开发 \| qualify 验证 \| launch 发布)。不传为空，有 parent 时继承父阶段<br>{} |
| --lifetime | lifetime | body | string | 否 | — | 周期(short 短期，迭代 \| long 长期，阶段 \| ops 运维)<br>{} |
| --begin | begin | body | string | 是 | — | 开始日期<br>{} |
| --end | end | body | string | 是 | — | 结束日期<br>{} |
| --days | days | body | integer | 否 | — | 可用工作日<br>{"format":"int32"} |
| --products | products | body | array | 是 | — | 关联产品；waterfall/waterfallplus 项目创建阶段时必填<br>{"items":{"type":"string"}} |
| --plans | plans | body | array | 否 | — | 关联计划，必须是产品+planID的二维数组<br>{"items":{"type":"string"}} |
| --po | PO | body | string | 否 | — | 产品负责人<br>{} |
| --qd | QD | body | string | 否 | — | 测试负责人<br>{} |
| --pm | PM | body | string | 否 | — | 执行负责人<br>{} |
| --rd | RD | body | string | 否 | — | 发布负责人<br>{} |
| --acl | acl | body | string | 否 | "open" | 访问控制(open 公开 \| private 私有)<br>{} |
| --milestone | milestone | body | integer | 否 | — | 是否里程碑(0 否\| 1 是)<br>{"format":"int32"} |

<a id="action-execution-close"></a>

## zentao execution close

```text
Usage: zentao execution close [options] [target]

关闭执行（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --real-end <value>      实际完成日期（必填）
  --comment <value>       备注
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --real-end | realEnd | body | string | 是 | — | 实际完成日期<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-execution-create-task-module"></a>

## zentao execution create-task-module

```text
Usage: zentao execution create-task-module [options] [target]

创建执行的任务模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --name <value>          模块名称
  --parent-id <value>     父模块
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-execution-link-stories"></a>

## zentao execution link-stories

```text
Usage: zentao execution link-stories [options] [target]

执行关联需求（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --stories <value>       要关联到执行的需求 ID 列表。（必填）
  --story-type <value>    需求类型，默认 story。
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --stories | stories | body | array | 是 | — | 要关联到执行的需求 ID 列表。<br>{"items":{"type":"string"}} |
| --story-type | storyType | body | string | 否 | — | 需求类型，默认 story。<br>{} |

<a id="action-execution-get"></a>

## zentao execution get

```text
Usage: zentao execution get [options] [target]

获取执行详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --execution <id>        executionID 或 scope/scopeID 别名
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  --fields <fields>       返回字段，逗号分隔
  --html-to-markdown      显式将富文本字段转换为 Markdown
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |

<a id="action-execution-update"></a>

## zentao execution update

```text
Usage: zentao execution update [options] [target]

修改执行（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --project <value>       所属项目
  --name <value>          迭代名称（必填）
  --lifetime <value>      执行类型(short 短期 | long 长期 | ops 运维)
  --begin <value>         开始日期（必填）
  --end <value>           结束日期（必填）
  --days <value>          可用工作日
  --products <value>      关联产品
  --plans <value>         关联计划，必须是产品+planID的二维数组
  --po <value>            产品负责人
  --qd <value>            测试负责人
  --pm <value>            执行负责人
  --rd <value>            发布负责人
  --acl <value>           访问控制(open 公开 | private 私有)
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --project | project | body | integer | 否 | — | 所属项目<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 迭代名称<br>{} |
| --lifetime | lifetime | body | string | 否 | — | 执行类型(short 短期 \| long 长期 \| ops 运维)<br>{} |
| --begin | begin | body | string | 是 | — | 开始日期<br>{} |
| --end | end | body | string | 是 | — | 结束日期<br>{} |
| --days | days | body | integer | 否 | — | 可用工作日<br>{"format":"int32"} |
| --products | products | body | array | 否 | — | 关联产品<br>{"items":{"type":"string"}} |
| --plans | plans | body | array | 否 | — | 关联计划，必须是产品+planID的二维数组<br>{"items":{"type":"string"}} |
| --po | PO | body | string | 否 | — | 产品负责人<br>{} |
| --qd | QD | body | string | 否 | — | 测试负责人<br>{} |
| --pm | PM | body | string | 否 | — | 执行负责人<br>{} |
| --rd | RD | body | string | 否 | — | 发布负责人<br>{} |
| --acl | acl | body | string | 否 | "open" | 访问控制(open 公开 \| private 私有)<br>{} |

<a id="action-execution-delete"></a>

## zentao execution delete

```text
Usage: zentao execution delete [options] [target]

删除执行（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --execution <id>        executionID 或 scope/scopeID 别名
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  --yes                   确认删除
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |

<a id="action-execution-members"></a>

## zentao execution members

```text
Usage: zentao execution members [options] [target]

维护执行成员（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --account <value>       成员账号，多人时按顺序设置。例如 account=["admin","dev1"] 时，role[0] 对应
                          admin，role[1] 对应 dev1（必填）
  --role <value>          成员角色，与account顺序一一对应
  --days <value>          可用工作日，与account顺序一一对应
  --hours <value>         每日工时，与account顺序一一对应
  --limited <value>       是否限制日期，与account顺序一一对应
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --account | account | body | array | 是 | — | 成员账号，多人时按顺序设置。例如 account=["admin","dev1"] 时，role[0] 对应 admin，role[1] 对应 dev1<br>{"items":{"type":"string"}} |
| --role | role | body | array | 否 | — | 成员角色，与account顺序一一对应<br>{"items":{"type":"string"}} |
| --days | days | body | array | 否 | — | 可用工作日，与account顺序一一对应<br>{"items":{"type":"string"}} |
| --hours | hours | body | array | 否 | — | 每日工时，与account顺序一一对应<br>{"items":{"type":"string"}} |
| --limited | limited | body | array | 否 | — | 是否限制日期，与account顺序一一对应<br>{"items":{"type":"string"}} |

<a id="module-productplan"></a>

## 产品计划 · productplan

```text
Usage: zentao productplan [options] [command]

产品计划

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options] [target]    获取产品计划列表，支持获取产品下的产品计划（最低版本：22.0 / biz13.0 / max8.0
                             / ipd5.0）
  create [options]           创建产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]     获取产品计划详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]  删除产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-productplan-list"></a>

## zentao productplan list

```text
Usage: zentao productplan list [options] [target]

获取产品计划列表，支持获取产品下的产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --browse-type <value>     执行状态，默认是undone
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：begin,branch,end,id,status,title
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --browse-type | browseType | query | string | 否 | "undone" | 执行状态，默认是undone<br>{"options":[{"value":"all","label":"全部"},{"value":"undone","label":"未完成"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"名称 升序"},{"value":"title_desc","label":"名称 降序"},{"value":"begin_asc","label":"开始日期 升序"},{"value":"begin_desc","label":"开始日期 降序"},{"value":"end_asc","label":"结束日期 升序"},{"value":"end_desc","label":"结束日期 降序"},{"value":"status_asc","label":"状态 升序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,branch,end,id,status,title<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-productplan-create"></a>

## zentao productplan create

```text
Usage: zentao productplan create [options]

创建产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    产品ID（必填）
  --title <value>         计划名称（必填）
  --parent <value>        父计划ID
  --begin <value>         开始日期
  --end <value>           结束日期
  --branch-id <value>     分支ID
  --desc <value>          计划描述
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 产品ID<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 计划名称<br>{} |
| --parent | parent | body | integer | 否 | — | 父计划ID<br>{"format":"int32"} |
| --begin | begin | body | string | 否 | — | 开始日期<br>{} |
| --end | end | body | string | 否 | — | 结束日期<br>{} |
| --branch-id | branchID | body | integer | 否 | — | 分支ID<br>{"format":"int32"} |
| --desc | desc | body | string | 否 | — | 计划描述<br>{} |

<a id="action-productplan-get"></a>

## zentao productplan get

```text
Usage: zentao productplan get [options] [target]

获取产品计划详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 planID；也可使用命名参数

Options:
  --plan-id <value>   产品计划ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --plan-id | planID | path | integer | 是 | — | 产品计划ID<br>{} |

<a id="action-productplan-update"></a>

## zentao productplan update

```text
Usage: zentao productplan update [options] [target]

修改产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 planID；也可使用命名参数

Options:
  --plan-id <value>       产品计划ID（必填）
  --title <value>         计划名称（必填）
  --parent <value>        父计划
  --begin <value>         开始日期
  --end <value>           结束日期
  --branch-id <value>     分支ID
  --desc <value>          计划描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --plan-id | planID | path | integer | 是 | — | 产品计划ID<br>{} |
| --title | title | body | string | 是 | — | 计划名称<br>{} |
| --parent | parent | body | integer | 否 | — | 父计划<br>{"format":"int32"} |
| --begin | begin | body | string | 否 | — | 开始日期<br>{} |
| --end | end | body | string | 否 | — | 结束日期<br>{} |
| --branch-id | branchID | body | integer | 否 | — | 分支ID<br>{"format":"int32"} |
| --desc | desc | body | string | 否 | — | 计划描述<br>{} |

<a id="action-productplan-delete"></a>

## zentao productplan delete

```text
Usage: zentao productplan delete [options] [target]

删除产品计划（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target             单个 planID；也可使用命名参数

Options:
  --plan-id <value>  产品计划ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --plan-id | planID | path | integer | 是 | — | 产品计划ID<br>{} |

<a id="module-story"></a>

## 需求 · story

```text
Usage: zentao story [options] [command]

需求

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  list [options]                    获取需求列表，支持获取项目/产品/执行下的需求（最低版本：22.0 / biz13.0
                                    / max8.0 / ipd5.0）
  modules [options] [target]        产品的需求模块树（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  create [options]                  创建需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]            获取需求详情（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  update [options] [target]         修改需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update-module [options] [target]  修改需求模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  delete [options] [target]         删除需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete-module [options] [target]  删除需求模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  activate [options] [target]       激活需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  change [options] [target]         变更需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]          关闭需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get-grades [options]              获取需求层级选项（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
```

<a id="action-story-list"></a>

## zentao story list

```text
Usage: zentao story list [options]

获取需求列表，支持获取项目/产品/执行下的需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --scope <value>           需求所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     状态
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 需求所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"products","label":"产品"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | — | 状态<br>{"options":[{"value":"allstory","label":"全部"},{"value":"assignedtome","label":"指派给我"},{"value":"openedbyme","label":"我创建"},{"value":"reviewbyme","label":"待我评审"},{"value":"draftstory","label":"草稿"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-story-modules"></a>

## zentao story modules

```text
Usage: zentao story modules [options] [target]

产品的需求模块树（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品ID（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |

<a id="action-story-create"></a>

## zentao story create

```text
Usage: zentao story create [options]

创建需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    产品ID（必填）
  --title <value>         title（必填）
  --pri <value>           优先级，默认是3
  --module <value>        所属模块
  --parent <value>        父需求
  --estimate <value>      预计工时
  --spec <value>          需求描述
  --category <value>      类别(feature 功能 | interface 接口 | performance 性能 | safe
                          安全 | experience 体验 | improve 改进 | other 其他)
  --source <value>        来源(customer 客户 | user 用户 | po 产品经理 | market 市场 |
                          service 客服 | operation 运营 | support 技术支持 | competitor
                          竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug
                          | forum 论坛 | other 其他)
  --verify <value>        验收标准
  --assigned-to <value>   指派给
  --status <value>        无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。
  --reviewer <value>      评审人员，如果无需评审则不传
  --project <value>       所属项目
  --execution <value>     所属执行
  --grade <value>         需求层级，可用的需求层级可以通过 story-getGrades 操作获取
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 产品ID<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | {} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --parent | parent | body | integer | 否 | — | 父需求<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --category | category | body | integer | 否 | — | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>{"format":"int32"} |
| --source | source | body | string | 否 | — | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)<br>{} |
| --verify | verify | body | string | 否 | — | 验收标准<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --status | status | body | string | 否 | — | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人员，如果无需评审则不传<br>{"items":{"type":"string"}} |
| --project | project | body | integer | 否 | — | 所属项目<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --grade | grade | body | integer | 否 | — | 需求层级，可用的需求层级可以通过 story-getGrades 操作获取<br>{} |

<a id="action-story-get"></a>

## zentao story get

```text
Usage: zentao story get [options] [target]

获取需求详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 storyID；也可使用命名参数

Options:
  --story-id <value>  需求ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |

<a id="action-story-update"></a>

## zentao story update

```text
Usage: zentao story update [options] [target]

修改需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --title <value>         title（必填）
  --pri <value>           优先级，默认是3
  --module <value>        所属模块
  --parent <value>        父需求
  --estimate <value>      预计工时
  --category <value>      类别
  --source <value>        来源(customer 客户 | user 用户 | po 产品经理 | market 市场 |
                          service 客服 | operation 运营 | support 技术支持 | competitor
                          竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug
                          | forum 论坛 | other 其他)
  --assigned-to <value>   指派给
  --plan <value>          所属计划
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --title | title | body | string | 是 | — | {} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --parent | parent | body | integer | 否 | — | 父需求<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --category | category | body | string | 否 | — | 类别<br>{} |
| --source | source | body | string | 否 | — | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --plan | plan | body | integer | 否 | — | 所属计划<br>{"format":"int32"} |

<a id="action-story-update-module"></a>

## zentao story update-module

```text
Usage: zentao story update-module [options] [target]

修改需求模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 moduleID；也可使用命名参数

Options:
  --module-id <value>     模块ID（必填）
  --name <value>          模块名称
  --parent <value>        父模块
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent | parent | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-story-delete"></a>

## zentao story delete

```text
Usage: zentao story delete [options] [target]

删除需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 storyID；也可使用命名参数

Options:
  --story-id <value>  需求ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |

<a id="action-story-delete-module"></a>

## zentao story delete-module

```text
Usage: zentao story delete-module [options] [target]

删除需求模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target               单个 moduleID；也可使用命名参数

Options:
  --module-id <value>  模块ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |

<a id="action-story-activate"></a>

## zentao story activate

```text
Usage: zentao story activate [options] [target]

激活需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-story-change"></a>

## zentao story change

```text
Usage: zentao story change [options] [target]

变更需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --title <value>         需求名称
  --status <value>        无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。
  --reviewer <value>      评审人员，如果无需评审则不传
  --spec <value>          需求描述
  --verify <value>        验收标准
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --title | title | body | string | 否 | — | 需求名称<br>{} |
| --status | status | body | string | 否 | — | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人员，如果无需评审则不传<br>{"items":{"type":"string"}} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --verify | verify | body | string | 否 | — | 验收标准<br>{} |

<a id="action-story-close"></a>

## zentao story close

```text
Usage: zentao story close [options] [target]

关闭需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 storyID；也可使用命名参数

Options:
  --story-id <value>       需求ID（必填）
  --closed-reason <value>  关闭原因(done 已完成 | subdivided 已拆分 | duplicate 重复 |
                           postponed 延期 | willnotdo 不做 | cancel 已取消 | bydesign
                           设计如此)（必填）
  --comment <value>        备注
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --closed-reason | closedReason | body | string | 是 | — | 关闭原因(done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-story-get-grades"></a>

## zentao story get-grades

```text
Usage: zentao story get-grades [options]

获取需求层级选项（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="module-epic"></a>

## 业务需求 · epic

```text
Usage: zentao epic [options] [command]

业务需求

Options:
  -h, --help                   显示命令帮助

Commands:
  props                        返回对象字段定义（离线）
  list [options] [target]      获取业务需求列表，支持获取产品下的业务需求（最低版本：22.0 / biz13.0 /
                               max8.0 / ipd5.0）
  create [options]             创建业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]       获取业务需求详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]    修改业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]    删除业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  activate [options] [target]  激活业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  change [options] [target]    变更业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]     关闭业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-epic-list"></a>

## zentao epic list

```text
Usage: zentao epic list [options] [target]

获取业务需求列表，支持获取产品下的业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --browse-type <value>     状态，默认是unclosed
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --browse-type | browseType | query | string | 否 | "unclosed" | 状态，默认是unclosed<br>{"options":[{"value":"allstory","label":"全部"},{"value":"assignedtome","label":"指派给我"},{"value":"openedbyme","label":"我创建"},{"value":"reviewbyme","label":"待我评审"},{"value":"draftstory","label":"草稿"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-epic-create"></a>

## zentao epic create

```text
Usage: zentao epic create [options]

创建业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    产品ID（必填）
  --title <value>         title（必填）
  --pri <value>           优先级，默认是3
  --module <value>        所属模块
  --parent <value>        父业务需求
  --estimate <value>      预计工时
  --spec <value>          业务需求描述
  --category <value>      类别(feature 功能 | interface 接口 | performance 性能 | safe
                          安全 | experience 体验 | improve 改进 | other 其他)
  --source <value>        来源(customer 客户 | user 用户 | po 产品经理 | market 市场 |
                          service 客服 | operation 运营 | support 技术支持 | competitor
                          竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug
                          | forum 论坛 | other 其他)
  --verify <value>        验收标准
  --assigned-to <value>   指派给
  --status <value>        无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。
  --reviewer <value>      评审人员，如果无需评审则不传
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 产品ID<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | {} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --parent | parent | body | integer | 否 | — | 父业务需求<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --spec | spec | body | string | 否 | — | 业务需求描述<br>{} |
| --category | category | body | integer | 否 | — | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>{"format":"int32"} |
| --source | source | body | string | 否 | — | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)<br>{} |
| --verify | verify | body | string | 否 | — | 验收标准<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --status | status | body | string | 否 | — | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人员，如果无需评审则不传<br>{"items":{"type":"string"}} |

<a id="action-epic-get"></a>

## zentao epic get

```text
Usage: zentao epic get [options] [target]

获取业务需求详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 storyID；也可使用命名参数

Options:
  --story-id <value>  需求ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |

<a id="action-epic-update"></a>

## zentao epic update

```text
Usage: zentao epic update [options] [target]

修改业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --title <value>         需求名称（必填）
  --pri <value>           优先级，默认是3
  --module <value>        所属模块
  --parent <value>        父业务需求
  --estimate <value>      预计工时
  --category <value>      类别(feature 功能 | interface 接口 | performance 性能 | safe
                          安全 | experience 体验 | improve 改进 | other 其他)
  --source <value>        来源(customer 客户 | user 用户 | po 产品经理 | market 市场 |
                          service 客服 | operation 运营 | support 技术支持 | competitor
                          竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug
                          | forum 论坛 | other 其他)
  --assigned-to <value>   指派给
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --title | title | body | string | 是 | — | 需求名称<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --parent | parent | body | integer | 否 | — | 父业务需求<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --category | category | body | integer | 否 | — | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>{"format":"int32"} |
| --source | source | body | string | 否 | — | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |

<a id="action-epic-delete"></a>

## zentao epic delete

```text
Usage: zentao epic delete [options] [target]

删除业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 storyID；也可使用命名参数

Options:
  --story-id <value>  需求ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |

<a id="action-epic-activate"></a>

## zentao epic activate

```text
Usage: zentao epic activate [options] [target]

激活业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-epic-change"></a>

## zentao epic change

```text
Usage: zentao epic change [options] [target]

变更业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --title <value>         需求名称
  --status <value>        无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。
  --reviewer <value>      评审人员，如果无需评审则不传
  --spec <value>          需求描述
  --verify <value>        验收标准
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --title | title | body | string | 否 | — | 需求名称<br>{} |
| --status | status | body | string | 否 | — | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人员，如果无需评审则不传<br>{"items":{"type":"string"}} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --verify | verify | body | string | 否 | — | 验收标准<br>{} |

<a id="action-epic-close"></a>

## zentao epic close

```text
Usage: zentao epic close [options] [target]

关闭业务需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 storyID；也可使用命名参数

Options:
  --story-id <value>       需求ID（必填）
  --closed-reason <value>  关闭原因(done 已完成 | subdivided 已拆分 | duplicate 重复 |
                           postponed 延期 | willnotdo 不做 | cancel 已取消 | bydesign
                           设计如此)（必填）
  --comment <value>        备注
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --closed-reason | closedReason | body | string | 是 | — | 关闭原因(done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="module-requirement"></a>

## 用户需求 · requirement

```text
Usage: zentao requirement [options] [command]

用户需求

Options:
  -h, --help                   显示命令帮助

Commands:
  props                        返回对象字段定义（离线）
  list [options] [target]      获取用户需求列表，支持获取产品下的用户需求（最低版本：22.0 / biz13.0 /
                               max8.0 / ipd5.0）
  create [options]             创建用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]       获取用户需求详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]    修改用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]    删除用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  activate [options] [target]  激活用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  change [options] [target]    变更用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]     关闭用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-requirement-list"></a>

## zentao requirement list

```text
Usage: zentao requirement list [options] [target]

获取用户需求列表，支持获取产品下的用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --browse-type <value>     状态，默认是unclosed
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --browse-type | browseType | query | string | 否 | "unclosed" | 状态，默认是unclosed<br>{"options":[{"value":"allstory","label":"全部"},{"value":"assignedtome","label":"指派给我"},{"value":"openedbyme","label":"我创建"},{"value":"reviewbyme","label":"待我评审"},{"value":"draftstory","label":"草稿"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-requirement-create"></a>

## zentao requirement create

```text
Usage: zentao requirement create [options]

创建用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    产品ID（必填）
  --title <value>         title（必填）
  --pri <value>           优先级，默认是3
  --module <value>        所属模块
  --parent <value>        父用户需求
  --estimate <value>      预计工时
  --spec <value>          用户需求描述
  --category <value>      类别(feature 功能 | interface 接口 | performance 性能 | safe
                          安全 | experience 体验 | improve 改进 | other 其他)
  --source <value>        来源(customer 客户 | user 用户 | po 产品经理 | market 市场 |
                          service 客服 | operation 运营 | support 技术支持 | competitor
                          竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug
                          | forum 论坛 | other 其他)
  --verify <value>        验收标准
  --assigned-to <value>   指派给
  --status <value>        无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。
  --reviewer <value>      评审人员，如果无需评审则不传
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 产品ID<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | {} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --parent | parent | body | integer | 否 | — | 父用户需求<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --spec | spec | body | string | 否 | — | 用户需求描述<br>{} |
| --category | category | body | integer | 否 | — | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>{"format":"int32"} |
| --source | source | body | string | 否 | — | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)<br>{} |
| --verify | verify | body | string | 否 | — | 验收标准<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --status | status | body | string | 否 | — | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人员，如果无需评审则不传<br>{"items":{"type":"string"}} |

<a id="action-requirement-get"></a>

## zentao requirement get

```text
Usage: zentao requirement get [options] [target]

获取用户需求详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 storyID；也可使用命名参数

Options:
  --story-id <value>  需求ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |

<a id="action-requirement-update"></a>

## zentao requirement update

```text
Usage: zentao requirement update [options] [target]

修改用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --title <value>         title（必填）
  --pri <value>           优先级，默认是3
  --module <value>        所属模块
  --parent <value>        父用户需求
  --estimate <value>      预计工时
  --category <value>      类别(feature 功能 | interface 接口 | performance 性能 | safe
                          安全 | experience 体验 | improve 改进 | other 其他)
  --source <value>        来源(customer 客户 | user 用户 | po 产品经理 | market 市场 |
                          service 客服 | operation 运营 | support 技术支持 | competitor
                          竞争对手 | partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug
                          | forum 论坛 | other 其他)
  --assigned-to <value>   指派给
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --title | title | body | string | 是 | — | {} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --parent | parent | body | integer | 否 | — | 父用户需求<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --category | category | body | integer | 否 | — | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>{"format":"int32"} |
| --source | source | body | string | 否 | — | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |

<a id="action-requirement-delete"></a>

## zentao requirement delete

```text
Usage: zentao requirement delete [options] [target]

删除用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 storyID；也可使用命名参数

Options:
  --story-id <value>  需求ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |

<a id="action-requirement-activate"></a>

## zentao requirement activate

```text
Usage: zentao requirement activate [options] [target]

激活用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-requirement-change"></a>

## zentao requirement change

```text
Usage: zentao requirement change [options] [target]

变更用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 storyID；也可使用命名参数

Options:
  --story-id <value>      需求ID（必填）
  --title <value>         需求名称
  --spec <value>          需求描述
  --verify <value>        验收标准
  --status <value>        无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。
  --reviewer <value>      评审人员，如果无需评审则不传
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --title | title | body | string | 否 | — | 需求名称<br>{} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --verify | verify | body | string | 否 | — | 验收标准<br>{} |
| --status | status | body | string | 否 | — | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。<br>{} |
| --reviewer | reviewer | body | array | 否 | — | 评审人员，如果无需评审则不传<br>{"items":{"type":"string"}} |

<a id="action-requirement-close"></a>

## zentao requirement close

```text
Usage: zentao requirement close [options] [target]

关闭用户需求（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 storyID；也可使用命名参数

Options:
  --story-id <value>       需求ID（必填）
  --closed-reason <value>  关闭原因(done 已完成 | subdivided 已拆分 | duplicate 重复 |
                           postponed 延期 | willnotdo 不做 | cancel 已取消 | bydesign
                           设计如此)（必填）
  --comment <value>        备注
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --story-id | storyID | path | integer | 是 | — | 需求ID<br>{} |
| --closed-reason | closedReason | body | string | 是 | — | 关闭原因(done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="module-bug"></a>

## Bug · bug

```text
Usage: zentao bug [options] [command]

Bug

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  list [options]                    获取Bug列表，支持获取项目/产品/执行下的Bug（最低版本：22.0 /
                                    biz13.0 / max8.0 / ipd5.0）
  modules [options] [target]        产品的Bug模块树（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  create [options]                  创建Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]            获取Bug详情（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  update [options] [target]         修改Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update-module [options] [target]  修改Bug模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  delete [options] [target]         删除Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete-module [options] [target]  删除Bug模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  activate [options] [target]       激活Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]          关闭Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  confirm [options] [target]        确认Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  resolve [options] [target]        解决Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-bug-list"></a>

## zentao bug list

```text
Usage: zentao bug list [options]

获取Bug列表，支持获取项目/产品/执行下的Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --scope <value>           Bug所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     状态
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active
                            激活 | resolved 已解决 | closed 已关闭)；confirmed(是否确认，枚举：1
                            已确认 | 0
                            未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1
                            | 2 | 3 | 4)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；type(Bug类型，枚举：codeerror 代码错误 | config 配置相关 |
                            install 安装部署 | security 安全相关 | performance 性能问题 |
                            standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷
                            | codeimprovement 代码改进 | others 其他)；os(操作系统，枚举：all
                            全部 | windows Windows | win11 Windows 11 | win10
                            Windows 10 | win8 Windows 8 | win7 Windows 7 | winxp
                            Windows XP | osx Mac OS | android Android | ios IOS
                            | linux Linux | ubuntu Ubuntu | chromeos Chrome OS |
                            fedora Fedora | unix Unix | others
                            其他)；browser(浏览器，枚举：all 全部 | chrome Chrome | edge
                            Edge | ie IE系列 | ie11 IE11 | ie10 IE10 | ie9 IE9 |
                            ie8 IE8 | firefox firefox系列 | opera Opera系列 | safari
                            | 360 360浏览器 | qq QQ浏览器 | other
                            其他)；resolution(解决方案，枚举：bydesign 设计如此 | duplicate
                            重复Bug | external 外部原因 | fixed 已解决 | notrepro 无法重现 |
                            postponed 延期处理 | willnotfix 不予解决 | tostory
                            转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | Bug所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"products","label":"产品"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | — | 状态<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active 激活 \| resolved 已解决 \| closed 已关闭)；confirmed(是否确认，枚举：1 已确认 \| 0 未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1 \| 2 \| 3 \| 4)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；type(Bug类型，枚举：codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| codeimprovement 代码改进 \| others 其他)；os(操作系统，枚举：all 全部 \| windows Windows \| win11 Windows 11 \| win10 Windows 10 \| win8 Windows 8 \| win7 Windows 7 \| winxp Windows XP \| osx Mac OS \| android Android \| ios IOS \| linux Linux \| ubuntu Ubuntu \| chromeos Chrome OS \| fedora Fedora \| unix Unix \| others 其他)；browser(浏览器，枚举：all 全部 \| chrome Chrome \| edge Edge \| ie IE系列 \| ie11 IE11 \| ie10 IE10 \| ie9 IE9 \| ie8 IE8 \| firefox firefox系列 \| opera Opera系列 \| safari \| 360 360浏览器 \| qq QQ浏览器 \| other 其他)；resolution(解决方案，枚举：bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因 \| fixed 已解决 \| notrepro 无法重现 \| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-bug-modules"></a>

## zentao bug modules

```text
Usage: zentao bug modules [options] [target]

产品的Bug模块树（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品ID（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |

<a id="action-bug-create"></a>

## zentao bug create

```text
Usage: zentao bug create [options]

创建Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    所属产品（必填）
  --title <value>         Bug标题（必填）
  --opened-build <value>  影响版本,主干是trunk，其他版本使用版本ID（必填）
  --project <value>       所属项目
  --execution <value>     所属执行
  --severity <value>      严重程度，默认是3
  --pri <value>           优先级，默认是3
  --type <value>          Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 |
                          security 安全相关 | performance 性能问题 | standard 标准规范 |
                          automation 测试脚本 | designdefect 设计缺陷 | others 其他)
  --steps <value>         重现步骤
  --story <value>         相关需求
  --assigned-to <value>   指派给
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | Bug标题<br>{} |
| --opened-build | openedBuild | body | array | 是 | — | 影响版本,主干是trunk，其他版本使用版本ID<br>{"items":{"type":"string"}} |
| --project | project | body | integer | 否 | — | 所属项目<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --severity | severity | body | integer | 否 | — | 严重程度，默认是3<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他)<br>{} |
| --steps | steps | body | string | 否 | — | 重现步骤<br>{} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |

<a id="action-bug-get"></a>

## zentao bug get

```text
Usage: zentao bug get [options] [target]

获取Bug详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 bugID；也可使用命名参数

Options:
  --bug-id <value>    Bug ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |

<a id="action-bug-update"></a>

## zentao bug update

```text
Usage: zentao bug update [options] [target]

修改Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 bugID；也可使用命名参数

Options:
  --bug-id <value>        Bug ID（必填）
  --title <value>         Bug标题
  --severity <value>      严重程度，默认是3
  --pri <value>           优先级，默认是3
  --type <value>          Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 |
                          security 安全相关 | performance 性能问题 | standard 标准规范 |
                          automation 测试脚本 | designdefect 设计缺陷 | others 其他)
  --opened-build <value>  影响版本,主干是trunk，其他版本使用版本ID
  --steps <value>         重现步骤
  --project <value>       所属项目
  --execution <value>     所属执行
  --story <value>         相关需求
  --assigned-to <value>   指派给
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |
| --title | title | body | string | 否 | — | Bug标题<br>{} |
| --severity | severity | body | integer | 否 | — | 严重程度，默认是3<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他)<br>{} |
| --opened-build | openedBuild | body | array | 否 | — | 影响版本,主干是trunk，其他版本使用版本ID<br>{"items":{"type":"string"}} |
| --steps | steps | body | string | 否 | — | 重现步骤<br>{} |
| --project | project | body | integer | 否 | — | 所属项目<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |

<a id="action-bug-update-module"></a>

## zentao bug update-module

```text
Usage: zentao bug update-module [options] [target]

修改Bug模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 moduleID；也可使用命名参数

Options:
  --module-id <value>     模块ID（必填）
  --name <value>          模块名称
  --parent <value>        父模块
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent | parent | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-bug-delete"></a>

## zentao bug delete

```text
Usage: zentao bug delete [options] [target]

删除Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target             单个 bugID；也可使用命名参数

Options:
  --bug-id <value>   Bug ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |

<a id="action-bug-delete-module"></a>

## zentao bug delete-module

```text
Usage: zentao bug delete-module [options] [target]

删除Bug模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target               单个 moduleID；也可使用命名参数

Options:
  --module-id <value>  模块ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |

<a id="action-bug-activate"></a>

## zentao bug activate

```text
Usage: zentao bug activate [options] [target]

激活Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 bugID；也可使用命名参数

Options:
  --bug-id <value>        Bug ID（必填）
  --opened-build <value>  影响版本, trunk为主干
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |
| --opened-build | openedBuild | body | array | 否 | — | 影响版本, trunk为主干<br>{"items":{"type":"string"}} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-bug-close"></a>

## zentao bug close

```text
Usage: zentao bug close [options] [target]

关闭Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 bugID；也可使用命名参数

Options:
  --bug-id <value>        Bug ID（必填）
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-bug-confirm"></a>

## zentao bug confirm

```text
Usage: zentao bug confirm [options] [target]

确认Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                   单个 bugID；也可使用命名参数

Options:
  --bug-id <value>         Bug ID（必填）
  --assigned-to <value>    指派给
  --type <value>           Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 |
                           security 安全相关 | performance 性能问题 | standard 标准规范 |
                           automation 测试脚本 | designdefect 设计缺陷 | others 其他)
  --pri <value>            优先级，默认是3
  --data-deadline <value>  截止日期
  --status <value>         状态
  --mailto <value>         抄送给
  --comment <value>        备注
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --type | type | body | string | 否 | — | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他)<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级，默认是3<br>{"format":"int32"} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --status | status | body | string | 否 | — | 状态<br>{} |
| --mailto | mailto | body | array | 否 | — | 抄送给<br>{"items":{"type":"string"}} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-bug-resolve"></a>

## zentao bug resolve

```text
Usage: zentao bug resolve [options] [target]

解决Bug（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 bugID；也可使用命名参数

Options:
  --bug-id <value>          Bug ID（必填）
  --resolution <value>      fixed 已解决 | notrepro 无法重现 | bydesign 设计如此 |
                            duplicate 重复Bug | external 外部原因| postponed 延期处理 |
                            willnotfix 不予解决 | tostory 转为需求（必填）
  --resolved-date <value>   解决日期，默认今天
  --resolved-build <value>  解决版本, trunk为主干
  --assigned-to <value>     指派给
  --comment <value>         备注
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --bug-id | bugID | path | integer | 是 | — | Bug ID<br>{} |
| --resolution | resolution | body | string | 是 | — | fixed 已解决 \| notrepro 无法重现 \| bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因\| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为需求<br>{} |
| --resolved-date | resolvedDate | body | string | 否 | — | 解决日期，默认今天<br>{} |
| --resolved-build | resolvedBuild | body | string | 否 | — | 解决版本, trunk为主干<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="module-testcase"></a>

## 测试用例 · testcase

```text
Usage: zentao testcase [options] [command]

测试用例

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  list [options]                    获取测试用例列表，支持获取产品/项目/执行下的测试用例（最低版本：22.0 /
                                    biz13.0 / max8.0 / ipd5.0）
  modules [options] [target]        产品的用例模块树（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  create [options]                  创建测试用例（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  get [options] [target]            获取测试用例详情（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  update [options] [target]         修改测试用例（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  update-module [options] [target]  修改用例模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  delete [options] [target]         删除测试用例（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  delete-module [options] [target]  删除用例模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
```

<a id="action-testcase-list"></a>

## zentao testcase list

```text
Usage: zentao testcase list [options]

获取测试用例列表，支持获取产品/项目/执行下的测试用例（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --scope <value>           测试用例所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit
                            单元测试 | interface 接口测试 | feature 功能测试 | install 安装部署
                            | config 配置相关 | performance 性能测试 | security 安全相关 |
                            other 其他)；auto(自动化，枚举：auto 是 | no
                            否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait
                            待评审 | normal 正常 | blocked 被阻塞 | investigate
                            研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest
                            单元测试环节 | feature 功能测试环节 | intergrate 集成测试环节 | system
                            系统测试环节 | smoke 冒烟测试环节 | bvt
                            版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 | 1 | 2 |
                            4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass
                            通过 | fail 失败 | blocked 阻塞 | null
                            未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all)
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 测试用例所属范围<br>{"options":[{"value":"products","label":"产品"},{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"未关闭"},{"value":"needconfirm","label":"需求变动"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)；auto(自动化，枚举：auto 是 \| no 否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait 待评审 \| normal 正常 \| blocked 被阻塞 \| investigate 研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest 单元测试环节 \| feature 功能测试环节 \| intergrate 集成测试环节 \| system 系统测试环节 \| smoke 冒烟测试环节 \| bvt 版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 \| 1 \| 2 \| 4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass 通过 \| fail 失败 \| blocked 阻塞 \| null 未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-testcase-modules"></a>

## zentao testcase modules

```text
Usage: zentao testcase modules [options] [target]

产品的用例模块树（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品ID（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |

<a id="action-testcase-create"></a>

## zentao testcase create

```text
Usage: zentao testcase create [options]

创建测试用例（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    所属产品（必填）
  --title <value>         用例标题（必填）
  --module <value>        所属模块
  --story <value>         相关需求
  --pri <value>           优先级
  --type <value>          用例类型(unit 单元测试 | interface 接口测试 | feature 功能测试 |
                          install 安装部署 | config 配置相关 | performance 性能测试 |
                          security 安全相关 | other 其他)
  --precondition <value>  前置条件
  --steps <value>         用例步骤, 如果是嵌套用例，可以通过key表示嵌套关系 {"1": "分组1", "1.1":
                          "子分组1.1", "1.1.1": "步骤1.1.1"}
  --expects <value>       用例步骤期望, 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "", "1.1": "",
                          "1.1.1": "步骤1.1.1的期望"}
  --step-type <value>     用例步骤类型(step 步骤 | group 父级步骤), 如果是嵌套用例步骤，可以通过key表示嵌套关系
                          {"1": "group", "1.1": "group", "1.1.1": "step"}
  --project <value>       所属项目
  --execution <value>     所属执行
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 用例标题<br>{} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 用例类型(unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)<br>{} |
| --precondition | precondition | body | string | 否 | — | 前置条件<br>{} |
| --steps | steps | body | array | 否 | — | 用例步骤, 如果是嵌套用例，可以通过key表示嵌套关系 {"1": "分组1", "1.1": "子分组1.1", "1.1.1": "步骤1.1.1"}<br>{"items":{"type":"string"}} |
| --expects | expects | body | array | 否 | — | 用例步骤期望, 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "", "1.1": "", "1.1.1": "步骤1.1.1的期望"}<br>{"items":{"type":"string"}} |
| --step-type | stepType | body | array | 否 | — | 用例步骤类型(step 步骤 \| group 父级步骤), 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "group", "1.1": "group", "1.1.1": "step"}<br>{"items":{"type":"string"}} |
| --project | project | body | integer | 否 | — | 所属项目<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |

<a id="action-testcase-get"></a>

## zentao testcase get

```text
Usage: zentao testcase get [options] [target]

获取测试用例详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 caseID；也可使用命名参数

Options:
  --case-id <value>   测试用例ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --case-id | caseID | path | integer | 是 | — | 测试用例ID<br>{} |

<a id="action-testcase-update"></a>

## zentao testcase update

```text
Usage: zentao testcase update [options] [target]

修改测试用例（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 caseID；也可使用命名参数

Options:
  --case-id <value>       测试用例ID（必填）
  --title <value>         用例标题（必填）
  --module <value>        所属模块
  --story <value>         相关需求
  --pri <value>           优先级
  --type <value>          用例类型(unit 单元测试 | interface 接口测试 | feature 功能测试 |
                          install 安装部署 | config 配置相关 | performance 性能测试 |
                          security 安全相关 | other 其他)
  --precondition <value>  前置条件
  --steps <value>         用例步骤, 如果是嵌套用例，可以通过key表示嵌套关系 {"1": "分组1", "1.1":
                          "子分组1.1", "1.1.1": "步骤1.1.1"}
  --expects <value>       用例步骤期望, 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "", "1.1": "",
                          "1.1.1": "步骤1.1.1的期望"}
  --step-type <value>     用例步骤类型(step 步骤 | group 父级步骤), 如果是嵌套用例步骤，可以通过key表示嵌套关系
                          {"1": "group", "1.1": "group", "1.1.1": "step"}
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --case-id | caseID | path | integer | 是 | — | 测试用例ID<br>{} |
| --title | title | body | string | 是 | — | 用例标题<br>{} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 用例类型(unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)<br>{} |
| --precondition | precondition | body | string | 否 | — | 前置条件<br>{} |
| --steps | steps | body | array | 否 | — | 用例步骤, 如果是嵌套用例，可以通过key表示嵌套关系 {"1": "分组1", "1.1": "子分组1.1", "1.1.1": "步骤1.1.1"}<br>{"items":{"type":"string"}} |
| --expects | expects | body | array | 否 | — | 用例步骤期望, 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "", "1.1": "", "1.1.1": "步骤1.1.1的期望"}<br>{"items":{"type":"string"}} |
| --step-type | stepType | body | array | 否 | — | 用例步骤类型(step 步骤 \| group 父级步骤), 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "group", "1.1": "group", "1.1.1": "step"}<br>{"items":{"type":"string"}} |

<a id="action-testcase-update-module"></a>

## zentao testcase update-module

```text
Usage: zentao testcase update-module [options] [target]

修改用例模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 moduleID；也可使用命名参数

Options:
  --module-id <value>     模块ID（必填）
  --name <value>          模块名称
  --parent <value>        父模块
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent | parent | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-testcase-delete"></a>

## zentao testcase delete

```text
Usage: zentao testcase delete [options] [target]

删除测试用例（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target             单个 caseID；也可使用命名参数

Options:
  --case-id <value>  测试用例ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --case-id | caseID | path | integer | 是 | — | 测试用例ID<br>{} |

<a id="action-testcase-delete-module"></a>

## zentao testcase delete-module

```text
Usage: zentao testcase delete-module [options] [target]

删除用例模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target               单个 moduleID；也可使用命名参数

Options:
  --module-id <value>  模块ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |

<a id="module-task"></a>

## 任务 · task

```text
Usage: zentao task [options] [command]

任务

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  list [options] [target]           获取任务列表，支持获取执行下的任务（最低版本：22.0 / biz13.0 /
                                    max8.0 / ipd5.0）
  modules [options] [target]        执行的任务模块树（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  create [options]                  创建任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  get [options] [target]            获取任务详情（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  update [options] [target]         修改任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update-module [options] [target]  修改任务模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  delete [options] [target]         删除任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete-module [options] [target]  删除任务模块（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  activate [options] [target]       激活任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]          关闭任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  finish [options] [target]         完成任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  start [options] [target]          启动任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-task-list"></a>

## zentao task list

```text
Usage: zentao task list [options] [target]

获取任务列表，支持获取执行下的任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 executionID；也可使用命名参数

Options:
  --execution-id <value>    所属执行ID（必填）
  --browse-type <value>     状态，默认是unclosed
  --order-by <value>        排序
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 所属执行ID<br>{} |
| --browse-type | browseType | query | string | 否 | "unclosed" | 状态，默认是unclosed<br>{"options":[{"value":"all","label":"全部"},{"value":"unclosed","label":"未关闭"},{"value":"assignedtome","label":"指派给我"},{"value":"assignedtome","label":"指派给我"},{"value":"myinvolved","label":"由我参与"},{"value":"assignedbyme","label":"由我指派"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-task-modules"></a>

## zentao task modules

```text
Usage: zentao task modules [options] [target]

执行的任务模块树（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 executionID；也可使用命名参数

Options:
  --execution-id <value>    执行ID（必填）
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |

<a id="action-task-create"></a>

## zentao task create

```text
Usage: zentao task create [options]

创建任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --name <value>           任务名称（必填）
  --execution-id <value>   所属执行（必填）
  --type <value>           任务类型
  --assigned-to <value>    指派给
  --est-started <value>    预计开始
  --data-deadline <value>  截止日期
  --pri <value>            优先级
  --estimate <value>       预计工时
  --module <value>         所属模块
  --story <value>          相关需求
  --desc <value>           任务描述
  --parent <value>         父任务
  --execution <id>         executionID 或 scope/scopeID 别名
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 任务名称<br>{} |
| --execution-id | executionID | body | integer | 是 | — | 所属执行<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 任务类型<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --est-started | estStarted | body | string | 否 | — | 预计开始<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --desc | desc | body | string | 否 | — | 任务描述<br>{} |
| --parent | parent | body | integer | 否 | — | 父任务<br>{"format":"int32"} |

<a id="action-task-get"></a>

## zentao task get

```text
Usage: zentao task get [options] [target]

获取任务详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 taskID；也可使用命名参数

Options:
  --task-id <value>   任务ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |

<a id="action-task-update"></a>

## zentao task update

```text
Usage: zentao task update [options] [target]

修改任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 taskID；也可使用命名参数

Options:
  --task-id <value>        任务ID（必填）
  --name <value>           任务名称
  --type <value>           任务类型
  --assigned-to <value>    指派给
  --est-started <value>    预计开始
  --data-deadline <value>  截止日期
  --pri <value>            优先级
  --estimate <value>       预计工时
  --module <value>         所属模块
  --story <value>          相关需求
  --desc <value>           任务描述
  --parent <value>         父任务
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |
| --name | name | body | string | 否 | — | 任务名称<br>{} |
| --type | type | body | string | 否 | — | 任务类型<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --est-started | estStarted | body | string | 否 | — | 预计开始<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --estimate | estimate | body | number | 否 | — | 预计工时<br>{"format":"float"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --story | story | body | integer | 否 | — | 相关需求<br>{"format":"int32"} |
| --desc | desc | body | string | 否 | — | 任务描述<br>{} |
| --parent | parent | body | integer | 否 | — | 父任务<br>{"format":"int32"} |

<a id="action-task-update-module"></a>

## zentao task update-module

```text
Usage: zentao task update-module [options] [target]

修改任务模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 moduleID；也可使用命名参数

Options:
  --module-id <value>     模块ID（必填）
  --name <value>          模块名称
  --parent <value>        父模块
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |
| --name | name | body | string | 否 | — | 模块名称<br>{} |
| --parent | parent | body | integer | 否 | — | 父模块<br>{"format":"int32"} |

<a id="action-task-delete"></a>

## zentao task delete

```text
Usage: zentao task delete [options] [target]

删除任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target             单个 taskID；也可使用命名参数

Options:
  --task-id <value>  任务ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |

<a id="action-task-delete-module"></a>

## zentao task delete-module

```text
Usage: zentao task delete-module [options] [target]

删除任务模块（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target               单个 moduleID；也可使用命名参数

Options:
  --module-id <value>  模块ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |

<a id="action-task-activate"></a>

## zentao task activate

```text
Usage: zentao task activate [options] [target]

激活任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 taskID；也可使用命名参数

Options:
  --task-id <value>       任务ID（必填）
  --left <value>          预计剩余
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |
| --left | left | body | number | 否 | — | 预计剩余<br>{"format":"float"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-task-close"></a>

## zentao task close

```text
Usage: zentao task close [options] [target]

关闭任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 taskID；也可使用命名参数

Options:
  --task-id <value>       任务ID（必填）
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-task-finish"></a>

## zentao task finish

```text
Usage: zentao task finish [options] [target]

完成任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                      单个 taskID；也可使用命名参数

Options:
  --task-id <value>           任务ID（必填）
  --current-consumed <value>  本次消耗（必填）
  --assigned-to <value>       指派给
  --consumed <value>          总计消耗
  --real-started <value>      实际开始，精确到秒（必填）
  --finished-date <value>     实际完成，精确到秒（必填）
  --comment <value>           备注
  --data <json|@file|@->      JSON 对象、文件或显式标准输入
  --ids <ids>                 批量目标 ID，逗号分隔并去重
  --batch-fail-fast           失败后跳过剩余目标
  -h, --help                  显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |
| --current-consumed | currentConsumed | body | number | 是 | — | 本次消耗<br>{"format":"float"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --consumed | consumed | body | number | 否 | — | 总计消耗<br>{"format":"float"} |
| --real-started | realStarted | body | string | 是 | — | 实际开始，精确到秒<br>{} |
| --finished-date | finishedDate | body | string | 是 | — | 实际完成，精确到秒<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-task-start"></a>

## zentao task start

```text
Usage: zentao task start [options] [target]

启动任务（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 taskID；也可使用命名参数

Options:
  --task-id <value>       任务ID（必填）
  --assigned-to <value>   任务名称
  --real-started <value>  实际开始，精确到秒（必填）
  --consumed <value>      总计消耗
  --left <value>          预计剩余
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --task-id | taskID | path | integer | 是 | — | 任务ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 任务名称<br>{} |
| --real-started | realStarted | body | string | 是 | — | 实际开始，精确到秒<br>{} |
| --consumed | consumed | body | number | 否 | — | 总计消耗<br>{"format":"float"} |
| --left | left | body | number | 否 | — | 预计剩余<br>{"format":"float"} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="module-issue"></a>

## 问题 · issue

```text
Usage: zentao issue [options] [command]

问题

Options:
  -h, --help                           显示命令帮助

Commands:
  props                                返回对象字段定义（离线）
  list [options]                       获取问题列表（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  project-issues [options] [target]    获取项目问题列表（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  execution-issues [options] [target]  获取执行问题列表（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  create [options]                     创建问题（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
  get [options] [target]               获取问题详情（最低版本：22.5 / biz13.5 / max8.5 /
                                       ipd5.5）
```

<a id="action-issue-list"></a>

## zentao issue list

```text
Usage: zentao issue list [options]

获取问题列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"open","label":"开放"},{"value":"assignto","label":"指派给我"},{"value":"assignby","label":"由我指派"},{"value":"closed","label":"已关闭"},{"value":"resolved","label":"已解决"},{"value":"canceled","label":"已取消"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"severity_asc","label":"严重程度 升序"},{"value":"severity_desc","label":"严重程度 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-issue-project-issues"></a>

## zentao issue project-issues

```text
Usage: zentao issue project-issues [options] [target]

获取项目问题列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type
  --group-join <value>      条件组之间的连接方式
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"open","label":"开放"},{"value":"assignto","label":"指派给我"},{"value":"assignby","label":"由我指派"},{"value":"closed","label":"已关闭"},{"value":"resolved","label":"已解决"},{"value":"canceled","label":"已取消"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"severity_asc","label":"严重程度 升序"},{"value":"severity_desc","label":"严重程度 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-issue-execution-issues"></a>

## zentao issue execution-issues

```text
Usage: zentao issue execution-issues [options] [target]

获取执行问题列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 executionID；也可使用命名参数

Options:
  --execution-id <value>    执行ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type
  --group-join <value>      条件组之间的连接方式
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"open","label":"开放"},{"value":"assignto","label":"指派给我"},{"value":"assignby","label":"由我指派"},{"value":"closed","label":"已关闭"},{"value":"resolved","label":"已解决"},{"value":"canceled","label":"已取消"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"severity_asc","label":"严重程度 升序"},{"value":"severity_desc","label":"严重程度 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-issue-create"></a>

## zentao issue create

```text
Usage: zentao issue create [options]

创建问题（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --object-id <value>      所属项目（必填）
  --from <value>           来源，0 表示直接创建
  --title <value>          问题名称（必填）
  --type <value>           类型(design 设计问题 | code 程序缺陷 | performance 性能问题 |
                           version 版本控制 | storyadd 需求新增 | storychanged 需求修改 |
                           storyremoved 需求删除 | data 数据问题)（必填）
  --severity <value>       严重程度(1 严重 | 2 较严重 | 3 较小 | 4 建议)（必填）
  --pri <value>            优先级(1-4)
  --execution <value>      所属执行
  --assigned-to <value>    指派给
  --owner <value>          提出人
  --data-deadline <value>  计划解决日期
  --desc <value>           描述
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  -h, --help               显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --object-id | objectID | body | integer | 是 | — | 所属项目<br>{"format":"int32"} |
| --from | from | body | integer | 否 | — | 来源，0 表示直接创建<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 问题名称<br>{} |
| --type | type | body | string | 是 | — | 类型(design 设计问题 \| code 程序缺陷 \| performance 性能问题 \| version 版本控制 \| storyadd 需求新增 \| storychanged 需求修改 \| storyremoved 需求删除 \| data 数据问题)<br>{} |
| --severity | severity | body | integer | 是 | — | 严重程度(1 严重 \| 2 较严重 \| 3 较小 \| 4 建议)<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级(1-4)<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --owner | owner | body | string | 否 | — | 提出人<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 计划解决日期<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-issue-get"></a>

## zentao issue get

```text
Usage: zentao issue get [options] [target]

获取问题详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target              单个 issueID；也可使用命名参数

Options:
  --issue-id <value>  问题ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --issue-id | issueID | path | integer | 是 | — | 问题ID<br>{} |

<a id="module-risk"></a>

## 风险 · risk

```text
Usage: zentao risk [options] [command]

风险

Options:
  -h, --help                          显示命令帮助

Commands:
  props                               返回对象字段定义（离线）
  list [options]                      获取风险列表（最低版本：22.5 / biz13.5 / max8.5 /
                                      ipd5.5）
  project-risks [options] [target]    获取项目风险列表（最低版本：22.5 / biz13.5 / max8.5 /
                                      ipd5.5）
  execution-risks [options] [target]  获取执行风险列表（最低版本：22.5 / biz13.5 / max8.5 /
                                      ipd5.5）
  create [options]                    创建风险（最低版本：22.5 / biz13.5 / max8.5 /
                                      ipd5.5）
  get [options] [target]              获取风险详情（最低版本：22.5 / biz13.5 / max8.5 /
                                      ipd5.5）
  update [options] [target]           修改风险（最低版本：22.5 / biz13.5 / max8.5 /
                                      ipd5.5）
```

<a id="action-risk-list"></a>

## zentao risk list

```text
Usage: zentao risk list [options]

获取风险列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"active","label":"开放"},{"value":"assignTo","label":"指派给我"},{"value":"assignBy","label":"由我指派"},{"value":"closed","label":"已关闭"},{"value":"hangup","label":"已挂起"},{"value":"canceled","label":"已取消"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"},{"value":"pri_asc","label":"优先级 升序"},{"value":"pri_desc","label":"优先级 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-risk-project-risks"></a>

## zentao risk project-risks

```text
Usage: zentao risk project-risks [options] [target]

获取项目风险列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy
  --group-join <value>      条件组之间的连接方式
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"active","label":"开放"},{"value":"assignTo","label":"指派给我"},{"value":"assignBy","label":"由我指派"},{"value":"closed","label":"已关闭"},{"value":"hangup","label":"已挂起"},{"value":"canceled","label":"已取消"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"},{"value":"pri_asc","label":"优先级 升序"},{"value":"pri_desc","label":"优先级 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-risk-execution-risks"></a>

## zentao risk execution-risks

```text
Usage: zentao risk execution-risks [options] [target]

获取执行风险列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 executionID；也可使用命名参数

Options:
  --execution-id <value>    执行ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy
  --group-join <value>      条件组之间的连接方式
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"active","label":"开放"},{"value":"assignTo","label":"指派给我"},{"value":"assignBy","label":"由我指派"},{"value":"closed","label":"已关闭"},{"value":"hangup","label":"已挂起"},{"value":"canceled","label":"已取消"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"},{"value":"pri_asc","label":"优先级 升序"},{"value":"pri_desc","label":"优先级 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-risk-create"></a>

## zentao risk create

```text
Usage: zentao risk create [options]

创建风险（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --project <value>              所属项目（必填）
  --name <value>                 风险名称（必填）
  --execution <value>            所属执行
  --source <value>               来源(business 业务部门 | team 项目组 | logistic 项目保障科室 |
                                 manage 管理层 | sourcing 供应商-采购 | outsourcing
                                 供应商-外包 | customer 外部客户 | others 其他)
  --category <value>             类型(technical 技术类 | manage 管理类 | business 业务类 |
                                 requirement 需求类 | resource 资源类 | others 其他)
  --strategy <value>             策略(avoidance 规避 | mitigation 缓解 | transference
                                 转移 | acceptance 接受)
  --impact <value>               影响程度(1-5)（必填）
  --probability <value>          发生概率(1-5)（必填）
  --rate <value>                 风险系数
  --pri <value>                  优先级(1 高 | 2 中 | 3 低)（必填）
  --identified-date <value>      识别日期
  --planned-closed-date <value>  计划关闭日期
  --assigned-to <value>          指派给
  --prevention <value>           应对措施
  --remedy <value>               响应措施
  --data <json|@file|@->         JSON 对象、文件或显式标准输入
  -h, --help                     显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project | project | body | integer | 是 | — | 所属项目<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 风险名称<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --source | source | body | string | 否 | — | 来源(business 业务部门 \| team 项目组 \| logistic 项目保障科室 \| manage 管理层 \| sourcing 供应商-采购 \| outsourcing 供应商-外包 \| customer 外部客户 \| others 其他)<br>{} |
| --category | category | body | string | 否 | — | 类型(technical 技术类 \| manage 管理类 \| business 业务类 \| requirement 需求类 \| resource 资源类 \| others 其他)<br>{} |
| --strategy | strategy | body | string | 否 | — | 策略(avoidance 规避 \| mitigation 缓解 \| transference 转移 \| acceptance 接受)<br>{} |
| --impact | impact | body | integer | 是 | — | 影响程度(1-5)<br>{"format":"int32"} |
| --probability | probability | body | integer | 是 | — | 发生概率(1-5)<br>{"format":"int32"} |
| --rate | rate | body | integer | 否 | — | 风险系数<br>{"format":"int32"} |
| --pri | pri | body | integer | 是 | — | 优先级(1 高 \| 2 中 \| 3 低)<br>{"format":"int32"} |
| --identified-date | identifiedDate | body | string | 否 | — | 识别日期<br>{} |
| --planned-closed-date | plannedClosedDate | body | string | 否 | — | 计划关闭日期<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --prevention | prevention | body | string | 否 | — | 应对措施<br>{} |
| --remedy | remedy | body | string | 否 | — | 响应措施<br>{} |

<a id="action-risk-get"></a>

## zentao risk get

```text
Usage: zentao risk get [options] [target]

获取风险详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target              单个 riskID；也可使用命名参数

Options:
  --risk-id <value>   风险ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --risk-id | riskID | path | integer | 是 | — | 风险ID<br>{} |

<a id="action-risk-update"></a>

## zentao risk update

```text
Usage: zentao risk update [options] [target]

修改风险（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                         单个 riskID；也可使用命名参数

Options:
  --risk-id <value>              风险ID（必填）
  --name <value>                 风险名称（必填）
  --source <value>               来源(business 业务部门 | team 项目组 | logistic 项目保障科室 |
                                 manage 管理层 | sourcing 供应商-采购 | outsourcing
                                 供应商-外包 | customer 外部客户 | others 其他)
  --category <value>             类型(technical 技术类 | manage 管理类 | business 业务类 |
                                 requirement 需求类 | resource 资源类 | others 其他)
  --strategy <value>             策略(avoidance 规避 | mitigation 缓解 | transference
                                 转移 | acceptance 接受)
  --impact <value>               影响程度(1-5)
  --probability <value>          发生概率(1-5)
  --rate <value>                 风险系数
  --pri <value>                  优先级(1 高 | 2 中 | 3 低)
  --identified-date <value>      识别日期
  --planned-closed-date <value>  计划关闭日期
  --assigned-to <value>          指派给
  --prevention <value>           应对措施
  --remedy <value>               响应措施
  --resolution <value>           解决措施
  --data <json|@file|@->         JSON 对象、文件或显式标准输入
  --ids <ids>                    批量目标 ID，逗号分隔并去重
  --batch-fail-fast              失败后跳过剩余目标
  -h, --help                     显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --risk-id | riskID | path | integer | 是 | — | 风险ID<br>{} |
| --name | name | body | string | 是 | — | 风险名称<br>{} |
| --source | source | body | string | 否 | — | 来源(business 业务部门 \| team 项目组 \| logistic 项目保障科室 \| manage 管理层 \| sourcing 供应商-采购 \| outsourcing 供应商-外包 \| customer 外部客户 \| others 其他)<br>{} |
| --category | category | body | string | 否 | — | 类型(technical 技术类 \| manage 管理类 \| business 业务类 \| requirement 需求类 \| resource 资源类 \| others 其他)<br>{} |
| --strategy | strategy | body | string | 否 | — | 策略(avoidance 规避 \| mitigation 缓解 \| transference 转移 \| acceptance 接受)<br>{} |
| --impact | impact | body | integer | 否 | — | 影响程度(1-5)<br>{"format":"int32"} |
| --probability | probability | body | integer | 否 | — | 发生概率(1-5)<br>{"format":"int32"} |
| --rate | rate | body | integer | 否 | — | 风险系数<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级(1 高 \| 2 中 \| 3 低)<br>{"format":"int32"} |
| --identified-date | identifiedDate | body | string | 否 | — | 识别日期<br>{} |
| --planned-closed-date | plannedClosedDate | body | string | 否 | — | 计划关闭日期<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --prevention | prevention | body | string | 否 | — | 应对措施<br>{} |
| --remedy | remedy | body | string | 否 | — | 响应措施<br>{} |
| --resolution | resolution | body | string | 否 | — | 解决措施<br>{} |

<a id="module-meeting"></a>

## 会议 · meeting

```text
Usage: zentao meeting [options] [command]

会议

Options:
  -h, --help                             显示命令帮助

Commands:
  props                                  返回对象字段定义（离线）
  list [options]                         获取会议列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  project-meetings [options] [target]    获取项目会议列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  execution-meetings [options] [target]  获取执行会议列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create [options]                       创建会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get [options] [target]                 获取会议详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  update [options] [target]              修改会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete [options] [target]              删除会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  minutes [options] [target]             编辑会议纪要（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
```

<a id="action-meeting-list"></a>

## zentao meeting list

```text
Usage: zentao meeting list [options]

获取会议列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"booked","label":"我预约的"},{"value":"participate","label":"我参加的"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"date_asc","label":"日期 升序"},{"value":"date_desc","label":"日期 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-meeting-project-meetings"></a>

## zentao meeting project-meetings

```text
Usage: zentao meeting project-meetings [options] [target]

获取项目会议列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room
  --group-join <value>      条件组之间的连接方式
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"booked","label":"我预约的"},{"value":"participate","label":"我参加的"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"date_asc","label":"日期 升序"},{"value":"date_desc","label":"日期 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-meeting-execution-meetings"></a>

## zentao meeting execution-meetings

```text
Usage: zentao meeting execution-meetings [options] [target]

获取执行会议列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 executionID；也可使用命名参数

Options:
  --execution-id <value>    执行ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room
  --group-join <value>      条件组之间的连接方式
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"booked","label":"我预约的"},{"value":"participate","label":"我参加的"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"date_asc","label":"日期 升序"},{"value":"date_desc","label":"日期 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-meeting-create"></a>

## zentao meeting create

```text
Usage: zentao meeting create [options]

创建会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --project <value>       所属项目（必填）
  --execution <value>     所属执行
  --name <value>          会议名称（必填）
  --begin <value>         开始时间（必填）
  --end <value>           结束时间（必填）
  --mode <value>          会议模式(online 线上 | outline 线下 | both 线上+线下)（必填）
  --host <value>          主持人（必填）
  --participant <value>   参会人员（必填）
  --room <value>          会议室
  --dept <value>          所属部门
  --object-type <value>   关联类型(story | task | bug | issue | risk | opportunity)
  --object-id <value>     关联对象
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project | project | body | integer | 是 | — | 所属项目<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 会议名称<br>{} |
| --begin | begin | body | string | 是 | — | 开始时间<br>{} |
| --end | end | body | string | 是 | — | 结束时间<br>{} |
| --mode | mode | body | string | 是 | — | 会议模式(online 线上 \| outline 线下 \| both 线上+线下)<br>{} |
| --host | host | body | string | 是 | — | 主持人<br>{} |
| --participant | participant | body | array | 是 | — | 参会人员<br>{"items":{"type":"string"}} |
| --room | room | body | integer | 否 | — | 会议室<br>{"format":"int32"} |
| --dept | dept | body | integer | 否 | — | 所属部门<br>{"format":"int32"} |
| --object-type | objectType | body | string | 否 | — | 关联类型(story \| task \| bug \| issue \| risk \| opportunity)<br>{} |
| --object-id | objectID | body | integer | 否 | — | 关联对象<br>{"format":"int32"} |

<a id="action-meeting-get"></a>

## zentao meeting get

```text
Usage: zentao meeting get [options] [target]

获取会议详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                单个 meetingID；也可使用命名参数

Options:
  --meeting-id <value>  会议ID（必填）
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --fields <fields>     返回字段，逗号分隔
  --html-to-markdown    显式将富文本字段转换为 Markdown
  -h, --help            显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --meeting-id | meetingID | path | integer | 是 | — | 会议ID<br>{} |

<a id="action-meeting-update"></a>

## zentao meeting update

```text
Usage: zentao meeting update [options] [target]

修改会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 meetingID；也可使用命名参数

Options:
  --meeting-id <value>    会议ID（必填）
  --name <value>          会议名称（必填）
  --begin <value>         开始时间（必填）
  --end <value>           结束时间（必填）
  --mode <value>          会议模式(online 线上 | outline 线下 | both 线上+线下)（必填）
  --host <value>          主持人（必填）
  --participant <value>   参会人员（必填）
  --room <value>          会议室
  --dept <value>          所属部门
  --object-type <value>   关联类型(story | task | bug | issue | risk | opportunity)
  --object-id <value>     关联对象
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --meeting-id | meetingID | path | integer | 是 | — | 会议ID<br>{} |
| --name | name | body | string | 是 | — | 会议名称<br>{} |
| --begin | begin | body | string | 是 | — | 开始时间<br>{} |
| --end | end | body | string | 是 | — | 结束时间<br>{} |
| --mode | mode | body | string | 是 | — | 会议模式(online 线上 \| outline 线下 \| both 线上+线下)<br>{} |
| --host | host | body | string | 是 | — | 主持人<br>{} |
| --participant | participant | body | array | 是 | — | 参会人员<br>{"items":{"type":"string"}} |
| --room | room | body | integer | 否 | — | 会议室<br>{"format":"int32"} |
| --dept | dept | body | integer | 否 | — | 所属部门<br>{"format":"int32"} |
| --object-type | objectType | body | string | 否 | — | 关联类型(story \| task \| bug \| issue \| risk \| opportunity)<br>{} |
| --object-id | objectID | body | integer | 否 | — | 关联对象<br>{"format":"int32"} |

<a id="action-meeting-delete"></a>

## zentao meeting delete

```text
Usage: zentao meeting delete [options] [target]

删除会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                单个 meetingID；也可使用命名参数

Options:
  --meeting-id <value>  会议ID（必填）
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --yes                 确认删除
  -h, --help            显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --meeting-id | meetingID | path | integer | 是 | — | 会议ID<br>{} |

<a id="action-meeting-minutes"></a>

## zentao meeting minutes

```text
Usage: zentao meeting minutes [options] [target]

编辑会议纪要（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 meetingID；也可使用命名参数

Options:
  --meeting-id <value>    会议ID（必填）
  --minutes <value>       会议纪要
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --meeting-id | meetingID | path | integer | 是 | — | 会议ID<br>{} |
| --minutes | minutes | body | string | 否 | — | 会议纪要<br>{} |

<a id="module-feedback"></a>

## 反馈 · feedback

```text
Usage: zentao feedback [options] [command]

反馈

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  list [options] [target]           获取反馈列表，支持获取产品下的反馈（最低版本：22.0 / biz13.0 /
                                    max8.0 / ipd5.0）
  create [options]                  创建反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  create-bug [options] [target]     反馈转Bug（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  create-ticket [options] [target]  反馈转工单（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-todo [options] [target]    反馈转待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-story [options] [target]   反馈转需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-task [options] [target]    反馈转任务（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get [options] [target]            获取反馈详情（最低版本：22.0 / biz13.0 / max8.0 /
                                    ipd5.0）
  update [options] [target]         修改反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]         删除反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  activate [options] [target]       激活反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]          关闭反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-feedback-list"></a>

## zentao feedback list

```text
Usage: zentao feedback list [options] [target]

获取反馈列表，支持获取产品下的反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --browse-type <value>     状态，默认是wait
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --browse-type | browseType | query | string | 否 | "wait" | 状态，默认是wait<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"待处理"},{"value":"doing","label":"处理中"},{"value":"toclosed","label":"待关闭"},{"value":"review","label":"待评审"},{"value":"assigntome","label":"指派给我"},{"value":"openedbyme","label":"由我反馈"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-feedback-create"></a>

## zentao feedback create

```text
Usage: zentao feedback create [options]

创建反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product <value>       所属产品（必填）
  --title <value>         标题（必填）
  --module <value>        所属模块
  --type <value>          类型(story 需求 | task 任务 | bug Bug | todo 待办 | advice 建议
                          | issue 问题 | risk 风险 | opportunity 机会)
  --desc <value>          描述
  --feedback-by <value>   反馈者
  --source <value>        来源
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product | product | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 标题<br>{} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 类型(story 需求 \| task 任务 \| bug Bug \| todo 待办 \| advice 建议 \| issue 问题 \| risk 风险 \| opportunity 机会)<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |
| --feedback-by | feedbackBy | body | string | 否 | — | 反馈者<br>{} |
| --source | source | body | string | 否 | — | 来源<br>{} |

<a id="action-feedback-create-bug"></a>

## zentao feedback create-bug

```text
Usage: zentao feedback create-bug [options] [target]

反馈转Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>   反馈ID（必填）
  --product-id <value>    所属产品（必填）
  --title <value>         Bug标题（必填）
  --opened-build <value>  影响版本，主干是trunk，其他版本使用版本ID（必填）
  --severity <value>      严重程度(1-4)
  --pri <value>           优先级
  --type <value>          Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 |
                          security 安全相关 | performance 性能问题 | standard 标准规范 |
                          automation 测试脚本 | designdefect 设计缺陷 | others 其他)
  --steps <value>         重现步骤
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | Bug标题<br>{} |
| --opened-build | openedBuild | body | array | 是 | — | 影响版本，主干是trunk，其他版本使用版本ID<br>{"items":{"type":"string"}} |
| --severity | severity | body | integer | 否 | — | 严重程度(1-4)<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他)<br>{} |
| --steps | steps | body | string | 否 | — | 重现步骤<br>{} |

<a id="action-feedback-create-ticket"></a>

## zentao feedback create-ticket

```text
Usage: zentao feedback create-ticket [options] [target]

反馈转工单（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>   反馈ID（必填）
  --product <value>       所属产品（必填）
  --module <value>        所属模块（必填）
  --title <value>         工单标题（必填）
  --type <value>          类型(code 程序报错 | data 数据错误 | stuck 流程卡断 | security 安全问题
                          | affair 事务)
  --desc <value>          工单描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --product | product | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --module | module | body | integer | 是 | — | 所属模块<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 工单标题<br>{} |
| --type | type | body | string | 否 | — | 类型(code 程序报错 \| data 数据错误 \| stuck 流程卡断 \| security 安全问题 \| affair 事务)<br>{} |
| --desc | desc | body | string | 否 | — | 工单描述<br>{} |

<a id="action-feedback-create-todo"></a>

## zentao feedback create-todo

```text
Usage: zentao feedback create-todo [options] [target]

反馈转待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>   反馈ID（必填）
  --date <value>          日期（必填）
  --name <value>          待办名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --date | date | body | string | 是 | — | 日期<br>{} |
| --name | name | body | string | 是 | — | 待办名称<br>{} |

<a id="action-feedback-create-story"></a>

## zentao feedback create-story

```text
Usage: zentao feedback create-story [options] [target]

反馈转需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>   反馈ID（必填）
  --product-id <value>    所属产品（必填）
  --title <value>         需求标题（必填）
  --spec <value>          需求描述
  --pri <value>           优先级
  --category <value>      类别
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 需求标题<br>{} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --category | category | body | string | 否 | — | 类别<br>{} |

<a id="action-feedback-create-task"></a>

## zentao feedback create-task

```text
Usage: zentao feedback create-task [options] [target]

反馈转任务（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                   单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>    反馈ID（必填）
  --execution-id <value>   所属执行（必填）
  --name <value>           任务名称（必填）
  --type <value>           任务类型
  --assigned-to <value>    指派给
  --est-started <value>    预计开始
  --data-deadline <value>  截止日期
  --desc <value>           任务描述
  --execution <id>         executionID 或 scope/scopeID 别名
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  -h, --help               显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --execution-id | executionID | body | integer | 是 | — | 所属执行<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 任务名称<br>{} |
| --type | type | body | string | 否 | — | 任务类型<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --est-started | estStarted | body | string | 否 | — | 预计开始<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --desc | desc | body | string | 否 | — | 任务描述<br>{} |

<a id="action-feedback-get"></a>

## zentao feedback get

```text
Usage: zentao feedback get [options] [target]

获取反馈详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                 单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>  反馈ID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --fields <fields>      返回字段，逗号分隔
  --html-to-markdown     显式将富文本字段转换为 Markdown
  -h, --help             显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |

<a id="action-feedback-update"></a>

## zentao feedback update

```text
Usage: zentao feedback update [options] [target]

修改反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>   反馈ID（必填）
  --product <value>       所属产品（必填）
  --module <value>        所属模块
  --title <value>         标题（必填）
  --type <value>          类型(story 需求 | task 任务 | bug Bug | todo 待办 | advice 建议
                          | issue 问题 | risk 风险 | opportunity 机会)
  --desc <value>          描述
  --feedback-by <value>   反馈者
  --source <value>        来源
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --product | product | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 标题<br>{} |
| --type | type | body | string | 否 | — | 类型(story 需求 \| task 任务 \| bug Bug \| todo 待办 \| advice 建议 \| issue 问题 \| risk 风险 \| opportunity 机会)<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |
| --feedback-by | feedbackBy | body | string | 否 | — | 反馈者<br>{} |
| --source | source | body | string | 否 | — | 来源<br>{} |

<a id="action-feedback-delete"></a>

## zentao feedback delete

```text
Usage: zentao feedback delete [options] [target]

删除反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                 单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>  反馈ID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --yes                  确认删除
  -h, --help             显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |

<a id="action-feedback-activate"></a>

## zentao feedback activate

```text
Usage: zentao feedback activate [options] [target]

激活反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>   反馈ID（必填）
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-feedback-close"></a>

## zentao feedback close

```text
Usage: zentao feedback close [options] [target]

关闭反馈（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 feedbackID；也可使用命名参数

Options:
  --feedback-id <value>    反馈ID（必填）
  --closed-reason <value>  关闭原因(commented 已处理 | repeat 重复 | refuse 不予采纳)（必填）
  --comment <value>        备注
  --confirm-close <value>  存在未关闭转化对象时是否强制关闭
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --feedback-id | feedbackID | path | integer | 是 | — | 反馈ID<br>{} |
| --closed-reason | closedReason | body | string | 是 | — | 关闭原因(commented 已处理 \| repeat 重复 \| refuse 不予采纳)<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |
| --confirm-close | confirmClose | body | string | 否 | — | 存在未关闭转化对象时是否强制关闭<br>{} |

<a id="module-ticket"></a>

## 工单 · ticket

```text
Usage: zentao ticket [options] [command]

工单

Options:
  -h, --help                       显示命令帮助

Commands:
  props                            返回对象字段定义（离线）
  list [options] [target]          获取工单列表，支持获取产品下的工单（最低版本：22.0 / biz13.0 /
                                   max8.0 / ipd5.0）
  create [options]                 创建工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  create-story [options] [target]  工单转需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-bug [options] [target]    工单转Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get [options] [target]           获取工单详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]        修改工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]        删除工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  activate [options] [target]      激活工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  close [options] [target]         关闭工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-ticket-list"></a>

## zentao ticket list

```text
Usage: zentao ticket list [options] [target]

获取工单列表，支持获取产品下的工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --browse-type <value>     状态，默认是wait
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedCount,activatedDate,assignedTo,closedBy,closedDate,closedReason,contact,customer,deadline,desc,editedBy,editedDate,feedback,id,keywords,mailto,module,notifyEmail,openedBuild,openedBy,openedDate,pri,product,resolution,resolvedBy,resolvedDate,startedBy,startedDate,status,title,type
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --browse-type | browseType | query | string | 否 | "wait" | 状态，默认是wait<br>{"options":[{"value":"all","label":"全部"},{"value":"unclosed","label":"未关闭"},{"value":"wait","label":"待处理"},{"value":"doing","label":"处理中"},{"value":"done","label":"待关闭"},{"value":"finishedbyme","label":"由我解决"},{"value":"assigntome","label":"指派给我"},{"value":"openedbyme","label":"由我创建"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedCount,activatedDate,assignedTo,closedBy,closedDate,closedReason,contact,customer,deadline,desc,editedBy,editedDate,feedback,id,keywords,mailto,module,notifyEmail,openedBuild,openedBy,openedDate,pri,product,resolution,resolvedBy,resolvedDate,startedBy,startedDate,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-ticket-create"></a>

## zentao ticket create

```text
Usage: zentao ticket create [options]

创建工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product <value>        所属产品（必填）
  --module <value>         所属模块
  --title <value>          标题（必填）
  --type <value>           类型(code 程序报错 | data 数据错误 | stuck 流程卡断 | security 安全问题
                           | affair 事务)
  --desc <value>           描述
  --assigned-to <value>    指派给
  --data-deadline <value>  截止日期
  --opened-build <value>   影响版本
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product | product | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 标题<br>{} |
| --type | type | body | string | 否 | — | 类型(code 程序报错 \| data 数据错误 \| stuck 流程卡断 \| security 安全问题 \| affair 事务)<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --opened-build | openedBuild | body | array | 否 | — | 影响版本<br>{"items":{"type":"string"}} |

<a id="action-ticket-create-story"></a>

## zentao ticket create-story

```text
Usage: zentao ticket create-story [options] [target]

工单转需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>     工单ID（必填）
  --product-id <value>    所属产品（必填）
  --title <value>         需求标题（必填）
  --spec <value>          需求描述
  --pri <value>           优先级
  --category <value>      类别
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 需求标题<br>{} |
| --spec | spec | body | string | 否 | — | 需求描述<br>{} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --category | category | body | string | 否 | — | 类别<br>{} |

<a id="action-ticket-create-bug"></a>

## zentao ticket create-bug

```text
Usage: zentao ticket create-bug [options] [target]

工单转Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>     工单ID（必填）
  --product-id <value>    所属产品（必填）
  --title <value>         Bug标题（必填）
  --opened-build <value>  影响版本，主干是trunk，其他版本使用版本ID（必填）
  --severity <value>      严重程度(1-4)
  --pri <value>           优先级
  --type <value>          Bug类型(codeerror 代码错误 | config 配置相关 | install 安装部署 |
                          security 安全相关 | performance 性能问题 | standard 标准规范 |
                          automation 测试脚本 | designdefect 设计缺陷 | others 其他)
  --steps <value>         重现步骤
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | Bug标题<br>{} |
| --opened-build | openedBuild | body | array | 是 | — | 影响版本，主干是trunk，其他版本使用版本ID<br>{"items":{"type":"string"}} |
| --severity | severity | body | integer | 否 | — | 严重程度(1-4)<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他)<br>{} |
| --steps | steps | body | string | 否 | — | 重现步骤<br>{} |

<a id="action-ticket-get"></a>

## zentao ticket get

```text
Usage: zentao ticket get [options] [target]

获取工单详情（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target               单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>  工单ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --fields <fields>    返回字段，逗号分隔
  --html-to-markdown   显式将富文本字段转换为 Markdown
  -h, --help           显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |

<a id="action-ticket-update"></a>

## zentao ticket update

```text
Usage: zentao ticket update [options] [target]

修改工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>      工单ID（必填）
  --product <value>        所属产品
  --module <value>         所属模块
  --title <value>          标题
  --type <value>           类型(code 程序报错 | data 数据错误 | stuck 流程卡断 | security 安全问题
                           | affair 事务)
  --desc <value>           描述
  --assigned-to <value>    指派给
  --data-deadline <value>  截止日期
  --opened-build <value>   影响版本
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |
| --product | product | body | integer | 否 | — | 所属产品<br>{"format":"int32"} |
| --module | module | body | integer | 否 | — | 所属模块<br>{"format":"int32"} |
| --title | title | body | string | 否 | — | 标题<br>{} |
| --type | type | body | string | 否 | — | 类型(code 程序报错 \| data 数据错误 \| stuck 流程卡断 \| security 安全问题 \| affair 事务)<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 截止日期<br>{} |
| --opened-build | openedBuild | body | array | 否 | — | 影响版本<br>{"items":{"type":"string"}} |

<a id="action-ticket-delete"></a>

## zentao ticket delete

```text
Usage: zentao ticket delete [options] [target]

删除工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target               单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>  工单ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |

<a id="action-ticket-activate"></a>

## zentao ticket activate

```text
Usage: zentao ticket activate [options] [target]

激活工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>     工单ID（必填）
  --assigned-to <value>   指派给
  --comment <value>       备注
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --comment | comment | body | string | 否 | — | 备注<br>{} |

<a id="action-ticket-close"></a>

## zentao ticket close

```text
Usage: zentao ticket close [options] [target]

关闭工单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                   单个 ticketID；也可使用命名参数

Options:
  --ticket-id <value>      工单ID（必填）
  --closed-reason <value>  关闭原因(commented 已处理 | repeat 重复 | refuse 不予处理)（必填）
  --comment <value>        备注（必填）
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --ticket-id | ticketID | path | integer | 是 | — | 工单ID<br>{} |
| --closed-reason | closedReason | body | string | 是 | — | 关闭原因(commented 已处理 \| repeat 重复 \| refuse 不予处理)<br>{} |
| --comment | comment | body | string | 是 | — | 备注<br>{} |

<a id="module-system"></a>

## 应用 · system

```text
Usage: zentao system [options] [command]

应用

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options] [target]    获取应用列表，支持获取产品下的应用（最低版本：22.0 / biz13.0 / max8.0 /
                             ipd5.0）
  create [options]           创建应用（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改应用（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-system-list"></a>

## zentao system list

```text
Usage: zentao system list [options] [target]

获取应用列表，支持获取产品下的应用（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --order-by <value>        排序
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-system-create"></a>

## zentao system create

```text
Usage: zentao system create [options]

创建应用（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    所属产品（必填）
  --integrated <value>    是否集成应用(0 否| 1 是)（必填）
  --children <value>      集成应用需要包含其他应用，非集成应用传空数组[]（必填）
  --name <value>          应用名称（必填）
  --desc <value>          描述
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --integrated | integrated | body | integer | 是 | — | 是否集成应用(0 否\| 1 是)<br>{"format":"int32"} |
| --children | children | body | array | 是 | — | 集成应用需要包含其他应用，非集成应用传空数组[]<br>{"items":{"type":"string"}} |
| --name | name | body | string | 是 | — | 应用名称<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-system-update"></a>

## zentao system update

```text
Usage: zentao system update [options] [target]

修改应用（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 systemID；也可使用命名参数

Options:
  --system-id <value>     应用ID（必填）
  --name <value>          应用名称（必填）
  --children <value>      集成应用需要包含其他应用，非集成应用传空数组[]（必填）
  --desc <value>          描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --system-id | systemID | path | integer | 是 | — | 应用ID<br>{} |
| --name | name | body | string | 是 | — | 应用名称<br>{} |
| --children | children | body | array | 是 | — | 集成应用需要包含其他应用，非集成应用传空数组[]<br>{"items":{"type":"string"}} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="module-build"></a>

## 版本 · build

```text
Usage: zentao build [options] [command]

版本

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options]             获取版本列表，支持获取项目/执行下的版本（最低版本：22.0 / biz13.0 / max8.0 /
                             ipd5.0）
  create [options]           创建版本/构建（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改版本（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]  删除版本（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-build-list"></a>

## zentao build list

```text
Usage: zentao build list [options]

获取版本列表，支持获取项目/执行下的版本（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --scope <value>           版本所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：name(名称，示例：关键字)；system(所属应用，示例：all)；id(ID，示例：1)；product(所属产品，产品，示例：1)；scmPath(源代码地址，示例：关键字)；filePath(下载地址，示例：关键字)；date(打包日期，示例：2026-01-01)；builder(构建者，用户，示例：admin)；desc(描述，示例：关键字)
  --group-join <value>      条件组之间的连接方式
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 版本所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"active","label":"有效"},{"value":"closed","label":"已关闭"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"date_asc","label":"日期 升序"},{"value":"date_desc","label":"日期 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(名称，示例：关键字)；system(所属应用，示例：all)；id(ID，示例：1)；product(所属产品，产品，示例：1)；scmPath(源代码地址，示例：关键字)；filePath(下载地址，示例：关键字)；date(打包日期，示例：2026-01-01)；builder(构建者，用户，示例：admin)；desc(描述，示例：关键字)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-build-create"></a>

## zentao build create

```text
Usage: zentao build create [options]

创建版本/构建（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --execution-id <value>  所属执行/迭代（必填）
  --product <value>       所属产品（必填）
  --name <value>          构建名称（必填）
  --system <value>        所属应用（必填）
  --builder <value>       构建者（必填）
  --date <value>          打包日期（必填）
  --scm-path <value>      源代码地址
  --file-path <value>     下载地址
  --desc <value>          描述
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | body | integer | 是 | — | 所属执行/迭代<br>{"format":"int32"} |
| --product | product | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 构建名称<br>{} |
| --system | system | body | integer | 是 | — | 所属应用<br>{"format":"int32"} |
| --builder | builder | body | string | 是 | — | 构建者<br>{} |
| --date | date | body | string | 是 | — | 打包日期<br>{} |
| --scm-path | scmPath | body | string | 否 | — | 源代码地址<br>{} |
| --file-path | filePath | body | string | 否 | — | 下载地址<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-build-update"></a>

## zentao build update

```text
Usage: zentao build update [options] [target]

修改版本（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 buildID；也可使用命名参数

Options:
  --build-id <value>      版本ID（必填）
  --execution <value>     所属执行/迭代（必填）
  --product <value>       所属产品（必填）
  --name <value>          构建名称（必填）
  --system <value>        所属应用（必填）
  --builder <value>       构建者（必填）
  --date <value>          打包日期（必填）
  --scm-path <value>      源代码地址
  --file-path <value>     下载地址
  --desc <value>          描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --build-id | buildID | path | integer | 是 | — | 版本ID<br>{} |
| --execution | execution | body | integer | 是 | — | 所属执行/迭代<br>{"format":"int32"} |
| --product | product | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 构建名称<br>{} |
| --system | system | body | integer | 是 | — | 所属应用<br>{"format":"int32"} |
| --builder | builder | body | string | 是 | — | 构建者<br>{} |
| --date | date | body | string | 是 | — | 打包日期<br>{} |
| --scm-path | scmPath | body | string | 否 | — | 源代码地址<br>{} |
| --file-path | filePath | body | string | 否 | — | 下载地址<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-build-delete"></a>

## zentao build delete

```text
Usage: zentao build delete [options] [target]

删除版本（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target              单个 buildID；也可使用命名参数

Options:
  --build-id <value>  版本ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --build-id | buildID | path | integer | 是 | — | 版本ID<br>{} |

<a id="module-testtask"></a>

## 测试单 · testtask

```text
Usage: zentao testtask [options] [command]

测试单

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options]             获取测试单列表，支持获取产品/项目/执行下的测试单（最低版本：22.0 / biz13.0 /
                             max8.0 / ipd5.0）
  create [options]           创建测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]  删除测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-testtask-list"></a>

## zentao testtask list

```text
Usage: zentao testtask list [options]

获取测试单列表，支持获取产品/项目/执行下的测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --scope <value>           测试单所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --product <id>            productID 或 scope/scopeID 别名
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 测试单所属范围<br>{"options":[{"value":"products","label":"产品"},{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"未开始"},{"value":"doing","label":"进行中"},{"value":"done","label":"已完成"},{"value":"blocked","label":"阻塞"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-testtask-create"></a>

## zentao testtask create

```text
Usage: zentao testtask create [options]

创建测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    所属产品ID（必填）
  --name <value>          测试单名称（必填）
  --build <value>         提测构建/版本（必填）
  --execution <value>     所属执行
  --type <value>          类型(integrate 集成测试 | system 系统测试 | acceptance 验收测试 |
                          performance 性能测试 | safety 安全测试)
  --owner <value>         负责人
  --status <value>        状态(wait 未开始 | doing 进行中 | done 已关闭 | blocked 被阻塞)
  --begin <value>         开始日期（必填）
  --end <value>           结束日期（必填）
  --desc <value>          描述
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 所属产品ID<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 测试单名称<br>{} |
| --build | build | body | integer | 是 | — | 提测构建/版本<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --type | type | body | array | 否 | — | 类型(integrate 集成测试 \| system 系统测试 \| acceptance 验收测试 \| performance 性能测试 \| safety 安全测试)<br>{"items":{"type":"string"}} |
| --owner | owner | body | string | 否 | — | 负责人<br>{} |
| --status | status | body | string | 否 | — | 状态(wait 未开始 \| doing 进行中 \| done 已关闭 \| blocked 被阻塞)<br>{} |
| --begin | begin | body | string | 是 | — | 开始日期<br>{} |
| --end | end | body | string | 是 | — | 结束日期<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-testtask-update"></a>

## zentao testtask update

```text
Usage: zentao testtask update [options] [target]

修改测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 testtaskID；也可使用命名参数

Options:
  --testtask-id <value>   测试单ID（必填）
  --name <value>          测试单名称（必填）
  --build <value>         提测构建/版本（必填）
  --execution <value>     所属执行
  --type <value>          类型(integrate 集成测试 | system 系统测试 | acceptance 验收测试 |
                          performance 性能测试 | safety 安全测试)
  --owner <value>         负责人
  --status <value>        状态(wait 未开始 | doing 进行中 | done 已关闭 | blocked 被阻塞)
  --begin <value>         开始日期（必填）
  --end <value>           结束日期（必填）
  --desc <value>          描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --testtask-id | testtaskID | path | integer | 是 | — | 测试单ID<br>{} |
| --name | name | body | string | 是 | — | 测试单名称<br>{} |
| --build | build | body | integer | 是 | — | 提测构建/版本<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行<br>{"format":"int32"} |
| --type | type | body | array | 否 | — | 类型(integrate 集成测试 \| system 系统测试 \| acceptance 验收测试 \| performance 性能测试 \| safety 安全测试)<br>{"items":{"type":"string"}} |
| --owner | owner | body | string | 否 | — | 负责人<br>{} |
| --status | status | body | string | 否 | — | 状态(wait 未开始 \| doing 进行中 \| done 已关闭 \| blocked 被阻塞)<br>{} |
| --begin | begin | body | string | 是 | — | 开始日期<br>{} |
| --end | end | body | string | 是 | — | 结束日期<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-testtask-delete"></a>

## zentao testtask delete

```text
Usage: zentao testtask delete [options] [target]

删除测试单（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                 单个 testtaskID；也可使用命名参数

Options:
  --testtask-id <value>  测试单ID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --yes                  确认删除
  -h, --help             显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --testtask-id | testtaskID | path | integer | 是 | — | 测试单ID<br>{} |

<a id="module-release"></a>

## 发布 · release

```text
Usage: zentao release [options] [command]

发布

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options] [target]    获取发布列表，支持获取产品下的发布（最低版本：22.0 / biz13.0 / max8.0 /
                             ipd5.0）
  create [options]           创建发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  update [options] [target]  修改发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
  delete [options] [target]  删除发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-release-list"></a>

## zentao release list

```text
Usage: zentao release list [options] [target]

获取发布列表，支持获取产品下的发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      所属产品ID（必填）
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：name(应用版本号，示例：关键字)；branch(平台/分支，示例：all)；id(ID，示例：1)；build(包含构建，示例：all)；status(发布状态，枚举：wait
                            未开始 | normal 已发布 | fail 发布失败 | terminate
                            停止维护)；date(计划发布日期，示例：2026-01-01)；marker(里程碑，枚举：1 是 |
                            0 否)
  --group-join <value>      条件组之间的连接方式
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 所属产品ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"未开始"},{"value":"normal","label":"已发布"},{"value":"fail","label":"发布失败"},{"value":"terminate","label":"停止维护"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"date_asc","label":"日期 升序"},{"value":"date_desc","label":"日期 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(应用版本号，示例：关键字)；branch(平台/分支，示例：all)；id(ID，示例：1)；build(包含构建，示例：all)；status(发布状态，枚举：wait 未开始 \| normal 已发布 \| fail 发布失败 \| terminate 停止维护)；date(计划发布日期，示例：2026-01-01)；marker(里程碑，枚举：1 是 \| 0 否)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-release-create"></a>

## zentao release create

```text
Usage: zentao release create [options]

创建发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --product-id <value>    所属产品（必填）
  --system <value>        所属应用（必填）
  --name <value>          应用版本号（必填）
  --build <value>         包含构建（必填）
  --status <value>        状态(wait 未开始 | normal 已发布 | fail 发布失败 | terminate 停止维护)
  --date <value>          计划发布日期（必填）
  --desc <value>          描述
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | body | integer | 是 | — | 所属产品<br>{"format":"int32"} |
| --system | system | body | integer | 是 | — | 所属应用<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 应用版本号<br>{} |
| --build | build | body | array | 是 | — | 包含构建<br>{"items":{"type":"string"}} |
| --status | status | body | string | 否 | — | 状态(wait 未开始 \| normal 已发布 \| fail 发布失败 \| terminate 停止维护)<br>{} |
| --date | date | body | string | 是 | — | 计划发布日期<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-release-update"></a>

## zentao release update

```text
Usage: zentao release update [options] [target]

修改发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                  单个 releaseID；也可使用命名参数

Options:
  --release-id <value>    发布ID（必填）
  --system <value>        所属应用（必填）
  --name <value>          应用版本号（必填）
  --build <value>         包含构建（必填）
  --status <value>        状态(wait 未开始 | normal 已发布 | fail 发布失败 | terminate 停止维护)
  --date <value>          计划发布日期（必填）
  --desc <value>          描述
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --release-id | releaseID | path | integer | 是 | — | 发布ID<br>{} |
| --system | system | body | integer | 是 | — | 所属应用<br>{"format":"int32"} |
| --name | name | body | string | 是 | — | 应用版本号<br>{} |
| --build | build | body | array | 是 | — | 包含构建<br>{"items":{"type":"string"}} |
| --status | status | body | string | 否 | — | 状态(wait 未开始 \| normal 已发布 \| fail 发布失败 \| terminate 停止维护)<br>{} |
| --date | date | body | string | 是 | — | 计划发布日期<br>{} |
| --desc | desc | body | string | 否 | — | 描述<br>{} |

<a id="action-release-delete"></a>

## zentao release delete

```text
Usage: zentao release delete [options] [target]

删除发布（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target                单个 releaseID；也可使用命名参数

Options:
  --release-id <value>  发布ID（必填）
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --yes                 确认删除
  -h, --help            显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --release-id | releaseID | path | integer | 是 | — | 发布ID<br>{} |

<a id="module-file"></a>

## 附件 · file

```text
Usage: zentao file [options] [command]

附件

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  create [options]           上传附件，使用【表单formdata】方式提交，不支持json（最低版本：22.0 / biz13.0
                             / max8.0 / ipd5.0）
  update [options] [target]  编辑附件，修改附件的名称（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete [options] [target]  删除附件（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）
```

<a id="action-file-create"></a>

## zentao file create

```text
Usage: zentao file create [options]

上传附件，使用【表单formdata】方式提交，不支持json（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Options:
  --file <value>          本地文件路径，将按 multipart/form-data 上传（必填）
  --object-type <value>   关联对象类型(bug 缺陷 | story 需求 | task 任务 | testcase 用例)（必填）
  --object-id <value>     关联对象ID（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：是，HTTP MCP 不可用。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --file | file | body | string | 是 | — | 本地文件路径，将按 multipart/form-data 上传<br>{"format":"binary"} |
| --object-type | objectType | body | string | 是 | — | 关联对象类型(bug 缺陷 \| story 需求 \| task 任务 \| testcase 用例)<br>{} |
| --object-id | objectID | body | integer | 是 | — | 关联对象ID<br>{"format":"int32"} |

<a id="action-file-update"></a>

## zentao file update

```text
Usage: zentao file update [options] [target]

编辑附件，修改附件的名称（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 fileID；也可使用命名参数

Options:
  --file-id <value>       附件ID（必填）
  --file-name <value>     附件名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --file-id | fileID | path | integer | 是 | — | 附件ID<br>{} |
| --file-name | fileName | body | string | 是 | — | 附件名称<br>{} |

<a id="action-file-delete"></a>

## zentao file delete

```text
Usage: zentao file delete [options] [target]

删除附件（最低版本：22.0 / biz13.0 / max8.0 / ipd5.0）

Arguments:
  target             单个 fileID；也可使用命名参数

Options:
  --file-id <value>  附件ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.0 / biz13.0 / max8.0 / ipd5.0。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --file-id | fileID | path | integer | 是 | — | 附件ID<br>{} |

<a id="module-workflow"></a>

## 工作流 · workflow

```text
Usage: zentao workflow [options] [command]

工作流

Options:
  -h, --help                                  显示命令帮助

Commands:
  props                                       返回对象字段定义（离线）
  list [options]                              获取工作流数据列表(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get-contract [options]                      获取工作流数据详情(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  flows [options]                             获取工作流列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  fields [options] [target]                   获取工作流字段列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  actions [options] [target]                  获取工作流动作列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  labels [options] [target]                   获取工作流标签列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  tables [options] [target]                   获取工作流数据表列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  datasources [options]                       获取数据源列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  rules [options]                             获取规则列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create [options]                            创建工作流数据(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-flow [options]                       创建工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  copy-flow [options] [target]                复制工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create-field [options] [target]             创建工作流字段（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create-action [options] [target]            创建工作流动作（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create-label [options] [target]             创建工作流标签（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create-table [options] [target]             创建工作流数据表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create-datasource [options]                 创建数据源（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create-rule [options]                       创建规则（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-flow [options] [target]                 获取工作流详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-field [options] [target]                获取工作流字段详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-action [options] [target]               获取工作流动作详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-label [options] [target]                获取工作流标签详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-table [options] [target]                获取工作流数据表详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-datasource [options] [target]           获取数据源详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get-rule [options] [target]                 获取规则详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update [options] [target]                   修改工作流数据(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  update-flow [options] [target]              修改工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update-field [options] [target]             修改工作流字段（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update-action [options] [target]            修改工作流动作（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update-label [options] [target]             修改工作流标签（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update-table [options] [target]             修改工作流数据表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update-datasource [options] [target]        修改数据源（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update-rule [options] [target]              修改规则（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete [options] [target]                   删除工作流事项(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete-flow [options] [target]              删除工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete-field [options] [target]             删除工作流字段（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete-action [options] [target]            删除工作流动作（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete-label [options] [target]             删除工作流标签（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete-table [options] [target]             删除工作流数据表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete-datasource [options] [target]        删除数据源（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete-rule [options] [target]              删除规则（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  activate-flow [options] [target]            启用工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  deactivate-flow [options] [target]          停用工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  release-flow [options] [target]             发布工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-approval [options] [target]             设置工作流审批（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-action-css [options] [target]           设置动作CSS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-flow-css [options] [target]             设置工作流CSS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-export [options] [target]               设置字段导出（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-fulltext-search [options] [target]      设置工作流全文检索（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-action-js [options] [target]            设置动作JS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-flow-js [options] [target]              设置工作流JS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-action-notice [options] [target]        设置动作通知（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-search [options] [target]               设置字段搜索（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-value [options] [target]                设置字段取值（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  set-action-verification [options] [target]  设置动作验证（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-workflow-list"></a>

## zentao workflow list

```text
Usage: zentao workflow list [options]

获取工作流数据列表(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-workflow-get-contract"></a>

## zentao workflow get-contract

```text
Usage: zentao workflow get-contract [options]

获取工作流数据详情(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-workflow-flows"></a>

## zentao workflow flows

```text
Usage: zentao workflow flows [options]

获取工作流列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --status <value>          工作流状态
  --app <value>             所属应用，不传时不限。
  --only-custom <value>     是否只显示自定义工作流
  --order-by <value>        排序字段，默认 id_desc。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：app,createdBy,createdDate,desc,id,name
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --status | status | query | string | 否 | — | 工作流状态<br>{"options":[{"value":"normal","label":"正常"},{"value":"wait","label":"待发布"},{"value":"pause","label":"已停用"}]} |
| --app | app | query | string | 否 | — | 所属应用，不传时不限。<br>{} |
| --only-custom | onlyCustom | query | number | 否 | — | 是否只显示自定义工作流<br>{"options":[{"value":"0","label":"全部"},{"value":"1","label":"仅自定义"}]} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：app,createdBy,createdDate,desc,id,name<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-workflow-fields"></a>

## zentao workflow fields

```text
Usage: zentao workflow fields [options] [target]

获取工作流字段列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 module；也可使用命名参数

Options:
  --module <value>          module（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |

<a id="action-workflow-actions"></a>

## zentao workflow actions

```text
Usage: zentao workflow actions [options] [target]

获取工作流动作列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 module；也可使用命名参数

Options:
  --module <value>          module（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |

<a id="action-workflow-labels"></a>

## zentao workflow labels

```text
Usage: zentao workflow labels [options] [target]

获取工作流标签列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 module；也可使用命名参数

Options:
  --module <value>          module（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |

<a id="action-workflow-tables"></a>

## zentao workflow tables

```text
Usage: zentao workflow tables [options] [target]

获取工作流数据表列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 module；也可使用命名参数

Options:
  --module <value>          module（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |

<a id="action-workflow-datasources"></a>

## zentao workflow datasources

```text
Usage: zentao workflow datasources [options]

获取数据源列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-workflow-rules"></a>

## zentao workflow rules

```text
Usage: zentao workflow rules [options]

获取规则列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-workflow-create"></a>

## zentao workflow create

```text
Usage: zentao workflow create [options]

创建工作流数据(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --name <value>          合同名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 合同名称<br>{} |

<a id="action-workflow-create-flow"></a>

## zentao workflow create-flow

```text
Usage: zentao workflow create-flow [options]

创建工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --module <value>        工作流代号，只能包含英文字母。（必填）
  --name <value>          工作流名称。（必填）
  --navigator <value>     所属导航(primary 主导航 | secondary 二级导航)。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | body | string | 是 | — | 工作流代号，只能包含英文字母。<br>{} |
| --name | name | body | string | 是 | — | 工作流名称。<br>{} |
| --navigator | navigator | body | string | 否 | — | 所属导航(primary 主导航 \| secondary 二级导航)。<br>{} |

<a id="action-workflow-copy-flow"></a>

## zentao workflow copy-flow

```text
Usage: zentao workflow copy-flow [options] [target]

复制工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 flowID；也可使用命名参数

Options:
  --flow-id <value>       flowID（必填）
  --module <value>        新工作流代号，只能包含英文字母。（必填）
  --name <value>          新工作流名称。（必填）
  --navigator <value>     所属导航(primary 主导航 | secondary 二级导航)。
  --position <value>      菜单位置。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |
| --module | module | body | string | 是 | — | 新工作流代号，只能包含英文字母。<br>{} |
| --name | name | body | string | 是 | — | 新工作流名称。<br>{} |
| --navigator | navigator | body | string | 否 | — | 所属导航(primary 主导航 \| secondary 二级导航)。<br>{} |
| --position | position | body | string | 否 | — | 菜单位置。<br>{} |

<a id="action-workflow-create-field"></a>

## zentao workflow create-field

```text
Usage: zentao workflow create-field [options] [target]

创建工作流字段（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --name <value>          字段名称。（必填）
  --field <value>         字段代号，只能包含英文字母。（必填）
  --control <value>       控件类型(input 单行文本 | textarea 多行文本 | select 下拉 | date 日期
                          | datetime 日期时间 | richtext 富文本 | checkbox 复选框 |
                          multi-select 多选 | formula 公式)。（必填）
  --type <value>          字段类型(varchar 字符 | int 整数 | float 浮点数 | date 日期 |
                          datetime 日期时间 | text 文本)。
  --length <value>        字段长度。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --name | name | body | string | 是 | — | 字段名称。<br>{} |
| --field | field | body | string | 是 | — | 字段代号，只能包含英文字母。<br>{} |
| --control | control | body | string | 是 | — | 控件类型(input 单行文本 \| textarea 多行文本 \| select 下拉 \| date 日期 \| datetime 日期时间 \| richtext 富文本 \| checkbox 复选框 \| multi-select 多选 \| formula 公式)。<br>{} |
| --type | type | body | string | 否 | — | 字段类型(varchar 字符 \| int 整数 \| float 浮点数 \| date 日期 \| datetime 日期时间 \| text 文本)。<br>{} |
| --length | length | body | string | 否 | — | 字段长度。<br>{} |

<a id="action-workflow-create-action"></a>

## zentao workflow create-action

```text
Usage: zentao workflow create-action [options] [target]

创建工作流动作（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --action <value>        动作代号，只能包含小写英文字母。（必填）
  --name <value>          动作名称。（必填）
  --type <value>          动作类型(single 单条操作 | batch 批量操作)。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --module | module | body | string | 是 | — | 工作流代号。<br>{} |
| --action | action | body | string | 是 | — | 动作代号，只能包含小写英文字母。<br>{} |
| --name | name | body | string | 是 | — | 动作名称。<br>{} |
| --type | type | body | string | 否 | — | 动作类型(single 单条操作 \| batch 批量操作)。<br>{} |

<a id="action-workflow-create-label"></a>

## zentao workflow create-label

```text
Usage: zentao workflow create-label [options] [target]

创建工作流标签（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --action <value>        关联动作代号。（必填）
  --code <value>          标签代号。
  --label <value>         标签名称。
  --type <value>          标签类型(data 数据标签 | sql SQL标签)。
  --data-fields <value>   数据标签的字段列表。
  --operators <value>     数据标签的运算符列表。
  --values <value>        数据标签的条件值列表。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --module | module | body | string | 是 | — | 工作流代号。<br>{} |
| --action | action | body | string | 是 | — | 关联动作代号。<br>{} |
| --code | code | body | string | 否 | — | 标签代号。<br>{} |
| --label | label | body | string | 否 | — | 标签名称。<br>{} |
| --type | type | body | string | 否 | — | 标签类型(data 数据标签 \| sql SQL标签)。<br>{} |
| --data-fields | fields | body | array | 否 | — | 数据标签的字段列表。<br>{"items":{"type":"string"}} |
| --operators | operators | body | array | 否 | — | 数据标签的运算符列表。<br>{"items":{"type":"string"}} |
| --values | values | body | array | 否 | — | 数据标签的条件值列表。<br>{"items":{"type":"string"}} |

<a id="action-workflow-create-table"></a>

## zentao workflow create-table

```text
Usage: zentao workflow create-table [options] [target]

创建工作流数据表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --name <value>          数据表名称。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --module | module | body | string | 是 | — | 数据表代号，只能包含英文字母。<br>{} |
| --name | name | body | string | 是 | — | 数据表名称。<br>{} |

<a id="action-workflow-create-datasource"></a>

## zentao workflow create-datasource

```text
Usage: zentao workflow create-datasource [options]

创建数据源（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --type <value>          数据源类型(sql SQL查询 | system 系统方法 | option 选项 | lang 语言项 |
                          category 分类 | func 函数)。（必填）
  --name <value>          数据源名称。（必填）
  --code <value>          数据源代码。
  --sql <value>           SQL 语句，type=sql 时必填，支持 SELECT 查询。
  --key-field <value>     键字段，type=sql 时必填。
  --value-field <value>   值字段，type=sql 时必填。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --type | type | body | string | 是 | — | 数据源类型(sql SQL查询 \| system 系统方法 \| option 选项 \| lang 语言项 \| category 分类 \| func 函数)。<br>{} |
| --name | name | body | string | 是 | — | 数据源名称。<br>{} |
| --code | code | body | string | 否 | — | 数据源代码。<br>{} |
| --sql | sql | body | string | 否 | — | SQL 语句，type=sql 时必填，支持 SELECT 查询。<br>{} |
| --key-field | keyField | body | string | 否 | — | 键字段，type=sql 时必填。<br>{} |
| --value-field | valueField | body | string | 否 | — | 值字段，type=sql 时必填。<br>{} |

<a id="action-workflow-create-rule"></a>

## zentao workflow create-rule

```text
Usage: zentao workflow create-rule [options]

创建规则（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --type <value>          规则类型(regex 正则表达式)。（必填）
  --name <value>          规则名称。（必填）
  --rule <value>          规则内容，正则表达式需要包含定界符。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --type | type | body | string | 是 | — | 规则类型(regex 正则表达式)。<br>{} |
| --name | name | body | string | 是 | — | 规则名称。<br>{} |
| --rule | rule | body | string | 是 | — | 规则内容，正则表达式需要包含定界符。<br>{} |

<a id="action-workflow-get-flow"></a>

## zentao workflow get-flow

```text
Usage: zentao workflow get-flow [options] [target]

获取工作流详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 flowID；也可使用命名参数

Options:
  --flow-id <value>   flowID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |

<a id="action-workflow-get-field"></a>

## zentao workflow get-field

```text
Usage: zentao workflow get-field [options] [target]

获取工作流字段详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 fieldID；也可使用命名参数

Options:
  --field-id <value>  fieldID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --field-id | fieldID | path | integer | 是 | — | fieldID<br>{} |

<a id="action-workflow-get-action"></a>

## zentao workflow get-action

```text
Usage: zentao workflow get-action [options] [target]

获取工作流动作详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target               单个 actionID；也可使用命名参数

Options:
  --action-id <value>  actionID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --fields <fields>    返回字段，逗号分隔
  --html-to-markdown   显式将富文本字段转换为 Markdown
  -h, --help           显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |

<a id="action-workflow-get-label"></a>

## zentao workflow get-label

```text
Usage: zentao workflow get-label [options] [target]

获取工作流标签详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 labelID；也可使用命名参数

Options:
  --label-id <value>  labelID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --label-id | labelID | path | integer | 是 | — | labelID<br>{} |

<a id="action-workflow-get-table"></a>

## zentao workflow get-table

```text
Usage: zentao workflow get-table [options] [target]

获取工作流数据表详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 tableID；也可使用命名参数

Options:
  --table-id <value>  tableID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --table-id | tableID | path | integer | 是 | — | tableID<br>{} |

<a id="action-workflow-get-datasource"></a>

## zentao workflow get-datasource

```text
Usage: zentao workflow get-datasource [options] [target]

获取数据源详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                   单个 datasourceID；也可使用命名参数

Options:
  --datasource-id <value>  datasourceID（必填）
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  --fields <fields>        返回字段，逗号分隔
  --html-to-markdown       显式将富文本字段转换为 Markdown
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --datasource-id | datasourceID | path | integer | 是 | — | datasourceID<br>{} |

<a id="action-workflow-get-rule"></a>

## zentao workflow get-rule

```text
Usage: zentao workflow get-rule [options] [target]

获取规则详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 ruleID；也可使用命名参数

Options:
  --rule-id <value>   ruleID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --rule-id | ruleID | path | integer | 是 | — | ruleID<br>{} |

<a id="action-workflow-update"></a>

## zentao workflow update

```text
Usage: zentao workflow update [options] [target]

修改工作流数据(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 contractID；也可使用命名参数

Options:
  --contract-id <value>   合同ID（必填）
  --name <value>          合同名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --contract-id | contractID | path | integer | 是 | — | 合同ID<br>{} |
| --name | name | body | string | 是 | — | 合同名称<br>{} |

<a id="action-workflow-update-flow"></a>

## zentao workflow update-flow

```text
Usage: zentao workflow update-flow [options] [target]

修改工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                     单个 flowID；也可使用命名参数

Options:
  --flow-id <value>          flowID（必填）
  --name <value>             工作流名称。（必填）
  --navigator <value>        所属导航(primary 主导航 | secondary 二级导航)。
  --position <value>         菜单位置(before 之前 | after 之后 | 空 直接放在模块下)。
  --position-module <value>  位置模块，主导航下通常传 main；工作流发布后不能为空。
  --data <json|@file|@->     JSON 对象、文件或显式标准输入
  --ids <ids>                批量目标 ID，逗号分隔并去重
  --batch-fail-fast          失败后跳过剩余目标
  -h, --help                 显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |
| --name | name | body | string | 是 | — | 工作流名称。<br>{} |
| --navigator | navigator | body | string | 否 | — | 所属导航(primary 主导航 \| secondary 二级导航)。<br>{} |
| --position | position | body | string | 否 | — | 菜单位置(before 之前 \| after 之后 \| 空 直接放在模块下)。<br>{} |
| --position-module | positionModule | body | string | 否 | — | 位置模块，主导航下通常传 main；工作流发布后不能为空。<br>{} |

<a id="action-workflow-update-field"></a>

## zentao workflow update-field

```text
Usage: zentao workflow update-field [options] [target]

修改工作流字段（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 fieldID；也可使用命名参数

Options:
  --field-id <value>      fieldID（必填）
  --name <value>          字段名称。（必填）
  --control <value>       控件类型。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --field-id | fieldID | path | integer | 是 | — | fieldID<br>{} |
| --name | name | body | string | 是 | — | 字段名称。<br>{} |
| --control | control | body | string | 是 | — | 控件类型。<br>{} |

<a id="action-workflow-update-action"></a>

## zentao workflow update-action

```text
Usage: zentao workflow update-action [options] [target]

修改工作流动作（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 actionID；也可使用命名参数

Options:
  --action-id <value>     actionID（必填）
  --action <value>        动作代号。（必填）
  --name <value>          动作名称。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |
| --action | action | body | string | 是 | — | 动作代号。<br>{} |
| --name | name | body | string | 是 | — | 动作名称。<br>{} |

<a id="action-workflow-update-label"></a>

## zentao workflow update-label

```text
Usage: zentao workflow update-label [options] [target]

修改工作流标签（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 labelID；也可使用命名参数

Options:
  --label-id <value>      labelID（必填）
  --label <value>         标签名称。
  --type <value>          标签类型。
  --data-fields <value>   数据标签的字段列表。
  --operators <value>     数据标签的运算符列表。
  --values <value>        数据标签的条件值列表。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --label-id | labelID | path | integer | 是 | — | labelID<br>{} |
| --label | label | body | string | 否 | — | 标签名称。<br>{} |
| --type | type | body | string | 否 | — | 标签类型。<br>{} |
| --data-fields | fields | body | array | 否 | — | 数据标签的字段列表。<br>{"items":{"type":"string"}} |
| --operators | operators | body | array | 否 | — | 数据标签的运算符列表。<br>{"items":{"type":"string"}} |
| --values | values | body | array | 否 | — | 数据标签的条件值列表。<br>{"items":{"type":"string"}} |

<a id="action-workflow-update-table"></a>

## zentao workflow update-table

```text
Usage: zentao workflow update-table [options] [target]

修改工作流数据表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 tableID；也可使用命名参数

Options:
  --table-id <value>      tableID（必填）
  --name <value>          数据表名称。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --table-id | tableID | path | integer | 是 | — | tableID<br>{} |
| --name | name | body | string | 是 | — | 数据表名称。<br>{} |

<a id="action-workflow-update-datasource"></a>

## zentao workflow update-datasource

```text
Usage: zentao workflow update-datasource [options] [target]

修改数据源（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                   单个 datasourceID；也可使用命名参数

Options:
  --datasource-id <value>  datasourceID（必填）
  --type <value>           数据源类型。（必填）
  --name <value>           数据源名称。（必填）
  --code <value>           数据源代码。
  --sql <value>            SQL 语句。
  --key-field <value>      键字段。
  --value-field <value>    值字段。
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --datasource-id | datasourceID | path | integer | 是 | — | datasourceID<br>{} |
| --type | type | body | string | 是 | — | 数据源类型。<br>{} |
| --name | name | body | string | 是 | — | 数据源名称。<br>{} |
| --code | code | body | string | 否 | — | 数据源代码。<br>{} |
| --sql | sql | body | string | 否 | — | SQL 语句。<br>{} |
| --key-field | keyField | body | string | 否 | — | 键字段。<br>{} |
| --value-field | valueField | body | string | 否 | — | 值字段。<br>{} |

<a id="action-workflow-update-rule"></a>

## zentao workflow update-rule

```text
Usage: zentao workflow update-rule [options] [target]

修改规则（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 ruleID；也可使用命名参数

Options:
  --rule-id <value>       ruleID（必填）
  --type <value>          规则类型。（必填）
  --name <value>          规则名称。（必填）
  --rule <value>          规则内容。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --rule-id | ruleID | path | integer | 是 | — | ruleID<br>{} |
| --type | type | body | string | 是 | — | 规则类型。<br>{} |
| --name | name | body | string | 是 | — | 规则名称。<br>{} |
| --rule | rule | body | string | 是 | — | 规则内容。<br>{} |

<a id="action-workflow-delete"></a>

## zentao workflow delete

```text
Usage: zentao workflow delete [options] [target]

删除工作流事项(以合同为例)（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                 单个 contractID；也可使用命名参数

Options:
  --contract-id <value>  合同ID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --yes                  确认删除
  -h, --help             显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --contract-id | contractID | path | integer | 是 | — | 合同ID<br>{} |

<a id="action-workflow-delete-flow"></a>

## zentao workflow delete-flow

```text
Usage: zentao workflow delete-flow [options] [target]

删除工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target             单个 flowID；也可使用命名参数

Options:
  --flow-id <value>  flowID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |

<a id="action-workflow-delete-field"></a>

## zentao workflow delete-field

```text
Usage: zentao workflow delete-field [options] [target]

删除工作流字段（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 fieldID；也可使用命名参数

Options:
  --field-id <value>  fieldID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --field-id | fieldID | path | integer | 是 | — | fieldID<br>{} |

<a id="action-workflow-delete-action"></a>

## zentao workflow delete-action

```text
Usage: zentao workflow delete-action [options] [target]

删除工作流动作（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target               单个 actionID；也可使用命名参数

Options:
  --action-id <value>  actionID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |

<a id="action-workflow-delete-label"></a>

## zentao workflow delete-label

```text
Usage: zentao workflow delete-label [options] [target]

删除工作流标签（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 labelID；也可使用命名参数

Options:
  --label-id <value>  labelID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --label-id | labelID | path | integer | 是 | — | labelID<br>{} |

<a id="action-workflow-delete-table"></a>

## zentao workflow delete-table

```text
Usage: zentao workflow delete-table [options] [target]

删除工作流数据表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 tableID；也可使用命名参数

Options:
  --table-id <value>  tableID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --table-id | tableID | path | integer | 是 | — | tableID<br>{} |

<a id="action-workflow-delete-datasource"></a>

## zentao workflow delete-datasource

```text
Usage: zentao workflow delete-datasource [options] [target]

删除数据源（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                   单个 datasourceID；也可使用命名参数

Options:
  --datasource-id <value>  datasourceID（必填）
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  --yes                    确认删除
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --datasource-id | datasourceID | path | integer | 是 | — | datasourceID<br>{} |

<a id="action-workflow-delete-rule"></a>

## zentao workflow delete-rule

```text
Usage: zentao workflow delete-rule [options] [target]

删除规则（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target             单个 ruleID；也可使用命名参数

Options:
  --rule-id <value>  ruleID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --rule-id | ruleID | path | integer | 是 | — | ruleID<br>{} |

<a id="action-workflow-activate-flow"></a>

## zentao workflow activate-flow

```text
Usage: zentao workflow activate-flow [options] [target]

启用工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target             单个 flowID；也可使用命名参数

Options:
  --flow-id <value>  flowID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  -h, --help         显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |

<a id="action-workflow-deactivate-flow"></a>

## zentao workflow deactivate-flow

```text
Usage: zentao workflow deactivate-flow [options] [target]

停用工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target             单个 flowID；也可使用命名参数

Options:
  --flow-id <value>  flowID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  -h, --help         显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |

<a id="action-workflow-release-flow"></a>

## zentao workflow release-flow

```text
Usage: zentao workflow release-flow [options] [target]

发布工作流（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                     单个 flowID；也可使用命名参数

Options:
  --flow-id <value>          flowID（必填）
  --navigator <value>        所属导航(primary 主导航 | secondary 二级导航)。（必填）
  --position <value>         菜单位置(before 之前 | after 之后 | 空 直接放在模块下)。
  --position-module <value>  位置模块，主导航下通常传 main。（必填）
  --data <json|@file|@->     JSON 对象、文件或显式标准输入
  --ids <ids>                批量目标 ID，逗号分隔并去重
  --batch-fail-fast          失败后跳过剩余目标
  -h, --help                 显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |
| --navigator | navigator | body | string | 是 | — | 所属导航(primary 主导航 \| secondary 二级导航)。<br>{} |
| --position | position | body | string | 否 | — | 菜单位置(before 之前 \| after 之后 \| 空 直接放在模块下)。<br>{} |
| --position-module | positionModule | body | string | 是 | — | 位置模块，主导航下通常传 main。<br>{} |

<a id="action-workflow-set-approval"></a>

## zentao workflow set-approval

```text
Usage: zentao workflow set-approval [options] [target]

设置工作流审批（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --approval <value>      是否启用审批(enabled 启用 | disabled 停用)。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --approval | approval | body | string | 是 | — | 是否启用审批(enabled 启用 \| disabled 停用)。<br>{} |

<a id="action-workflow-set-action-css"></a>

## zentao workflow set-action-css

```text
Usage: zentao workflow set-action-css [options] [target]

设置动作CSS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 actionID；也可使用命名参数

Options:
  --action-id <value>     actionID（必填）
  --css <value>           动作自定义CSS。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |
| --css | css | body | string | 否 | — | 动作自定义CSS。<br>{} |

<a id="action-workflow-set-flow-css"></a>

## zentao workflow set-flow-css

```text
Usage: zentao workflow set-flow-css [options] [target]

设置工作流CSS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 flowID；也可使用命名参数

Options:
  --flow-id <value>       flowID（必填）
  --css <value>           工作流自定义CSS。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |
| --css | css | body | string | 否 | — | 工作流自定义CSS。<br>{} |

<a id="action-workflow-set-export"></a>

## zentao workflow set-export

```text
Usage: zentao workflow set-export [options] [target]

设置字段导出（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --modules <value>       要设置的模块列表。（必填）
  --data-fields <value>   导出字段，键为模块、值为字段代号列表。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --modules | modules | body | array | 是 | — | 要设置的模块列表。<br>{"items":{"type":"string"}} |
| --data-fields | fields | body | object | 否 | — | 导出字段，键为模块、值为字段代号列表。<br>{} |

<a id="action-workflow-set-fulltext-search"></a>

## zentao workflow set-fulltext-search

```text
Usage: zentao workflow set-fulltext-search [options] [target]

设置工作流全文检索（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                   单个 flowID；也可使用命名参数

Options:
  --flow-id <value>        flowID（必填）
  --content-field <value>  参与全文检索的字段列表。
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |
| --content-field | contentField | body | array | 否 | — | 参与全文检索的字段列表。<br>{"items":{"type":"string"}} |

<a id="action-workflow-set-action-js"></a>

## zentao workflow set-action-js

```text
Usage: zentao workflow set-action-js [options] [target]

设置动作JS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 actionID；也可使用命名参数

Options:
  --action-id <value>     actionID（必填）
  --js <value>            动作自定义JS。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |
| --js | js | body | string | 否 | — | 动作自定义JS。<br>{} |

<a id="action-workflow-set-flow-js"></a>

## zentao workflow set-flow-js

```text
Usage: zentao workflow set-flow-js [options] [target]

设置工作流JS（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 flowID；也可使用命名参数

Options:
  --flow-id <value>       flowID（必填）
  --js <value>            工作流自定义JS。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --flow-id | flowID | path | integer | 是 | — | flowID<br>{} |
| --js | js | body | string | 否 | — | 工作流自定义JS。<br>{} |

<a id="action-workflow-set-action-notice"></a>

## zentao workflow set-action-notice

```text
Usage: zentao workflow set-action-notice [options] [target]

设置动作通知（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 actionID；也可使用命名参数

Options:
  --action-id <value>     actionID（必填）
  --to-list <value>       通知人账号列表。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |
| --to-list | toList | body | array | 是 | — | 通知人账号列表。<br>{"items":{"type":"string"}} |

<a id="action-workflow-set-search"></a>

## zentao workflow set-search

```text
Usage: zentao workflow set-search [options] [target]

设置字段搜索（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --modules <value>       要设置的模块列表。（必填）
  --data-fields <value>   搜索字段，键为模块、值为字段代号列表（按数组顺序作为搜索排序）。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --modules | modules | body | array | 是 | — | 要设置的模块列表。<br>{"items":{"type":"string"}} |
| --data-fields | fields | body | object | 否 | — | 搜索字段，键为模块、值为字段代号列表（按数组顺序作为搜索排序）。<br>{} |

<a id="action-workflow-set-value"></a>

## zentao workflow set-value

```text
Usage: zentao workflow set-value [options] [target]

设置字段取值（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 module；也可使用命名参数

Options:
  --module <value>        module（必填）
  --modules <value>       要设置的模块列表。（必填）
  --data-fields <value>   取值字段，键为模块、值为字段代号列表。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module | module | path | string | 是 | — | module<br>{} |
| --modules | modules | body | array | 是 | — | 要设置的模块列表。<br>{"items":{"type":"string"}} |
| --data-fields | fields | body | object | 否 | — | 取值字段，键为模块、值为字段代号列表。<br>{} |

<a id="action-workflow-set-action-verification"></a>

## zentao workflow set-action-verification

```text
Usage: zentao workflow set-action-verification [options] [target]

设置动作验证（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                   单个 actionID；也可使用命名参数

Options:
  --action-id <value>      actionID（必填）
  --type <value>           验证类型(data 数据验证 | no 不验证)。（必填）
  --message <value>        验证失败提示。
  --verifications <value>  验证规则，包含 field(字段)、paramType(参数类型)、param(参数) 三个数组。
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --action-id | actionID | path | integer | 是 | — | actionID<br>{} |
| --type | type | body | string | 是 | — | 验证类型(data 数据验证 \| no 不验证)。<br>{} |
| --message | message | body | string | 否 | — | 验证失败提示。<br>{} |
| --verifications | verifications | body | object | 否 | — | 验证规则，包含 field(字段)、paramType(参数类型)、param(参数) 三个数组。<br>{} |

<a id="module-doc"></a>

## 文档 · doc

```text
Usage: zentao doc [options] [command]

文档

Options:
  -h, --help                                显示命令帮助

Commands:
  props                                     返回对象字段定义（离线）
  my-spaces [options]                       获取我的文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  team-spaces [options]                     获取团队文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  product-spaces [options]                  获取产品文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  project-spaces [options]                  获取项目文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  my-libs [options] [target]                获取我的文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  team-libs [options] [target]              获取团队文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  product-libs [options] [target]           获取产品文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  project-libs [options] [target]           获取项目文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  my-docs [options] [target]                获取我的文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  team-docs [options] [target]              获取团队文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  product-docs [options] [target]           获取产品文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  project-docs [options] [target]           获取项目文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  my-modules [options] [target]             获取我的文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  team-modules [options] [target]           获取团队文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  product-modules [options] [target]        获取产品文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  project-modules [options] [target]        获取项目文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-my-space [options]                 创建我的文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-team-space [options]               创建团队文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-my-lib [options] [target]          创建我的文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-team-lib [options] [target]        创建团队文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-product-lib [options] [target]     创建产品文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-project-lib [options] [target]     创建项目文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-my-doc [options] [target]          创建我的文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-team-doc [options] [target]        创建团队文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-product-doc [options] [target]     创建产品文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-project-doc [options] [target]     创建项目文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-my-module [options] [target]       创建我的文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-team-module [options] [target]     创建团队文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-product-module [options] [target]  创建产品文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  create-project-module [options] [target]  创建项目文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get-space [options] [target]              获取文档空间详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get-lib [options] [target]                获取文档库详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get [options] [target]                    获取文档详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  update-space [options] [target]           修改文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  update-lib [options] [target]             修改文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  update [options] [target]                 修改文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  update-module [options] [target]          修改文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete-space [options] [target]           删除文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete-lib [options] [target]             删除文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete [options] [target]                 删除文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete-module [options] [target]          删除文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
```

<a id="action-doc-my-spaces"></a>

## zentao doc my-spaces

```text
Usage: zentao doc my-spaces [options]

获取我的文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-doc-team-spaces"></a>

## zentao doc team-spaces

```text
Usage: zentao doc team-spaces [options]

获取团队文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-doc-product-spaces"></a>

## zentao doc product-spaces

```text
Usage: zentao doc product-spaces [options]

获取产品文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-doc-project-spaces"></a>

## zentao doc project-spaces

```text
Usage: zentao doc project-spaces [options]

获取项目文档空间列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-doc-my-libs"></a>

## zentao doc my-libs

```text
Usage: zentao doc my-libs [options] [target]

获取我的文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        空间ID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |

<a id="action-doc-team-libs"></a>

## zentao doc team-libs

```text
Usage: zentao doc team-libs [options] [target]

获取团队文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        空间ID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |

<a id="action-doc-product-libs"></a>

## zentao doc product-libs

```text
Usage: zentao doc product-libs [options] [target]

获取产品文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品ID（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |

<a id="action-doc-project-libs"></a>

## zentao doc project-libs

```text
Usage: zentao doc project-libs [options] [target]

获取项目文档库列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |

<a id="action-doc-my-docs"></a>

## zentao doc my-docs

```text
Usage: zentao doc my-docs [options] [target]

获取我的文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        空间ID（必填）
  --lib-id <value>          文档库ID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-team-docs"></a>

## zentao doc team-docs

```text
Usage: zentao doc team-docs [options] [target]

获取团队文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        空间ID（必填）
  --lib-id <value>          文档库ID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-product-docs"></a>

## zentao doc product-docs

```text
Usage: zentao doc product-docs [options] [target]

获取产品文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品ID（必填）
  --lib-id <value>          文档库ID（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-project-docs"></a>

## zentao doc project-docs

```text
Usage: zentao doc project-docs [options] [target]

获取项目文档列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --lib-id <value>          文档库ID（必填）
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-my-modules"></a>

## zentao doc my-modules

```text
Usage: zentao doc my-modules [options] [target]

获取我的文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        空间ID（必填）
  --lib-id <value>          文档库ID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-team-modules"></a>

## zentao doc team-modules

```text
Usage: zentao doc team-modules [options] [target]

获取团队文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        空间ID（必填）
  --lib-id <value>          文档库ID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-product-modules"></a>

## zentao doc product-modules

```text
Usage: zentao doc product-modules [options] [target]

获取产品文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 productID；也可使用命名参数

Options:
  --product-id <value>      产品ID（必填）
  --lib-id <value>          文档库ID（必填）
  --product <id>            productID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-project-modules"></a>

## zentao doc project-modules

```text
Usage: zentao doc project-modules [options] [target]

获取项目文档库目录列表（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      项目ID（必填）
  --lib-id <value>          文档库ID（必填）
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-create-my-space"></a>

## zentao doc create-my-space

```text
Usage: zentao doc create-my-space [options]

创建我的文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --name <value>          文档空间名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 文档空间名称<br>{} |

<a id="action-doc-create-team-space"></a>

## zentao doc create-team-space

```text
Usage: zentao doc create-team-space [options]

创建团队文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --name <value>          文档空间名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 文档空间名称<br>{} |

<a id="action-doc-create-my-lib"></a>

## zentao doc create-my-lib

```text
Usage: zentao doc create-my-lib [options] [target]

创建我的文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --name <value>          文档库名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --name | name | body | string | 是 | — | 文档库名称<br>{} |

<a id="action-doc-create-team-lib"></a>

## zentao doc create-team-lib

```text
Usage: zentao doc create-team-lib [options] [target]

创建团队文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --name <value>          文档库名称（必填）
  --acl <value>           open 公开 | private 私有，默认是open
  --groups <value>        如果acl=private,可以设置哪些权限分组可以访问
  --users <value>         如果acl=private,可以设置哪些用户可以访问
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --name | name | body | string | 是 | — | 文档库名称<br>{} |
| --acl | acl | body | string | 否 | — | open 公开 \| private 私有，默认是open<br>{} |
| --groups | groups | body | array | 否 | — | 如果acl=private,可以设置哪些权限分组可以访问<br>{"items":{"type":"string"}} |
| --users | users | body | array | 否 | — | 如果acl=private,可以设置哪些用户可以访问<br>{"items":{"type":"string"}} |

<a id="action-doc-create-product-lib"></a>

## zentao doc create-product-lib

```text
Usage: zentao doc create-product-lib [options] [target]

创建产品文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --name <value>          文档库名称（必填）
  --acl <value>           default 默认产品权限 | private 私有
  --groups <value>        如果acl=private,可以设置哪些权限分组可以访问
  --users <value>         如果acl=private,可以设置哪些用户可以访问
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --name | name | body | string | 是 | — | 文档库名称<br>{} |
| --acl | acl | body | string | 否 | — | default 默认产品权限 \| private 私有<br>{} |
| --groups | groups | body | array | 否 | — | 如果acl=private,可以设置哪些权限分组可以访问<br>{"items":{"type":"string"}} |
| --users | users | body | array | 否 | — | 如果acl=private,可以设置哪些用户可以访问<br>{"items":{"type":"string"}} |

<a id="action-doc-create-project-lib"></a>

## zentao doc create-project-lib

```text
Usage: zentao doc create-project-lib [options] [target]

创建项目文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --name <value>          文档库名称（必填）
  --acl <value>           default 默认项目权限 | private 私有
  --groups <value>        如果acl=private,可以设置哪些权限分组可以访问
  --users <value>         如果acl=private,可以设置哪些用户可以访问
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | string | 是 | — | 文档库名称<br>{} |
| --acl | acl | body | string | 否 | — | default 默认项目权限 \| private 私有<br>{} |
| --groups | groups | body | array | 否 | — | 如果acl=private,可以设置哪些权限分组可以访问<br>{"items":{"type":"string"}} |
| --users | users | body | array | 否 | — | 如果acl=private,可以设置哪些用户可以访问<br>{"items":{"type":"string"}} |

<a id="action-doc-create-my-doc"></a>

## zentao doc create-my-doc

```text
Usage: zentao doc create-my-doc [options] [target]

创建我的文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --lib-id <value>        文档库ID（必填）
  --module-id <value>     所属目录
  --title <value>         文档标题（必填）
  --content <value>       文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照（必填）
  --content-type <value>  文档格式(doc 按Markdown处理，支持团队协同编辑 | html
                          旧格式，直接保存HTML，不支持团队协同编辑)
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --module-id | moduleID | body | integer | 否 | — | 所属目录<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 文档标题<br>{} |
| --content | content | body | string | 是 | — | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照<br>{} |
| --content-type | contentType | body | string | 否 | — | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑)<br>{} |

<a id="action-doc-create-team-doc"></a>

## zentao doc create-team-doc

```text
Usage: zentao doc create-team-doc [options] [target]

创建团队文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --lib-id <value>        文档库ID（必填）
  --module-id <value>     所属目录
  --title <value>         文档标题（必填）
  --content <value>       文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照（必填）
  --content-type <value>  文档格式(doc 按Markdown处理，支持团队协同编辑 | html
                          旧格式，直接保存HTML，不支持团队协同编辑)
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --module-id | moduleID | body | integer | 否 | — | 所属目录<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 文档标题<br>{} |
| --content | content | body | string | 是 | — | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照<br>{} |
| --content-type | contentType | body | string | 否 | — | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑)<br>{} |

<a id="action-doc-create-product-doc"></a>

## zentao doc create-product-doc

```text
Usage: zentao doc create-product-doc [options] [target]

创建产品文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --lib-id <value>        文档库ID（必填）
  --module-id <value>     所属目录
  --title <value>         文档标题（必填）
  --content <value>       文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照（必填）
  --content-type <value>  文档格式(doc 按Markdown处理，支持团队协同编辑 | html
                          旧格式，直接保存HTML，不支持团队协同编辑)
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --module-id | moduleID | body | integer | 否 | — | 所属目录<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 文档标题<br>{} |
| --content | content | body | string | 是 | — | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照<br>{} |
| --content-type | contentType | body | string | 否 | — | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑)<br>{} |

<a id="action-doc-create-project-doc"></a>

## zentao doc create-project-doc

```text
Usage: zentao doc create-project-doc [options] [target]

创建项目文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --lib-id <value>        文档库ID（必填）
  --module-id <value>     所属目录
  --title <value>         文档标题（必填）
  --content <value>       文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照（必填）
  --content-type <value>  文档格式(doc 按Markdown处理，支持团队协同编辑 | html
                          旧格式，直接保存HTML，不支持团队协同编辑)
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --module-id | moduleID | body | integer | 否 | — | 所属目录<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 文档标题<br>{} |
| --content | content | body | string | 是 | — | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照<br>{} |
| --content-type | contentType | body | string | 否 | — | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑)<br>{} |

<a id="action-doc-create-my-module"></a>

## zentao doc create-my-module

```text
Usage: zentao doc create-my-module [options] [target]

创建我的文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --lib-id <value>        文档库ID（必填）
  --name <value>          文档库目录（必填）
  --parent-id <value>     父目录ID，必须属于当前文档库
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --name | name | body | string | 是 | — | 文档库目录<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父目录ID，必须属于当前文档库<br>{"format":"int32"} |

<a id="action-doc-create-team-module"></a>

## zentao doc create-team-module

```text
Usage: zentao doc create-team-module [options] [target]

创建团队文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --lib-id <value>        文档库ID（必填）
  --name <value>          文档库目录（必填）
  --parent-id <value>     父目录ID，必须属于当前文档库
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --name | name | body | string | 是 | — | 文档库目录<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父目录ID，必须属于当前文档库<br>{"format":"int32"} |

<a id="action-doc-create-product-module"></a>

## zentao doc create-product-module

```text
Usage: zentao doc create-product-module [options] [target]

创建产品文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 productID；也可使用命名参数

Options:
  --product-id <value>    产品ID（必填）
  --lib-id <value>        文档库ID（必填）
  --name <value>          文档库目录（必填）
  --parent-id <value>     父目录ID，必须属于当前文档库
  --product <id>          productID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --product-id | productID | path | integer | 是 | — | 产品ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --name | name | body | string | 是 | — | 文档库目录<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父目录ID，必须属于当前文档库<br>{"format":"int32"} |

<a id="action-doc-create-project-module"></a>

## zentao doc create-project-module

```text
Usage: zentao doc create-project-module [options] [target]

创建项目文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --lib-id <value>        文档库ID（必填）
  --name <value>          文档库目录（必填）
  --parent-id <value>     父目录ID，必须属于当前文档库
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --name | name | body | string | 是 | — | 文档库目录<br>{} |
| --parent-id | parentID | body | integer | 否 | — | 父目录ID，必须属于当前文档库<br>{"format":"int32"} |

<a id="action-doc-get-space"></a>

## zentao doc get-space

```text
Usage: zentao doc get-space [options] [target]

获取文档空间详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target              单个 spaceID；也可使用命名参数

Options:
  --space-id <value>  空间ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |

<a id="action-doc-get-lib"></a>

## zentao doc get-lib

```text
Usage: zentao doc get-lib [options] [target]

获取文档库详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target              单个 libID；也可使用命名参数

Options:
  --lib-id <value>    文档库ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-get"></a>

## zentao doc get

```text
Usage: zentao doc get [options] [target]

获取文档详情（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target              单个 docID；也可使用命名参数

Options:
  --doc-id <value>    文档ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --doc-id | docID | path | integer | 是 | — | 文档ID<br>{} |

<a id="action-doc-update-space"></a>

## zentao doc update-space

```text
Usage: zentao doc update-space [options] [target]

修改文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 spaceID；也可使用命名参数

Options:
  --space-id <value>      空间ID（必填）
  --name <value>          文档空间名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |
| --name | name | body | string | 是 | — | 文档空间名称<br>{} |

<a id="action-doc-update-lib"></a>

## zentao doc update-lib

```text
Usage: zentao doc update-lib [options] [target]

修改文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 libID；也可使用命名参数

Options:
  --lib-id <value>        文档库ID（必填）
  --name <value>          文档库名称（必填）
  --acl <value>           open 公开(适用于团队文档库) | default 默认权限(适用于产品、项目文档库) |
                          private 私有(适用于所有类型文档库)
  --groups <value>        如果acl=private,可以设置哪些权限分组可以访问
  --users <value>         如果acl=private,可以设置哪些用户可以访问
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |
| --name | name | body | string | 是 | — | 文档库名称<br>{} |
| --acl | acl | body | string | 否 | — | open 公开(适用于团队文档库) \| default 默认权限(适用于产品、项目文档库) \| private 私有(适用于所有类型文档库)<br>{} |
| --groups | groups | body | array | 否 | — | 如果acl=private,可以设置哪些权限分组可以访问<br>{"items":{"type":"string"}} |
| --users | users | body | array | 否 | — | 如果acl=private,可以设置哪些用户可以访问<br>{"items":{"type":"string"}} |

<a id="action-doc-update"></a>

## zentao doc update

```text
Usage: zentao doc update [options] [target]

修改文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 docID；也可使用命名参数

Options:
  --doc-id <value>        文档ID（必填）
  --module-id <value>     所属目录
  --title <value>         文档标题（必填）
  --content <value>       文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照（必填）
  --content-type <value>  文档格式(doc 按Markdown处理，支持团队协同编辑 | html
                          旧格式，直接保存HTML，不支持团队协同编辑)
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --doc-id | docID | path | integer | 是 | — | 文档ID<br>{} |
| --module-id | moduleID | body | integer | 否 | — | 所属目录<br>{"format":"int32"} |
| --title | title | body | string | 是 | — | 文档标题<br>{} |
| --content | content | body | string | 是 | — | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照<br>{} |
| --content-type | contentType | body | string | 否 | — | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑)<br>{} |

<a id="action-doc-update-module"></a>

## zentao doc update-module

```text
Usage: zentao doc update-module [options] [target]

修改文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 moduleID；也可使用命名参数

Options:
  --module-id <value>     模块ID（必填）
  --name <value>          文档库目录名称（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |
| --name | name | body | string | 是 | — | 文档库目录名称<br>{} |

<a id="action-doc-delete-space"></a>

## zentao doc delete-space

```text
Usage: zentao doc delete-space [options] [target]

删除文档空间（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target              单个 spaceID；也可使用命名参数

Options:
  --space-id <value>  空间ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --yes               确认删除
  -h, --help          显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 空间ID<br>{} |

<a id="action-doc-delete-lib"></a>

## zentao doc delete-lib

```text
Usage: zentao doc delete-lib [options] [target]

删除文档库（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target             单个 libID；也可使用命名参数

Options:
  --lib-id <value>   文档库ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --lib-id | libID | path | integer | 是 | — | 文档库ID<br>{} |

<a id="action-doc-delete"></a>

## zentao doc delete

```text
Usage: zentao doc delete [options] [target]

删除文档（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target             单个 docID；也可使用命名参数

Options:
  --doc-id <value>   文档ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --doc-id | docID | path | integer | 是 | — | 文档ID<br>{} |

<a id="action-doc-delete-module"></a>

## zentao doc delete-module

```text
Usage: zentao doc delete-module [options] [target]

删除文档库目录（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target               单个 moduleID；也可使用命名参数

Options:
  --module-id <value>  模块ID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --module-id | moduleID | path | integer | 是 | — | 模块ID<br>{} |

<a id="module-todo"></a>

## 待办 · todo

```text
Usage: zentao todo [options] [command]

待办

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  create [options]           创建待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  get [options] [target]     获取待办详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update [options] [target]  编辑待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  delete [options] [target]  删除待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
```

<a id="action-todo-create"></a>

## zentao todo create

```text
Usage: zentao todo create [options]

创建待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --date <value>          日期（必填）
  --type <value>          类型：custom 自定义 | task 任务 | bug 缺陷 | story 研发需求 | epic
                          业务需求 | requirement 用户需求 | testtask 测试单（必填）
  --name <value>          待办名称，type为custom时必填；type为非custom时由关联对象的名称或标题自动生成
  --object-id <value>     关联对象ID，type为非custom时必填，必须是type对应对象的ID
  --begin <value>         开始时间，使用小时+分钟拼接
  --end <value>           结束时间，使用小时+分钟拼接
  --assigned-to <value>   指派给
  --desc <value>          待办详情
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --date | date | body | string | 是 | — | 日期<br>{} |
| --type | type | body | string | 是 | — | 类型：custom 自定义 \| task 任务 \| bug 缺陷 \| story 研发需求 \| epic 业务需求 \| requirement 用户需求 \| testtask 测试单<br>{} |
| --name | name | body | string | 否 | — | 待办名称，type为custom时必填；type为非custom时由关联对象的名称或标题自动生成<br>{} |
| --object-id | objectID | body | integer | 否 | — | 关联对象ID，type为非custom时必填，必须是type对应对象的ID<br>{"format":"int32"} |
| --begin | begin | body | string | 否 | — | 开始时间，使用小时+分钟拼接<br>{} |
| --end | end | body | string | 否 | — | 结束时间，使用小时+分钟拼接<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --desc | desc | body | string | 否 | — | 待办详情<br>{} |

<a id="action-todo-get"></a>

## zentao todo get

```text
Usage: zentao todo get [options] [target]

获取待办详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 todoID；也可使用命名参数

Options:
  --todo-id <value>   待办ID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --todo-id | todoID | path | integer | 是 | — | 待办ID<br>{} |

<a id="action-todo-update"></a>

## zentao todo update

```text
Usage: zentao todo update [options] [target]

编辑待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target                  单个 todoID；也可使用命名参数

Options:
  --todo-id <value>       待办ID（必填）
  --date <value>          日期（必填）
  --type <value>          类型：custom 自定义 | task 任务 | bug 缺陷 | story 研发需求 | epic
                          业务需求 | requirement 用户需求 | testtask 测试单（必填）
  --name <value>          待办名称，type为custom时必填；type为非custom时由关联对象的名称或标题自动生成
  --object-id <value>     关联对象ID，type为非custom时必填，必须是type对应对象的ID
  --begin <value>         开始时间，使用小时+分钟拼接
  --end <value>           结束时间，使用小时+分钟拼接
  --assigned-to <value>   指派给
  --desc <value>          待办详情
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --todo-id | todoID | path | integer | 是 | — | 待办ID<br>{} |
| --date | date | body | string | 是 | — | 日期<br>{} |
| --type | type | body | string | 是 | — | 类型：custom 自定义 \| task 任务 \| bug 缺陷 \| story 研发需求 \| epic 业务需求 \| requirement 用户需求 \| testtask 测试单<br>{} |
| --name | name | body | string | 否 | — | 待办名称，type为custom时必填；type为非custom时由关联对象的名称或标题自动生成<br>{} |
| --object-id | objectID | body | integer | 否 | — | 关联对象ID，type为非custom时必填，必须是type对应对象的ID<br>{"format":"int32"} |
| --begin | begin | body | string | 否 | — | 开始时间，使用小时+分钟拼接<br>{} |
| --end | end | body | string | 否 | — | 结束时间，使用小时+分钟拼接<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派给<br>{} |
| --desc | desc | body | string | 否 | — | 待办详情<br>{} |

<a id="action-todo-delete"></a>

## zentao todo delete

```text
Usage: zentao todo delete [options] [target]

删除待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Arguments:
  target             单个 todoID；也可使用命名参数

Options:
  --todo-id <value>  待办ID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --todo-id | todoID | path | integer | 是 | — | 待办ID<br>{} |

<a id="module-my"></a>

## 地盘 · my

```text
Usage: zentao my [options] [command]

地盘

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  todos [options]                   我的待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  tasks [options]                   指派给我的任务（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  bugs [options]                    指派给我的Bug（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  stories [options]                 指派给我的研发需求（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  epics [options]                   指派给我的业务需求（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  requirements [options]            指派给我的用户需求（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  testtasks [options]               我负责的的测试单（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  projects [options]                我参与的项目（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  feedbacks [options]               指派给我的反馈（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  tickets [options]                 指派给我的工单（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  testcases [options]               指派给我的用例（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  meetings [options]                我的会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）
  issues [options]                  指派给我的问题（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  risks [options]                   指派给我的风险（最低版本：22.5 / biz13.5 / max8.5 /
                                    ipd5.5）
  activity-tasks [options]          我的地盘-贡献任务（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-bugs [options]           我的地盘-贡献 Bug（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-stories [options]        我的地盘-贡献研发需求（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-epics [options]          我的地盘-贡献业务需求（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-requirements [options]   我的地盘-贡献用户需求（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-test-tasks [options]     我的地盘-贡献测试单（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-test-cases [options]     我的地盘-贡献用例（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-docs [options]           我的地盘-贡献文档（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-issues [options]         我的地盘-贡献问题（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-risks [options]          我的地盘-贡献风险（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-review-issues [options]  我的地盘-贡献评审问题（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-feedbacks [options]      我的地盘-贡献反馈（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  activity-audits [options]         我的地盘-贡献审批（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  review-issues [options]           我的地盘-待处理评审问题（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  audits [options]                  我的地盘-待处理审批（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  audit-plans [options]             我的地盘-待处理审计计划（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  ncs [options]                     我的地盘-待处理不符合项（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  create-ssh [options]              添加我的 SSH 公钥（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
```

<a id="action-my-todos"></a>

## zentao my todos

```text
Usage: zentao my todos [options]

我的待办（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --status <value>          待办状态；browseType=undone 时传 undone。
  --browse-type <value>     状态，默认是all
  --order-by <value>        排序(date_desc,status,begin 日期/状态/开始时间)
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --status | status | query | string | 否 | — | 待办状态；browseType=undone 时传 undone。<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 状态，默认是all<br>{"options":[{"value":"all","label":"全部"},{"value":"today","label":"今天"},{"value":"thisWeek","label":"本周"},{"value":"thisMonth","label":"本月"},{"value":"future","label":"将来"},{"value":"undone","label":"未完成，需同时传 status=undone"},{"value":"cycle","label":"周期待办"},{"value":"assignedToOther","label":"指派他人"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序(date_desc,status,begin 日期/状态/开始时间)<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-tasks"></a>

## zentao my tasks

```text
Usage: zentao my tasks [options]

指派给我的任务（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值区分大小写
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：name(任务名称，示例：关键字)；keywords(关键词，示例：关键字)；id(编号，示例：1)；status(任务状态，枚举：wait
                            未开始 | doing 进行中 | done 已完成 | pause 已暂停 | cancel 已取消
                            | closed
                            已关闭)；desc(任务描述，示例：关键字)；assignedTo(指派给，用户，示例：admin)；pri(优先级，枚举：1
                            | 2 | 3 |
                            4)；project(所属项目，示例：all)；execution(所属执行，示例：all)；module(所属模块，示例：all)；estimate(最初预计，示例：关键字)；left(预计剩余，示例：关键字)；consumed(总计消耗，示例：关键字)；type(任务类型，枚举：design
                            设计 | devel 开发 | request 需求 | test 测试 | study 研究 |
                            discuss 讨论 | ui 界面 | affair 事务 | misc
                            其他)；story(相关用户故事，示例：all)；fromBug(来源Bug编号，枚举：design
                            设计 | devel 开发 | request 需求 | test 测试 | study 研究 |
                            discuss 讨论 | ui 界面 | affair 事务 | misc
                            其他)；closedReason(关闭原因，枚举：done 已完成 | cancel
                            已取消)；openedBy(由谁创建，用户，示例：admin)；finishedBy(由谁完成，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；canceledBy(由谁取消，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedDate(创建日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；estStarted(预计开始，示例：2026-01-01)；realStarted(实际开始，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；finishedDate(实际完成，示例：2026-01-01)；closedDate(关闭时间，示例：2026-01-01)；canceledDate(取消时间，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值区分大小写<br>{"options":[{"value":"assignedTo","label":"指派给我"},{"value":"openedBy","label":"由我创建"},{"value":"finishedBy","label":"由我完成"},{"value":"myInvolved","label":"由我参与"},{"value":"closedBy","label":"由我关闭"},{"value":"canceledBy","label":"由我取消"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"},{"value":"pri_asc","label":"优先级 升序"},{"value":"pri_desc","label":"优先级 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(任务名称，示例：关键字)；keywords(关键词，示例：关键字)；id(编号，示例：1)；status(任务状态，枚举：wait 未开始 \| doing 进行中 \| done 已完成 \| pause 已暂停 \| cancel 已取消 \| closed 已关闭)；desc(任务描述，示例：关键字)；assignedTo(指派给，用户，示例：admin)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；project(所属项目，示例：all)；execution(所属执行，示例：all)；module(所属模块，示例：all)；estimate(最初预计，示例：关键字)；left(预计剩余，示例：关键字)；consumed(总计消耗，示例：关键字)；type(任务类型，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；story(相关用户故事，示例：all)；fromBug(来源Bug编号，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；closedReason(关闭原因，枚举：done 已完成 \| cancel 已取消)；openedBy(由谁创建，用户，示例：admin)；finishedBy(由谁完成，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；canceledBy(由谁取消，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedDate(创建日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；estStarted(预计开始，示例：2026-01-01)；realStarted(实际开始，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；finishedDate(实际完成，示例：2026-01-01)；closedDate(关闭时间，示例：2026-01-01)；canceledDate(取消时间，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-bugs"></a>

## zentao my bugs

```text
Usage: zentao my bugs [options]

指派给我的Bug（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值取自 zt_bug 的字段名（区分大小写）
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active
                            激活 | resolved 已解决 | closed 已关闭)；confirmed(是否确认，枚举：1
                            已确认 | 0
                            未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1
                            | 2 | 3 | 4)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；type(Bug类型，枚举：codeerror 代码错误 | config 配置相关 |
                            install 安装部署 | security 安全相关 | performance 性能问题 |
                            standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷
                            | codeimprovement 代码改进 | others 其他)；os(操作系统，枚举：all
                            全部 | windows Windows | win11 Windows 11 | win10
                            Windows 10 | win8 Windows 8 | win7 Windows 7 | winxp
                            Windows XP | osx Mac OS | android Android | ios IOS
                            | linux Linux | ubuntu Ubuntu | chromeos Chrome OS |
                            fedora Fedora | unix Unix | others
                            其他)；browser(浏览器，枚举：all 全部 | chrome Chrome | edge
                            Edge | ie IE系列 | ie11 IE11 | ie10 IE10 | ie9 IE9 |
                            ie8 IE8 | firefox firefox系列 | opera Opera系列 | safari
                            | 360 360浏览器 | qq QQ浏览器 | other
                            其他)；resolution(解决方案，枚举：bydesign 设计如此 | duplicate
                            重复Bug | external 外部原因 | fixed 已解决 | notrepro 无法重现 |
                            postponed 延期处理 | willnotfix 不予解决 | tostory
                            转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值取自 zt_bug 的字段名（区分大小写）<br>{"options":[{"value":"assignedTo","label":"指派给我"},{"value":"openedBy","label":"由我创建"},{"value":"resolvedBy","label":"由我解决"},{"value":"closedBy","label":"由我关闭"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"},{"value":"severity_asc","label":"严重程度 升序"},{"value":"severity_desc","label":"严重程度 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active 激活 \| resolved 已解决 \| closed 已关闭)；confirmed(是否确认，枚举：1 已确认 \| 0 未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1 \| 2 \| 3 \| 4)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；type(Bug类型，枚举：codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| codeimprovement 代码改进 \| others 其他)；os(操作系统，枚举：all 全部 \| windows Windows \| win11 Windows 11 \| win10 Windows 10 \| win8 Windows 8 \| win7 Windows 7 \| winxp Windows XP \| osx Mac OS \| android Android \| ios IOS \| linux Linux \| ubuntu Ubuntu \| chromeos Chrome OS \| fedora Fedora \| unix Unix \| others 其他)；browser(浏览器，枚举：all 全部 \| chrome Chrome \| edge Edge \| ie IE系列 \| ie11 IE11 \| ie10 IE10 \| ie9 IE9 \| ie8 IE8 \| firefox firefox系列 \| opera Opera系列 \| safari \| 360 360浏览器 \| qq QQ浏览器 \| other 其他)；resolution(解决方案，枚举：bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因 \| fixed 已解决 \| notrepro 无法重现 \| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-stories"></a>

## zentao my stories

```text
Usage: zentao my stories [options]

指派给我的研发需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值区分大小写
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值区分大小写<br>{"options":[{"value":"all","label":"全部"},{"value":"assignedTo","label":"指派给我"},{"value":"openedBy","label":"由我创建"},{"value":"reviewBy","label":"待我评审"},{"value":"reviewedBy","label":"我评审过"},{"value":"closedBy","label":"由我关闭"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-epics"></a>

## zentao my epics

```text
Usage: zentao my epics [options]

指派给我的业务需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值区分大小写
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值区分大小写<br>{"options":[{"value":"all","label":"全部"},{"value":"assignedTo","label":"指派给我"},{"value":"openedBy","label":"由我创建"},{"value":"reviewBy","label":"待我评审"},{"value":"reviewedBy","label":"我评审过"},{"value":"closedBy","label":"由我关闭"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-requirements"></a>

## zentao my requirements

```text
Usage: zentao my requirements [options]

指派给我的用户需求（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值区分大小写
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值区分大小写<br>{"options":[{"value":"all","label":"全部"},{"value":"assignedTo","label":"指派给我"},{"value":"openedBy","label":"由我创建"},{"value":"reviewBy","label":"待我评审"},{"value":"reviewedBy","label":"我评审过"},{"value":"closedBy","label":"由我关闭"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-testtasks"></a>

## zentao my testtasks

```text
Usage: zentao my testtasks [options]

我负责的的测试单（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，接口固定返回“我参与的未完成测试单”
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，接口固定返回“我参与的未完成测试单”<br>{"options":[{"value":"assignedTo","label":"我参与的"},{"value":"bySearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-projects"></a>

## zentao my projects

```text
Usage: zentao my projects [options]

我参与的项目（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是doing
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "doing" | 状态，默认是doing<br>{"options":[{"value":"doing","label":"进行中"},{"value":"wait","label":"未开始"},{"value":"suspended","label":"已挂起"},{"value":"closed","label":"已关闭"},{"value":"done","label":"已完成"},{"value":"undone","label":"未完成"},{"value":"delayed","label":"已延期"},{"value":"openedbyme","label":"由我创建"},{"value":"all","label":"全部"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-feedbacks"></a>

## zentao my feedbacks

```text
Usage: zentao my feedbacks [options]

指派给我的反馈（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是assigntome
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "assigntome" | 状态，默认是assigntome<br>{"options":[{"value":"assigntome","label":"指派给我"},{"value":"unclosed","label":"未关闭"},{"value":"wait","label":"待处理"},{"value":"doing","label":"处理中"},{"value":"toclosed","label":"待关闭"},{"value":"openedbyme","label":"由我创建"},{"value":"reviewedbyme","label":"我评审过"},{"value":"closedbyme","label":"由我关闭"},{"value":"assignedbyme","label":"由我指派"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-tickets"></a>

## zentao my tickets

```text
Usage: zentao my tickets [options]

指派给我的工单（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是assignedtome
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedCount,activatedDate,assignedTo,closedBy,closedDate,closedReason,contact,customer,deadline,desc,editedBy,editedDate,feedback,id,keywords,mailto,module,notifyEmail,openedBuild,openedBy,openedDate,pri,product,resolution,resolvedBy,resolvedDate,startedBy,startedDate,status,title,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "assignedtome" | 状态，默认是assignedtome<br>{"options":[{"value":"assignedtome","label":"指派给我"},{"value":"unclosed","label":"未关闭"},{"value":"wait","label":"待处理"},{"value":"doing","label":"处理中"},{"value":"done","label":"待关闭"},{"value":"closed","label":"已关闭"},{"value":"openedbyme","label":"由我创建"},{"value":"finishedbyme","label":"由我解决"},{"value":"closedbyme","label":"由我关闭"},{"value":"assignedbyme","label":"由我指派"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedCount,activatedDate,assignedTo,closedBy,closedDate,closedReason,contact,customer,deadline,desc,editedBy,editedDate,feedback,id,keywords,mailto,module,notifyEmail,openedBuild,openedBy,openedDate,pri,product,resolution,resolvedBy,resolvedDate,startedBy,startedDate,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-testcases"></a>

## zentao my testcases

```text
Usage: zentao my testcases [options]

指派给我的用例（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assigntome
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit
                            单元测试 | interface 接口测试 | feature 功能测试 | install 安装部署
                            | config 配置相关 | performance 性能测试 | security 安全相关 |
                            other 其他)；auto(自动化，枚举：auto 是 | no
                            否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait
                            待评审 | normal 正常 | blocked 被阻塞 | investigate
                            研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest
                            单元测试环节 | feature 功能测试环节 | intergrate 集成测试环节 | system
                            系统测试环节 | smoke 冒烟测试环节 | bvt
                            版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 | 1 | 2 |
                            4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass
                            通过 | fail 失败 | blocked 阻塞 | null
                            未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assigntome" | 状态，默认是assigntome<br>{"options":[{"value":"assigntome","label":"指派给我"},{"value":"openedbyme","label":"我创建的"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)；auto(自动化，枚举：auto 是 \| no 否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait 待评审 \| normal 正常 \| blocked 被阻塞 \| investigate 研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest 单元测试环节 \| feature 功能测试环节 \| intergrate 集成测试环节 \| system 系统测试环节 \| smoke 冒烟测试环节 \| bvt 版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 \| 1 \| 2 \| 4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass 通过 \| fail 失败 \| blocked 阻塞 \| null 未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-meetings"></a>

## zentao my meetings

```text
Usage: zentao my meetings [options]

我的会议（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --browse-type <value>     状态，默认是futureMeeting
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "futureMeeting" | 状态，默认是futureMeeting<br>{"options":[{"value":"futureMeeting","label":"我参加的（未开始）"},{"value":"all","label":"全部"},{"value":"booked","label":"我预约的"},{"value":"participate","label":"我参加的（全部）"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"date_asc","label":"日期 升序"},{"value":"date_desc","label":"日期 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-issues"></a>

## zentao my issues

```text
Usage: zentao my issues [options]

指派给我的问题（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值取自 zt_issue 的字段名
  --order-by <value>        排序
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值取自 zt_issue 的字段名<br>{"options":[{"value":"assignedTo","label":"指派给我"},{"value":"createdBy","label":"由我创建"},{"value":"resolvedBy","label":"由我解决"},{"value":"closedBy","label":"由我关闭"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"title_asc","label":"标题 升序"},{"value":"title_desc","label":"标题 降序"},{"value":"severity_asc","label":"严重程度 升序"},{"value":"severity_desc","label":"严重程度 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-risks"></a>

## zentao my risks

```text
Usage: zentao my risks [options]

指派给我的风险（最低版本：22.5 / biz13.5 / max8.5 / ipd5.5）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     状态，默认是assignedTo，取值取自 zt_risk 的字段名
  --order-by <value>        排序
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.5 / biz13.5 / max8.5 / ipd5.5。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 状态，默认是assignedTo，取值取自 zt_risk 的字段名<br>{"options":[{"value":"assignedTo","label":"指派给我"},{"value":"createdBy","label":"由我创建"},{"value":"closedBy","label":"由我关闭"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称 升序"},{"value":"name_desc","label":"名称 降序"},{"value":"status_asc","label":"状态 升序"},{"value":"status_desc","label":"状态 降序"},{"value":"pri_asc","label":"优先级 升序"},{"value":"pri_desc","label":"优先级 降序"}]} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-tasks"></a>

## zentao my activity-tasks

```text
Usage: zentao my activity-tasks [options]

我的地盘-贡献任务（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：name(任务名称，示例：关键字)；keywords(关键词，示例：关键字)；id(编号，示例：1)；status(任务状态，枚举：wait
                            未开始 | doing 进行中 | done 已完成 | pause 已暂停 | cancel 已取消
                            | closed
                            已关闭)；desc(任务描述，示例：关键字)；assignedTo(指派给，用户，示例：admin)；pri(优先级，枚举：1
                            | 2 | 3 |
                            4)；project(所属项目，示例：all)；execution(所属执行，示例：all)；module(所属模块，示例：all)；estimate(最初预计，示例：关键字)；left(预计剩余，示例：关键字)；consumed(总计消耗，示例：关键字)；type(任务类型，枚举：design
                            设计 | devel 开发 | request 需求 | test 测试 | study 研究 |
                            discuss 讨论 | ui 界面 | affair 事务 | misc
                            其他)；story(相关用户故事，示例：all)；fromBug(来源Bug编号，枚举：design
                            设计 | devel 开发 | request 需求 | test 测试 | study 研究 |
                            discuss 讨论 | ui 界面 | affair 事务 | misc
                            其他)；closedReason(关闭原因，枚举：done 已完成 | cancel
                            已取消)；openedBy(由谁创建，用户，示例：admin)；finishedBy(由谁完成，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；canceledBy(由谁取消，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedDate(创建日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；estStarted(预计开始，示例：2026-01-01)；realStarted(实际开始，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；finishedDate(实际完成，示例：2026-01-01)；closedDate(关闭时间，示例：2026-01-01)；canceledDate(取消时间，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(任务名称，示例：关键字)；keywords(关键词，示例：关键字)；id(编号，示例：1)；status(任务状态，枚举：wait 未开始 \| doing 进行中 \| done 已完成 \| pause 已暂停 \| cancel 已取消 \| closed 已关闭)；desc(任务描述，示例：关键字)；assignedTo(指派给，用户，示例：admin)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；project(所属项目，示例：all)；execution(所属执行，示例：all)；module(所属模块，示例：all)；estimate(最初预计，示例：关键字)；left(预计剩余，示例：关键字)；consumed(总计消耗，示例：关键字)；type(任务类型，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；story(相关用户故事，示例：all)；fromBug(来源Bug编号，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；closedReason(关闭原因，枚举：done 已完成 \| cancel 已取消)；openedBy(由谁创建，用户，示例：admin)；finishedBy(由谁完成，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；canceledBy(由谁取消，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedDate(创建日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；estStarted(预计开始，示例：2026-01-01)；realStarted(实际开始，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；finishedDate(实际完成，示例：2026-01-01)；closedDate(关闭时间，示例：2026-01-01)；canceledDate(取消时间，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-bugs"></a>

## zentao my activity-bugs

```text
Usage: zentao my activity-bugs [options]

我的地盘-贡献 Bug（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active
                            激活 | resolved 已解决 | closed 已关闭)；confirmed(是否确认，枚举：1
                            已确认 | 0
                            未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1
                            | 2 | 3 | 4)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；type(Bug类型，枚举：codeerror 代码错误 | config 配置相关 |
                            install 安装部署 | security 安全相关 | performance 性能问题 |
                            standard 标准规范 | automation 测试脚本 | designdefect 设计缺陷
                            | codeimprovement 代码改进 | others 其他)；os(操作系统，枚举：all
                            全部 | windows Windows | win11 Windows 11 | win10
                            Windows 10 | win8 Windows 8 | win7 Windows 7 | winxp
                            Windows XP | osx Mac OS | android Android | ios IOS
                            | linux Linux | ubuntu Ubuntu | chromeos Chrome OS |
                            fedora Fedora | unix Unix | others
                            其他)；browser(浏览器，枚举：all 全部 | chrome Chrome | edge
                            Edge | ie IE系列 | ie11 IE11 | ie10 IE10 | ie9 IE9 |
                            ie8 IE8 | firefox firefox系列 | opera Opera系列 | safari
                            | 360 360浏览器 | qq QQ浏览器 | other
                            其他)；resolution(解决方案，枚举：bydesign 设计如此 | duplicate
                            重复Bug | external 外部原因 | fixed 已解决 | notrepro 无法重现 |
                            postponed 延期处理 | willnotfix 不予解决 | tostory
                            转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active 激活 \| resolved 已解决 \| closed 已关闭)；confirmed(是否确认，枚举：1 已确认 \| 0 未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1 \| 2 \| 3 \| 4)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；type(Bug类型，枚举：codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| codeimprovement 代码改进 \| others 其他)；os(操作系统，枚举：all 全部 \| windows Windows \| win11 Windows 11 \| win10 Windows 10 \| win8 Windows 8 \| win7 Windows 7 \| winxp Windows XP \| osx Mac OS \| android Android \| ios IOS \| linux Linux \| ubuntu Ubuntu \| chromeos Chrome OS \| fedora Fedora \| unix Unix \| others 其他)；browser(浏览器，枚举：all 全部 \| chrome Chrome \| edge Edge \| ie IE系列 \| ie11 IE11 \| ie10 IE10 \| ie9 IE9 \| ie8 IE8 \| firefox firefox系列 \| opera Opera系列 \| safari \| 360 360浏览器 \| qq QQ浏览器 \| other 其他)；resolution(解决方案，枚举：bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因 \| fixed 已解决 \| notrepro 无法重现 \| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-stories"></a>

## zentao my activity-stories

```text
Usage: zentao my activity-stories [options]

我的地盘-贡献研发需求（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-epics"></a>

## zentao my activity-epics

```text
Usage: zentao my activity-epics [options]

我的地盘-贡献业务需求（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-requirements"></a>

## zentao my activity-requirements

```text
Usage: zentao my activity-requirements [options]

我的地盘-贡献用户需求（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft
                            草稿 | reviewing 评审中 | active 激活 | changing 变更中 |
                            closed 已关闭)；pri(优先级，枚举：1 | 2 | 3 |
                            4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 |
                            planned 已计划 | projected 研发立项 | designing 设计中 |
                            designed 设计完毕 | developing 研发中 | developed 研发完毕 |
                            testing 测试中 | tested 测试完毕 | verified 已验收 | rejected
                            验收失败 | delivering 交付中 | delivered 已交付 | released 已发布
                            | closed
                            已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer
                            客户 | user 用户 | po 产品经理 | market 市场 | service 客服 |
                            operation 运营 | support 技术支持 | competitor 竞争对手 |
                            partner 合作伙伴 | dev 开发人员 | tester 测试人员 | bug Bug |
                            forum 论坛 | other
                            其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature
                            功能 | interface 接口 | performance 性能 | safe 安全 |
                            experience 体验 | improve 改进 | other
                            其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass
                            确认通过 | revert 撤销变更 | clarify 有待明确 | reject
                            拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done
                            已完成 | subdivided 已拆分 | duplicate 重复 | postponed 延期 |
                            willnotdo 不做 | cancel 已取消 | bydesign
                            设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-test-tasks"></a>

## zentao my activity-test-tasks

```text
Usage: zentao my activity-test-tasks [options]

我的地盘-贡献测试单（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-activity-test-cases"></a>

## zentao my activity-test-cases

```text
Usage: zentao my activity-test-cases [options]

我的地盘-贡献用例（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit
                            单元测试 | interface 接口测试 | feature 功能测试 | install 安装部署
                            | config 配置相关 | performance 性能测试 | security 安全相关 |
                            other 其他)；auto(自动化，枚举：auto 是 | no
                            否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait
                            待评审 | normal 正常 | blocked 被阻塞 | investigate
                            研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest
                            单元测试环节 | feature 功能测试环节 | intergrate 集成测试环节 | system
                            系统测试环节 | smoke 冒烟测试环节 | bvt
                            版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 | 1 | 2 |
                            4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass
                            通过 | fail 失败 | blocked 阻塞 | null
                            未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all)
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)；auto(自动化，枚举：auto 是 \| no 否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait 待评审 \| normal 正常 \| blocked 被阻塞 \| investigate 研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest 单元测试环节 \| feature 功能测试环节 \| intergrate 集成测试环节 \| system 系统测试环节 \| smoke 冒烟测试环节 \| bvt 版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 \| 1 \| 2 \| 4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass 通过 \| fail 失败 \| blocked 阻塞 \| null 未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all)<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-docs"></a>

## zentao my activity-docs

```text
Usage: zentao my activity-docs [options]

我的地盘-贡献文档（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-activity-issues"></a>

## zentao my activity-issues

```text
Usage: zentao my activity-issues [options]

我的地盘-贡献问题（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-activity-risks"></a>

## zentao my activity-risks

```text
Usage: zentao my activity-risks [options]

我的地盘-贡献风险（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-review-issues"></a>

## zentao my activity-review-issues

```text
Usage: zentao my activity-review-issues [options]

我的地盘-贡献评审问题（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,createdBy,createdDate,id,opinion,resolution,review,status,title,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,createdBy,createdDate,id,opinion,resolution,review,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-feedbacks"></a>

## zentao my activity-feedbacks

```text
Usage: zentao my activity-feedbacks [options]

我的地盘-贡献反馈（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-activity-audits"></a>

## zentao my activity-audits

```text
Usage: zentao my activity-audits [options]

我的地盘-贡献审批（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     贡献筛选类型，不传时使用禅道页面默认值。
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | — | 贡献筛选类型，不传时使用禅道页面默认值。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-review-issues"></a>

## zentao my review-issues

```text
Usage: zentao my review-issues [options]

我的地盘-待处理评审问题（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --param <value>           搜索参数；browseType=bysearch 或 bySearch 时必填。
  --browse-type <value>     待处理筛选类型，默认 assignedTo，取值取自 zt_reviewissue 的字段名
  --order-by <value>        排序字段。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,createdBy,createdDate,id,opinion,resolution,review,status,title,type
  --group-join <value>      条件组之间的连接方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 或 bySearch 时必填。<br>{} |
| --browse-type | browseType | query | string | 否 | "assignedTo" | 待处理筛选类型，默认 assignedTo，取值取自 zt_reviewissue 的字段名<br>{"options":[{"value":"assignedTo","label":"指派给我"},{"value":"createdBy","label":"由我创建"},{"value":"resolutionBy","label":"由我解决"},{"value":"assignedBy","label":"由我指派"},{"value":"bysearch","label":"按查询搜索，需同时传 param"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,createdBy,createdDate,id,opinion,resolution,review,status,title,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-my-audits"></a>

## zentao my audits

```text
Usage: zentao my audits [options]

我的地盘-待处理审批（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     待处理审批类型，默认 all
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "all" | 待处理审批类型，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"demand","label":"需求池需求"},{"value":"story","label":"研发需求"},{"value":"requirement","label":"用户需求"},{"value":"epic","label":"业务需求"},{"value":"testcase","label":"用例"},{"value":"project","label":"项目"},{"value":"ppm","label":"评审请求"},{"value":"feedback","label":"反馈"},{"value":"自定义工作流模块代号","label":"自定义工作流模块代号"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-audit-plans"></a>

## zentao my audit-plans

```text
Usage: zentao my audit-plans [options]

我的地盘-待处理审计计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     待处理筛选类型，默认 mychecking，取值不区分大小写
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "mychecking" | 待处理筛选类型，默认 mychecking，取值不区分大小写<br>{"options":[{"value":"mychecking","label":"待我检查"},{"value":"checked","label":"已检查"},{"value":"wait","label":"未检查"},{"value":"checking","label":"检查中"},{"value":"assignto","label":"指派给我"},{"value":"delay","label":"已延期"},{"value":"iscycle","label":"周期性计划"},{"value":"all","label":"全部"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-ncs"></a>

## zentao my ncs

```text
Usage: zentao my ncs [options]

我的地盘-待处理不符合项（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     待处理筛选类型，默认 assignedToMe
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "assignedToMe" | 待处理筛选类型，默认 assignedToMe<br>{"options":[{"value":"assignedToMe","label":"指派给我"},{"value":"createdByMe","label":"由我创建"},{"value":"resolvedByMe","label":"由我解决"},{"value":"closedByMe","label":"由我关闭"},{"value":"all","label":"全部"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量，不超过1000<br>{} |
| --page | pageID | query | number | 否 | — | 页码，从第1页开始<br>{} |

<a id="action-my-create-ssh"></a>

## zentao my create-ssh

```text
Usage: zentao my create-ssh [options]

添加我的 SSH 公钥（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --name <value>          密钥名称，去除首尾空白后仅允许英文字母、数字、连字符、下划线、点和 $（必填）
  --public-key <value>    完整单行 SSH 公钥文本，去除首尾空白；支持
                          ssh-rsa、ecdsa-sha2-nistp256/384/521、ssh-ed25519、sk-ecdsa-sha2-nistp256@openssh.com、sk-ssh-ed25519@openssh.com
                          前缀，完整性及重复检查由 GitFox 处理（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

需部署代码库 API 2.0 实现并配置 GitFox，将公钥添加到当前 Token 用户的 GitFox 账号，account 不能改变归属。成功仅返回 message，不返回密钥 ID；公钥错误保留在 rawMessage.publicKey 中。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --name | name | body | string | 是 | — | 密钥名称，去除首尾空白后仅允许英文字母、数字、连字符、下划线、点和 $<br>{"minLength":1} |
| --public-key | publicKey | body | string | 是 | — | 完整单行 SSH 公钥文本，去除首尾空白；支持 ssh-rsa、ecdsa-sha2-nistp256/384/521、ssh-ed25519、sk-ecdsa-sha2-nistp256@openssh.com、sk-ssh-ed25519@openssh.com 前缀，完整性及重复检查由 GitFox 处理<br>{"minLength":1} |

<a id="module-process"></a>

## 过程裁剪 · process

```text
Usage: zentao process [options] [command]

过程裁剪

Options:
  -h, --help                        显示命令帮助

Commands:
  props                             返回对象字段定义（离线）
  list [options]                    获取过程裁剪列表，支持获取项目/执行下的过程裁剪（最低版本：22.7 / biz13.7
                                    / max8.7 / ipd5.7）
  set-project [options] [target]    提交项目过程裁剪结果（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
  set-execution [options] [target]  提交执行过程裁剪结果（最低版本：22.7 / biz13.7 / max8.7 /
                                    ipd5.7）
```

<a id="action-process-list"></a>

## zentao process list

```text
Usage: zentao process list [options]

获取过程裁剪列表，支持获取项目/执行下的过程裁剪（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --scope <value>           过程裁剪所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     过程裁剪筛选类型，默认 wait
  --module-id <value>       过程 ID，用于只查询指定过程下的活动和交付物；默认 0。
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 过程裁剪所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "wait" | 过程裁剪筛选类型，默认 wait<br>{"options":[{"value":"wait","label":"待裁剪"},{"value":"yes","label":"已裁剪适用"},{"value":"no","label":"已裁剪不适用"}]} |
| --module-id | moduleID | query | number | 否 | "0" | 过程 ID，用于只查询指定过程下的活动和交付物；默认 0。<br>{} |

<a id="action-process-set-project"></a>

## zentao process set-project

```text
Usage: zentao process set-project [options] [target]

提交项目过程裁剪结果（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --items <value>         裁剪结果列表，每项包含 type(activity 活动 | deliverable
                          交付物)、id(对象ID)、result(yes 适用 | no 不适用)（必填）
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --items | items | body | array | 是 | — | 裁剪结果列表，每项包含 type(activity 活动 \| deliverable 交付物)、id(对象ID)、result(yes 适用 \| no 不适用)<br>{"items":{"type":"string"}} |

<a id="action-process-set-execution"></a>

## zentao process set-execution

```text
Usage: zentao process set-execution [options] [target]

提交执行过程裁剪结果（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --items <value>         裁剪结果列表，每项包含 type(activity 活动 | deliverable
                          交付物)、id(对象ID)、result(yes 适用 | no 不适用)（必填）
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --items | items | body | array | 是 | — | 裁剪结果列表，每项包含 type(activity 活动 \| deliverable 交付物)、id(对象ID)、result(yes 适用 \| no 不适用)<br>{"items":{"type":"string"}} |

<a id="module-auditplan"></a>

## 质量保证计划 · auditplan

```text
Usage: zentao auditplan [options] [command]

质量保证计划

Options:
  -h, --help                       显示命令帮助

Commands:
  props                            返回对象字段定义（离线）
  list [options]                   获取质量保证计划列表，支持获取项目/执行下的质量保证计划（最低版本：22.7 /
                                   biz13.7 / max8.7 / ipd5.7）
  create [options]                 新增质量保证计划（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
  check [options] [target]         检查质量保证计划（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
  batch-create [options] [target]  批量新增项目质量保证计划（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
  get [options] [target]           获取质量保证详情（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
  update [options] [target]        编辑质量保证计划（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
  delete [options] [target]        删除质量保证计划（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
```

<a id="action-auditplan-list"></a>

## zentao auditplan list

```text
Usage: zentao auditplan list [options]

获取质量保证计划列表，支持获取项目/执行下的质量保证计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --scope <value>           质量保证计划所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     筛选类型，默认 all
  --param <value>           筛选参数。browseType=bysearch 时传查询 ID；按过程筛选时传过程
                            ID；按执行筛选时传执行 ID。
  --order-by <value>        排序字段，默认 id_desc。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：assignedTo,checkDate,checkedBy,createdBy,createdDate,execution,id,objectID,process,realCheckDate,status
  --group-join <value>      条件组之间的连接方式
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 质量保证计划所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 筛选类型，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"待检查"},{"value":"checking","label":"检查中"},{"value":"checked","label":"已检查"},{"value":"assignto","label":"指派给我"},{"value":"delay","label":"已延期"},{"value":"today","label":"今天"},{"value":"yesterday","label":"昨天"},{"value":"lastmonth","label":"上月"},{"value":"month","label":"本月"},{"value":"nextmonth","label":"下月"},{"value":"iscycle","label":"周期计划"}]} |
| --param | param | query | number | 否 | — | 筛选参数。browseType=bysearch 时传查询 ID；按过程筛选时传过程 ID；按执行筛选时传执行 ID。<br>{} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedTo,checkDate,checkedBy,createdBy,createdDate,execution,id,objectID,process,realCheckDate,status<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-auditplan-create"></a>

## zentao auditplan create

```text
Usage: zentao auditplan create [options]

新增质量保证计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --project-id <value>        所属项目或执行 ID（必填）
  --execution <value>         所属执行 ID，项目级计划传 0；敏捷多执行项目下需要传执行 ID
  --process <value>           所属过程 ID（必填）
  --object-id <value>         检查对象 ID（活动或交付物 ID）（必填）
  --object-type <value>       检查对象类型(activity 活动 | zoutput 交付物)
  --status <value>            状态(wait 待检查 | checking 检查中 | checked 已检查)
  --is-cycle <value>          是否周期计划(0 否 | 1 是)
  --check-date-list <value>   计划检查日期列表
  --assigned-to-list <value>  检查人账号列表
  --project <id>              projectID 或 scope/scopeID 别名
  --data <json|@file|@->      JSON 对象、文件或显式标准输入
  -h, --help                  显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | body | integer | 是 | — | 所属项目或执行 ID<br>{"format":"int32"} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级计划传 0；敏捷多执行项目下需要传执行 ID<br>{"format":"int32"} |
| --process | process | body | integer | 是 | — | 所属过程 ID<br>{"format":"int32"} |
| --object-id | objectID | body | integer | 是 | — | 检查对象 ID（活动或交付物 ID）<br>{"format":"int32"} |
| --object-type | objectType | body | string | 否 | — | 检查对象类型(activity 活动 \| zoutput 交付物)<br>{} |
| --status | status | body | string | 否 | — | 状态(wait 待检查 \| checking 检查中 \| checked 已检查)<br>{} |
| --is-cycle | isCycle | body | integer | 否 | — | 是否周期计划(0 否 \| 1 是)<br>{"format":"int32"} |
| --check-date-list | checkDateList | body | array | 否 | — | 计划检查日期列表<br>{"items":{"type":"string"}} |
| --assigned-to-list | assignedToList | body | array | 否 | — | 检查人账号列表<br>{"items":{"type":"string"}} |

<a id="action-auditplan-check"></a>

## zentao auditplan check

```text
Usage: zentao auditplan check [options] [target]

检查质量保证计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 auditplanID；也可使用命名参数

Options:
  --auditplan-id <value>  auditplanID（必填）
  --list-id <value>       检查清单项 ID 列表（必填）
  --result <value>        检查结果列表(pass 通过 | fail 不通过)（必填）
  --status <value>        结果状态列表(normal 正式提交 | draft 草稿)
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --auditplan-id | auditplanID | path | integer | 是 | — | auditplanID<br>{} |
| --list-id | listID | body | array | 是 | — | 检查清单项 ID 列表<br>{"items":{"type":"string"}} |
| --result | result | body | array | 是 | — | 检查结果列表(pass 通过 \| fail 不通过)<br>{"items":{"type":"string"}} |
| --status | status | body | array | 否 | — | 结果状态列表(normal 正式提交 \| draft 草稿)<br>{"items":{"type":"string"}} |

<a id="action-auditplan-batch-create"></a>

## zentao auditplan batch-create

```text
Usage: zentao auditplan batch-create [options] [target]

批量新增项目质量保证计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --process <value>       过程 ID 列表（必填）
  --execution <value>     执行 ID 列表，项目级计划传 0
  --object-id <value>     检查对象 ID 列表（必填）
  --object-type <value>   对象类型列表(activity 活动 | zoutput 交付物)
  --check-date <value>    计划检查日期列表（必填）
  --assigned-to <value>   指派人账号列表
  --status <value>        状态列表(wait 待检查 | checking 检查中 | checked 已检查)
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --process | process | body | array | 是 | — | 过程 ID 列表<br>{"items":{"type":"string"}} |
| --execution | execution | body | array | 否 | — | 执行 ID 列表，项目级计划传 0<br>{"items":{"type":"string"}} |
| --object-id | objectID | body | array | 是 | — | 检查对象 ID 列表<br>{"items":{"type":"string"}} |
| --object-type | objectType | body | array | 否 | — | 对象类型列表(activity 活动 \| zoutput 交付物)<br>{"items":{"type":"string"}} |
| --check-date | checkDate | body | array | 是 | — | 计划检查日期列表<br>{"items":{"type":"string"}} |
| --assigned-to | assignedTo | body | array | 否 | — | 指派人账号列表<br>{"items":{"type":"string"}} |
| --status | status | body | array | 否 | — | 状态列表(wait 待检查 \| checking 检查中 \| checked 已检查)<br>{"items":{"type":"string"}} |

<a id="action-auditplan-get"></a>

## zentao auditplan get

```text
Usage: zentao auditplan get [options] [target]

获取质量保证详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 auditplanID；也可使用命名参数

Options:
  --auditplan-id <value>  auditplanID（必填）
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  --fields <fields>       返回字段，逗号分隔
  --html-to-markdown      显式将富文本字段转换为 Markdown
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --auditplan-id | auditplanID | path | integer | 是 | — | auditplanID<br>{} |

<a id="action-auditplan-update"></a>

## zentao auditplan update

```text
Usage: zentao auditplan update [options] [target]

编辑质量保证计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 auditplanID；也可使用命名参数

Options:
  --auditplan-id <value>  auditplanID（必填）
  --execution <value>     所属执行 ID，项目级计划传 0。
  --process <value>       所属过程 ID。
  --object-id <value>     检查对象 ID。
  --object-type <value>   检查对象类型(activity 活动 | zoutput 交付物)
  --status <value>        状态(wait 待检查 | checking 检查中 | checked 已检查)
  --assigned-to <value>   指派人账号。
  --comment <value>       编辑备注。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --auditplan-id | auditplanID | path | integer | 是 | — | auditplanID<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级计划传 0。<br>{"format":"int32"} |
| --process | process | body | integer | 否 | — | 所属过程 ID。<br>{"format":"int32"} |
| --object-id | objectID | body | integer | 否 | — | 检查对象 ID。<br>{"format":"int32"} |
| --object-type | objectType | body | string | 否 | — | 检查对象类型(activity 活动 \| zoutput 交付物)<br>{} |
| --status | status | body | string | 否 | — | 状态(wait 待检查 \| checking 检查中 \| checked 已检查)<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派人账号。<br>{} |
| --comment | comment | body | string | 否 | — | 编辑备注。<br>{} |

<a id="action-auditplan-delete"></a>

## zentao auditplan delete

```text
Usage: zentao auditplan delete [options] [target]

删除质量保证计划（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 auditplanID；也可使用命名参数

Options:
  --auditplan-id <value>  auditplanID（必填）
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  --yes                   确认删除
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --auditplan-id | auditplanID | path | integer | 是 | — | auditplanID<br>{} |

<a id="module-nc"></a>

## 不符合项 · nc

```text
Usage: zentao nc [options] [command]

不符合项

Options:
  -h, --help                           显示命令帮助

Commands:
  props                                返回对象字段定义（离线）
  list [options]                       获取不符合项列表，支持获取项目/执行下的不符合项（最低版本：22.7 /
                                       biz13.7 / max8.7 / ipd5.7）
  create-project [options] [target]    新建项目不符合项（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
  create-execution [options] [target]  新建执行不符合项（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
  get [options] [target]               获取不符合项详情（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
  update [options] [target]            编辑不符合项（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
  delete [options] [target]            删除不符合项（最低版本：22.7 / biz13.7 / max8.7 /
                                       ipd5.7）
```

<a id="action-nc-list"></a>

## zentao nc list

```text
Usage: zentao nc list [options]

获取不符合项列表，支持获取项目/执行下的不符合项（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --scope <value>           不符合项所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     筛选类型，默认 unclosed
  --param <value>           browseType=bysearch 时传查询 ID。
  --order-by <value>        排序字段，默认 id_desc。
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 不符合项所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "unclosed" | 筛选类型，默认 unclosed<br>{"options":[{"value":"all","label":"全部"},{"value":"unclosed","label":"未关闭"},{"value":"assignedtome","label":"指派给我"},{"value":"assignedbyme","label":"由我指派"},{"value":"bysearch","label":"搜索"}]} |
| --param | param | query | string | 否 | — | browseType=bysearch 时传查询 ID。<br>{} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |

<a id="action-nc-create-project"></a>

## zentao nc create-project

```text
Usage: zentao nc create-project [options] [target]

新建项目不符合项（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --object-type <value>   不符合项对象类型(auditplan 质量保证计划 | deliverable 交付物)（必填）
  --title <value>         不符合项名称（必填）
  --execution <value>     所属执行 ID，项目级不符合项传 0
  --auditplan <value>     质量保证计划 ID，objectType=auditplan 时必填
  --list-id <value>       检查清单项 ID，objectType=auditplan 时必填
  --severity <value>      严重程度(1 严重 | 2 中等 | 3 轻微)（必填）
  --type <value>          不符合项分类
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --object-type | objectType | body | string | 是 | — | 不符合项对象类型(auditplan 质量保证计划 \| deliverable 交付物)<br>{} |
| --title | title | body | string | 是 | — | 不符合项名称<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级不符合项传 0<br>{"format":"int32"} |
| --auditplan | auditplan | body | integer | 否 | — | 质量保证计划 ID，objectType=auditplan 时必填<br>{"format":"int32"} |
| --list-id | listID | body | integer | 否 | — | 检查清单项 ID，objectType=auditplan 时必填<br>{"format":"int32"} |
| --severity | severity | body | integer | 是 | — | 严重程度(1 严重 \| 2 中等 \| 3 轻微)<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 不符合项分类<br>{} |

<a id="action-nc-create-execution"></a>

## zentao nc create-execution

```text
Usage: zentao nc create-execution [options] [target]

新建执行不符合项（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 executionID；也可使用命名参数

Options:
  --execution-id <value>  执行ID（必填）
  --object-type <value>   不符合项对象类型(auditplan 质量保证计划 | deliverable 交付物)（必填）
  --title <value>         不符合项名称（必填）
  --auditplan <value>     质量保证计划 ID，objectType=auditplan 时必填
  --list-id <value>       检查清单项 ID，objectType=auditplan 时必填
  --severity <value>      严重程度(1 严重 | 2 中等 | 3 轻微)（必填）
  --type <value>          不符合项分类
  --execution <id>        executionID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --execution-id | executionID | path | integer | 是 | — | 执行ID<br>{} |
| --object-type | objectType | body | string | 是 | — | 不符合项对象类型(auditplan 质量保证计划 \| deliverable 交付物)<br>{} |
| --title | title | body | string | 是 | — | 不符合项名称<br>{} |
| --auditplan | auditplan | body | integer | 否 | — | 质量保证计划 ID，objectType=auditplan 时必填<br>{"format":"int32"} |
| --list-id | listID | body | integer | 否 | — | 检查清单项 ID，objectType=auditplan 时必填<br>{"format":"int32"} |
| --severity | severity | body | integer | 是 | — | 严重程度(1 严重 \| 2 中等 \| 3 轻微)<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 不符合项分类<br>{} |

<a id="action-nc-get"></a>

## zentao nc get

```text
Usage: zentao nc get [options] [target]

获取不符合项详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 ncID；也可使用命名参数

Options:
  --nc-id <value>     ncID（必填）
  --ids <ids>         批量目标 ID，逗号分隔并去重
  --batch-fail-fast   失败后跳过剩余目标
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --nc-id | ncID | path | integer | 是 | — | ncID<br>{} |

<a id="action-nc-update"></a>

## zentao nc update

```text
Usage: zentao nc update [options] [target]

编辑不符合项（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                   单个 ncID；也可使用命名参数

Options:
  --nc-id <value>          ncID（必填）
  --title <value>          不符合项名称（必填）
  --type <value>           不符合项分类
  --execution <value>      所属执行 ID，项目级不符合项传 0。
  --auditplan <value>      质量保证计划 ID，基于质量保证计划的不符合项必填。
  --list-id <value>        检查清单项 ID，基于质量保证计划的不符合项必填。
  --severity <value>       严重程度(1 严重 | 2 中等 | 3 轻微)（必填）
  --assigned-to <value>    指派人账号。
  --data-deadline <value>  计划解决日期。
  --desc <value>           完成情况说明。
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  --ids <ids>              批量目标 ID，逗号分隔并去重
  --batch-fail-fast        失败后跳过剩余目标
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --nc-id | ncID | path | integer | 是 | — | ncID<br>{} |
| --title | title | body | string | 是 | — | 不符合项名称<br>{} |
| --type | type | body | string | 否 | — | 不符合项分类<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级不符合项传 0。<br>{"format":"int32"} |
| --auditplan | auditplan | body | integer | 否 | — | 质量保证计划 ID，基于质量保证计划的不符合项必填。<br>{"format":"int32"} |
| --list-id | listID | body | integer | 否 | — | 检查清单项 ID，基于质量保证计划的不符合项必填。<br>{"format":"int32"} |
| --severity | severity | body | integer | 是 | — | 严重程度(1 严重 \| 2 中等 \| 3 轻微)<br>{"format":"int32"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派人账号。<br>{} |
| --data-deadline | deadline | body | string | 否 | — | 计划解决日期。<br>{} |
| --desc | desc | body | string | 否 | — | 完成情况说明。<br>{} |

<a id="action-nc-delete"></a>

## zentao nc delete

```text
Usage: zentao nc delete [options] [target]

删除不符合项（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target             单个 ncID；也可使用命名参数

Options:
  --nc-id <value>    ncID（必填）
  --ids <ids>        批量目标 ID，逗号分隔并去重
  --batch-fail-fast  失败后跳过剩余目标
  --yes              确认删除
  -h, --help         显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --nc-id | ncID | path | integer | 是 | — | ncID<br>{} |

<a id="module-opportunity"></a>

## 机会 · opportunity

```text
Usage: zentao opportunity [options] [command]

机会

Options:
  -h, --help                       显示命令帮助

Commands:
  props                            返回对象字段定义（离线）
  list [options]                   获取机会列表，支持获取项目/执行下的机会（最低版本：22.7 / biz13.7 /
                                   max8.7 / ipd5.7）
  create [options] [target]        创建项目机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  batch-create [options] [target]  批量创建项目机会（最低版本：22.7 / biz13.7 / max8.7 /
                                   ipd5.7）
  get [options] [target]           获取机会详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update [options] [target]        编辑机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete [options] [target]        删除机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-opportunity-list"></a>

## zentao opportunity list

```text
Usage: zentao opportunity list [options]

获取机会列表，支持获取项目/执行下的机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --scope <value>           机会所属范围（必填）
  --scope-id <value>        所属范围ID（必填）
  --browse-type <value>     筛选类型，默认 all
  --param <value>           搜索参数；browseType=bysearch 时使用。
  --order-by <value>        排序字段，默认 id_desc。
  --filters <value>         搜索条件数组，每项包含 field/operator/value/join/group；field
                            必须是该接口支持的搜索字段，operator
                            使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,actualClosedDate,assignedTo,canceledBy,chance,createdBy,createdDate,desc,editedBy,editedDate,hangupedBy,id,identifiedDate,impact,lastCheckedBy,name,plannedClosedDate,prevention,pri,ratio,resolution,resolvedBy,source,status,strategy,type
  --group-join <value>      条件组之间的连接方式
  --project <id>            projectID 或 scope/scopeID 别名
  --execution <id>          executionID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --scope | scope | path | string | 是 | — | 机会所属范围<br>{"options":[{"value":"projects","label":"项目"},{"value":"executions","label":"执行"}]} |
| --scope-id | scopeID | path | integer | 是 | — | 所属范围ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 筛选类型，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"active","label":"开放"},{"value":"assignTo","label":"指派给我"},{"value":"closed","label":"已关闭"},{"value":"hangup","label":"已挂起"},{"value":"canceled","label":"已取消"},{"value":"review","label":"待评审"},{"value":"bysearch","label":"搜索"}]} |
| --param | param | query | string | 否 | — | 搜索参数；browseType=bysearch 时使用。<br>{} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |
| --filters | filters | query | array | 否 | — | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,actualClosedDate,assignedTo,canceledBy,chance,createdBy,createdDate,desc,editedBy,editedDate,hangupedBy,id,identifiedDate,impact,lastCheckedBy,name,plannedClosedDate,prevention,pri,ratio,resolution,resolvedBy,source,status,strategy,type<br>{} |
| --group-join | groupJoin | query | string | 否 | — | 条件组之间的连接方式<br>{"options":[{"value":"and","label":"and"},{"value":"or","label":"or"}]} |

<a id="action-opportunity-create"></a>

## zentao opportunity create

```text
Usage: zentao opportunity create [options] [target]

创建项目机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                         单个 projectID；也可使用命名参数

Options:
  --project-id <value>           项目ID（必填）
  --name <value>                 机会名称。（必填）
  --source <value>               机会来源。
  --execution <value>            所属执行 ID，项目级机会传 0；传执行 ID 时机会同时归属项目和执行。
  --type <value>                 机会类型。
  --strategy <value>             机会应对策略。
  --impact <value>               影响程度，1-5。
  --chance <value>               发生概率，1-5。
  --ratio <value>                机会系数，通常为 impact * chance。
  --pri <value>                  优先级，1 高、2 中、3 低。
  --identified-date <value>      机会识别日期。
  --planned-closed-date <value>  计划关闭日期。
  --assigned-to <value>          指派人账号。
  --desc <value>                 机会描述。
  --prevention <value>           应对措施。
  --project <id>                 projectID 或 scope/scopeID 别名
  --data <json|@file|@->         JSON 对象、文件或显式标准输入
  -h, --help                     显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | string | 是 | — | 机会名称。<br>{} |
| --source | source | body | string | 否 | — | 机会来源。<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级机会传 0；传执行 ID 时机会同时归属项目和执行。<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 机会类型。<br>{} |
| --strategy | strategy | body | string | 否 | — | 机会应对策略。<br>{} |
| --impact | impact | body | integer | 否 | — | 影响程度，1-5。<br>{"format":"int32"} |
| --chance | chance | body | integer | 否 | — | 发生概率，1-5。<br>{"format":"int32"} |
| --ratio | ratio | body | integer | 否 | — | 机会系数，通常为 impact * chance。<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级，1 高、2 中、3 低。<br>{"format":"int32"} |
| --identified-date | identifiedDate | body | string | 否 | — | 机会识别日期。<br>{} |
| --planned-closed-date | plannedClosedDate | body | string | 否 | — | 计划关闭日期。<br>{} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派人账号。<br>{} |
| --desc | desc | body | string | 否 | — | 机会描述。<br>{} |
| --prevention | prevention | body | string | 否 | — | 应对措施。<br>{} |

<a id="action-opportunity-batch-create"></a>

## zentao opportunity batch-create

```text
Usage: zentao opportunity batch-create [options] [target]

批量创建项目机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --name <value>          机会名称列表（必填）
  --source <value>        机会来源列表
  --execution <value>     所属执行 ID 列表，项目级机会传 0
  --impact <value>        影响程度列表，1-5
  --chance <value>        发生概率列表，1-5
  --pri <value>           优先级列表，1 高、2 中、3 低
  --desc <value>          机会描述列表
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | array | 是 | — | 机会名称列表<br>{"items":{"type":"string"}} |
| --source | source | body | array | 否 | — | 机会来源列表<br>{"items":{"type":"string"}} |
| --execution | execution | body | array | 否 | — | 所属执行 ID 列表，项目级机会传 0<br>{"items":{"type":"string"}} |
| --impact | impact | body | array | 否 | — | 影响程度列表，1-5<br>{"items":{"type":"string"}} |
| --chance | chance | body | array | 否 | — | 发生概率列表，1-5<br>{"items":{"type":"string"}} |
| --pri | pri | body | array | 否 | — | 优先级列表，1 高、2 中、3 低<br>{"items":{"type":"string"}} |
| --desc | desc | body | array | 否 | — | 机会描述列表<br>{"items":{"type":"string"}} |

<a id="action-opportunity-get"></a>

## zentao opportunity get

```text
Usage: zentao opportunity get [options] [target]

获取机会详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 opportunityID；也可使用命名参数

Options:
  --opportunity-id <value>  opportunityID（必填）
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --opportunity-id | opportunityID | path | integer | 是 | — | opportunityID<br>{} |

<a id="action-opportunity-update"></a>

## zentao opportunity update

```text
Usage: zentao opportunity update [options] [target]

编辑机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 opportunityID；也可使用命名参数

Options:
  --opportunity-id <value>  opportunityID（必填）
  --name <value>            机会名称。
  --source <value>          机会来源。
  --execution <value>       所属执行 ID，项目级机会传 0。
  --type <value>            机会类型。
  --strategy <value>        机会应对策略。
  --status <value>          机会状态(active 开放 | closed 已关闭 | hangup 已挂起 | canceled
                            已取消)
  --impact <value>          影响程度，1-5。
  --chance <value>          发生概率，1-5。
  --pri <value>             优先级，1 高、2 中、3 低。
  --assigned-to <value>     指派人账号。
  --desc <value>            机会描述。
  --prevention <value>      应对措施。
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --opportunity-id | opportunityID | path | integer | 是 | — | opportunityID<br>{} |
| --name | name | body | string | 否 | — | 机会名称。<br>{} |
| --source | source | body | string | 否 | — | 机会来源。<br>{} |
| --execution | execution | body | integer | 否 | — | 所属执行 ID，项目级机会传 0。<br>{"format":"int32"} |
| --type | type | body | string | 否 | — | 机会类型。<br>{} |
| --strategy | strategy | body | string | 否 | — | 机会应对策略。<br>{} |
| --status | status | body | string | 否 | — | 机会状态(active 开放 \| closed 已关闭 \| hangup 已挂起 \| canceled 已取消)<br>{} |
| --impact | impact | body | integer | 否 | — | 影响程度，1-5。<br>{"format":"int32"} |
| --chance | chance | body | integer | 否 | — | 发生概率，1-5。<br>{"format":"int32"} |
| --pri | pri | body | integer | 否 | — | 优先级，1 高、2 中、3 低。<br>{"format":"int32"} |
| --assigned-to | assignedTo | body | string | 否 | — | 指派人账号。<br>{} |
| --desc | desc | body | string | 否 | — | 机会描述。<br>{} |
| --prevention | prevention | body | string | 否 | — | 应对措施。<br>{} |

<a id="action-opportunity-delete"></a>

## zentao opportunity delete

```text
Usage: zentao opportunity delete [options] [target]

删除机会（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 opportunityID；也可使用命名参数

Options:
  --opportunity-id <value>  opportunityID（必填）
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  --yes                     确认删除
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --opportunity-id | opportunityID | path | integer | 是 | — | opportunityID<br>{} |

<a id="module-deliverable"></a>

## 交付物 · deliverable

```text
Usage: zentao deliverable [options] [command]

交付物

Options:
  -h, --help                  显示命令帮助

Commands:
  props                       返回对象字段定义（离线）
  list [options] [target]     获取交付物列表，支持获取项目下的交付物（最低版本：22.7 / biz13.7 / max8.7 /
                              ipd5.7）
  options [options] [target]  获取项目可选交付物列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create [options] [target]   新增项目交付物（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get [options] [target]      获取交付物详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete [options] [target]   删除项目交付物（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-deliverable-list"></a>

## zentao deliverable list

```text
Usage: zentao deliverable list [options] [target]

获取交付物列表，支持获取项目下的交付物（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      所属项目ID（必填）
  --browse-type <value>     交付物筛选类型，默认 normal
  --param <value>           browseType 为 bymodule 时传模块 ID，为 bysearch 时传已保存查询 ID。
  --order-by <value>        排序字段，默认 id_desc。
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 所属项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "normal" | 交付物筛选类型，默认 normal<br>{"options":[{"value":"normal","label":"已提交"},{"value":"wait","label":"未提交"},{"value":"mine","label":"我提交"},{"value":"submitbyme","label":"由我发起"},{"value":"pending","label":"待评审"},{"value":"pendingme","label":"待我评审"},{"value":"reviewing","label":"评审中"},{"value":"reviewedbyme","label":"我评审过"},{"value":"pass","label":"评审通过"},{"value":"fail","label":"评审失败"},{"value":"bymodule","label":"按模块"},{"value":"bysearch","label":"搜索"}]} |
| --param | param | query | string | 否 | — | browseType 为 bymodule 时传模块 ID，为 bysearch 时传已保存查询 ID。<br>{} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |

<a id="action-deliverable-options"></a>

## zentao deliverable options

```text
Usage: zentao deliverable options [options] [target]

获取项目可选交付物列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                单个 projectID；也可使用命名参数

Options:
  --project-id <value>  项目ID（必填）
  --project <id>        projectID 或 scope/scopeID 别名
  --ids <ids>           批量目标 ID，逗号分隔并去重
  --batch-fail-fast     失败后跳过剩余目标
  --fields <fields>     返回字段，逗号分隔
  --html-to-markdown    显式将富文本字段转换为 Markdown
  -h, --help            显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

获取当前项目流程下可以提交的交付物定义。返回结果中 deliverables 的属性名为交付物定义 ID，值为交付物名称，可用于创建项目交付物。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |

<a id="action-deliverable-create"></a>

## zentao deliverable create

```text
Usage: zentao deliverable create [options] [target]

新增项目交付物（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --deliverable <value>   交付物定义 ID，取自交付物列表返回的 deliverable 字段。（必填）
  --source-type <value>   来源类型(project 项目 | task 任务)。（必填）
  --source-id <value>     来源对象 ID，sourceType=project 时传项目 ID。（必填）
  --doc <value>           交付物文档，键为交付物定义 ID；每项包含 doc(文档 ID
                          列表)、docVersion(版本列表)、name(名称列表)。（必填）
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --deliverable | deliverable | body | integer | 是 | — | 交付物定义 ID，取自交付物列表返回的 deliverable 字段。<br>{"format":"int32"} |
| --source-type | sourceType | body | string | 是 | — | 来源类型(project 项目 \| task 任务)。<br>{} |
| --source-id | sourceID | body | integer | 是 | — | 来源对象 ID，sourceType=project 时传项目 ID。<br>{"format":"int32"} |
| --doc | doc | body | object | 是 | — | 交付物文档，键为交付物定义 ID；每项包含 doc(文档 ID 列表)、docVersion(版本列表)、name(名称列表)。<br>{} |

<a id="action-deliverable-get"></a>

## zentao deliverable get

```text
Usage: zentao deliverable get [options] [target]

获取交付物详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 deliverableID；也可使用命名参数

Options:
  --deliverable-id <value>  deliverableID（必填）
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --deliverable-id | deliverableID | path | integer | 是 | — | deliverableID<br>{} |

<a id="action-deliverable-delete"></a>

## zentao deliverable delete

```text
Usage: zentao deliverable delete [options] [target]

删除项目交付物（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 deliverableID；也可使用命名参数

Options:
  --deliverable-id <value>  deliverableID（必填）
  --ids <ids>               批量目标 ID，逗号分隔并去重
  --batch-fail-fast         失败后跳过剩余目标
  --yes                     确认删除
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --deliverable-id | deliverableID | path | integer | 是 | — | deliverableID<br>{} |

<a id="module-baseline"></a>

## 基线 · baseline

```text
Usage: zentao baseline [options] [command]

基线

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options] [target]    获取基线列表，支持获取项目下的基线（最低版本：22.7 / biz13.7 / max8.7 /
                             ipd5.7）
  create [options] [target]  创建项目基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get [options] [target]     获取基线详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update [options] [target]  编辑项目基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete [options] [target]  删除项目基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-baseline-list"></a>

## zentao baseline list

```text
Usage: zentao baseline list [options] [target]

获取基线列表，支持获取项目下的基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      所属项目ID（必填）
  --browse-type <value>     基线状态筛选，默认 all
  --order-by <value>        排序字段，默认 id_desc。
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 所属项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 基线状态筛选，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"待提交"},{"value":"reviewing","label":"评审中"},{"value":"pass","label":"已通过"},{"value":"reject","label":"已拒绝"}]} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |

<a id="action-baseline-create"></a>

## zentao baseline create

```text
Usage: zentao baseline create [options] [target]

创建项目基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --title <value>         基线名称。（必填）
  --version <value>       基线版本。（必填）
  --category <value>      纳入基线的交付物 ID 列表。（必填）
  --type <value>          基线类型。
  --status <value>        基线状态。
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --title | title | body | string | 是 | — | 基线名称。<br>{} |
| --version | version | body | string | 是 | — | 基线版本。<br>{} |
| --category | category | body | array | 是 | — | 纳入基线的交付物 ID 列表。<br>{"items":{"type":"string"}} |
| --type | type | body | string | 否 | — | 基线类型。<br>{} |
| --status | status | body | string | 否 | — | 基线状态。<br>{} |

<a id="action-baseline-get"></a>

## zentao baseline get

```text
Usage: zentao baseline get [options] [target]

获取基线详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                 单个 baselineID；也可使用命名参数

Options:
  --baseline-id <value>  baselineID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --fields <fields>      返回字段，逗号分隔
  --html-to-markdown     显式将富文本字段转换为 Markdown
  -h, --help             显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --baseline-id | baselineID | path | integer | 是 | — | baselineID<br>{} |

<a id="action-baseline-update"></a>

## zentao baseline update

```text
Usage: zentao baseline update [options] [target]

编辑项目基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 baselineID；也可使用命名参数

Options:
  --baseline-id <value>   baselineID（必填）
  --title <value>         基线名称。（必填）
  --version <value>       基线版本。（必填）
  --category <value>      纳入基线的交付物 ID 列表。（必填）
  --comment <value>       编辑备注。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --baseline-id | baselineID | path | integer | 是 | — | baselineID<br>{} |
| --title | title | body | string | 是 | — | 基线名称。<br>{} |
| --version | version | body | string | 是 | — | 基线版本。<br>{} |
| --category | category | body | array | 是 | — | 纳入基线的交付物 ID 列表。<br>{"items":{"type":"string"}} |
| --comment | comment | body | string | 否 | — | 编辑备注。<br>{} |

<a id="action-baseline-delete"></a>

## zentao baseline delete

```text
Usage: zentao baseline delete [options] [target]

删除项目基线（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                 单个 baselineID；也可使用命名参数

Options:
  --baseline-id <value>  baselineID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --yes                  确认删除
  -h, --help             显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --baseline-id | baselineID | path | integer | 是 | — | baselineID<br>{} |

<a id="module-change"></a>

## 项目变更 · change

```text
Usage: zentao change [options] [command]

项目变更

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options] [target]    获取项目变更列表，支持获取项目下的项目变更（最低版本：22.7 / biz13.7 / max8.7
                             / ipd5.7）
  create [options] [target]  创建项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get [options] [target]     获取变更详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update [options] [target]  编辑项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete [options] [target]  删除项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-change-list"></a>

## zentao change list

```text
Usage: zentao change list [options] [target]

获取项目变更列表，支持获取项目下的项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 projectID；也可使用命名参数

Options:
  --project-id <value>      所属项目ID（必填）
  --browse-type <value>     变更状态筛选，默认 all
  --order-by <value>        排序字段，默认 id_desc。
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 所属项目ID<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 变更状态筛选，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"wait","label":"待提交"},{"value":"reviewing","label":"评审中"},{"value":"pass","label":"已通过"},{"value":"reject","label":"已拒绝"},{"value":"reverting","label":"撤销中"}]} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序字段，默认 id_desc。<br>{} |
| --page-size | recPerPage | query | number | 否 | "20" | 每页数量，默认 20。<br>{} |
| --page | pageID | query | number | 否 | "1" | 页码，默认 1。<br>{} |

<a id="action-change-create"></a>

## zentao change create

```text
Usage: zentao change create [options] [target]

创建项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 projectID；也可使用命名参数

Options:
  --project-id <value>    项目ID（必填）
  --name <value>          变更名称。（必填）
  --urgency <value>       紧急程度。（必填）
  --type <value>          变更类型。（必填）
  --owner <value>         变更负责人。（必填）
  --reason <value>        变更原因。（必填）
  --desc <value>          变更描述。（必填）
  --project <id>          projectID 或 scope/scopeID 别名
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | path | integer | 是 | — | 项目ID<br>{} |
| --name | name | body | string | 是 | — | 变更名称。<br>{} |
| --urgency | urgency | body | string | 是 | — | 紧急程度。<br>{} |
| --type | type | body | string | 是 | — | 变更类型。<br>{} |
| --owner | owner | body | string | 是 | — | 变更负责人。<br>{} |
| --reason | reason | body | string | 是 | — | 变更原因。<br>{} |
| --desc | desc | body | string | 是 | — | 变更描述。<br>{} |

<a id="action-change-get"></a>

## zentao change get

```text
Usage: zentao change get [options] [target]

获取变更详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target               单个 changeID；也可使用命名参数

Options:
  --change-id <value>  changeID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --fields <fields>    返回字段，逗号分隔
  --html-to-markdown   显式将富文本字段转换为 Markdown
  -h, --help           显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --change-id | changeID | path | integer | 是 | — | changeID<br>{} |

<a id="action-change-update"></a>

## zentao change update

```text
Usage: zentao change update [options] [target]

编辑项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 changeID；也可使用命名参数

Options:
  --change-id <value>     changeID（必填）
  --name <value>          变更名称。（必填）
  --urgency <value>       紧急程度。（必填）
  --type <value>          变更类型。（必填）
  --owner <value>         变更负责人。（必填）
  --reason <value>        变更原因。（必填）
  --desc <value>          变更描述。（必填）
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --change-id | changeID | path | integer | 是 | — | changeID<br>{} |
| --name | name | body | string | 是 | — | 变更名称。<br>{} |
| --urgency | urgency | body | string | 是 | — | 紧急程度。<br>{} |
| --type | type | body | string | 是 | — | 变更类型。<br>{} |
| --owner | owner | body | string | 是 | — | 变更负责人。<br>{} |
| --reason | reason | body | string | 是 | — | 变更原因。<br>{} |
| --desc | desc | body | string | 是 | — | 变更描述。<br>{} |

<a id="action-change-delete"></a>

## zentao change delete

```text
Usage: zentao change delete [options] [target]

删除项目变更（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target               单个 changeID；也可使用命名参数

Options:
  --change-id <value>  changeID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --change-id | changeID | path | integer | 是 | — | changeID<br>{} |

<a id="module-relation"></a>

## 对象关联 · relation

```text
Usage: zentao relation [options] [command]

对象关联

Options:
  -h, --help                     显示命令帮助

Commands:
  props                          返回对象字段定义（离线）
  link [options] [target]        关联对象（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  candidates [options] [target]  查询可关联对象（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  list [options] [target]        查询关联对象（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  unlink [options] [target]      删除关联关系（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-relation-link"></a>

## zentao relation link

```text
Usage: zentao relation link [options] [target]

关联对象（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                         单个 objectType；也可使用命名参数

Options:
  --object-type <value>          objectType（必填）
  --object-id <value>            objectID（必填）
  --related-object-type <value>  relatedObjectType（必填）
  --relation <value>             被关联对象 ID 与关系 key 的映射，键为候选接口返回的 objects[].id，值为
                                 relationPairs 返回的 key。（必填）
  --data <json|@file|@->         JSON 对象、文件或显式标准输入
  --ids <ids>                    批量目标 ID，逗号分隔并去重
  --batch-fail-fast              失败后跳过剩余目标
  -h, --help                     显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --object-type | objectType | path | string | 是 | — | objectType<br>{} |
| --object-id | objectID | path | integer | 是 | — | objectID<br>{} |
| --related-object-type | relatedObjectType | path | string | 是 | — | relatedObjectType<br>{} |
| --relation | relation | body | array | 是 | — | 被关联对象 ID 与关系 key 的映射，键为候选接口返回的 objects[].id，值为 relationPairs 返回的 key。<br>{"items":{"type":"string"}} |

<a id="action-relation-candidates"></a>

## zentao relation candidates

```text
Usage: zentao relation candidates [options] [target]

查询可关联对象（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                         单个 objectType；也可使用命名参数

Options:
  --object-type <value>          objectType（必填）
  --object-id <value>            objectID（必填）
  --related-object-type <value>  relatedObjectType（必填）
  --browse-type <value>          候选对象筛选类型。
  --order-by <value>             排序字段。
  --fields <fields>              返回字段，逗号分隔
  --html-to-markdown             显式将富文本字段转换为 Markdown
  --max-items <number>           整次命令最多返回条数
  --filter <expr>                当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>            当前获取范围内搜索
  --search-fields <fields>       本地搜索字段
  --sort <expr>                  当前获取范围内排序，如 id:asc
  --page <number>                指定页，从 1 开始
  --page-size <number>           每次服务端请求的页大小
  --all                          显式遍历全部页面
  -h, --help                     显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --object-type | objectType | path | string | 是 | — | objectType<br>{} |
| --object-id | objectID | path | integer | 是 | — | objectID<br>{} |
| --related-object-type | relatedObjectType | path | string | 是 | — | relatedObjectType<br>{} |
| --browse-type | browseType | query | string | 否 | — | 候选对象筛选类型。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量。<br>{} |
| --page | pageID | query | number | 否 | — | 页码。<br>{} |

<a id="action-relation-list"></a>

## zentao relation list

```text
Usage: zentao relation list [options] [target]

查询关联对象（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 objectType；也可使用命名参数

Options:
  --object-type <value>     objectType（必填）
  --object-id <value>       objectID（必填）
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --object-type | objectType | path | string | 是 | — | objectType<br>{} |
| --object-id | objectID | path | integer | 是 | — | objectID<br>{} |

<a id="action-relation-unlink"></a>

## zentao relation unlink

```text
Usage: zentao relation unlink [options] [target]

删除关联关系（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                 单个 relationID；也可使用命名参数

Options:
  --relation-id <value>  relationID（必填）
  --ids <ids>            批量目标 ID，逗号分隔并去重
  --batch-fail-fast      失败后跳过剩余目标
  --yes                  确认删除
  -h, --help             显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

根据关系记录 ID 删除自定义关联关系。relationID 从查询关联对象接口返回的 relations[].relationID 字段获取，只有 relationType 为 custom 的自定义关系可以删除。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --relation-id | relationID | path | integer | 是 | — | relationID<br>{} |

<a id="module-workflowgroup"></a>

## 项目流程 · workflowgroup

```text
Usage: zentao workflowgroup [options] [command]

项目流程

Options:
  -h, --help      显示命令帮助

Commands:
  props           返回对象字段定义（离线）
  list [options]  获取项目流程列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-workflowgroup-list"></a>

## zentao workflowgroup list

```text
Usage: zentao workflowgroup list [options]

获取项目流程列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --browse-type <value>     项目流程状态筛选，默认 all
  --order-by <value>        排序字段。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --browse-type | browseType | query | string | 否 | "all" | 项目流程状态筛选，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"normal","label":"正常"},{"value":"pause","label":"已停用"}]} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量。<br>{} |
| --page | pageID | query | number | 否 | — | 页码。<br>{} |

<a id="module-resourcecalendar"></a>

## 人力资源日历 · resourcecalendar

```text
Usage: zentao resourcecalendar [options] [command]

人力资源日历

Options:
  -h, --help     显示命令帮助

Commands:
  props          返回对象字段定义（离线）
  get [options]  查询人力资源日历（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-resourcecalendar-get"></a>

## zentao resourcecalendar get

```text
Usage: zentao resourcecalendar get [options]

查询人力资源日历（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --type <value>        日历维度，默认 company
  --mode <value>        统计模式，默认 wait
  --accounts <value>    逗号分隔的用户账号；结果会继续按部门、项目和用户权限过滤。
  --project-id <value>  项目 ID；传入后仅查询该项目成员的日历数据。
  --depts <value>       逗号分隔的部门 ID；仅拥有查看所有人权限时生效。
  --project <id>        projectID 或 scope/scopeID 别名
  --fields <fields>     返回字段，逗号分隔
  --html-to-markdown    显式将富文本字段转换为 Markdown
  -h, --help            显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --type | type | query | string | 否 | "company" | 日历维度，默认 company<br>{"options":[{"value":"company","label":"按部门"},{"value":"person","label":"按人员"}]} |
| --mode | mode | query | string | 否 | "wait" | 统计模式，默认 wait<br>{"options":[{"value":"wait","label":"待处理"},{"value":"done","label":"已完成"}]} |
| --accounts | accounts | query | string | 否 | — | 逗号分隔的用户账号；结果会继续按部门、项目和用户权限过滤。<br>{} |
| --project-id | projectID | query | number | 否 | — | 项目 ID；传入后仅查询该项目成员的日历数据。<br>{} |
| --depts | depts | query | string | 否 | — | 逗号分隔的部门 ID；仅拥有查看所有人权限时生效。<br>{} |

<a id="module-weekly"></a>

## 项目周报 · weekly

```text
Usage: zentao weekly [options] [command]

项目周报

Options:
  -h, --help                 显示命令帮助

Commands:
  props                      返回对象字段定义（离线）
  list [options]             获取项目周报列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create [options]           创建项目周报（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  get [options] [target]     获取项目周报详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  update [options] [target]  编辑项目周报（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  delete [options] [target]  删除项目周报（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-weekly-list"></a>

## zentao weekly list

```text
Usage: zentao weekly list [options]

获取项目周报列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --project-id <value>      项目 ID。（必填）
  --browse-type <value>     筛选类型，默认 all
  --param <value>           browseType=bymodule 时传目录 ID，browseType=bysearch 时传查询
                            ID。
  --order-by <value>        排序字段。
  --project <id>            projectID 或 scope/scopeID 别名
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | query | number | 是 | — | 项目 ID。<br>{} |
| --browse-type | browseType | query | string | 否 | "all" | 筛选类型，默认 all<br>{"options":[{"value":"all","label":"全部"},{"value":"bymodule","label":"按目录"},{"value":"bysearch","label":"搜索"}]} |
| --param | param | query | string | 否 | — | browseType=bymodule 时传目录 ID，browseType=bysearch 时传查询 ID。<br>{} |
| --order-by | orderBy | query | string | 否 | — | 排序字段。<br>{} |
| --page-size | recPerPage | query | number | 否 | — | 每页数量。<br>{} |
| --page | pageID | query | number | 否 | — | 页码。<br>{} |

<a id="action-weekly-create"></a>

## zentao weekly create

```text
Usage: zentao weekly create [options]

创建项目周报（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --project-id <value>     项目 ID。（必填）
  --report-module <value>  项目周报分类 ID，没有分类时可传 0。
  --title <value>          周报标题。
  --template-id <value>    报告模板 ID，不使用模板时传 0。
  --template-desc <value>  周报描述。
  --acl <value>            访问控制(open 公开 | private 私有)。
  --status <value>         周报状态(draft 草稿 | normal 正常)。
  --project <id>           projectID 或 scope/scopeID 别名
  --data <json|@file|@->   JSON 对象、文件或显式标准输入
  -h, --help               显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --project-id | projectID | body | integer | 是 | — | 项目 ID。<br>{"format":"int32"} |
| --report-module | reportModule | body | string | 否 | — | 项目周报分类 ID，没有分类时可传 0。<br>{} |
| --title | title | body | string | 否 | — | 周报标题。<br>{} |
| --template-id | templateID | body | integer | 否 | — | 报告模板 ID，不使用模板时传 0。<br>{"format":"int32"} |
| --template-desc | templateDesc | body | string | 否 | — | 周报描述。<br>{} |
| --acl | acl | body | string | 否 | — | 访问控制(open 公开 \| private 私有)。<br>{} |
| --status | status | body | string | 否 | — | 周报状态(draft 草稿 \| normal 正常)。<br>{} |

<a id="action-weekly-get"></a>

## zentao weekly get

```text
Usage: zentao weekly get [options] [target]

获取项目周报详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target               单个 reportID；也可使用命名参数

Options:
  --report-id <value>  reportID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --fields <fields>    返回字段，逗号分隔
  --html-to-markdown   显式将富文本字段转换为 Markdown
  -h, --help           显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --report-id | reportID | path | integer | 是 | — | reportID<br>{} |

<a id="action-weekly-update"></a>

## zentao weekly update

```text
Usage: zentao weekly update [options] [target]

编辑项目周报（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 reportID；也可使用命名参数

Options:
  --report-id <value>     reportID（必填）
  --title <value>         周报标题。
  --status <value>        周报状态。
  --content-type <value>  内容类型，默认 doc。
  --type <value>          文档类型，默认 text。
  --content <value>       周报 HTML 内容。
  --raw-content <value>   周报原始内容。
  --comment <value>       编辑备注。
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

未提供的请求体字段可由匹配的详情操作自动补全。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --report-id | reportID | path | integer | 是 | — | reportID<br>{} |
| --title | title | body | string | 否 | — | 周报标题。<br>{} |
| --status | status | body | string | 否 | — | 周报状态。<br>{} |
| --content-type | contentType | body | string | 否 | — | 内容类型，默认 doc。<br>{} |
| --type | type | body | string | 否 | — | 文档类型，默认 text。<br>{} |
| --content | content | body | string | 否 | — | 周报 HTML 内容。<br>{} |
| --raw-content | rawContent | body | string | 否 | — | 周报原始内容。<br>{} |
| --comment | comment | body | string | 否 | — | 编辑备注。<br>{} |

<a id="action-weekly-delete"></a>

## zentao weekly delete

```text
Usage: zentao weekly delete [options] [target]

删除项目周报（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target               单个 reportID；也可使用命名参数

Options:
  --report-id <value>  reportID（必填）
  --ids <ids>          批量目标 ID，逗号分隔并去重
  --batch-fail-fast    失败后跳过剩余目标
  --yes                确认删除
  -h, --help           显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：写入或需服务端确认；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --report-id | reportID | path | integer | 是 | — | reportID<br>{} |

<a id="module-db"></a>

## 数据库 · db

```text
Usage: zentao db [options] [command]

数据库

Options:
  -h, --help                显示命令帮助

Commands:
  props                     返回对象字段定义（离线）
  tables [options]          获取数据库表列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  query [options]           执行SQL查询（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  table [options] [target]  获取数据库表结构（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-db-tables"></a>

## zentao db tables

```text
Usage: zentao db tables [options]

获取数据库表列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |

<a id="action-db-query"></a>

## zentao db query

```text
Usage: zentao db query [options]

执行SQL查询（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --sql <value>             只读 SQL 语句，仅支持 SELECT 查询。（必填）
  --count [boolean]         是否统计总条数，默认 true。 (preset: true)
  --no-count                将 count 设为 false
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

返回查询结果行及分页；使用 raw: true 可获取原始响应中的 SQL、列信息和执行耗时。

能力：写入或需服务端确认；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --sql | sql | body | string | 是 | — | 只读 SQL 语句，仅支持 SELECT 查询。<br>{} |
| --page | page | body | integer | 否 | — | 页码，默认 1。<br>{"format":"int32"} |
| --page-size | limit | body | integer | 否 | — | 每页条数，默认 100。<br>{"format":"int32"} |
| --count | count | body | boolean | 否 | — | 是否统计总条数，默认 true。<br>{} |

<a id="action-db-table"></a>

## zentao db table

```text
Usage: zentao db table [options] [target]

获取数据库表结构（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target              单个 table；也可使用命名参数

Options:
  --table <value>     数据库表名，例如 zt_config（必填）
  --type <value>      表结构返回格式
  --fields <fields>   返回字段，逗号分隔
  --html-to-markdown  显式将富文本字段转换为 Markdown
  -h, --help          显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

meta 返回表信息、主键和列定义；sql 返回包含表信息、dialect 和建表 SQL 的对象。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --table | table | path | string | 是 | — | 数据库表名，例如 zt_config<br>{} |
| --type | type | query | string | 否 | "meta" | 表结构返回格式<br>{"options":[{"value":"meta","label":"元数据"},{"value":"sql","label":"建表 SQL"}]} |

<a id="module-knowledgelib"></a>

## 知识库 · knowledgelib

```text
Usage: zentao knowledgelib [options] [command]

知识库

Options:
  -h, --help      显示命令帮助

Commands:
  props           返回对象字段定义（离线）
  list [options]  获取 AI 知识库列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-knowledgelib-list"></a>

## zentao knowledgelib list

```text
Usage: zentao knowledgelib list [options]

获取 AI 知识库列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --type <value>            库类型，省略或空字符串时合并两类可见库
  --keyword <value>         知识库名称或描述关键词，首尾空白会被移除
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --type | type | query | string | 否 | — | 库类型，省略或空字符串时合并两类可见库<br>{"options":[{"value":"my","label":"我的知识库"},{"value":"team","label":"组织知识库"}]} |
| --keyword | keyword | query | string | 否 | — | 知识库名称或描述关键词，首尾空白会被移除<br>{} |
| --page | pageID | query | number | 否 | 1 | 页码，从 1 开始的正整数<br>{} |
| --page-size | recPerPage | query | number | 否 | 20 | 每页条数，范围 1～100<br>{} |

<a id="module-knowledge"></a>

## 知识 · knowledge

```text
Usage: zentao knowledge [options] [command]

知识

Options:
  -h, --help                   显示命令帮助

Commands:
  props                        返回对象字段定义（离线）
  list [options] [target]      获取 AI 知识库内的知识列表（最低版本：22.7 / biz13.7 / max8.7 /
                               ipd5.7）
  embeddings-search [options]  在多个 AI 知识库内向量搜索（最低版本：22.7 / biz13.7 / max8.7 /
                               ipd5.7）
  search [options]             按关键词搜索 AI 知识（最低版本：22.7 / biz13.7 / max8.7 /
                               ipd5.7）
  get [options] [target]       获取 AI 知识详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-knowledge-list"></a>

## zentao knowledge list

```text
Usage: zentao knowledge list [options] [target]

获取 AI 知识库内的知识列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 libID；也可使用命名参数

Options:
  --lib-id <value>          本地知识库 ID，正整数（必填）
  --type <value>            知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。
  --object-type <value>     来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

返回当前用户可见的知识条目，按本地 ID 降序排列；不支持标题关键词查询。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --lib-id | libID | path | integer | 是 | — | 本地知识库 ID，正整数<br>{} |
| --type | type | query | string | 否 | — | 知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。<br>{"options":[{"value":"object","label":"对象知识"},{"value":"text","label":"文本知识"},{"value":"file","label":"文件知识"}]} |
| --object-type | objectType | query | string | 否 | — | 来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。<br>{"options":[{"value":"story","label":"需求"},{"value":"task","label":"任务"},{"value":"case","label":"测试用例"},{"value":"bug","label":"Bug"},{"value":"plan","label":"产品计划"},{"value":"release","label":"发布"},{"value":"feedback","label":"反馈"},{"value":"ticket","label":"工单"},{"value":"doc","label":"文档（含接口文档）"},{"value":"issue","label":"问题"},{"value":"risk","label":"风险"},{"value":"opportunity","label":"机会"},{"value":"practice","label":"最佳实践"},{"value":"component","label":"组件"}]} |
| --page | pageID | query | number | 否 | 1 | 页码，从 1 开始的正整数<br>{} |
| --page-size | recPerPage | query | number | 否 | 20 | 每页条数，范围 1～100<br>{} |

<a id="action-knowledge-embeddings-search"></a>

## zentao knowledge embeddings-search

```text
Usage: zentao knowledge embeddings-search [options]

在多个 AI 知识库内向量搜索（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --keyword <value>         搜索问题或关键词，去除首尾空白后不能为空（必填）
  --lib-ids <value>         本地知识库 ID 的非空正整数数组，例如 [12,18]；不接受字符串元素，重复 ID 自动去重（必填）
  --type <value>            知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。
  --object-type <value>     来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。
  --min-similarity <value>  最小匹配度，范围 [0,1]
  --limit <value>           整次多库搜索最多返回的片段数，范围 1～100
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

仅检索已有索引，需 ai.searchknowledgelib 权限。按匹配度降序返回片段，不分页；用 knowledgeID 获取完整正文，chunkID 仅标识片段。

能力：只读；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --keyword | keyword | body | string | 是 | — | 搜索问题或关键词，去除首尾空白后不能为空<br>{"minLength":1} |
| --lib-ids | libIDs | body | array | 是 | — | 本地知识库 ID 的非空正整数数组，例如 [12,18]；不接受字符串元素，重复 ID 自动去重<br>{"minItems":1,"items":{"type":"integer","minimum":1}} |
| --type | type | body | string | 否 | — | 知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。<br>{"options":[{"value":"object","label":"对象知识"},{"value":"text","label":"文本知识"},{"value":"file","label":"文件知识"}]} |
| --object-type | objectType | body | string | 否 | — | 来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。<br>{"options":[{"value":"story","label":"需求"},{"value":"task","label":"任务"},{"value":"case","label":"测试用例"},{"value":"bug","label":"Bug"},{"value":"plan","label":"产品计划"},{"value":"release","label":"发布"},{"value":"feedback","label":"反馈"},{"value":"ticket","label":"工单"},{"value":"doc","label":"文档（含接口文档）"},{"value":"issue","label":"问题"},{"value":"risk","label":"风险"},{"value":"opportunity","label":"机会"},{"value":"practice","label":"最佳实践"},{"value":"component","label":"组件"}]} |
| --min-similarity | minSimilarity | body | number | 否 | 0.5 | 最小匹配度，范围 [0,1]<br>{"minimum":0,"maximum":1} |
| --limit | limit | body | integer | 否 | 5 | 整次多库搜索最多返回的片段数，范围 1～100<br>{"minimum":1,"maximum":100} |

<a id="action-knowledge-search"></a>

## zentao knowledge search

```text
Usage: zentao knowledge search [options]

按关键词搜索 AI 知识（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --keywords <value>        非空关键词数组，每项去除首尾空白后为 1～200 个 Unicode 字符，去重后最多 20 项；%、_
                            和反斜杠按普通字符匹配（必填）
  --lib-ids <value>         本地知识库 ID 的非空正整数数组，例如 [12,18]；不接受字符串元素，重复 ID 自动去重（必填）
  --match-mode <value>      any 表示任一关键词出现在标题或正文中；all
                            表示同一条知识的每个关键词均出现在标题或正文之一，可分别命中两个字段。仅省略时使用 any，空字符串和
                            null 无效
  --type <value>            知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。
  --object-type <value>     来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。
  --data <json|@file|@->    JSON 对象、文件或显式标准输入
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

需 ai.searchknowledgelib 权限，按字面文本匹配 title 或已保存的 content，不依赖向量索引。标题与正文分别匹配，单个关键词不能跨字段拼接。返回完整正文及 contentType，正文为空或 null 时返回空字符串；每条知识只返回一次，按知识 ID 降序分页。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --keywords | keywords | body | array | 是 | — | 非空关键词数组，每项去除首尾空白后为 1～200 个 Unicode 字符，去重后最多 20 项；%、_ 和反斜杠按普通字符匹配<br>{"minItems":1,"items":{"type":"string","minLength":1}} |
| --lib-ids | libIDs | body | array | 是 | — | 本地知识库 ID 的非空正整数数组，例如 [12,18]；不接受字符串元素，重复 ID 自动去重<br>{"minItems":1,"items":{"type":"integer","minimum":1}} |
| --match-mode | matchMode | body | string | 否 | "any" | any 表示任一关键词出现在标题或正文中；all 表示同一条知识的每个关键词均出现在标题或正文之一，可分别命中两个字段。仅省略时使用 any，空字符串和 null 无效<br>{"options":[{"value":"any","label":"任一关键词匹配标题或正文"},{"value":"all","label":"全部关键词匹配同一条知识"}]} |
| --type | type | body | string | 否 | — | 知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。<br>{"options":[{"value":"object","label":"对象知识"},{"value":"text","label":"文本知识"},{"value":"file","label":"文件知识"}]} |
| --object-type | objectType | body | string | 否 | — | 来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。<br>{"options":[{"value":"story","label":"需求"},{"value":"task","label":"任务"},{"value":"case","label":"测试用例"},{"value":"bug","label":"Bug"},{"value":"plan","label":"产品计划"},{"value":"release","label":"发布"},{"value":"feedback","label":"反馈"},{"value":"ticket","label":"工单"},{"value":"doc","label":"文档（含接口文档）"},{"value":"issue","label":"问题"},{"value":"risk","label":"风险"},{"value":"opportunity","label":"机会"},{"value":"practice","label":"最佳实践"},{"value":"component","label":"组件"}]} |
| --page | pageID | body | integer | 否 | 1 | 页码，从 1 开始的正整数<br>{"minimum":1} |
| --page-size | recPerPage | body | integer | 否 | 20 | 每页条数，范围 1～100<br>{"minimum":1,"maximum":100} |

<a id="action-knowledge-get"></a>

## zentao knowledge get

```text
Usage: zentao knowledge get [options] [target]

获取 AI 知识详情（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                  单个 knowledgeID；也可使用命名参数

Options:
  --knowledge-id <value>  本地知识条目 ID，正整数；不可使用 chunkID 或来源对象 objectID（必填）
  --ids <ids>             批量目标 ID，逗号分隔并去重
  --batch-fail-fast       失败后跳过剩余目标
  --fields <fields>       返回字段，逗号分隔
  --html-to-markdown      显式将富文本字段转换为 Markdown
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

返回已保存的完整正文及来源信息，不触发文件提取、知识同步或索引更新。按 contentType 解释正文，尚未保存正文时 content 可为空。

能力：只读；批量：--ids；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --knowledge-id | knowledgeID | path | integer | 是 | — | 本地知识条目 ID，正整数；不可使用 chunkID 或来源对象 objectID<br>{} |

<a id="module-space"></a>

## 代码库空间 · space

```text
Usage: zentao space [options] [command]

代码库空间

Options:
  -h, --help      显示命令帮助

Commands:
  props           返回对象字段定义（离线）
  list [options]  获取代码库空间列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-space-list"></a>

## zentao space list

```text
Usage: zentao space list [options]

获取代码库空间列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

需 space.browse 权限，按空间 ID 降序排列；先按当前用户权限过滤，再分页。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --page | pageID | query | number | 否 | 1 | 页码，从 1 开始的正整数<br>{} |
| --page-size | recPerPage | query | number | 否 | 20 | 每页条数，范围 1～100<br>{} |

<a id="module-repo"></a>

## 代码库 · repo

```text
Usage: zentao repo [options] [command]

代码库

Options:
  -h, --help               显示命令帮助

Commands:
  props                    返回对象字段定义（离线）
  list [options] [target]  获取空间下的代码库列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
  create [options]         创建代码库（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）
```

<a id="action-repo-list"></a>

## zentao repo list

```text
Usage: zentao repo list [options] [target]

获取空间下的代码库列表（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Arguments:
  target                    单个 spaceID；也可使用命名参数

Options:
  --space-id <value>        代码库空间 ID，正整数（必填）
  --order-by <value>        排序方式
  --fields <fields>         返回字段，逗号分隔
  --html-to-markdown        显式将富文本字段转换为 Markdown
  --max-items <number>      整次命令最多返回条数
  --filter <expr>           当前获取范围内过滤；组内 AND，多次指定为 OR
  --search <keywords>       当前获取范围内搜索
  --search-fields <fields>  本地搜索字段
  --sort <expr>             当前获取范围内排序，如 id:asc
  --page <number>           指定页，从 1 开始
  --page-size <number>      每次服务端请求的页大小
  --all                     显式遍历全部页面
  -h, --help                显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

需 repo.maintain 权限及空间访问权限，独立授权空间另需空间内的 repo.maintain 权限。仅返回未删除、非导入中且当前用户可访问的代码库；url.http、url.ssh 可能缺省，克隆地址保持服务端原值。

能力：只读；批量：不支持；分页：--page / --page-size / --all；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space-id | spaceID | path | integer | 是 | — | 代码库空间 ID，正整数<br>{} |
| --page | pageID | query | number | 否 | 1 | 页码，从 1 开始的正整数<br>{} |
| --page-size | recPerPage | query | number | 否 | 20 | 每页条数，范围 1～100<br>{} |
| --order-by | orderBy | query | string | 否 | "id_desc" | 排序方式<br>{"options":[{"value":"id_asc","label":"ID 升序"},{"value":"id_desc","label":"ID 降序"},{"value":"name_asc","label":"名称升序"},{"value":"name_desc","label":"名称降序"}]} |

<a id="action-repo-create"></a>

## zentao repo create

```text
Usage: zentao repo create [options]

创建代码库（最低版本：22.7 / biz13.7 / max8.7 / ipd5.7）

Options:
  --space <value>         代码库空间 ID，使用 JSON 数字；字段名为 space（必填）
  --product <value>       关联产品 ID 的非空正整数数组，例如 [12]；不接受字符串元素或逗号分隔字符串（必填）
  --name <value>          去除首尾空白后，以英文字母或下划线开头，后续仅允许英文字母、数字、下划线、连字符和点（必填）
  --desc <value>          代码库描述；可选字段使用默认值时应省略，不传 null
  --acl <value>           访问权限，private 时 members 必须非空
  --members <value>       成员账号数组，账号须存在、未删除且未关闭；acl=private 时必填且非空，服务端自动加入当前创建者
  --data <json|@file|@->  JSON 对象、文件或显式标准输入
  -h, --help              显示命令帮助
```

最低版本：22.7 / biz13.7 / max8.7 / ipd5.7。

需配置 GitFox，具备 repo.createRepo 全局权限、空间及关联产品访问权限；私有空间或独立授权空间另需空间内的 repo.create 权限，独立授权空间还需 repo.createRepo 权限。以当前 Token 用户创建，默认 main 分支并初始化 README；返回 id，不返回克隆地址。超时或后续步骤失败时远端代码库可能已创建，重试前应查询目标空间核对。

能力：写入或需服务端确认；批量：不支持；分页：不支持；本地文件：否。

| 参数 | JSON 字段 | 位置 | 类型 | 必填 | 默认值 | 说明与约束 |
| --- | --- | --- | --- | --- | --- | --- |
| --space | space | body | integer | 是 | — | 代码库空间 ID，使用 JSON 数字；字段名为 space<br>{"minimum":1} |
| --product | product | body | array | 是 | — | 关联产品 ID 的非空正整数数组，例如 [12]；不接受字符串元素或逗号分隔字符串<br>{"minItems":1,"items":{"type":"integer","minimum":1}} |
| --name | name | body | string | 是 | — | 去除首尾空白后，以英文字母或下划线开头，后续仅允许英文字母、数字、下划线、连字符和点<br>{"minLength":1} |
| --desc | desc | body | string | 否 | "" | 代码库描述；可选字段使用默认值时应省略，不传 null<br>{} |
| --acl | acl | body | string | 否 | "open" | 访问权限，private 时 members 必须非空<br>{"options":[{"value":"open","label":"公开"},{"value":"private","label":"私有"}]} |
| --members | members | body | array | 否 | [] | 成员账号数组，账号须存在、未删除且未关闭；acl=private 时必填且非空，服务端自动加入当前创建者<br>{"items":{"type":"string","minLength":1}} |
