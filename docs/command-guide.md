# 命令、参数与用法参考

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
- `raw`：原始业务响应，拒绝批量、字段摘取、本地处理和自动翻页；内置命令不提供 raw。

列表 meta 包含 returned、fetched、page、pageSize、total、hasMore、truncated、processingScope。total 是服务器处理前的总数；未知值为 null。过滤后空页仍保留 hasMore。批量 data 为逐项 objectID/ok/data/error，meta 为成功、失败与跳过数量。

<a id="errors"></a>
## 身份、交互与错误

认证优先级：`--profile` → 完整环境凭据 → 保存的默认账号。不完整的环境凭据直接报错；同账号或同主机简写存在多个匹配时必须使用完整 key。

`auth login` 只保存凭据，不改变默认身份；`profile use` 才选择默认身份。普通业务调用和 `auth status` 默认不修改配置。`auth status --verify` 才在线验证。配置写入以短事务串行化，只更新目标字段，网络等待不占锁；进程被强制终止后如遗留 `.lock` 目录，先确认没有 CLI 写入进程，再删除该锁目录后重试。

stdout 用于结果和批量报告；stderr 用于进度、诊断和无法产生结果的错误。JSON 模式的参数错误也是 `{ok:false,error}`。退出码：0 成功、1 执行失败、2 用法错误、130 取消。

`--no-input` 禁止浏览器和所有提示；`--yes` 只确认明确操作；`--quiet` 压制进度，保留结果和错误。`--color auto|always|never` 独立控制终端颜色。`--timeout` 限制单个请求，`--deadline` 限制整次命令，包括登录、预取与执行。

MCP 保留 structuredContent/outputSchema 与执行时策略检查。知识 POST 搜索可供只读工具使用；SQL 查询保守地留在写工具组。HTTP MCP 不发现或执行本地文件上传；stdio 可上传。取消涵盖认证和业务调用，取消一个并发调用不会终止其他调用。

<a id="review-summary"></a>
## 优化交付与手动验收

本分支逐项实施引用聊天中的批量、输入、命令树、分页、输出、身份、交互、MCP 和发现机制建议。详见 [实施记录](optimization-progress.md) 与 [HTML 验收报告](optimization-report.html)。报告会区分本地验证、真实测试环境结果和服务器能力限制。
