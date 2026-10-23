# 命令、参数与用法参考

本文按命令列出用法、参数类型、必填项、默认值、可选值及最低禅道版本。先用下面的索引定位命令，再查看对应操作的参数表。任务场景与输出示例可配合 [CLI 核心功能详解](./cli-usage.md) 阅读。

需要搜索和筛选时，可直接用浏览器打开 [HTML 版本](./command-reference.html)，支持按模块、操作类型和参数查阅。

- [命令格式与传参](#usage)
- [常用示例](#examples)
- [全局选项](#global-options)
- [业务命令公共选项](#data-options)
- [配置项](#configuration)
- [内置命令](#builtin-commands)
- [业务模块索引](#modules)
- [错误处理与版本兼容](#errors)
- [更新与优化总览（2026-10-03）](#review-summary)

<a id="usage"></a>

## 命令格式与传参

```text
zentao [全局选项] <命令> [参数]
zentao [全局选项] <模块> <操作> [--参数名=值 ...]
```

用法中的 `<...>` 表示需要替换的值，`[...]` 表示可选部分，`...` 表示可以重复。用法模板不能原样粘贴执行。后文 Bash 示例中的 ID、账号、地址、文件路径和业务内容也需要换成实际值。

推荐将全局选项放在命令前，将业务参数写成 `--参数名=值`，保留参数名的大小写，例如 `--productID=1`、`--recPerPage=50`。业务字段不要写成 `--title 标题`；这类动态参数需要等号。包含空格或 Shell 特殊字符的值使用引号，例如 `--title='登录失败'`、`--filter='pri<=2'`。

引号内的参数值支持多行文本，换行、末尾换行和额外的 `=` 会原样保留。格式错误的动态参数会报错，但拼写合法的未知字段仍可能被 SDK 忽略。平铺动态值 `00123`、`true`、`false` 会被转换成数字或布尔值；需要保留字符串、数组或小数的准确类型时，优先使用 JSON。

### 简写、别名与帮助

| 写法 | 含义 |
| --- | --- |
| `zentao <模块>` | 执行该模块的默认 `list`；没有默认列表的模块会显示帮助 |
| `zentao <模块> <数字ID>` | 执行该模块的 `get`，前提是该模块支持此操作 |
| `zentao <模块> <操作> [参数]` | 执行明确命名的操作，包括关联列表和状态流转 |
| `zentao <模块> props` | 离线查询返回对象的属性定义，支持 `--format=json`、`--format=raw` 和 `--silent` |
| `zentao help` / `zentao --help` / `zentao` | 查看一级命令及全局选项 |
| `zentao <模块> --help` / `zentao <模块> help` | 查看模块概览 |
| `zentao help <模块>` | 一次查看该模块所有操作的详细参数 |
| `zentao <模块> <操作> --help` / `zentao <模块> <操作> help` | 查看指定操作参数 |
| `zentao <内置命令> --help` | 查看登录、配置、安装等命令的帮助 |
| `zentao list <模块>` | `zentao ls <模块>` 的别名 |
| `zentao <模块> ls` | 该模块 `list` 操作的别名，要求模块支持默认列表 |
| `zentao plan ...` | `zentao productplan ...` 的别名 |

只有各模块索引中列出的操作才可调用；不是每个模块都支持全部增删改查操作。`props` 描述返回对象的字段，写入时可以提交哪些字段请查对应操作的参数表。

### ID、范围与关联列表

优先使用参数表中的完整 ID 名称，例如 `--bugID=42`。首个路径 ID 可以写成 `--id=42` 或首个数字位置参数；一个操作需要多个路径 ID 时，其余 ID 必须分别提供。例如：

```bash
zentao bug get --bugID=42
zentao bug 42
zentao doc myDocs --spaceID=1 --libID=2
```

带有 `scope`、`scopeID` 的操作需要指定查询范围。可以用参数表下列出的 `--product`、`--project` 或 `--execution` 简写代替这两个参数，每次选择一个范围。例如 `zentao bug --product=1`。其他操作里的同名字段按其自身定义解释，不表示所有列表都支持按产品、项目或执行筛选。

`zentao bug create --product=1` 中的 `--product` 是 `--productID=1` 的别名。平铺参数同时提供两者时必须指定同一个产品，否则报错；`--data` 内的 `productID` 仍优先于平铺字段。创建 Bug 时，最终产品 ID 会同时发送到查询串和请求体，以兼容服务端的两种读取方式。

### JSON、数组与标准输入

`--params` 应传一个 JSON 对象，可同时传路径、查询和请求体字段；`--data` 接受请求体 JSON，适用于创建、更新、状态流转，以及数据库查询和知识搜索等带请求体的查询操作。数组和包含嵌套结构的字段优先使用 JSON，以保留类型。

```bash
zentao bug resolve --params '{"bugID":42,"resolution":"fixed"}'
zentao bug create --productID=1 --data '{"title":"登录失败","openedBuild":["trunk"],"severity":2}'
zentao story change 11 --data '{"reviewer":["admin"],"title":"更新后的需求标题"}'
zentao product create --data @- < product.json
```

最后一个示例读取本地 `product.json`，其内容可以是 `{"name":"团队知识库"}`。未提供 `--data` 时，写操作也会尝试读取标准输入中的 JSON。`--data @-` 明确要求从标准输入读取；空输入或非法 JSON 会报错。读取文件请使用输入重定向，`--data @文件名` 不支持。

上述标准输入规则目前仅覆盖创建、更新和状态流转。`db query`、`knowledge search`、`knowledge embeddingsSearch` 需要直接提供 JSON 或平铺业务字段，不能使用 `--data @-` 或隐式标准输入。此类查询的非法 JSON 目前还可能被忽略，调用前应自行检查 JSON；对应优化建议见后文。

同一字段尽量只用一种传法。混用时，`--params` 覆盖已解析的公共选项，动态 `--key=value` 再覆盖 `--params` 中的同名值；首个数字位置参数最后写入 `id`。组装请求体时，`--data` 内的字段优先于外层的同名字段，其次才使用参数定义中的默认值。

### 更新、批量与删除

更新操作会先读取原对象，自动补全未提交的字段；通常只需提交要修改的字段。参数表中标记为必填的请求体字段可能由原对象补全，创建操作仍需提供必填内容。

支持按 ID 操作的命令可以通过 `--id=1,2` 或数字位置参数 `1,2` 批量执行。批量处理的对象是首个路径 ID；其他路径参数保持本次传入的值。默认继续处理后续对象，`--batch-fail-fast` 可在失败后停止。批量结果会分别列出成功、失败和跳过的 ID。

```bash
zentao product get --id=1,2
zentao product update --id=1,2 --desc='统一更新的说明'
zentao product delete --id=1,2 --yes
```

交互终端中的删除会要求确认。非交互、JSON、raw 或 `--machine-readable` 模式下，删除必须显式添加 `--yes`，否则报错。批量操作不会回滚已经成功的项目。

<a id="examples"></a>

## 常用示例

### 登录并查看数据

```bash
# 在桌面环境打开本机浏览器登录
zentao login
# 明确使用终端交互登录
zentao login --no-browser

# 查看本地账号，切换当前账号
zentao profile
zentao profile 'admin@https://zentao.example.com'

# 查看产品以及产品中的 Bug
zentao product --pick=id,name
zentao bug --product=1 --pick=id,title,status
```

### 筛选、搜索、排序与分页

```bash
# 当前返回页内筛选和排序
zentao bug --product=1 --filter='status=active,pri<=2' --sort=pri:asc,id:desc
zentao bug --product=1 --search='登录,失败' --search-fields=title,steps

# 单个 --filter / --search 内的条件为 AND，重复该选项表示 OR
zentao bug --product=1 --filter='status=active' --filter='status=resolved'

# 分页获取，并输出 JSON
zentao --format=json bug --product=1 --page=1 --recPerPage=50
zentao --format=json bug --product=1 --page=2 --recPerPage=50
```

`--filter`、`--search`、`--sort`、`--pick` 是客户端处理；`--limit` 用于客户端截取，但在 `db query`、`knowledge embeddingsSearch` 中也与同名请求体字段重叠。服务端查询参数（如 `browseType`、`orderBy`、`filters`）按操作参数表传入。客户端筛选只作用于当前页，不会改变服务器的总数，也不会自动补足匹配数量。

| 选项 | 值的写法 |
| --- | --- |
| `--pick` | 逗号分隔的字段名，如 `id,title,assignedTo.realname`；JSON 保留嵌套对象结构，忽略不存在的字段 |
| `--filter` | `字段运算符值`，支持 `=`、`:`（等于的兼容写法）、`!=`、`>`、`<`、`>=`、`<=`、`~`（包含）、`!~`（不包含）；字段支持点号路径 |
| `--search` | 逗号分隔的关键词，大小写不敏感；不提供 `--search-fields` 时递归搜索对象和数组中的值 |
| `--search-fields` | 逗号分隔的字段名，支持点号路径，例如 `title,assignedTo.realname` |
| `--sort` | 逗号分隔的 `字段:asc` 或 `字段:desc`，支持点号路径，兼容 `字段_asc` / `字段_desc` |

过滤值含逗号时，可在表达式内保留引号，例如 `--filter='title~"登录,注册"'`；外层引号交给 Shell，内层引号用于区分值中的逗号与条件分隔符。

分页必须按操作参数表的字段名和位置传入。查询串中的 `pageID` 可简写为 `--page`；`knowledge search` 的请求体 `pageID` 不支持这个别名，请写入 `--data` 或显式传 `--pageID=2`。`db query` 使用请求体 `page` / `limit`。`--all` 尚未实现并会报错，需要全部数据时应按服务端分页逐页读取，不能因当前页本地筛选后为空就判定检索结束。

### 创建与处理业务对象

```bash
zentao product create --name='团队知识库'
zentao story create --productID=1 --title='支持全文搜索'
zentao task create --executionID=1 --name='实现搜索接口' --type=devel --assignedTo=admin --estimate=4
zentao bug resolve 42 --resolution=fixed --resolvedBuild=trunk
zentao execution projectExecutions --projectID=5 --browseType=all
zentao my tasks --pick=id,name,status
```

### 文档与附件

```bash
zentao doc mySpaces
zentao doc myLibs --spaceID=1
zentao doc createMyDoc --spaceID=1 --libID=2 --data '{"title":"开发说明","content":"# 开发说明\n\n正文","contentType":"doc"}'
zentao file create --file=/path/to/screenshot.png --objectType=bug --objectID=42
```

文档的 `contentType=doc` 将 Markdown 正文转换为协作文档内容，`contentType=html` 保存旧格式 HTML。附件上传的 `file` 是本地文件路径，默认大小上限为 50 MiB。

### 数据库与知识库（SDK 0.8.0）

```bash
zentao db tables
zentao db table --table=zt_task --type=meta
zentao --format=raw db query --data '{"sql":"SELECT id, name FROM zt_task ORDER BY id","page":1,"limit":20}'
zentao knowledgelib list --type=team --page=1 --recPerPage=20
zentao knowledge list --libID=12 --page=1 --recPerPage=20
zentao knowledge search --data '{"keywords":["登录","超时"],"libIDs":[12],"matchMode":"all","pageID":1,"recPerPage":20}'
zentao knowledge embeddingsSearch --data '{"keyword":"如何处理接口请求超时","libIDs":[12],"minSimilarity":0.7,"limit":5}'
zentao knowledge get --knowledgeID=42
```

数据库、知识库与知识操作要求 22.7 / biz13.7 / max8.7 / ipd5.7 或更新版本。知识库接口的实际可用性取决于服务端知识库功能与权限；搜索还需 `ai.searchknowledgelib` 权限。上述表名和 ID 仅为示例，访问仍受服务端权限控制。

`knowledge search` 是对标题或已保存正文的关键词匹配：`any` 表示任一关键词命中，`all` 表示全部关键词命中同一条知识，可以分别命中标题与正文。它与本地当前页的 `--search` 不同。`embeddingsSearch` 只检索已有索引，按匹配度返回片段且不分页；读取完整正文使用结果中的 `knowledgeID`，不能使用 `chunkID` 或来源对象 ID。这三个模块目前没有 `props` 字段元数据，需查看具体操作帮助。

<a id="errors"></a>

## 错误处理与版本兼容

未设置输出格式时，业务查询默认输出 Markdown；`--format=json` 输出处理后的结构化结果；`--format=raw` 保留服务端响应内容，跳过 HTML 转 Markdown、客户端筛选、排序和字段摘取。内置命令的输出以各节说明为准；`--machine-readable` 只禁用 Markdown ANSI 渲染，不会自动切换为 JSON。

命令失败以非零状态退出，批量操作中任一对象失败时也会非零退出。批量请求应同时检查返回的失败和跳过列表，定位具体对象。错误代码及排查方法见 [常见错误排查与参考手册](./errors.md)。

每个业务操作下方都列出最低禅道版本，开源版、企业版（`biz`）、旗舰版（`max`）与 IPD 版分别比较。版本不足时会在业务请求前报 `E2010`。帮助与 `props` 可以离线使用；文档中列出某个操作，不代表当前服务器版本和当前账号权限均允许执行。

<a id="review-summary"></a>

## 更新与优化总览

评估日期：**2026-10-03（Asia/Singapore）**。基线为当前工作区 CLI **0.3.1**、已安装 SDK **0.7.2**、提交 `dfce324`，包括工作区已有的 SDK 升级及其测试调整；这不是对 npm 已发布版本的判断。参考 0906 的命令文档与评估，重新检查当前实现，下面的建议均为待实施方案。本次仅更新文档及生成器。

本版覆盖 **17 个内置一级命令、29 个模块、237 个业务操作、1071 条参数定义**。相比原清单新增 `db`、`knowledgelib`、`knowledge` 三个模块和 8 个操作；同时保留并核对浏览器登录、`profile --effective`、XDG 配置目录与 HTTP MCP 的说明。新操作的部署条件、请求体、数组约束和分页差异已补入参考表及示例。

### 旧建议的当前状态

| 主题 | 当前核验结果 | 后续处理 |
| --- | --- | --- |
| 动态参数静默丢失 | 多行文本、额外等号和格式错误处理已修正；未知字段、类型误转换和非对象 JSON 仍有缺口 | 优先收紧输入契约 |
| 无人值守登录假成功 | 已有浏览器登录、桌面环境检测；无桌面且非交互时返回 E1006 | 不再沿用旧版“stdin EOF 成功退出”的结论 |
| 认证改变当前账号 | 普通认证不再写回 Profile；完整环境凭据与本地配置隔离；MCP 账号绑定实例 | 保留现有行为，补简写歧义处理即可 |
| MCP 只有宽泛 Schema 和文本结果 | 已有按动作校验、结构化结果、outputSchema、当前页处理元数据、只读/模块筛选及读写拆分 | 补深层约束和新 POST 查询适配 |
| CLI JSON / 分页 / 机器帮助 | 输出仍有多种形状，只有当前页处理，没有独立的 CLI 操作 Schema 入口 | 复用现有 MCP 与 SDK 定义 |

### 推荐顺序

| 优先级 | 工作项 | 收益与最小范围 |
| --- | --- | --- |
| P1 | [参数与请求体契约](#review-input) | 避免用户输入被改变、忽略或发送到错误页；覆盖 CLI 与 MCP 的同一操作 |
| P1 | [CLI 机器输出一致性](#review-output) | 让 Agent 按稳定字段判断成功、失败和分页完整性 |
| P1 | [MCP 完整参数约束](#review-mcp) | 拦截非法知识搜索参数，确保示例可以直接使用 |
| P2 | [文档与发现机制](#review-maintenance) | 用现有注册表和 --check 降低维护成本，避免 SDK 升级后遗漏 |
| P2 / P3 | [账号简写、可用工具与重复查找](#review-mcp) | 小范围消除歧义和重复实现，无需重建架构 |

建议先完成 P1，再按真实 Agent 任务中的失败率、纠错次数、返回量和遗漏分页情况决定后续投入。新命令、选项、返回结构均应先定义兼容策略；文中示意方案不代表已经实现。

验证依据包括当前源码、SDK 注册表、隔离配置的 CLI 子进程、本地 mock HTTP 和 MCP handler。未调用真实禅道业务接口，因此不声称已验证服务端权限、数据库查询限制或线上性能。类型检查和文档一致性检查通过；首次全套测试为 **405 通过、1 失败**，失败项是 HTTP 分块请求体限制测试；该文件单独复跑 **14 通过、0 失败**，随后完整复跑 **406 通过、0 失败**（36 个文件、4140 次断言）。首次失败原因仍未确认，不能将复跑通过当作已修复。

评估原则参考 [CLI Guidelines](https://clig.dev/#arguments-and-flags) 的参数一致性、[MCP 工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content) 的结构化结果，以及 [Anthropic 工具设计文章](https://www.anthropic.com/engineering/writing-tools-for-agents) 的清晰参数、有效返回量和真实任务评估。优先级与具体修订方案来自本项目代码及离线复现。

<a id="review-input"></a>

## P1 · 参数与请求体契约

### 1. 按请求体定义处理输入，避免用返回类型推断输入能力

**已复现：** `db query`、`knowledge search`、`knowledge embeddingsSearch` 都是 `type=list` 的 POST 操作。直接 JSON `--data` 可以工作，但 `--data @-` 和隐式 stdin 不读取请求体；`db query --sql='select 1' --data='{broken'` 甚至成功发送仅包含 SQL 的请求，非法 JSON 被忽略。

根因在 `src/modules/executor.ts:76–82`：只有 create/update/action 才调用 `resolveData()`；MCP 的 `src/mcp/params.ts:59–78` 又只允许这些类型使用 `params.data`，导致同一查询的合法嵌套 JSON 被拒绝。返回列表与是否具有请求体是两个独立属性。

**最小建议：** 根据 `action.requestBody` / body 参数元数据判断 JSON 支持，统一解析和对象形状校验；autoFill 等行为继续按更新语义判断。MCP 保留 JSON 对象输入边界，不引入 CLI stdin 语法。当前使用者先直接传合法 JSON，知识库 ID 数组使用 `[12,18]`，不要用会产生字符串元素的 `--libIDs=12,18`。

**验收：** 三个 POST 查询的平铺字段、JSON、CLI stdin 得到一致请求体；非法 JSON、数组/null 根值在认证和业务 HTTP 前失败；已有创建/更新/文件上传行为保持兼容。

### 2. 删除猜测式类型转换，并拒绝无效参数

**已复现：** `product create --name=007 --desc=true` 的字段会变成数字 `7` 和布尔值 `true`；`product list --paeg=2` 与 `--params=[]` 都可以正常执行，输入错误没有提示；同时指定 Bug 的产品、项目、执行范围时，最终选中 execution 范围。

根因在 `src/modules/args.ts:41–63`：`Object.assign(JSON.parse(...))` 未要求对象，动态字段对所有纯数字/布尔文本做统一转换，且未按操作字段名校验。`src/commands/register-modules.ts:121` 附近先认证再进入动作处理，使许多本可离线发现的错误晚于鉴权。

**最小建议：** 先要求 `--params` 为非数组对象；保留原始文本，让 SDK 按字段声明转换，删除会破坏字符串的启发式转换；复用按动作的字段清单和冲突检查，在鉴权前拒绝未知字段与多范围冲突。不要额外建立一套平行 Schema。兼容支持 `--key value` 可以随后做，先确保现有等号语法不改变用户意图。

**验收：** 字符串 `007`/`true` 保真，数字按声明转换；未知字段显示字段名与候选；非对象 JSON、多范围和不同 ID 来源冲突均零网络请求失败；现有别名和批量 ID 有回归覆盖。

### 3. 明确服务端分页与客户端截取

**已复现：** `knowledge search --page=3` 仍提交请求体 `pageID:1`，因为 SDK 的 page→pageID 别名仅处理查询串。MCP 顶层 page 会自行映射为 pageID，此问题属于 CLI。`db query --page=2 --limit=1` 则正确发送请求体 page/limit，但非 raw 输出时同一个 `--limit` 还会本地截取结果；将 limit 放入 `--params` / `--data` 时不会单独触发同样的本地截取。

证据：`src/modules/args.ts:20` 将公共选项拷入业务参数；`src/modules/executor.ts:103–108` 再将 limit 等选项传入本地处理；SDK `dist/modules/resolve.js:160` 附近仅转换查询串中的 pageID。

**最小建议：** 按当前 action 的字段角色映射分页别名，先对重名参数明确报错或说明；业务请求值与本地处理值应有独立来源。统一推荐 JSON 请求体中的业务分页字段，避免直接改动旧 `--limit` 语义造成脚本行为变化。

**验收：** query pageID、body pageID、body page 三种分页分别验证；记录实际请求体和本地返回条数，覆盖混合输入与冲突。自动翻页可后置，先返回下一页提示，避免把当前页筛选为空解释为没有匹配项。

<a id="review-output"></a>

## P1 · CLI 机器输出一致性

**现状：** 列表和写入的 JSON 使用 `{status,data,pager?}`，详情直接返回对象，批量返回 `{status,result}`；未知一级命令即使传入 `--format=json` 仍是 Commander 文本错误。`--machine-readable` 只影响 Markdown ANSI 渲染，不代表 JSON 或禁止交互。

证据：`src/commands/module-handler.ts:46–95,128–133`、`src/utils/render.ts:25`、`src/utils/format.ts:69–75`、`src/index.ts:47–49,85–100`。隔离配置调用未知命令已验证非零退出，但 stderr 不是 JSON。

**最小建议：** 复用 `src/mcp/results.ts` 已有的 data/error/context 和页内处理语义，定义一个面向 CLI 的稳定结果契约，统一处理 Commander 错误及内置命令结果。保持 stdout 为可解析结果、stderr 为诊断；先用兼容选项或明确版本迁移，不能直接把详情对象再包一层而不告知脚本使用者。`--json` 仅在需要便捷入口时再增加。

分页元数据可先补 `returnedCount`、`processingScope=page`、服务器总数含义及可计算的下一页信息；没有服务端 pager 时明确未知。`hasMore` 应根据服务端分页信息判断，不能依据本地过滤后的条数。当前 MCP 已有其中一部分，不必重复实现处理流程。

**验收：** 列表、详情、写入、批量部分失败、参数错误、未知命令、认证失败都可按固定契约解析，并保持失败非零退出；筛选后空页仍能提示后续服务端页面；raw 保留原始响应的约定不变。

<a id="review-mcp"></a>

## P1 / P2 · MCP 能力与约束

### P1：按 SDK 原始定义补全边界校验与示例

当前 MCP 已验证顶层字段、操作范围、基本类型和枚举，但 `src/mcp/params.ts:94–114` 未覆盖 `minimum`、`maximum`、`minLength`、`minItems` 和数组元素。通用 `recPerPage≤1000` 也不能替代知识接口声明的上限 100。

**已复现：** `knowledge/embeddingsSearch` 的 `keyword:""`、`libIDs:["12"]`、`minSimilarity:2`、`limit:101` 原样到达 mock；关键词搜索的空数组和 `recPerPage:101` 也通过。`src/mcp/tools.ts:73–78` 给必填数组生成 `[]`，与新的非空约束冲突；现有发现测试使用同一浅层校验器，因此测试通过并不证明示例满足完整契约。

**最小建议：** 扩展已有校验器，复用原始 `requestBody.schema` 的约束和 SDK 示例；保留 integer 信息，避免 `getModuleActionParams()` 转成 number 后丢失整数要求。先覆盖注册表实际使用的约束，不引入新的通用校验框架。

**验收：** 非空、边界、整数和数组元素错误在认证前拒绝；每条生成示例通过完整字段约束；合法例子与实际请求体一致。此处仅验证客户端缺口，不能据此推断真实服务端也接受非法值。

### P2：操作风险按能力定义，继续使用已有读写拆分

现有 `--read-only`、`--modules`、`--split-tools`、`structuredContent` 和 `outputSchema` 已可使用。`src/mcp/tools.ts:24–25` 同时检查 action 类型与 GET 方法，因此 SQL 查询和 POST 知识搜索当前都在 `_write` 工具组，`--read-only` 不暴露它们。这是保守分类，不代表 SQL 接口支持写入。

若需要只读 Agent 使用 POST 搜索，应先在 SDK 定义中明确副作用，再让筛选、annotations 和帮助共用该信息；不要仅因 HTTP 方法为 POST 就认定写入，也不要仅因返回列表就认定只读。继续按模块读写拆分即可，无需一次注册 237 个动作工具。

### 其余小范围优化

| 优先级 | 已核验问题与定位 | 最小建议与验收 |
| --- | --- | --- |
| P2 | `src/config/store.ts:171–177` 用 find 取首个简写匹配；同账号在同域不同路径时存在歧义 | 完整 key 优先；简写必须唯一，多匹配列候选，不切换、不写盘；唯一简写保持兼容 |
| P3 | HTTP 禁用本地文件上传，但 `src/mcp/tools.ts:293` 的发现列表仍包含上传 action | 复用现有可用性判断过滤发现列表，保留执行守卫；HTTP 不列不可用上传，stdio 继续可用 |
| P3 | `src/auth/login.ts:68–82` 只查前 100 名用户；`src/mcp/tools.ts:114–133` 另有翻页查找 | 复用现有用户查询小函数，保持认证和可选用户详情的不同错误策略，覆盖第 100 名以后的账号 |

<a id="review-maintenance"></a>

## P2 · 文档与发现机制

### 复用现有生成器，加入一致性检查

本次 SDK 0.7.0→0.7.2 后，原参考清单遗漏了 3 个模块和 8 个操作。生成器已经提供 `--check`，但 `.github/workflows/ci.yml` 当前未执行它。最小后续调整是在依赖安装后运行现有检查，不增加文档框架：

```bash
# 本地更新文档
bun run scripts/generate-command-reference.ts
# CI 仅执行此行；不要先生成覆盖旧文件，否则无法发现文档过期
bun run scripts/generate-command-reference.ts --check
```

本次已修订生成器：输出模块部署说明、参数边界和数组元素约束；按 body 字段列出 `--data`；仅对查询串 pageID 宣称支持 `--page`。HTML 的“优化建议”分组也由同一份 Markdown 生成，后续再生成不会丢失报告。

**验收：** 更新 SDK 后，新增/删除操作、参数变化和模板变化都会使旧文档检查失败；重新生成后通过。覆盖检查与离线请求示例都需要，不能只确认命令数量。报告带日期，重新评估时更新基线和状态，避免旧结论长期混入命令规范。

### 提供按需机器帮助，避免维护多份定义

目前 `props` 是返回字段说明，CLI 操作帮助主要是文本；MCP 的 `zentao_action_help` 已能免登录输出定义。建议复用 SDK 注册表及现有帮助组装，给 CLI 增加按操作输出 JSON 的入口，例如 `zentao schema knowledge search`（**建议语法，当前不存在**）。应包含字段角色、类型、边界、必填/autoFill、版本、示例及可用性。

**验收：** 无凭据也能查询；CLI、MCP、HTML 对同一动作给出一致参数与约束；不运行登录或 API。先满足按需查一个动作，无需建立第二份元数据或新的发现服务。

### 暂不优先或不建议删除

- 参数重命名、全部命令 kebab-case、`--data @file`、自动翻页和写入预览可以后置。输入正确性与结果契约稳定后，再按实际需求添加；新增别名优先兼容现有命令。
- 全局禁止交互选项仍可评估，但不要为此撤销已实现的桌面浏览器登录；给无人值守调用定义明确行为即可。
- executor 已将路径、autoFill、响应提取和列表处理交给 SDK，无需再造执行层。
- `withRequestSignal` 和 raw 失败守卫暂时保留：SDK 0.7.2 高层请求仍未贯通 signal，raw 又在 throwOnFail 前返回。删除这些适配需要先有 SDK 能力和回归证据。
- 本次首次全套测试有一条 HTTP 分块请求体限制测试失败，单文件及完整复跑均通过；若后续再现，应保留完整失败日志并对比隔离/整套运行定位原因，不能凭一次结果直接归咎业务代码或降低断言。

<!-- BEGIN GENERATED COMMAND REFERENCE -->

<a id="coverage"></a>

## 覆盖范围

对应当前工作区：CLI **0.3.1**，API 定义 **0.8.2**；覆盖 **17 个内置一级命令**（另含 config get/set）、**42 个业务模块、361 个业务操作**。已安装版本不同时，请以本机命令的 --help 为准。

<a id="global-options"></a>

## 全局选项

```text
用法: zentao [options] [command]

禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据

选项:
  -V, --version                             显示版本号
  --format <format>                         输出格式 (markdown|json|raw)
  --silent                                  静默模式
  --insecure                                跳过 SSL/TLS 证书验证
  --timeout <ms>                            请求超时时间（毫秒）
  --config <config_file>                    指定自定义配置文件路径（亦可通过 ZENTAO_CONFIG_FILE 环境变量设置）
  --machine-readable                        禁用 Markdown ANSI 渲染；删除操作仍需显式传入 --yes
  -h, --help                                显示命令帮助
```

全局选项并不保证每个内置命令都改变输出格式或完全静默；业务命令支持情况见公共选项和各操作说明。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| ZENTAO_URL | 禅道服务地址 |
| ZENTAO_ACCOUNT | 登录账号 |
| ZENTAO_PASSWORD | 登录密码 |
| ZENTAO_TOKEN | 登录 Token；完整环境凭证中同时存在密码与 Token 时优先使用 Token |
| ZENTAO_CONFIG_FILE | 自定义配置文件路径；显式 --config 优先 |
| XDG_CONFIG_HOME | 配置根目录；仅接受绝对路径，未设置、为空或相对路径时使用 ~/.config；--config 和 ZENTAO_CONFIG_FILE 优先 |

CLI 业务调用和 stdio MCP 优先使用完整环境凭证（地址、账号以及 Token 或密码），否则使用当前本地登录记录。HTTP MCP 仅用 ZENTAO_URL 作为站点地址的后备值，凭证必须来自当前请求头。zentao login 的 --useEnv 专门用于强制使用环境变量登录。配置文件路径支持 ~ 和相对路径；更改配置路径会隔离登录记录与账号配置。

<a id="data-options"></a>

## 业务命令公共选项

以下选项由业务模块与通用增删改查入口共用。参数是否适用于当前操作，仍由结果类型和操作参数表决定。

| 选项 | 说明 |
| --- | --- |
| `--pick <fields>` | 摘取指定字段（逗号分隔） |
| `--filter <expr>` | 过滤条件（组内 AND，多次指定为 OR） |
| `--sort <expr>` | 排序条件（如 pri:desc,id:asc） |
| `--search <keywords>` | 搜索关键词（组内 AND，多次指定为 OR） |
| `--search-fields <fields>` | 搜索字段（逗号分隔） |
| `--page <number>` | 页码 |
| `--recPerPage <number>` | 每页条数 |
| `--all` | 尚未支持自动翻页，请使用 --page 和 --recPerPage |
| `--limit <number>` | 限制获取数量 |
| `--data <json>` | JSON 数据 |
| `--params <json>` | API 调用参数 |
| `--yes` | 跳过确认 |
| `--silent` | 静默模式 |
| `--batch-fail-fast` | 批量操作出错时停止 |
| `--id <id>` | 对象 ID |
| `--product <id>` | 产品 ID |
| `--project <id>` | 项目 ID |
| `--execution <id>` | 执行 ID |

列表操作支持客户端筛选、搜索、排序、字段摘取和数量限制；详情操作支持字段摘取；具有请求体的操作可提交 --data JSON；删除可使用 --yes。--params 接受路径、查询和请求体的业务参数，不应作为 --filter、--sort、--format 等客户端选项的替代入口。db query 等操作的 page、limit 也是业务字段，具体传法见对应操作说明。

分页、raw 输出、批量处理和动态字段的等号写法见前文。--silent 对业务命令省略正常结果，仍报告错误；--batch-fail-fast 只控制当前批次，不回滚已完成的操作。

<a id="configuration"></a>

## 配置项

以下默认值用于当前账号尚未配置的项目。命令行中显式指定的对应选项优先。

| 配置项 | 默认值 | 允许值与用途 |
| --- | --- | --- |
| `defaultOutputFormat` | `"markdown"` | 业务命令默认输出：markdown、json 或 raw |
| `defaultRecPerPage` | `20` | 默认每页条数，整数 1–1000；仅适用于支持分页的列表 |
| `insecure` | `false` | 是否跳过 SSL/TLS 证书验证 |
| `timeout` | `10000` | 请求超时时间，单位毫秒，必须为正整数 |
| `htmlToMarkdown` | `true` | 是否将查询结果中的 HTML 字段转换为 Markdown；raw 输出不转换 |
| `batchFailFast` | `false` | 批量操作遇到失败时是否停止后续处理 |
| `pagers` | `{}` | 各模块每页条数的 JSON 对象，值为整数 1–1000，覆盖 defaultRecPerPage |
| `silent` | `false` | 业务命令是否省略正常结果输出；错误仍会报告 |
| `jsonPretty` | `false` | 是否缩进输出业务命令的 JSON |

<a id="builtin-commands"></a>

## 内置命令

| 命令 | 用途 |
| --- | --- |
| [help](#command-help) | 显示命令帮助 |
| [login](#command-login) | 登录禅道服务 |
| [logout](#command-logout) | 退出当前用户登录 |
| [profile](#command-profile) | 查看或切换用户配置 |
| [config](#command-config) | 管理用户配置 |
| [version](#command-version) | 显示版本信息 |
| [autocomplete](#command-autocomplete) | 生成 shell 自动补全脚本 |
| [add-skill](#command-add-skill) | 安装禅道 CLI 技能到 AI Agent，或导出至指定目录 |
| [add-mcp](#command-add-mcp) | 配置禅道 MCP 服务到 AI Agent |
| [mcp](#command-mcp) | 启动 MCP 服务，支持本地 stdio 或多客户端 HTTP 访问禅道数据 |
| [ls](#command-ls) | 获取对象列表 |
| [get](#command-get) | 获取单个对象 |
| [create](#command-create) | 创建对象 |
| [update](#command-update) | 更新对象 |
| [delete](#command-delete) | 删除对象 |
| [do](#command-do) | 执行对象操作 |
| [upgrade](#command-upgrade) | 检查并升级 CLI 到最新版本 |

<a id="command-help"></a>

### `zentao help`

显示命令帮助

```text
zentao help [options] [command]
```

模块名会展开该模块全部操作；内置命令名会显示该命令帮助。支持离线使用。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `command` | 否 | 子命令或模块名 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao help
zentao help bug
zentao help login
zentao doc createMyDoc --help
```

<a id="command-login"></a>

### `zentao login`

登录禅道服务

```text
zentao login [options]
```

省略完整凭证时，桌面环境默认打开本机浏览器登录，否则使用终端交互；非交互且未检测到桌面环境时返回 E1006。默认浏览器启动明确失败且有交互终端时，会关闭临时服务并回退到终端登录。`--web` 显式启动浏览器登录，打开失败时保留服务，供手动访问输出的链接。`--no-browser` 强制终端交互。浏览器页面支持通过 server 和 user 预填地址和账号，不预填密码或 Token。`--message <text>` 仅设置登录页的纯文本副标题，默认为“完成登录后，回到 ZenTao CLI 即可继续使用禅道。”。

完整参数 server、user，以及 password 或 token 仍直接登录；同时提供两者时优先使用 token。--useEnv 强制从环境变量读取完整凭证。`--web` 不能与 `--no-browser`、`--useEnv`、`--password` 或 `--token` 混用。成功后保存服务地址、账号和 Token，并设为当前账号，不保存密码。浏览器登录期间应保持命令运行；远程或容器中的本机链接指 CLI 执行端。

| 选项 | 说明 |
| --- | --- |
| `-s, --server <url>` | 禅道服务地址 |
| `-u, --user <account>` | 用户名 |
| `-p, --password <password>` | 密码 |
| `-t, --token <token>` | Token |
| `--useEnv` | 强制使用环境变量登录 |
| `--web` | 通过本机浏览器页面登录 |
| `--message <text>` | 自定义浏览器登录页面的副标题提示语 |
| `--no-browser` | 使用终端交互登录，不打开浏览器 |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao login
zentao login --web
zentao login --web --message "完成登录后，回到 Codex 即可继续使用禅道。"
zentao login --no-browser
zentao login --server=https://zentao.example.com --user=admin --token='替换为实际Token'
zentao login --useEnv
```

<a id="command-logout"></a>

### `zentao logout`

退出当前用户登录

```text
zentao logout [options] [profileKey]
```

不传 profileKey 时退出当前账号；传入时删除指定的本地登录记录。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `profileKey` | 否 | 要退出的用户配置（格式：account@server） |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao logout
zentao logout 'admin@https://zentao.example.com'
```

<a id="command-profile"></a>

### `zentao profile`

查看或切换用户配置

```text
zentao profile [options] [profileKey]
```

不传参数时列出已保存的账号并标记当前账号；传入 account@server 可切换账号。--effective 只读显示业务命令实际使用的认证来源、站点、账号、凭据类型和配置路径，不能与切换账号同时使用。完整环境凭证优先于当前本地账号，使用环境凭证时 configFile 为 null 且不读取本地配置。不会显示 Token 或密码，不发起网络请求，verified 固定为 false。支持 --format=json 和 --format=raw。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `profileKey` | 否 | 要切换到的用户配置（格式：account@server，例如 admin@https://zentao.example.com） |

| 选项 | 说明 |
| --- | --- |
| `--effective` | 显示业务命令实际使用的认证来源（不验证凭据） |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao profile
zentao profile 'admin@https://zentao.example.com'
zentao profile --effective --format=json
```

<a id="command-config"></a>

### `zentao config`

管理用户配置

```text
zentao config [options] [command]
```

配置保存在当前账号下，需要先登录。使用 get 查看、set 修改，见上方配置项表。

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao config get
zentao config set defaultOutputFormat json
```

<a id="command-config-get"></a>

#### `zentao config get`

查看配置

```text
zentao config get [options] [key]
```

省略 key 时返回当前账号的全部配置，包括未显式设置的默认值。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `key` | 否 | 配置项名称 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao config get
zentao --format=json config get pagers
```

<a id="command-config-set"></a>

#### `zentao config set`

设置配置

```text
zentao config set [options] <key> <value>
```

布尔值只接受 true/false；数值与 pagers 的有效范围见配置项表。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `key` | 是 | 配置项名称 |
| `value` | 是 | 配置值 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao config set timeout 30000
zentao config set defaultRecPerPage 50
zentao config set pagers '{"product":50,"bug":100}'
```

<a id="command-version"></a>

### `zentao version`

显示版本信息

```text
zentao version [options]
```

显示 CLI 版本以及本地已保存的当前服务器信息，不用于实时探测服务器。--version / -V 只输出 CLI 版本号。JSON/raw 输出包含 CLI 版本和已保存的服务器地址。

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao version
zentao --version
zentao --format=json version
```

<a id="command-autocomplete"></a>

### `zentao autocomplete`

生成 shell 自动补全脚本

```text
zentao autocomplete [options] [shell]
```

支持 bash、zsh、fish，省略 shell 时在交互终端选择。脚本写入 $XDG_CONFIG_HOME/zentao/.zentao-completion.<shell>；XDG_CONFIG_HOME 未设置、为空或为相对路径时，根目录回退到 ~/.config。--config 和 ZENTAO_CONFIG_FILE 不改变补全脚本目录。命令会打印启用方式，不会将脚本正文直接输出到标准输出。Bash 使用生成脚本时需要提供 _init_completion 的 bash-completion 环境。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `shell` | 否 | shell 类型 (bash\|zsh\|fish) |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao autocomplete zsh
source ~/.config/zentao/.zentao-completion.zsh
```

<a id="command-add-skill"></a>

### `zentao add-skill`

安装禅道 CLI 技能到 AI Agent，或导出至指定目录

```text
zentao add-skill [options] [agent]
```

安装或更新内置的 zentao-cli 和 zentao-tour 两个技能。省略 agent 时交互选择，all 表示全部目标。--output 导出到指定目录，与 agent 不能同时使用；重复运行会覆盖目标中的同名技能文件。支持的 Agent 见参数表。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `agent` | 否 | 目标 Agent (claude-code\|cursor\|cherry-studio\|codex\|opencode\|vscode\|antigravity\|gemini\|all) |

| 选项 | 说明 |
| --- | --- |
| `-o, --output <path>` | 将所有内置技能导出到指定目录 |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao add-skill codex
zentao add-skill all
zentao add-skill --output ./exported-skills
```

<a id="command-add-mcp"></a>

### `zentao add-mcp`

配置禅道 MCP 服务到 AI Agent

```text
zentao add-mcp [options] [agent]
```

使用已登录账号配置目标 Agent 的本地 stdio MCP 服务；HTTP MCP 需要手动配置。省略 agent 时交互选择，all 表示全部目标。多数目标写入包含服务地址、账号和 Token 的配置；Cherry Studio 打印手动添加说明。包含注释或尾逗号的 JSONC 配置会提示手动处理。支持的 Agent 见参数表。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `agent` | 否 | 目标 Agent (cursor\|claude-desktop\|claude-code\|windsurf\|cline\|trae\|vscode\|cherry-studio\|opencode\|codex\|antigravity\|gemini\|all) |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao add-mcp codex
zentao add-mcp cursor
```

<a id="command-mcp"></a>

### `zentao mcp`

启动 MCP 服务，支持本地 stdio 或多客户端 HTTP 访问禅道数据

```text
zentao mcp [options]
```

默认使用 stdio，由客户端管理进程并使用本地登录或环境凭证。--transport http 启动无状态 Streamable HTTP 服务，默认监听 127.0.0.1:9090；--url（回退到 ZENTAO_URL）固定一个禅道站点，不使用本地账号。--url、--host、--port 仅适用于 HTTP 模式，端口为 1–65535。每个 POST /mcp 请求须单独提供 token 或 Authorization: Bearer 禅道 Token，不能同时提供；不接受密码、OAuth、查询参数凭证或浏览器 Origin。GET /healthz 无需认证，GET/DELETE /mcp 返回 405，不提供旧 /sse。HTTP 模式不提供账号切换，zentao_profile 的 account 为 null；运行需要 Node.js 18.14.1+ 或 Bun，远程访问应使用 HTTPS 反向代理。两种模式均支持 --read-only、--modules、--split-tools 和全局 --timeout、--insecure。完整部署与客户端示例见 [MCP 使用说明](cli-usage.md#mcp-服务)。

| 选项 | 说明 |
| --- | --- |
| `--transport <type>` | 传输方式 (stdio\|http) |
| `--host <host>` | HTTP 监听地址（默认 127.0.0.1） |
| `--port <port>` | HTTP 监听端口（默认 9090） |
| `--url <url>` | HTTP 模式的固定禅道站点地址（亦可通过 ZENTAO_URL 设置） |
| `--read-only` | 仅提供查询工具，禁止业务写入和账号切换 |
| `--modules <names>` | 仅提供指定业务模块（逗号分隔，如 product,story,task） |
| `--split-tools` | 按模块分为 _read 查询工具和 _write 写入工具 |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao mcp
zentao --config ./zentao.json mcp
zentao mcp --read-only --modules product,story,task,bug
zentao mcp --split-tools --modules product,story,task,bug
zentao mcp --transport http --url https://zentao.example.com
zentao --timeout 15000 mcp --transport http --host 127.0.0.1 --port 9090 --url https://zentao.example.com --read-only
```

<a id="command-ls"></a>

### `zentao ls`

获取对象列表

```text
zentao ls [options] <module> [args...]
```

通用列表入口，list 是此一级命令的别名。需要模块存在默认 list；业务参数与对应模块 list 的参数相同。建议日常使用 zentao <模块>。

别名：`list`。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `module` | 是 | 模块名称，例如 bug |
| `args...` | 否 | 参数 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。

示例：

```bash
zentao ls product
zentao list product
```

<a id="command-get"></a>

### `zentao get`

获取单个对象

```text
zentao get [options] <module> [args...]
```

通用详情入口，模块需支持 get。仅在操作声明路径 ID 时提供位置 ID；额外参数使用 --key=value 或 --params。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `module` | 是 | 模块名称，例如 bug |
| `args...` | 否 | 对象 ID（按操作要求）和其他参数 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。

示例：

```bash
zentao get bug 42
zentao get product 1 --pick=id,name
zentao get resourcecalendar --type=person --projectID=1
```

<a id="command-create"></a>

### `zentao create`

创建对象

```text
zentao create [options] <module> [args...]
```

通用创建入口，模块需支持 create；字段与对应模块 create 的参数相同。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `module` | 是 | 模块名称，例如 bug |
| `args...` | 否 | 参数 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。

示例：

```bash
zentao create product --name='团队知识库'
```

<a id="command-update"></a>

### `zentao update`

更新对象

```text
zentao update [options] <module> [args...]
```

通用更新入口，模块需支持 update；可使用数字位置参数或 --id。未提供的字段按更新规则自动补全。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `module` | 是 | 模块名称，例如 bug |
| `args...` | 否 | --id 和其他参数 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。

示例：

```bash
zentao update product --id=1 --name='团队知识库新版'
```

<a id="command-delete"></a>

### `zentao delete`

删除对象

```text
zentao delete [options] <module> [args...]
```

通用删除入口，模块需支持 delete；确认与批量规则同模块删除操作。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `module` | 是 | 模块名称，例如 bug |
| `args...` | 否 | --id 和其他参数 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。

示例：

```bash
zentao delete product --id=1,2 --yes
```

<a id="command-do"></a>

### `zentao do`

执行对象操作

```text
zentao do [options] <module> <action> [args...]
```

通用命名操作入口，action 必须来自该模块的操作列表；是否需要 ID 以具体操作为准。

| 位置参数 | 必填 | 说明 |
| --- | --- | --- |
| `module` | 是 | 模块名称，例如 bug |
| `action` | 是 | 操作名称，例如 resolve |
| `args...` | 否 | --id 和其他参数 |

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 显示命令帮助 |

同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。

示例：

```bash
zentao do bug resolve 42 --resolution=fixed
zentao do story getGrades
```

<a id="command-upgrade"></a>

### `zentao upgrade`

检查并升级 CLI 到最新版本

```text
zentao upgrade [options]
```

联网检查最新 CLI 版本；发现新版本后确认升级，--yes 可跳过确认。通过检测到的包管理器执行全局安装。

| 选项 | 说明 |
| --- | --- |
| `-y, --yes` | 跳过确认，直接升级 |
| `-h, --help` | 显示命令帮助 |

示例：

```bash
zentao upgrade
zentao upgrade --yes
```

<a id="modules"></a>

## 业务模块索引

本文使用规范操作名，参数名应保留大小写。每个模块同时提供 props 与离线帮助；下表的操作数量只统计业务操作。

参数表的默认值列记录显式声明的默认值；“未声明”不表示空值或 0，服务端默认行为还可能写在说明中。分页条数另外受 CLI 配置控制。

| 模块 | 名称 | 别名 | 操作数 |
| --- | --- | --- | --- |
| [user](#module-user) | 用户 | — | 5 |
| [program](#module-program) | 项目集 | — | 5 |
| [product](#module-product) | 产品 | — | 11 |
| [project](#module-project) | 项目 | — | 14 |
| [execution](#module-execution) | 执行 | — | 12 |
| [productplan](#module-productplan) | 产品计划 | plan | 5 |
| [story](#module-story) | 需求 | — | 12 |
| [epic](#module-epic) | 业务需求 | — | 8 |
| [requirement](#module-requirement) | 用户需求 | — | 8 |
| [bug](#module-bug) | Bug | — | 12 |
| [testcase](#module-testcase) | 测试用例 | — | 8 |
| [task](#module-task) | 任务 | — | 12 |
| [issue](#module-issue) | 问题 | — | 5 |
| [risk](#module-risk) | 风险 | — | 6 |
| [meeting](#module-meeting) | 会议 | — | 8 |
| [feedback](#module-feedback) | 反馈 | — | 12 |
| [ticket](#module-ticket) | 工单 | — | 9 |
| [system](#module-system) | 应用 | — | 3 |
| [build](#module-build) | 版本 | — | 4 |
| [testtask](#module-testtask) | 测试单 | — | 4 |
| [release](#module-release) | 发布 | — | 4 |
| [file](#module-file) | 附件 | — | 3 |
| [workflow](#module-workflow) | 工作流 | — | 55 |
| [doc](#module-doc) | 文档 | — | 41 |
| [todo](#module-todo) | 待办 | — | 4 |
| [my](#module-my) | 地盘 | — | 32 |
| [process](#module-process) | 过程裁剪 | — | 3 |
| [auditplan](#module-auditplan) | 质量保证计划 | — | 7 |
| [nc](#module-nc) | 不符合项 | — | 6 |
| [opportunity](#module-opportunity) | 机会 | — | 6 |
| [deliverable](#module-deliverable) | 交付物 | — | 5 |
| [baseline](#module-baseline) | 基线 | — | 5 |
| [change](#module-change) | 项目变更 | — | 5 |
| [relation](#module-relation) | 对象关联 | — | 4 |
| [workflowgroup](#module-workflowgroup) | 项目流程 | — | 1 |
| [resourcecalendar](#module-resourcecalendar) | 人力资源日历 | — | 1 |
| [weekly](#module-weekly) | 项目周报 | — | 5 |
| [db](#module-db) | 数据库 | — | 3 |
| [knowledgelib](#module-knowledgelib) | 知识库 | — | 1 |
| [knowledge](#module-knowledge) | 知识 | — | 4 |
| [space](#module-space) | 代码库空间 | — | 1 |
| [repo](#module-repo) | 代码库 | — | 2 |

<a id="module-user"></a>

### user · 用户

用户管理，支持获取用户列表、创建用户、获取用户详情、修改用户信息、删除用户

快捷用法与字段查询：

```text
zentao user <id>
zentao user [列表参数]
zentao user props --format=json
zentao help user
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-user-list) | 获取用户列表 |
| [create](#action-user-create) | 创建用户 |
| [get](#action-user-get) | 获取用户详情 |
| [update](#action-user-update) | 修改用户信息 |
| [delete](#action-user-delete) | 删除用户 |

<a id="action-user-list"></a>

#### `zentao user list` · 获取用户列表

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao user list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 浏览类型<br>可选值：inside（内部用户）；outside（内部用户） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；realname_asc（姓名 升序）；realname_desc（姓名 降序）；account_asc（用户名 升序）；account_desc（用户名 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：realname(姓名，示例：admin)；email(邮箱，示例：关键字)；dept(部门，示例：all)；account(用户名，示例：admin)；role(职位，枚举：dev 研发 \| qa 测试 \| pm 项目经理 \| po 产品经理 \| td 研发主管 \| pd 产品主管 \| qd 测试主管 \| top 高层管理 \| others 其他)；phone(电话，示例：关键字)；visions(界面类型，枚举：rnd 研发综合界面 \| lite 运营管理界面)；join(入职日期，示例：2026-01-01)；id(用户编号，示例：1)；commiter(源代码帐号，示例：all)；gender(性别，枚举：m 男 \| f 女)；qq(QQ，示例：关键字)；skype(Skype，示例：关键字)；dingding(钉钉，示例：关键字)；weixin(微信，示例：关键字)；slack(Slack，示例：关键字)；whatsapp(WhatsApp，示例：关键字)；address(通讯地址，示例：关键字)；zipcode(邮编，示例：关键字) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-user-create"></a>

#### `zentao user create` · 创建用户

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao user create --account=<string> --realname=<string> --password=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--account` | 请求体 | `string` | 是 | 未声明 | 登录名 |
| `--realname` | 请求体 | `string` | 是 | 未声明 | 姓名 |
| `--password` | 请求体 | `string` | 是 | 未声明 | 密码 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-user-get"></a>

#### `zentao user get` · 获取用户详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao user get --userID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--userID` | 路径 | `number` | 是 | 未声明 | 用户ID |

`--userID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-user-update"></a>

#### `zentao user update` · 修改用户信息

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao user update --userID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--userID` | 路径 | `number` | 是 | 未声明 | 用户ID |
| `--realname` | 请求体 | `string` | 否 | 未声明 | 真实姓名 |
| `--dept` | 请求体 | `number` | 否 | 未声明 | 部门<br>格式：int32<br>必须为整数 |
| `--join` | 请求体 | `string` | 否 | 未声明 | 入职日期 |
| `--group` | 请求体 | `string[]` | 否 | 未声明 | 权限分组<br>数组元素类型：string |
| `--email` | 请求体 | `string` | 否 | 未声明 | 邮箱 |
| `--visions` | 请求体 | `string[]` | 否 | 未声明 | 界面类型(研发综合界面 rnd \| 运营管理界面 lite)<br>数组元素类型：string |
| `--mobile` | 请求体 | `string` | 否 | 未声明 | 手机 |
| `--weixin` | 请求体 | `string` | 否 | 未声明 | 微信 |
| `--password` | 请求体 | `string` | 否 | 未声明 | 密码 |

`--userID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-user-delete"></a>

#### `zentao user delete` · 删除用户

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao user delete --userID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--userID` | 路径 | `number` | 是 | 未声明 | 用户ID |

`--userID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-program"></a>

### program · 项目集

项目集管理，支持获取项目集列表、创建项目集、获取项目集详情、修改项目集、删除项目集

快捷用法与字段查询：

```text
zentao program <id>
zentao program [列表参数]
zentao program props --format=json
zentao help program
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-program-list) | 获取项目集列表 |
| [create](#action-program-create) | 创建项目集 |
| [get](#action-program-get) | 获取项目集详情 |
| [update](#action-program-update) | 修改项目集 |
| [delete](#action-program-delete) | 删除项目集 |

<a id="action-program-list"></a>

#### `zentao program list` · 获取项目集列表

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao program list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 浏览类型<br>可选值：all（全部）；unclosed（未关闭）；wait（未开始）；doing（进行中）；suspended（已挂起）；delayed（已延期）；closed（已关闭） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(项目集名称，示例：关键字)；PM(负责人，用户，示例：admin)；openedDate(创建时间，示例：2026-01-01)；status(状态，枚举：wait 未开始 \| doing 进行中 \| suspended 已挂起 \| closed 已关闭)；openedBy(创建者，用户，示例：admin)；begin(计划开始，示例：2026-01-01)；end(计划完成，示例：2026-01-01)；realBegan(实际开始，示例：2026-01-01)；realEnd(实际完成，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后编辑日期，示例：2026-01-01)；desc(项目集描述，示例：关键字) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-program-create"></a>

#### `zentao program create` · 创建项目集

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao program create --name=<string> --begin=<string> --end=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 项目集名称 |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 计划开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 计划完成日期 |
| `--PM` | 请求体 | `string` | 否 | 未声明 | 计划完成日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 项目集描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-program-get"></a>

#### `zentao program get` · 获取项目集详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao program get --programID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--programID` | 路径 | `number` | 是 | 未声明 | 项目集ID |

`--programID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-program-update"></a>

#### `zentao program update` · 修改项目集

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao program update --programID=<number> --name=<string> --begin=<string> --end=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--programID` | 路径 | `number` | 是 | 未声明 | 项目集ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 项目集名称 |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 计划开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 计划完成日期 |
| `--PM` | 请求体 | `string` | 否 | 未声明 | 计划完成日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 项目集描述 |

`--programID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-program-delete"></a>

#### `zentao program delete` · 删除项目集

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao program delete --programID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--programID` | 路径 | `number` | 是 | 未声明 | 项目集ID |

`--programID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-product"></a>

### product · 产品

产品管理，支持获取产品列表、获取项目集的产品列表、创建产品、关闭产品、创建产品的需求模块、创建产品的Bug模块、创建产品的用例模块、获取产品详情、修改产品、删除产品

快捷用法与字段查询：

```text
zentao product <id>
zentao product [列表参数]
zentao product props --format=json
zentao help product
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-product-list) | 获取产品列表 |
| [programProducts](#action-product-programproducts) | 获取项目集的产品列表 |
| [create](#action-product-create) | 创建产品 |
| [close](#action-product-close) | 关闭产品 |
| [createStoryModule](#action-product-createstorymodule) | 创建产品的需求模块 |
| [createBugModule](#action-product-createbugmodule) | 创建产品的Bug模块 |
| [createTestcaseModule](#action-product-createtestcasemodule) | 创建产品的用例模块 |
| [get](#action-product-get) | 获取产品详情 |
| [update](#action-product-update) | 修改产品 |
| [delete](#action-product-delete) | 删除产品 |
| [repos](#action-product-repos) | 获取产品关联的代码库列表 |

<a id="action-product-list"></a>

#### `zentao product list` · 获取产品列表

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao product list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 浏览类型<br>可选值：all（全部）；noclosed（未关闭）；closed（已结束） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（名称 升序）；title_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-programproducts"></a>

#### `zentao product programProducts` · 获取项目集的产品列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao product programProducts --programID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--programID` | 路径 | `number` | 是 | 未声明 | 项目集ID |
| `--browseType` | 查询 | `string` | 否 | `"noclosed"` | 状态，默认是noclosed<br>可选值：all（全部）；noclosed（未关闭）；closed（已结束） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

`--programID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-create"></a>

#### `zentao product create` · 创建产品

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao product create --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 产品名称 |
| `--program` | 请求体 | `number` | 否 | 未声明 | 所属项目集<br>格式：int32<br>必须为整数 |
| `--line` | 请求体 | `number` | 否 | 未声明 | 所属产品线<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(normal 正常 \| branch 多分支 \| platform 多平台) |
| `--PO` | 请求体 | `string` | 否 | 未声明 | 产品负责人 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人<br>数组元素类型：string |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 产品描述 |
| `--QD` | 请求体 | `string` | 否 | 未声明 | 测试负责人 |
| `--RD` | 请求体 | `string` | 否 | 未声明 | 发布负责人 |
| `--acl` | 请求体 | `string` | 否 | `"open"` | 访问控制(open 公开 \| private 私有) |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-close"></a>

#### `zentao product close` · 关闭产品

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao product close --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-createstorymodule"></a>

#### `zentao product createStoryModule` · 创建产品的需求模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao product createStoryModule --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-createbugmodule"></a>

#### `zentao product createBugModule` · 创建产品的Bug模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao product createBugModule --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-createtestcasemodule"></a>

#### `zentao product createTestcaseModule` · 创建产品的用例模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao product createTestcaseModule --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-get"></a>

#### `zentao product get` · 获取产品详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao product get --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-update"></a>

#### `zentao product update` · 修改产品

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao product update --productID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 产品名称 |
| `--program` | 请求体 | `number` | 否 | 未声明 | 所属项目集<br>格式：int32<br>必须为整数 |
| `--line` | 请求体 | `number` | 否 | 未声明 | 所属产品线<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(normal 正常 \| branch 多分支 \| platform 多平台) |
| `--PO` | 请求体 | `string` | 否 | 未声明 | 产品负责人 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人<br>数组元素类型：string |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 产品描述 |
| `--QD` | 请求体 | `string` | 否 | 未声明 | 测试负责人 |
| `--RD` | 请求体 | `string` | 否 | 未声明 | 发布负责人 |
| `--acl` | 请求体 | `string` | 否 | `"open"` | 访问控制(open 公开 \| private 私有) |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-product-delete"></a>

#### `zentao product delete` · 删除产品

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao product delete --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-product-repos"></a>

#### `zentao product repos` · 获取产品关联的代码库列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

需部署代码库 API 2.0 实现，具备 repo.browse 权限及产品访问权限。仅返回未删除、非导入中且当前用户可访问的代码库，不分页、不保证排序；url.http、url.ssh 可能缺省。产品不存在、已删除或不可访问时为业务失败。

```text
zentao product repos --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品 ID，正整数 |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="module-project"></a>

### project · 项目

项目管理，支持获取项目列表、获取项目集的项目列表、获取项目团队列表、获取项目成员列表、创建项目、关闭项目、创建项目需求、创建项目Bug、创建项目任务、创建项目风险、项目关联需求、修改项目、删除项目、维护项目成员

快捷用法与字段查询：

```text
zentao project [列表参数]
zentao project props --format=json
zentao help project
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-project-list) | 获取项目列表 |
| [programProjects](#action-project-programprojects) | 获取项目集的项目列表 |
| [team](#action-project-team) | 获取项目团队列表 |
| [projectMembers](#action-project-projectmembers) | 获取项目成员列表 |
| [create](#action-project-create) | 创建项目 |
| [close](#action-project-close) | 关闭项目 |
| [createStory](#action-project-createstory) | 创建项目需求 |
| [createBug](#action-project-createbug) | 创建项目Bug |
| [createTask](#action-project-createtask) | 创建项目任务 |
| [createRisk](#action-project-createrisk) | 创建项目风险 |
| [linkStories](#action-project-linkstories) | 项目关联需求 |
| [update](#action-project-update) | 修改项目 |
| [delete](#action-project-delete) | 删除项目 |
| [members](#action-project-members) | 维护项目成员 |

<a id="action-project-list"></a>

#### `zentao project list` · 获取项目列表

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao project list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"undone"` | 项目状态，默认是undone<br>可选值：all（全部）；undone（未完成）；wait（未开始）；doing（进行中） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(项目名称，示例：关键字)；code(项目代号，示例：关键字)；id(项目ID，示例：1)；model(项目管理方式，枚举：scrum Scrum \| waterfall 瀑布 \| kanban 看板 \| agileplus 融合敏捷 \| waterfallplus 融合瀑布)；hasProduct(项目类型，枚举：1 产品型 \| 0 项目型)；parent(所属项目集，示例：all)；status(状态，枚举：wait 未开始 \| doing 进行中 \| suspended 已挂起 \| closed 已关闭 \| delay 已延期)；desc(项目描述，示例：关键字)；PM(负责人，用户，示例：admin)；teamCount(人数，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；begin(计划开始，示例：2026-01-01)；end(计划完成，示例：2026-01-01)；realBegan(实际开始，示例：2026-01-01)；realEnd(实际完成，示例：2026-01-01)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedDate(最后编辑日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-programprojects"></a>

#### `zentao project programProjects` · 获取项目集的项目列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project programProjects --programID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--programID` | 路径 | `number` | 是 | 未声明 | 项目集ID |
| `--browseType` | 查询 | `string` | 否 | `"undone"` | 项目状态，默认是undone<br>可选值：all（全部）；undone（未完成）；wait（未开始）；doing（进行中） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

`--programID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-team"></a>

#### `zentao project team` · 获取项目团队列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project team --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 查询 | `number` | 是 | 未声明 | 项目ID |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-projectmembers"></a>

#### `zentao project projectMembers` · 获取项目成员列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project projectMembers --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-create"></a>

#### `zentao project create` · 创建项目

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao project create --name=<string> --model=<string> --begin=<string> --end=<string> --workflowGroup=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 项目名称 |
| `--model` | 请求体 | `string` | 是 | 未声明 | 项目管理方式(scrum 敏捷 \| waterfall 瀑布 \| kanban 看板 \| agileplus 融合敏捷 \| waterfallplus 融合瀑布) |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束日期 |
| `--products` | 请求体 | `string[]` | 否 | 未声明 | 关联产品<br>数组元素类型：string |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 所属项目集<br>格式：int32<br>必须为整数 |
| `--workflowGroup` | 请求体 | `number` | 是 | 未声明 | 项目流程，付费版功能，开源版可以不填<br>格式：int32<br>必须为整数 |
| `--PM` | 请求体 | `string` | 否 | 未声明 | 项目负责人 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-close"></a>

#### `zentao project close` · 关闭项目

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project close --projectID=<number> --realEnd=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--realEnd` | 请求体 | `string` | 是 | 未声明 | 实际完成日期 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-createstory"></a>

#### `zentao project createStory` · 创建项目需求

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project createStory --projectID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--productID` | 请求体 | `number` | 否 | 未声明 | 所属产品；项目型项目可不传，产品型项目必须传<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 需求标题 |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--category` | 请求体 | `string` | 否 | 未声明 | 类别 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人<br>数组元素类型：string |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-createbug"></a>

#### `zentao project createBug` · 创建项目Bug

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project createBug --projectID=<number> --title=<string> --openedBuild=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--productID` | 请求体 | `number` | 否 | 未声明 | 所属产品；项目型项目可不传，产品型项目必须传<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | Bug标题 |
| `--openedBuild` | 请求体 | `string[]` | 是 | 未声明 | 影响版本，主干是trunk，其他版本使用版本ID<br>数组元素类型：string |
| `--severity` | 请求体 | `number` | 否 | 未声明 | 严重程度<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | Bug类型 |
| `--steps` | 请求体 | `string` | 否 | 未声明 | 重现步骤 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-createtask"></a>

#### `zentao project createTask` · 创建项目任务

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project createTask --projectID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 任务名称 |
| `--executionID` | 请求体 | `number` | 否 | 未声明 | 所属执行；无执行项目可不传，有执行项目必须传<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 任务类型 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--estStarted` | 请求体 | `string` | 否 | 未声明 | 预计开始 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 任务描述 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-createrisk"></a>

#### `zentao project createRisk` · 创建项目风险

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao project createRisk --projectID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 风险名称。 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 风险来源。 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级风险传 0。<br>格式：int32<br>必须为整数 |
| `--category` | 请求体 | `string` | 否 | 未声明 | 风险类型。 |
| `--strategy` | 请求体 | `string` | 否 | 未声明 | 应对策略。 |
| `--impact` | 请求体 | `number` | 否 | 未声明 | 影响程度，1-5。<br>格式：int32<br>必须为整数 |
| `--probability` | 请求体 | `number` | 否 | 未声明 | 发生概率，1-5。<br>格式：int32<br>必须为整数 |
| `--rate` | 请求体 | `number` | 否 | 未声明 | 风险系数，通常为 impact * probability。<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，1 高、2 中、3 低。<br>格式：int32<br>必须为整数 |
| `--identifiedDate` | 请求体 | `string` | 否 | 未声明 | 识别日期。 |
| `--plannedClosedDate` | 请求体 | `string` | 否 | 未声明 | 计划关闭日期。 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派人账号。 |
| `--prevention` | 请求体 | `string` | 否 | 未声明 | 应对措施。 |
| `--remedy` | 请求体 | `string` | 否 | 未声明 | 响应措施。 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-linkstories"></a>

#### `zentao project linkStories` · 项目关联需求

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao project linkStories --projectID=<number> --stories=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--stories` | 请求体 | `string[]` | 是 | 未声明 | 要关联到项目的需求 ID 列表。<br>数组元素类型：string |
| `--storyType` | 请求体 | `string` | 否 | 未声明 | 需求类型，默认 story；可按项目需求类型传 requirement、epic 等。 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-update"></a>

#### `zentao project update` · 修改项目

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao project update --projectID=<number> --name=<string> --model=<string> --begin=<string> --end=<string> --workflowGroup=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 项目名称 |
| `--model` | 请求体 | `string` | 是 | 未声明 | 项目管理方式(scrum 敏捷 \| waterfall 瀑布 \| kanban 看板 \| agileplus 融合敏捷 \| waterfallplus 融合瀑布) |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束日期 |
| `--products` | 请求体 | `string[]` | 否 | 未声明 | 关联产品<br>数组元素类型：string |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 所属项目集<br>格式：int32<br>必须为整数 |
| `--workflowGroup` | 请求体 | `number` | 是 | 未声明 | 项目流程，付费版功能，开源版可以不填<br>格式：int32<br>必须为整数 |
| `--PM` | 请求体 | `string` | 否 | 未声明 | 项目负责人 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-project-delete"></a>

#### `zentao project delete` · 删除项目

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao project delete --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-project-members"></a>

#### `zentao project members` · 维护项目成员

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao project members --projectID=<number> --account=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--account` | 请求体 | `string[]` | 是 | 未声明 | 成员账号，多人时按顺序设置。例如 account=["admin","dev1"] 时，role[0] 对应 admin，role[1] 对应 dev1<br>数组元素类型：string |
| `--role` | 请求体 | `string[]` | 否 | 未声明 | 成员角色，与account顺序一一对应<br>数组元素类型：string |
| `--days` | 请求体 | `string[]` | 否 | 未声明 | 可用工作日，与account顺序一一对应<br>数组元素类型：string |
| `--hours` | 请求体 | `string[]` | 否 | 未声明 | 每日工时，与account顺序一一对应<br>数组元素类型：string |
| `--limited` | 请求体 | `string[]` | 否 | 未声明 | 是否限制日期，与account顺序一一对应<br>数组元素类型：string |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-execution"></a>

### execution · 执行

执行管理，支持获取执行列表、获取项目的执行列表、获取执行团队列表、获取执行成员列表、创建执行（迭代/阶段/看板）、关闭执行、创建执行的任务模块、执行关联需求、获取执行详情、修改执行、删除执行、维护执行成员

快捷用法与字段查询：

```text
zentao execution <id>
zentao execution [列表参数]
zentao execution props --format=json
zentao help execution
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-execution-list) | 获取执行列表 |
| [projectExecutions](#action-execution-projectexecutions) | 获取项目的执行列表 |
| [team](#action-execution-team) | 获取执行团队列表 |
| [executionMembers](#action-execution-executionmembers) | 获取执行成员列表 |
| [create](#action-execution-create) | 创建执行（迭代/阶段/看板） |
| [close](#action-execution-close) | 关闭执行 |
| [createTaskModule](#action-execution-createtaskmodule) | 创建执行的任务模块 |
| [linkStories](#action-execution-linkstories) | 执行关联需求 |
| [get](#action-execution-get) | 获取执行详情 |
| [update](#action-execution-update) | 修改执行 |
| [delete](#action-execution-delete) | 删除执行 |
| [members](#action-execution-members) | 维护执行成员 |

<a id="action-execution-list"></a>

#### `zentao execution list` · 获取执行列表

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao execution list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"undone"` | 执行状态，默认是undone<br>可选值：all（全部）；undone（未完成）；wait（未开始）；doing（进行中） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：rawID_asc（RAWID 升序）；rawID_desc（RAWID 降序）；nameCol_asc（名称 升序）；nameCol_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedDate,assignedDate,assignedTo,canceledBy,canceledDate,closedBy,closedDate,closedReason,consumed,deadline,desc,estStarted,estimate,execution,finishedBy,finishedDate,fromBug,id,keywords,lastEditedBy,lastEditedDate,left,mailto,module,name,openedBy,openedDate,pri,project,realStarted,status,story,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-projectexecutions"></a>

#### `zentao execution projectExecutions` · 获取项目的执行列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao execution projectExecutions --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--browseType` | 查询 | `string` | 否 | `"undone"` | 执行状态，默认是undone<br>可选值：all（全部）；undone（未完成）；wait（未开始）；doing（进行中） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：rawID_asc（RAWID 升序）；rawID_desc（RAWID 降序）；nameCol_asc（名称 升序）；nameCol_desc（名称 降序）；begin_asc（计划开始 升序）；begin_desc（计划开始 降序）；end_asc（计划结束 升序）；end_desc（计划结束 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-team"></a>

#### `zentao execution team` · 获取执行团队列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao execution team --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 查询 | `number` | 是 | 未声明 | 执行ID |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-executionmembers"></a>

#### `zentao execution executionMembers` · 获取执行成员列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao execution executionMembers --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-create"></a>

#### `zentao execution create` · 创建执行（迭代/阶段/看板）

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao execution create --project=<number> --name=<string> --begin=<string> --end=<string> --products=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--project` | 请求体 | `number` | 是 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 迭代/阶段名称 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(sprint 迭代 \| stage 阶段 \| kanban 看板)。默认按项目模型推导：scrum→sprint、kanban→kanban、waterfall/waterfallplus→stage；IPD 项目创建阶段时必须显式传 stage |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父执行/父阶段ID；创建子阶段时传父阶段ID，不传为顶层阶段<br>格式：int32<br>必须为整数 |
| `--attribute` | 请求体 | `string` | 否 | 未声明 | 阶段类型(mix 综合 \| request 需求 \| design 设计 \| dev 开发 \| qa 测试 \| release 发布 \| review 总结评审 \| other 其他；IPD: concept 概念 \| plan 计划 \| develop 开发 \| qualify 验证 \| launch 发布)。不传为空，有 parent 时继承父阶段 |
| `--lifetime` | 请求体 | `string` | 否 | 未声明 | 周期(short 短期，迭代 \| long 长期，阶段 \| ops 运维) |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束日期 |
| `--days` | 请求体 | `number` | 否 | 未声明 | 可用工作日<br>格式：int32<br>必须为整数 |
| `--products` | 请求体 | `string[]` | 是 | 未声明 | 关联产品；waterfall/waterfallplus 项目创建阶段时必填<br>数组元素类型：string |
| `--plans` | 请求体 | `string[]` | 否 | 未声明 | 关联计划，必须是产品+planID的二维数组<br>数组元素类型：string |
| `--PO` | 请求体 | `string` | 否 | 未声明 | 产品负责人 |
| `--QD` | 请求体 | `string` | 否 | 未声明 | 测试负责人 |
| `--PM` | 请求体 | `string` | 否 | 未声明 | 执行负责人 |
| `--RD` | 请求体 | `string` | 否 | 未声明 | 发布负责人 |
| `--acl` | 请求体 | `string` | 否 | `"open"` | 访问控制(open 公开 \| private 私有) |
| `--milestone` | 请求体 | `number` | 否 | 未声明 | 是否里程碑(0 否\| 1 是)<br>格式：int32<br>必须为整数 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-close"></a>

#### `zentao execution close` · 关闭执行

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao execution close --executionID=<number> --realEnd=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--realEnd` | 请求体 | `string` | 是 | 未声明 | 实际完成日期 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-createtaskmodule"></a>

#### `zentao execution createTaskModule` · 创建执行的任务模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao execution createTaskModule --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-linkstories"></a>

#### `zentao execution linkStories` · 执行关联需求

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao execution linkStories --executionID=<number> --stories=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--stories` | 请求体 | `string[]` | 是 | 未声明 | 要关联到执行的需求 ID 列表。<br>数组元素类型：string |
| `--storyType` | 请求体 | `string` | 否 | 未声明 | 需求类型，默认 story。 |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-get"></a>

#### `zentao execution get` · 获取执行详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao execution get --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-update"></a>

#### `zentao execution update` · 修改执行

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao execution update --executionID=<number> --name=<string> --begin=<string> --end=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--project` | 请求体 | `number` | 否 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 迭代名称 |
| `--lifetime` | 请求体 | `string` | 否 | 未声明 | 执行类型(short 短期 \| long 长期 \| ops 运维) |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束日期 |
| `--days` | 请求体 | `number` | 否 | 未声明 | 可用工作日<br>格式：int32<br>必须为整数 |
| `--products` | 请求体 | `string[]` | 否 | 未声明 | 关联产品<br>数组元素类型：string |
| `--plans` | 请求体 | `string[]` | 否 | 未声明 | 关联计划，必须是产品+planID的二维数组<br>数组元素类型：string |
| `--PO` | 请求体 | `string` | 否 | 未声明 | 产品负责人 |
| `--QD` | 请求体 | `string` | 否 | 未声明 | 测试负责人 |
| `--PM` | 请求体 | `string` | 否 | 未声明 | 执行负责人 |
| `--RD` | 请求体 | `string` | 否 | 未声明 | 发布负责人 |
| `--acl` | 请求体 | `string` | 否 | `"open"` | 访问控制(open 公开 \| private 私有) |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-execution-delete"></a>

#### `zentao execution delete` · 删除执行

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao execution delete --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-execution-members"></a>

#### `zentao execution members` · 维护执行成员

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao execution members --executionID=<number> --account=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--account` | 请求体 | `string[]` | 是 | 未声明 | 成员账号，多人时按顺序设置。例如 account=["admin","dev1"] 时，role[0] 对应 admin，role[1] 对应 dev1<br>数组元素类型：string |
| `--role` | 请求体 | `string[]` | 否 | 未声明 | 成员角色，与account顺序一一对应<br>数组元素类型：string |
| `--days` | 请求体 | `string[]` | 否 | 未声明 | 可用工作日，与account顺序一一对应<br>数组元素类型：string |
| `--hours` | 请求体 | `string[]` | 否 | 未声明 | 每日工时，与account顺序一一对应<br>数组元素类型：string |
| `--limited` | 请求体 | `string[]` | 否 | 未声明 | 是否限制日期，与account顺序一一对应<br>数组元素类型：string |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-productplan"></a>

### productplan · 产品计划

产品计划管理，支持获取产品计划列表，支持获取产品下的产品计划、创建产品计划、获取产品计划详情、修改产品计划、删除产品计划

快捷用法与字段查询：

```text
zentao productplan <id>
zentao productplan [列表参数]
zentao productplan props --format=json
zentao help productplan
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-productplan-list) | 获取产品计划列表，支持获取产品下的产品计划 |
| [create](#action-productplan-create) | 创建产品计划 |
| [get](#action-productplan-get) | 获取产品计划详情 |
| [update](#action-productplan-update) | 修改产品计划 |
| [delete](#action-productplan-delete) | 删除产品计划 |

<a id="action-productplan-list"></a>

#### `zentao productplan list` · 获取产品计划列表，支持获取产品下的产品计划

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao productplan list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--browseType` | 查询 | `string` | 否 | `"undone"` | 执行状态，默认是undone<br>可选值：all（全部）；undone（未完成）；wait（未开始）；doing（进行中） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（名称 升序）；title_desc（名称 降序）；begin_asc（开始日期 升序）；begin_desc（开始日期 降序）；end_asc（结束日期 升序）；end_desc（结束日期 降序）；status_asc（状态 升序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,branch,end,id,status,title |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-productplan-create"></a>

#### `zentao productplan create` · 创建产品计划

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao productplan create --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 产品ID<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 计划名称 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父计划ID<br>格式：int32<br>必须为整数 |
| `--begin` | 请求体 | `string` | 否 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 否 | 未声明 | 结束日期 |
| `--branchID` | 请求体 | `number` | 否 | 未声明 | 分支ID<br>格式：int32<br>必须为整数 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 计划描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-productplan-get"></a>

#### `zentao productplan get` · 获取产品计划详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao productplan get --planID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--planID` | 路径 | `number` | 是 | 未声明 | 产品计划ID |

`--planID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-productplan-update"></a>

#### `zentao productplan update` · 修改产品计划

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao productplan update --planID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--planID` | 路径 | `number` | 是 | 未声明 | 产品计划ID |
| `--title` | 请求体 | `string` | 是 | 未声明 | 计划名称 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父计划<br>格式：int32<br>必须为整数 |
| `--begin` | 请求体 | `string` | 否 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 否 | 未声明 | 结束日期 |
| `--branchID` | 请求体 | `number` | 否 | 未声明 | 分支ID<br>格式：int32<br>必须为整数 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 计划描述 |

`--planID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-productplan-delete"></a>

#### `zentao productplan delete` · 删除产品计划

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao productplan delete --planID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--planID` | 路径 | `number` | 是 | 未声明 | 产品计划ID |

`--planID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-story"></a>

### story · 需求

需求管理，支持获取需求列表，支持获取项目/产品/执行下的需求、产品的需求模块树、创建需求、获取需求详情、修改需求、修改需求模块、删除需求、删除需求模块、激活需求、变更需求、关闭需求

快捷用法与字段查询：

```text
zentao story <id>
zentao story [列表参数]
zentao story props --format=json
zentao help story
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-story-list) | 获取需求列表，支持获取项目/产品/执行下的需求 |
| [modules](#action-story-modules) | 产品的需求模块树 |
| [create](#action-story-create) | 创建需求 |
| [get](#action-story-get) | 获取需求详情 |
| [update](#action-story-update) | 修改需求 |
| [updateModule](#action-story-updatemodule) | 修改需求模块 |
| [delete](#action-story-delete) | 删除需求 |
| [deleteModule](#action-story-deletemodule) | 删除需求模块 |
| [activate](#action-story-activate) | 激活需求 |
| [change](#action-story-change) | 变更需求 |
| [close](#action-story-close) | 关闭需求 |
| [getGrades](#action-story-getgrades) | 获取需求层级选项 |

<a id="action-story-list"></a>

#### `zentao story list` · 获取需求列表，支持获取项目/产品/执行下的需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--product=<id>`（产品）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 需求所属范围<br>可选值：projects（项目）；products（产品）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 状态<br>可选值：allstory（全部）；assignedtome（指派给我）；openedbyme（我创建）；reviewbyme（待我评审）；draftstory（草稿） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-modules"></a>

#### `zentao story modules` · 产品的需求模块树

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao story modules --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-create"></a>

#### `zentao story create` · 创建需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story create --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 产品ID<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | title |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父需求<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--category` | 请求体 | `number` | 否 | 未声明 | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>格式：int32<br>必须为整数 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他) |
| `--verify` | 请求体 | `string` | 否 | 未声明 | 验收标准 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人员，如果无需评审则不传<br>数组元素类型：string |
| `--project` | 请求体 | `number` | 否 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--grade` | 请求体 | `number` | 否 | 未声明 | 需求层级，可用的需求层级可以通过 story-getGrades 操作获取<br>必须为整数 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-get"></a>

#### `zentao story get` · 获取需求详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story get --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-update"></a>

#### `zentao story update` · 修改需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story update --storyID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--title` | 请求体 | `string` | 是 | 未声明 | title |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父需求<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--category` | 请求体 | `string` | 否 | 未声明 | 类别 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他) |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--plan` | 请求体 | `number` | 否 | 未声明 | 所属计划<br>格式：int32<br>必须为整数 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-story-updatemodule"></a>

#### `zentao story updateModule` · 修改需求模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao story updateModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-story-delete"></a>

#### `zentao story delete` · 删除需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story delete --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-deletemodule"></a>

#### `zentao story deleteModule` · 删除需求模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao story deleteModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-activate"></a>

#### `zentao story activate` · 激活需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story activate --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-change"></a>

#### `zentao story change` · 变更需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story change --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--title` | 请求体 | `string` | 否 | 未声明 | 需求名称 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人员，如果无需评审则不传<br>数组元素类型：string |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--verify` | 请求体 | `string` | 否 | 未声明 | 验收标准 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-close"></a>

#### `zentao story close` · 关闭需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao story close --storyID=<number> --closedReason=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--closedReason` | 请求体 | `string` | 是 | 未声明 | 关闭原因(done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此) |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-story-getgrades"></a>

#### `zentao story getGrades` · 获取需求层级选项

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao story getGrades [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="module-epic"></a>

### epic · 业务需求

业务需求管理，支持获取业务需求列表，支持获取产品下的业务需求、创建业务需求、获取业务需求详情、修改业务需求、删除业务需求、激活业务需求、变更业务需求、关闭业务需求

快捷用法与字段查询：

```text
zentao epic <id>
zentao epic [列表参数]
zentao epic props --format=json
zentao help epic
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-epic-list) | 获取业务需求列表，支持获取产品下的业务需求 |
| [create](#action-epic-create) | 创建业务需求 |
| [get](#action-epic-get) | 获取业务需求详情 |
| [update](#action-epic-update) | 修改业务需求 |
| [delete](#action-epic-delete) | 删除业务需求 |
| [activate](#action-epic-activate) | 激活业务需求 |
| [change](#action-epic-change) | 变更业务需求 |
| [close](#action-epic-close) | 关闭业务需求 |

<a id="action-epic-list"></a>

#### `zentao epic list` · 获取业务需求列表，支持获取产品下的业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--browseType` | 查询 | `string` | 否 | `"unclosed"` | 状态，默认是unclosed<br>可选值：allstory（全部）；assignedtome（指派给我）；openedbyme（我创建）；reviewbyme（待我评审）；draftstory（草稿） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-epic-create"></a>

#### `zentao epic create` · 创建业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic create --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 产品ID<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | title |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父业务需求<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 业务需求描述 |
| `--category` | 请求体 | `number` | 否 | 未声明 | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>格式：int32<br>必须为整数 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他) |
| `--verify` | 请求体 | `string` | 否 | 未声明 | 验收标准 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人员，如果无需评审则不传<br>数组元素类型：string |
| `--status` | 请求体 | `string` | 否 | 未声明 | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-epic-get"></a>

#### `zentao epic get` · 获取业务需求详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic get --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-epic-update"></a>

#### `zentao epic update` · 修改业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic update --storyID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--title` | 请求体 | `string` | 是 | 未声明 | 需求名称 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父业务需求<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--category` | 请求体 | `number` | 否 | 未声明 | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>格式：int32<br>必须为整数 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他) |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-epic-delete"></a>

#### `zentao epic delete` · 删除业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic delete --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-epic-activate"></a>

#### `zentao epic activate` · 激活业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic activate --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-epic-change"></a>

#### `zentao epic change` · 变更业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic change --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--title` | 请求体 | `string` | 否 | 未声明 | 需求名称 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人员，如果无需评审则不传<br>数组元素类型：string |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--verify` | 请求体 | `string` | 否 | 未声明 | 验收标准 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-epic-close"></a>

#### `zentao epic close` · 关闭业务需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao epic close --storyID=<number> --closedReason=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--closedReason` | 请求体 | `string` | 是 | 未声明 | 关闭原因(done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此) |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-requirement"></a>

### requirement · 用户需求

用户需求管理，支持获取用户需求列表，支持获取产品下的用户需求、创建用户需求、获取用户需求详情、修改用户需求、删除用户需求、激活用户需求、变更用户需求、关闭用户需求

快捷用法与字段查询：

```text
zentao requirement <id>
zentao requirement [列表参数]
zentao requirement props --format=json
zentao help requirement
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-requirement-list) | 获取用户需求列表，支持获取产品下的用户需求 |
| [create](#action-requirement-create) | 创建用户需求 |
| [get](#action-requirement-get) | 获取用户需求详情 |
| [update](#action-requirement-update) | 修改用户需求 |
| [delete](#action-requirement-delete) | 删除用户需求 |
| [activate](#action-requirement-activate) | 激活用户需求 |
| [change](#action-requirement-change) | 变更用户需求 |
| [close](#action-requirement-close) | 关闭用户需求 |

<a id="action-requirement-list"></a>

#### `zentao requirement list` · 获取用户需求列表，支持获取产品下的用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--browseType` | 查询 | `string` | 否 | `"unclosed"` | 状态，默认是unclosed<br>可选值：allstory（全部）；assignedtome（指派给我）；openedbyme（我创建）；reviewbyme（待我评审）；draftstory（草稿） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-requirement-create"></a>

#### `zentao requirement create` · 创建用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement create --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 产品ID<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | title |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父用户需求<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 用户需求描述 |
| `--category` | 请求体 | `number` | 否 | 未声明 | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>格式：int32<br>必须为整数 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他) |
| `--verify` | 请求体 | `string` | 否 | 未声明 | 验收标准 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人员，如果无需评审则不传<br>数组元素类型：string |
| `--status` | 请求体 | `string` | 否 | 未声明 | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-requirement-get"></a>

#### `zentao requirement get` · 获取用户需求详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement get --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-requirement-update"></a>

#### `zentao requirement update` · 修改用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement update --storyID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--title` | 请求体 | `string` | 是 | 未声明 | title |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父用户需求<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--category` | 请求体 | `number` | 否 | 未声明 | 类别(feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)<br>格式：int32<br>必须为整数 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他) |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-requirement-delete"></a>

#### `zentao requirement delete` · 删除用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement delete --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-requirement-activate"></a>

#### `zentao requirement activate` · 激活用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement activate --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-requirement-change"></a>

#### `zentao requirement change` · 变更用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement change --storyID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--title` | 请求体 | `string` | 否 | 未声明 | 需求名称 |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--verify` | 请求体 | `string` | 否 | 未声明 | 验收标准 |
| `--reviewer` | 请求体 | `string[]` | 否 | 未声明 | 评审人员，如果无需评审则不传<br>数组元素类型：string |
| `--status` | 请求体 | `string` | 否 | 未声明 | 无有效评审人时默认 active，可显式指定状态；有有效评审人时固定为 reviewing。 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-requirement-close"></a>

#### `zentao requirement close` · 关闭用户需求

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao requirement close --storyID=<number> --closedReason=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--storyID` | 路径 | `number` | 是 | 未声明 | 需求ID |
| `--closedReason` | 请求体 | `string` | 是 | 未声明 | 关闭原因(done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此) |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--storyID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-bug"></a>

### bug · Bug

Bug管理，支持获取Bug列表，支持获取项目/产品/执行下的Bug、产品的Bug模块树、创建Bug、获取Bug详情、修改Bug、修改Bug模块、删除Bug、删除Bug模块、激活Bug、关闭Bug、确认Bug、解决Bug

快捷用法与字段查询：

```text
zentao bug <id>
zentao bug [列表参数]
zentao bug props --format=json
zentao help bug
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-bug-list) | 获取Bug列表，支持获取项目/产品/执行下的Bug |
| [modules](#action-bug-modules) | 产品的Bug模块树 |
| [create](#action-bug-create) | 创建Bug |
| [get](#action-bug-get) | 获取Bug详情 |
| [update](#action-bug-update) | 修改Bug |
| [updateModule](#action-bug-updatemodule) | 修改Bug模块 |
| [delete](#action-bug-delete) | 删除Bug |
| [deleteModule](#action-bug-deletemodule) | 删除Bug模块 |
| [activate](#action-bug-activate) | 激活Bug |
| [close](#action-bug-close) | 关闭Bug |
| [confirm](#action-bug-confirm) | 确认Bug |
| [resolve](#action-bug-resolve) | 解决Bug |

<a id="action-bug-list"></a>

#### `zentao bug list` · 获取Bug列表，支持获取项目/产品/执行下的Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--product=<id>`（产品）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | Bug所属范围<br>可选值：projects（项目）；products（产品）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 状态 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active 激活 \| resolved 已解决 \| closed 已关闭)；confirmed(是否确认，枚举：1 已确认 \| 0 未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1 \| 2 \| 3 \| 4)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；type(Bug类型，枚举：codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| codeimprovement 代码改进 \| others 其他)；os(操作系统，枚举：all 全部 \| windows Windows \| win11 Windows 11 \| win10 Windows 10 \| win8 Windows 8 \| win7 Windows 7 \| winxp Windows XP \| osx Mac OS \| android Android \| ios IOS \| linux Linux \| ubuntu Ubuntu \| chromeos Chrome OS \| fedora Fedora \| unix Unix \| others 其他)；browser(浏览器，枚举：all 全部 \| chrome Chrome \| edge Edge \| ie IE系列 \| ie11 IE11 \| ie10 IE10 \| ie9 IE9 \| ie8 IE8 \| firefox firefox系列 \| opera Opera系列 \| safari \| 360 360浏览器 \| qq QQ浏览器 \| other 其他)；resolution(解决方案，枚举：bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因 \| fixed 已解决 \| notrepro 无法重现 \| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-modules"></a>

#### `zentao bug modules` · 产品的Bug模块树

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao bug modules --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-create"></a>

#### `zentao bug create` · 创建Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug create --productID=<number> --title=<string> --openedBuild=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | Bug标题 |
| `--openedBuild` | 请求体 | `string[]` | 是 | 未声明 | 影响版本,主干是trunk，其他版本使用版本ID<br>数组元素类型：string |
| `--project` | 请求体 | `number` | 否 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--severity` | 请求体 | `number` | 否 | 未声明 | 严重程度，默认是3<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他) |
| `--steps` | 请求体 | `string` | 否 | 未声明 | 重现步骤 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |

可用 `--product` 代替 `--productID`；平铺参数同时提供两者时必须指定同一个产品。`--data` 内的 `productID` 仍优先，最终产品 ID 会同时发送到查询串和请求体。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-get"></a>

#### `zentao bug get` · 获取Bug详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug get --bugID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-update"></a>

#### `zentao bug update` · 修改Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug update --bugID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |
| `--title` | 请求体 | `string` | 否 | 未声明 | Bug标题 |
| `--severity` | 请求体 | `number` | 否 | 未声明 | 严重程度，默认是3<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他) |
| `--openedBuild` | 请求体 | `string[]` | 否 | 未声明 | 影响版本,主干是trunk，其他版本使用版本ID<br>数组元素类型：string |
| `--steps` | 请求体 | `string` | 否 | 未声明 | 重现步骤 |
| `--project` | 请求体 | `number` | 否 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-bug-updatemodule"></a>

#### `zentao bug updateModule` · 修改Bug模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao bug updateModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-bug-delete"></a>

#### `zentao bug delete` · 删除Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug delete --bugID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-deletemodule"></a>

#### `zentao bug deleteModule` · 删除Bug模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao bug deleteModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-activate"></a>

#### `zentao bug activate` · 激活Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug activate --bugID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |
| `--openedBuild` | 请求体 | `string[]` | 否 | 未声明 | 影响版本, trunk为主干<br>数组元素类型：string |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-close"></a>

#### `zentao bug close` · 关闭Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug close --bugID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-confirm"></a>

#### `zentao bug confirm` · 确认Bug

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao bug confirm --bugID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--type` | 请求体 | `string` | 否 | 未声明 | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他) |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，默认是3<br>格式：int32<br>必须为整数 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态 |
| `--mailto` | 请求体 | `string[]` | 否 | 未声明 | 抄送给<br>数组元素类型：string |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-bug-resolve"></a>

#### `zentao bug resolve` · 解决Bug

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao bug resolve --bugID=<number> --resolution=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--bugID` | 路径 | `number` | 是 | 未声明 | Bug ID |
| `--resolution` | 请求体 | `string` | 是 | 未声明 | fixed 已解决 \| notrepro 无法重现 \| bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因\| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为需求 |
| `--resolvedDate` | 请求体 | `string` | 否 | 未声明 | 解决日期，默认今天 |
| `--resolvedBuild` | 请求体 | `string` | 否 | 未声明 | 解决版本, trunk为主干 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--bugID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-testcase"></a>

### testcase · 测试用例

测试用例管理，支持获取测试用例列表，支持获取产品/项目/执行下的测试用例、产品的用例模块树、创建测试用例、获取测试用例详情、修改测试用例、修改用例模块、删除测试用例、删除用例模块

快捷用法与字段查询：

```text
zentao testcase <id>
zentao testcase [列表参数]
zentao testcase props --format=json
zentao help testcase
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-testcase-list) | 获取测试用例列表，支持获取产品/项目/执行下的测试用例 |
| [modules](#action-testcase-modules) | 产品的用例模块树 |
| [create](#action-testcase-create) | 创建测试用例 |
| [get](#action-testcase-get) | 获取测试用例详情 |
| [update](#action-testcase-update) | 修改测试用例 |
| [updateModule](#action-testcase-updatemodule) | 修改用例模块 |
| [delete](#action-testcase-delete) | 删除测试用例 |
| [deleteModule](#action-testcase-deletemodule) | 删除用例模块 |

<a id="action-testcase-list"></a>

#### `zentao testcase list` · 获取测试用例列表，支持获取产品/项目/执行下的测试用例

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testcase list --product=<id> [选项]
```

范围必填：用法中以 `--product` 为例，也可从 `--product=<id>`（产品）、`--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 测试用例所属范围<br>可选值：products（产品）；projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；wait（未关闭）；needconfirm（需求变动） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)；auto(自动化，枚举：auto 是 \| no 否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait 待评审 \| normal 正常 \| blocked 被阻塞 \| investigate 研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest 单元测试环节 \| feature 功能测试环节 \| intergrate 集成测试环节 \| system 系统测试环节 \| smoke 冒烟测试环节 \| bvt 版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 \| 1 \| 2 \| 4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass 通过 \| fail 失败 \| blocked 阻塞 \| null 未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-testcase-modules"></a>

#### `zentao testcase modules` · 产品的用例模块树

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao testcase modules --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-testcase-create"></a>

#### `zentao testcase create` · 创建测试用例

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testcase create --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 用例标题 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 用例类型(unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他) |
| `--precondition` | 请求体 | `string` | 否 | 未声明 | 前置条件 |
| `--steps` | 请求体 | `string[]` | 否 | 未声明 | 用例步骤, 如果是嵌套用例，可以通过key表示嵌套关系 {"1": "分组1", "1.1": "子分组1.1", "1.1.1": "步骤1.1.1"}<br>数组元素类型：string |
| `--expects` | 请求体 | `string[]` | 否 | 未声明 | 用例步骤期望, 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "", "1.1": "", "1.1.1": "步骤1.1.1的期望"}<br>数组元素类型：string |
| `--stepType` | 请求体 | `string[]` | 否 | 未声明 | 用例步骤类型(step 步骤 \| group 父级步骤), 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "group", "1.1": "group", "1.1.1": "step"}<br>数组元素类型：string |
| `--project` | 请求体 | `number` | 否 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-testcase-get"></a>

#### `zentao testcase get` · 获取测试用例详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testcase get --caseID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--caseID` | 路径 | `number` | 是 | 未声明 | 测试用例ID |

`--caseID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-testcase-update"></a>

#### `zentao testcase update` · 修改测试用例

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testcase update --caseID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--caseID` | 路径 | `number` | 是 | 未声明 | 测试用例ID |
| `--title` | 请求体 | `string` | 是 | 未声明 | 用例标题 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 用例类型(unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他) |
| `--precondition` | 请求体 | `string` | 否 | 未声明 | 前置条件 |
| `--steps` | 请求体 | `string[]` | 否 | 未声明 | 用例步骤, 如果是嵌套用例，可以通过key表示嵌套关系 {"1": "分组1", "1.1": "子分组1.1", "1.1.1": "步骤1.1.1"}<br>数组元素类型：string |
| `--expects` | 请求体 | `string[]` | 否 | 未声明 | 用例步骤期望, 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "", "1.1": "", "1.1.1": "步骤1.1.1的期望"}<br>数组元素类型：string |
| `--stepType` | 请求体 | `string[]` | 否 | 未声明 | 用例步骤类型(step 步骤 \| group 父级步骤), 如果是嵌套用例步骤，可以通过key表示嵌套关系 {"1": "group", "1.1": "group", "1.1.1": "step"}<br>数组元素类型：string |

`--caseID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-testcase-updatemodule"></a>

#### `zentao testcase updateModule` · 修改用例模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao testcase updateModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-testcase-delete"></a>

#### `zentao testcase delete` · 删除测试用例

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testcase delete --caseID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--caseID` | 路径 | `number` | 是 | 未声明 | 测试用例ID |

`--caseID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-testcase-deletemodule"></a>

#### `zentao testcase deleteModule` · 删除用例模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao testcase deleteModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-task"></a>

### task · 任务

任务管理，支持获取任务列表，支持获取执行下的任务、执行的任务模块树、创建任务、获取任务详情、修改任务、修改任务模块、删除任务、删除任务模块、激活任务、关闭任务、完成任务、启动任务

快捷用法与字段查询：

```text
zentao task <id>
zentao task [列表参数]
zentao task props --format=json
zentao help task
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-task-list) | 获取任务列表，支持获取执行下的任务 |
| [modules](#action-task-modules) | 执行的任务模块树 |
| [create](#action-task-create) | 创建任务 |
| [get](#action-task-get) | 获取任务详情 |
| [update](#action-task-update) | 修改任务 |
| [updateModule](#action-task-updatemodule) | 修改任务模块 |
| [delete](#action-task-delete) | 删除任务 |
| [deleteModule](#action-task-deletemodule) | 删除任务模块 |
| [activate](#action-task-activate) | 激活任务 |
| [close](#action-task-close) | 关闭任务 |
| [finish](#action-task-finish) | 完成任务 |
| [start](#action-task-start) | 启动任务 |

<a id="action-task-list"></a>

#### `zentao task list` · 获取任务列表，支持获取执行下的任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task list --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 所属执行ID |
| `--browseType` | 查询 | `string` | 否 | `"unclosed"` | 状态，默认是unclosed<br>可选值：all（全部）；unclosed（未关闭）；assignedtome（指派给我）；assignedtome（指派给我）；myinvolved（由我参与）；assignedbyme（由我指派） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-modules"></a>

#### `zentao task modules` · 执行的任务模块树

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao task modules --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-create"></a>

#### `zentao task create` · 创建任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task create --name=<string> --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 任务名称 |
| `--executionID` | 请求体 | `number` | 是 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 任务类型 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--estStarted` | 请求体 | `string` | 否 | 未声明 | 预计开始 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 任务描述 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父任务<br>格式：int32<br>必须为整数 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-get"></a>

#### `zentao task get` · 获取任务详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task get --taskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-update"></a>

#### `zentao task update` · 修改任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task update --taskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 任务名称 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 任务类型 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--estStarted` | 请求体 | `string` | 否 | 未声明 | 预计开始 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--estimate` | 请求体 | `number` | 否 | 未声明 | 预计工时<br>格式：float |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--story` | 请求体 | `number` | 否 | 未声明 | 相关需求<br>格式：int32<br>必须为整数 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 任务描述 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父任务<br>格式：int32<br>必须为整数 |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-task-updatemodule"></a>

#### `zentao task updateModule` · 修改任务模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao task updateModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 模块名称 |
| `--parent` | 请求体 | `number` | 否 | 未声明 | 父模块<br>格式：int32<br>必须为整数 |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-task-delete"></a>

#### `zentao task delete` · 删除任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task delete --taskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-deletemodule"></a>

#### `zentao task deleteModule` · 删除任务模块

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao task deleteModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-activate"></a>

#### `zentao task activate` · 激活任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task activate --taskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |
| `--left` | 请求体 | `number` | 否 | 未声明 | 预计剩余<br>格式：float |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-close"></a>

#### `zentao task close` · 关闭任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task close --taskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-finish"></a>

#### `zentao task finish` · 完成任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task finish --taskID=<number> --currentConsumed=<number> --realStarted=<string> --finishedDate=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |
| `--currentConsumed` | 请求体 | `number` | 是 | 未声明 | 本次消耗<br>格式：float |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--consumed` | 请求体 | `number` | 否 | 未声明 | 总计消耗<br>格式：float |
| `--realStarted` | 请求体 | `string` | 是 | 未声明 | 实际开始，精确到秒 |
| `--finishedDate` | 请求体 | `string` | 是 | 未声明 | 实际完成，精确到秒 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-task-start"></a>

#### `zentao task start` · 启动任务

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao task start --taskID=<number> --realStarted=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--taskID` | 路径 | `number` | 是 | 未声明 | 任务ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 任务名称 |
| `--realStarted` | 请求体 | `string` | 是 | 未声明 | 实际开始，精确到秒 |
| `--consumed` | 请求体 | `number` | 否 | 未声明 | 总计消耗<br>格式：float |
| `--left` | 请求体 | `number` | 否 | 未声明 | 预计剩余<br>格式：float |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--taskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-issue"></a>

### issue · 问题

问题管理，支持获取问题列表、获取项目问题列表、获取执行问题列表、创建问题、获取问题详情

快捷用法与字段查询：

```text
zentao issue <id>
zentao issue [列表参数]
zentao issue props --format=json
zentao help issue
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-issue-list) | 获取问题列表 |
| [projectIssues](#action-issue-projectissues) | 获取项目问题列表 |
| [executionIssues](#action-issue-executionissues) | 获取执行问题列表 |
| [create](#action-issue-create) | 创建问题 |
| [get](#action-issue-get) | 获取问题详情 |

<a id="action-issue-list"></a>

#### `zentao issue list` · 获取问题列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao issue list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；open（开放）；assignto（指派给我）；assignby（由我指派）；closed（已关闭）；resolved（已解决）；canceled（已取消） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；severity_asc（严重程度 升序）；severity_desc（严重程度 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-issue-projectissues"></a>

#### `zentao issue projectIssues` · 获取项目问题列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao issue projectIssues --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；open（开放）；assignto（指派给我）；assignby（由我指派）；closed（已关闭）；resolved（已解决）；canceled（已取消） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；severity_asc（严重程度 升序）；severity_desc（严重程度 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-issue-executionissues"></a>

#### `zentao issue executionIssues` · 获取执行问题列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao issue executionIssues --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；open（开放）；assignto（指派给我）；assignby（由我指派）；closed（已关闭）；resolved（已解决）；canceled（已取消） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；severity_asc（严重程度 升序）；severity_desc（严重程度 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,closedBy,closedDate,createdBy,createdDate,editedBy,editedDate,execution,id,pri,project,severity,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-issue-create"></a>

#### `zentao issue create` · 创建问题

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao issue create --objectID=<number> --title=<string> --type=<string> --severity=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--objectID` | 请求体 | `number` | 是 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--from` | 请求体 | `number` | 否 | 未声明 | 来源，0 表示直接创建<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 问题名称 |
| `--type` | 请求体 | `string` | 是 | 未声明 | 类型(design 设计问题 \| code 程序缺陷 \| performance 性能问题 \| version 版本控制 \| storyadd 需求新增 \| storychanged 需求修改 \| storyremoved 需求删除 \| data 数据问题) |
| `--severity` | 请求体 | `number` | 是 | 未声明 | 严重程度(1 严重 \| 2 较严重 \| 3 较小 \| 4 建议)<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级(1-4)<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--owner` | 请求体 | `string` | 否 | 未声明 | 提出人 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 计划解决日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-issue-get"></a>

#### `zentao issue get` · 获取问题详情

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao issue get --issueID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--issueID` | 路径 | `number` | 是 | 未声明 | 问题ID |

`--issueID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="module-risk"></a>

### risk · 风险

风险管理，支持获取风险列表、获取项目风险列表、获取执行风险列表、创建风险、获取风险详情、修改风险

快捷用法与字段查询：

```text
zentao risk <id>
zentao risk [列表参数]
zentao risk props --format=json
zentao help risk
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-risk-list) | 获取风险列表 |
| [projectRisks](#action-risk-projectrisks) | 获取项目风险列表 |
| [executionRisks](#action-risk-executionrisks) | 获取执行风险列表 |
| [create](#action-risk-create) | 创建风险 |
| [get](#action-risk-get) | 获取风险详情 |
| [update](#action-risk-update) | 修改风险 |

<a id="action-risk-list"></a>

#### `zentao risk list` · 获取风险列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao risk list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；active（开放）；assignTo（指派给我）；assignBy（由我指派）；closed（已关闭）；hangup（已挂起）；canceled（已取消） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序）；pri_asc（优先级 升序）；pri_desc（优先级 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-risk-projectrisks"></a>

#### `zentao risk projectRisks` · 获取项目风险列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao risk projectRisks --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；active（开放）；assignTo（指派给我）；assignBy（由我指派）；closed（已关闭）；hangup（已挂起）；canceled（已取消） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序）；pri_asc（优先级 升序）；pri_desc（优先级 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-risk-executionrisks"></a>

#### `zentao risk executionRisks` · 获取执行风险列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao risk executionRisks --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；active（开放）；assignTo（指派给我）；assignBy（由我指派）；closed（已关闭）；hangup（已挂起）；canceled（已取消） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序）；pri_asc（优先级 升序）；pri_desc（优先级 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-risk-create"></a>

#### `zentao risk create` · 创建风险

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao risk create --project=<number> --name=<string> --impact=<number> --probability=<number> --pri=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--project` | 请求体 | `number` | 是 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 风险名称 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(business 业务部门 \| team 项目组 \| logistic 项目保障科室 \| manage 管理层 \| sourcing 供应商-采购 \| outsourcing 供应商-外包 \| customer 外部客户 \| others 其他) |
| `--category` | 请求体 | `string` | 否 | 未声明 | 类型(technical 技术类 \| manage 管理类 \| business 业务类 \| requirement 需求类 \| resource 资源类 \| others 其他) |
| `--strategy` | 请求体 | `string` | 否 | 未声明 | 策略(avoidance 规避 \| mitigation 缓解 \| transference 转移 \| acceptance 接受) |
| `--impact` | 请求体 | `number` | 是 | 未声明 | 影响程度(1-5)<br>格式：int32<br>必须为整数 |
| `--probability` | 请求体 | `number` | 是 | 未声明 | 发生概率(1-5)<br>格式：int32<br>必须为整数 |
| `--rate` | 请求体 | `number` | 否 | 未声明 | 风险系数<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 是 | 未声明 | 优先级(1 高 \| 2 中 \| 3 低)<br>格式：int32<br>必须为整数 |
| `--identifiedDate` | 请求体 | `string` | 否 | 未声明 | 识别日期 |
| `--plannedClosedDate` | 请求体 | `string` | 否 | 未声明 | 计划关闭日期 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--prevention` | 请求体 | `string` | 否 | 未声明 | 应对措施 |
| `--remedy` | 请求体 | `string` | 否 | 未声明 | 响应措施 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-risk-get"></a>

#### `zentao risk get` · 获取风险详情

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao risk get --riskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--riskID` | 路径 | `number` | 是 | 未声明 | 风险ID |

`--riskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-risk-update"></a>

#### `zentao risk update` · 修改风险

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao risk update --riskID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--riskID` | 路径 | `number` | 是 | 未声明 | 风险ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 风险名称 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源(business 业务部门 \| team 项目组 \| logistic 项目保障科室 \| manage 管理层 \| sourcing 供应商-采购 \| outsourcing 供应商-外包 \| customer 外部客户 \| others 其他) |
| `--category` | 请求体 | `string` | 否 | 未声明 | 类型(technical 技术类 \| manage 管理类 \| business 业务类 \| requirement 需求类 \| resource 资源类 \| others 其他) |
| `--strategy` | 请求体 | `string` | 否 | 未声明 | 策略(avoidance 规避 \| mitigation 缓解 \| transference 转移 \| acceptance 接受) |
| `--impact` | 请求体 | `number` | 否 | 未声明 | 影响程度(1-5)<br>格式：int32<br>必须为整数 |
| `--probability` | 请求体 | `number` | 否 | 未声明 | 发生概率(1-5)<br>格式：int32<br>必须为整数 |
| `--rate` | 请求体 | `number` | 否 | 未声明 | 风险系数<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级(1 高 \| 2 中 \| 3 低)<br>格式：int32<br>必须为整数 |
| `--identifiedDate` | 请求体 | `string` | 否 | 未声明 | 识别日期 |
| `--plannedClosedDate` | 请求体 | `string` | 否 | 未声明 | 计划关闭日期 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--prevention` | 请求体 | `string` | 否 | 未声明 | 应对措施 |
| `--remedy` | 请求体 | `string` | 否 | 未声明 | 响应措施 |
| `--resolution` | 请求体 | `string` | 否 | 未声明 | 解决措施 |

`--riskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="module-meeting"></a>

### meeting · 会议

会议管理，支持获取会议列表、获取项目会议列表、获取执行会议列表、创建会议、获取会议详情、修改会议、删除会议、编辑会议纪要

快捷用法与字段查询：

```text
zentao meeting <id>
zentao meeting [列表参数]
zentao meeting props --format=json
zentao help meeting
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-meeting-list) | 获取会议列表 |
| [projectMeetings](#action-meeting-projectmeetings) | 获取项目会议列表 |
| [executionMeetings](#action-meeting-executionmeetings) | 获取执行会议列表 |
| [create](#action-meeting-create) | 创建会议 |
| [get](#action-meeting-get) | 获取会议详情 |
| [update](#action-meeting-update) | 修改会议 |
| [delete](#action-meeting-delete) | 删除会议 |
| [minutes](#action-meeting-minutes) | 编辑会议纪要 |

<a id="action-meeting-list"></a>

#### `zentao meeting list` · 获取会议列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；booked（我预约的）；participate（我参加的） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；date_asc（日期 升序）；date_desc（日期 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-meeting-projectmeetings"></a>

#### `zentao meeting projectMeetings` · 获取项目会议列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting projectMeetings --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；booked（我预约的）；participate（我参加的） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；date_asc（日期 升序）；date_desc（日期 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-meeting-executionmeetings"></a>

#### `zentao meeting executionMeetings` · 获取执行会议列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting executionMeetings --executionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；booked（我预约的）；participate（我参加的） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；date_asc（日期 升序）；date_desc（日期 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：begin,createdBy,createdDate,date,dept,editedBy,editedDate,end,execution,host,id,minutedBy,minutedDate,mode,name,project,room |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-meeting-create"></a>

#### `zentao meeting create` · 创建会议

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting create --project=<number> --name=<string> --begin=<string> --end=<string> --mode=<string> --host=<string> --participant=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--project` | 请求体 | `number` | 是 | 未声明 | 所属项目<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 会议名称 |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始时间 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束时间 |
| `--mode` | 请求体 | `string` | 是 | 未声明 | 会议模式(online 线上 \| outline 线下 \| both 线上+线下) |
| `--host` | 请求体 | `string` | 是 | 未声明 | 主持人 |
| `--participant` | 请求体 | `string[]` | 是 | 未声明 | 参会人员<br>数组元素类型：string |
| `--room` | 请求体 | `number` | 否 | 未声明 | 会议室<br>格式：int32<br>必须为整数 |
| `--dept` | 请求体 | `number` | 否 | 未声明 | 所属部门<br>格式：int32<br>必须为整数 |
| `--objectType` | 请求体 | `string` | 否 | 未声明 | 关联类型(story \| task \| bug \| issue \| risk \| opportunity) |
| `--objectID` | 请求体 | `number` | 否 | 未声明 | 关联对象<br>格式：int32<br>必须为整数 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-meeting-get"></a>

#### `zentao meeting get` · 获取会议详情

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting get --meetingID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--meetingID` | 路径 | `number` | 是 | 未声明 | 会议ID |

`--meetingID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-meeting-update"></a>

#### `zentao meeting update` · 修改会议

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting update --meetingID=<number> --name=<string> --begin=<string> --end=<string> --mode=<string> --host=<string> --participant=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--meetingID` | 路径 | `number` | 是 | 未声明 | 会议ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 会议名称 |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始时间 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束时间 |
| `--mode` | 请求体 | `string` | 是 | 未声明 | 会议模式(online 线上 \| outline 线下 \| both 线上+线下) |
| `--host` | 请求体 | `string` | 是 | 未声明 | 主持人 |
| `--participant` | 请求体 | `string[]` | 是 | 未声明 | 参会人员<br>数组元素类型：string |
| `--room` | 请求体 | `number` | 否 | 未声明 | 会议室<br>格式：int32<br>必须为整数 |
| `--dept` | 请求体 | `number` | 否 | 未声明 | 所属部门<br>格式：int32<br>必须为整数 |
| `--objectType` | 请求体 | `string` | 否 | 未声明 | 关联类型(story \| task \| bug \| issue \| risk \| opportunity) |
| `--objectID` | 请求体 | `number` | 否 | 未声明 | 关联对象<br>格式：int32<br>必须为整数 |

`--meetingID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-meeting-delete"></a>

#### `zentao meeting delete` · 删除会议

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting delete --meetingID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--meetingID` | 路径 | `number` | 是 | 未声明 | 会议ID |

`--meetingID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-meeting-minutes"></a>

#### `zentao meeting minutes` · 编辑会议纪要

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao meeting minutes --meetingID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--meetingID` | 路径 | `number` | 是 | 未声明 | 会议ID |
| `--minutes` | 请求体 | `string` | 否 | 未声明 | 会议纪要 |

`--meetingID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-feedback"></a>

### feedback · 反馈

反馈管理，支持获取反馈列表，支持获取产品下的反馈、创建反馈、反馈转Bug、反馈转工单、反馈转待办、反馈转需求、反馈转任务、获取反馈详情、修改反馈、删除反馈、激活反馈、关闭反馈

快捷用法与字段查询：

```text
zentao feedback <id>
zentao feedback [列表参数]
zentao feedback props --format=json
zentao help feedback
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-feedback-list) | 获取反馈列表，支持获取产品下的反馈 |
| [create](#action-feedback-create) | 创建反馈 |
| [createBug](#action-feedback-createbug) | 反馈转Bug |
| [createTicket](#action-feedback-createticket) | 反馈转工单 |
| [createTodo](#action-feedback-createtodo) | 反馈转待办 |
| [createStory](#action-feedback-createstory) | 反馈转需求 |
| [createTask](#action-feedback-createtask) | 反馈转任务 |
| [get](#action-feedback-get) | 获取反馈详情 |
| [update](#action-feedback-update) | 修改反馈 |
| [delete](#action-feedback-delete) | 删除反馈 |
| [activate](#action-feedback-activate) | 激活反馈 |
| [close](#action-feedback-close) | 关闭反馈 |

<a id="action-feedback-list"></a>

#### `zentao feedback list` · 获取反馈列表，支持获取产品下的反馈

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--browseType` | 查询 | `string` | 否 | `"wait"` | 状态，默认是wait<br>可选值：all（全部）；wait（待处理）；doing（处理中）；toclosed（待关闭）；review（待评审）；assigntome（指派给我）；openedbyme（由我反馈） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-create"></a>

#### `zentao feedback create` · 创建反馈

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback create --product=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--product` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 标题 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(story 需求 \| task 任务 \| bug Bug \| todo 待办 \| advice 建议 \| issue 问题 \| risk 风险 \| opportunity 机会) |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |
| `--feedbackBy` | 请求体 | `string` | 否 | 未声明 | 反馈者 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-createbug"></a>

#### `zentao feedback createBug` · 反馈转Bug

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao feedback createBug --feedbackID=<number> --productID=<number> --title=<string> --openedBuild=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | Bug标题 |
| `--openedBuild` | 请求体 | `string[]` | 是 | 未声明 | 影响版本，主干是trunk，其他版本使用版本ID<br>数组元素类型：string |
| `--severity` | 请求体 | `number` | 否 | 未声明 | 严重程度(1-4)<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他) |
| `--steps` | 请求体 | `string` | 否 | 未声明 | 重现步骤 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-createticket"></a>

#### `zentao feedback createTicket` · 反馈转工单

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao feedback createTicket --feedbackID=<number> --product=<number> --module=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--product` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 是 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 工单标题 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(code 程序报错 \| data 数据错误 \| stuck 流程卡断 \| security 安全问题 \| affair 事务) |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 工单描述 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-createtodo"></a>

#### `zentao feedback createTodo` · 反馈转待办

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao feedback createTodo --feedbackID=<number> --date=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--date` | 请求体 | `string` | 是 | 未声明 | 日期 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 待办名称 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-createstory"></a>

#### `zentao feedback createStory` · 反馈转需求

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao feedback createStory --feedbackID=<number> --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 需求标题 |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--category` | 请求体 | `string` | 否 | 未声明 | 类别 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-createtask"></a>

#### `zentao feedback createTask` · 反馈转任务

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao feedback createTask --feedbackID=<number> --executionID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--executionID` | 请求体 | `number` | 是 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 任务名称 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 任务类型 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--estStarted` | 请求体 | `string` | 否 | 未声明 | 预计开始 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 任务描述 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-get"></a>

#### `zentao feedback get` · 获取反馈详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback get --feedbackID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-update"></a>

#### `zentao feedback update` · 修改反馈

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback update --feedbackID=<number> --product=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--product` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 标题 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(story 需求 \| task 任务 \| bug Bug \| todo 待办 \| advice 建议 \| issue 问题 \| risk 风险 \| opportunity 机会) |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |
| `--feedbackBy` | 请求体 | `string` | 否 | 未声明 | 反馈者 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 来源 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-feedback-delete"></a>

#### `zentao feedback delete` · 删除反馈

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback delete --feedbackID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-activate"></a>

#### `zentao feedback activate` · 激活反馈

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback activate --feedbackID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-feedback-close"></a>

#### `zentao feedback close` · 关闭反馈

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao feedback close --feedbackID=<number> --closedReason=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--feedbackID` | 路径 | `number` | 是 | 未声明 | 反馈ID |
| `--closedReason` | 请求体 | `string` | 是 | 未声明 | 关闭原因(commented 已处理 \| repeat 重复 \| refuse 不予采纳) |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |
| `--confirmClose` | 请求体 | `string` | 否 | 未声明 | 存在未关闭转化对象时是否强制关闭 |

`--feedbackID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-ticket"></a>

### ticket · 工单

工单管理，支持获取工单列表，支持获取产品下的工单、创建工单、工单转需求、工单转Bug、获取工单详情、修改工单、删除工单、激活工单、关闭工单

快捷用法与字段查询：

```text
zentao ticket <id>
zentao ticket [列表参数]
zentao ticket props --format=json
zentao help ticket
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-ticket-list) | 获取工单列表，支持获取产品下的工单 |
| [create](#action-ticket-create) | 创建工单 |
| [createStory](#action-ticket-createstory) | 工单转需求 |
| [createBug](#action-ticket-createbug) | 工单转Bug |
| [get](#action-ticket-get) | 获取工单详情 |
| [update](#action-ticket-update) | 修改工单 |
| [delete](#action-ticket-delete) | 删除工单 |
| [activate](#action-ticket-activate) | 激活工单 |
| [close](#action-ticket-close) | 关闭工单 |

<a id="action-ticket-list"></a>

#### `zentao ticket list` · 获取工单列表，支持获取产品下的工单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--browseType` | 查询 | `string` | 否 | `"wait"` | 状态，默认是wait<br>可选值：all（全部）；unclosed（未关闭）；wait（待处理）；doing（处理中）；done（待关闭）；finishedbyme（由我解决）；assigntome（指派给我）；openedbyme（由我创建） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedCount,activatedDate,assignedTo,closedBy,closedDate,closedReason,contact,customer,deadline,desc,editedBy,editedDate,feedback,id,keywords,mailto,module,notifyEmail,openedBuild,openedBy,openedDate,pri,product,resolution,resolvedBy,resolvedDate,startedBy,startedDate,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-create"></a>

#### `zentao ticket create` · 创建工单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket create --product=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--product` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 标题 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(code 程序报错 \| data 数据错误 \| stuck 流程卡断 \| security 安全问题 \| affair 事务) |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--openedBuild` | 请求体 | `string[]` | 否 | 未声明 | 影响版本<br>数组元素类型：string |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-createstory"></a>

#### `zentao ticket createStory` · 工单转需求

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao ticket createStory --ticketID=<number> --productID=<number> --title=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 需求标题 |
| `--spec` | 请求体 | `string` | 否 | 未声明 | 需求描述 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--category` | 请求体 | `string` | 否 | 未声明 | 类别 |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-createbug"></a>

#### `zentao ticket createBug` · 工单转Bug

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao ticket createBug --ticketID=<number> --productID=<number> --title=<string> --openedBuild=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | Bug标题 |
| `--openedBuild` | 请求体 | `string[]` | 是 | 未声明 | 影响版本，主干是trunk，其他版本使用版本ID<br>数组元素类型：string |
| `--severity` | 请求体 | `number` | 否 | 未声明 | 严重程度(1-4)<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | Bug类型(codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| others 其他) |
| `--steps` | 请求体 | `string` | 否 | 未声明 | 重现步骤 |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-get"></a>

#### `zentao ticket get` · 获取工单详情

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket get --ticketID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-update"></a>

#### `zentao ticket update` · 修改工单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket update --ticketID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |
| `--product` | 请求体 | `number` | 否 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--module` | 请求体 | `number` | 否 | 未声明 | 所属模块<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 否 | 未声明 | 标题 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 类型(code 程序报错 \| data 数据错误 \| stuck 流程卡断 \| security 安全问题 \| affair 事务) |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 截止日期 |
| `--openedBuild` | 请求体 | `string[]` | 否 | 未声明 | 影响版本<br>数组元素类型：string |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-ticket-delete"></a>

#### `zentao ticket delete` · 删除工单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket delete --ticketID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-activate"></a>

#### `zentao ticket activate` · 激活工单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket activate --ticketID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 备注 |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-ticket-close"></a>

#### `zentao ticket close` · 关闭工单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao ticket close --ticketID=<number> --closedReason=<string> --comment=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ticketID` | 路径 | `number` | 是 | 未声明 | 工单ID |
| `--closedReason` | 请求体 | `string` | 是 | 未声明 | 关闭原因(commented 已处理 \| repeat 重复 \| refuse 不予处理) |
| `--comment` | 请求体 | `string` | 是 | 未声明 | 备注 |

`--ticketID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-system"></a>

### system · 应用

应用管理，支持获取应用列表，支持获取产品下的应用、创建应用、修改应用

快捷用法与字段查询：

```text
zentao system [列表参数]
zentao system props --format=json
zentao help system
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-system-list) | 获取应用列表，支持获取产品下的应用 |
| [create](#action-system-create) | 创建应用 |
| [update](#action-system-update) | 修改应用 |

<a id="action-system-list"></a>

#### `zentao system list` · 获取应用列表，支持获取产品下的应用

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao system list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-system-create"></a>

#### `zentao system create` · 创建应用

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao system create --productID=<number> --integrated=<number> --children=<string[]> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--integrated` | 请求体 | `number` | 是 | 未声明 | 是否集成应用(0 否\| 1 是)<br>格式：int32<br>必须为整数 |
| `--children` | 请求体 | `string[]` | 是 | 未声明 | 集成应用需要包含其他应用，非集成应用传空数组[]<br>数组元素类型：string |
| `--name` | 请求体 | `string` | 是 | 未声明 | 应用名称 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-system-update"></a>

#### `zentao system update` · 修改应用

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao system update --systemID=<number> --name=<string> --children=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--systemID` | 路径 | `number` | 是 | 未声明 | 应用ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 应用名称 |
| `--children` | 请求体 | `string[]` | 是 | 未声明 | 集成应用需要包含其他应用，非集成应用传空数组[]<br>数组元素类型：string |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

`--systemID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="module-build"></a>

### build · 版本

版本管理，支持获取版本列表，支持获取项目/执行下的版本、创建版本/构建、修改版本、删除版本

快捷用法与字段查询：

```text
zentao build [列表参数]
zentao build props --format=json
zentao help build
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-build-list) | 获取版本列表，支持获取项目/执行下的版本 |
| [create](#action-build-create) | 创建版本/构建 |
| [update](#action-build-update) | 修改版本 |
| [delete](#action-build-delete) | 删除版本 |

<a id="action-build-list"></a>

#### `zentao build list` · 获取版本列表，支持获取项目/执行下的版本

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao build list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 版本所属范围<br>可选值：projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；active（有效）；closed（已关闭） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；date_asc（日期 升序）；date_desc（日期 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(名称，示例：关键字)；system(所属应用，示例：all)；id(ID，示例：1)；product(所属产品，产品，示例：1)；scmPath(源代码地址，示例：关键字)；filePath(下载地址，示例：关键字)；date(打包日期，示例：2026-01-01)；builder(构建者，用户，示例：admin)；desc(描述，示例：关键字) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-build-create"></a>

#### `zentao build create` · 创建版本/构建

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao build create --executionID=<number> --product=<number> --name=<string> --system=<number> --builder=<string> --date=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 请求体 | `number` | 是 | 未声明 | 所属执行/迭代<br>格式：int32<br>必须为整数 |
| `--product` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 构建名称 |
| `--system` | 请求体 | `number` | 是 | 未声明 | 所属应用<br>格式：int32<br>必须为整数 |
| `--builder` | 请求体 | `string` | 是 | 未声明 | 构建者 |
| `--date` | 请求体 | `string` | 是 | 未声明 | 打包日期 |
| `--scmPath` | 请求体 | `string` | 否 | 未声明 | 源代码地址 |
| `--filePath` | 请求体 | `string` | 否 | 未声明 | 下载地址 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-build-update"></a>

#### `zentao build update` · 修改版本

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao build update --buildID=<number> --execution=<number> --product=<number> --name=<string> --system=<number> --builder=<string> --date=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--buildID` | 路径 | `number` | 是 | 未声明 | 版本ID |
| `--execution` | 请求体 | `number` | 是 | 未声明 | 所属执行/迭代<br>格式：int32<br>必须为整数 |
| `--product` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 构建名称 |
| `--system` | 请求体 | `number` | 是 | 未声明 | 所属应用<br>格式：int32<br>必须为整数 |
| `--builder` | 请求体 | `string` | 是 | 未声明 | 构建者 |
| `--date` | 请求体 | `string` | 是 | 未声明 | 打包日期 |
| `--scmPath` | 请求体 | `string` | 否 | 未声明 | 源代码地址 |
| `--filePath` | 请求体 | `string` | 否 | 未声明 | 下载地址 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

`--buildID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-build-delete"></a>

#### `zentao build delete` · 删除版本

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao build delete --buildID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--buildID` | 路径 | `number` | 是 | 未声明 | 版本ID |

`--buildID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-testtask"></a>

### testtask · 测试单

测试单管理，支持获取测试单列表，支持获取产品/项目/执行下的测试单、创建测试单、修改测试单、删除测试单

快捷用法与字段查询：

```text
zentao testtask [列表参数]
zentao testtask props --format=json
zentao help testtask
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-testtask-list) | 获取测试单列表，支持获取产品/项目/执行下的测试单 |
| [create](#action-testtask-create) | 创建测试单 |
| [update](#action-testtask-update) | 修改测试单 |
| [delete](#action-testtask-delete) | 删除测试单 |

<a id="action-testtask-list"></a>

#### `zentao testtask list` · 获取测试单列表，支持获取产品/项目/执行下的测试单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testtask list --product=<id> [选项]
```

范围必填：用法中以 `--product` 为例，也可从 `--product=<id>`（产品）、`--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 测试单所属范围<br>可选值：products（产品）；projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；wait（未开始）；doing（进行中）；done（已完成）；blocked（阻塞） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-testtask-create"></a>

#### `zentao testtask create` · 创建测试单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testtask create --productID=<number> --name=<string> --build=<number> --begin=<string> --end=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品ID<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 测试单名称 |
| `--build` | 请求体 | `number` | 是 | 未声明 | 提测构建/版本<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string[]` | 否 | 未声明 | 类型(integrate 集成测试 \| system 系统测试 \| acceptance 验收测试 \| performance 性能测试 \| safety 安全测试)<br>数组元素类型：string |
| `--owner` | 请求体 | `string` | 否 | 未声明 | 负责人 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态(wait 未开始 \| doing 进行中 \| done 已关闭 \| blocked 被阻塞) |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-testtask-update"></a>

#### `zentao testtask update` · 修改测试单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testtask update --testtaskID=<number> --name=<string> --build=<number> --begin=<string> --end=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--testtaskID` | 路径 | `number` | 是 | 未声明 | 测试单ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 测试单名称 |
| `--build` | 请求体 | `number` | 是 | 未声明 | 提测构建/版本<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string[]` | 否 | 未声明 | 类型(integrate 集成测试 \| system 系统测试 \| acceptance 验收测试 \| performance 性能测试 \| safety 安全测试)<br>数组元素类型：string |
| `--owner` | 请求体 | `string` | 否 | 未声明 | 负责人 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态(wait 未开始 \| doing 进行中 \| done 已关闭 \| blocked 被阻塞) |
| `--begin` | 请求体 | `string` | 是 | 未声明 | 开始日期 |
| `--end` | 请求体 | `string` | 是 | 未声明 | 结束日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

`--testtaskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-testtask-delete"></a>

#### `zentao testtask delete` · 删除测试单

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao testtask delete --testtaskID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--testtaskID` | 路径 | `number` | 是 | 未声明 | 测试单ID |

`--testtaskID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-release"></a>

### release · 发布

发布管理，支持获取发布列表，支持获取产品下的发布、创建发布、修改发布、删除发布

快捷用法与字段查询：

```text
zentao release [列表参数]
zentao release props --format=json
zentao help release
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-release-list) | 获取发布列表，支持获取产品下的发布 |
| [create](#action-release-create) | 创建发布 |
| [update](#action-release-update) | 修改发布 |
| [delete](#action-release-delete) | 删除发布 |

<a id="action-release-list"></a>

#### `zentao release list` · 获取发布列表，支持获取产品下的发布

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao release list --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 所属产品ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；wait（未开始）；normal（已发布）；fail（发布失败）；terminate（停止维护） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；date_asc（日期 升序）；date_desc（日期 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(应用版本号，示例：关键字)；branch(平台/分支，示例：all)；id(ID，示例：1)；build(包含构建，示例：all)；status(发布状态，枚举：wait 未开始 \| normal 已发布 \| fail 发布失败 \| terminate 停止维护)；date(计划发布日期，示例：2026-01-01)；marker(里程碑，枚举：1 是 \| 0 否) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-release-create"></a>

#### `zentao release create` · 创建发布

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao release create --productID=<number> --system=<number> --name=<string> --build=<string[]> --date=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 请求体 | `number` | 是 | 未声明 | 所属产品<br>格式：int32<br>必须为整数 |
| `--system` | 请求体 | `number` | 是 | 未声明 | 所属应用<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 应用版本号 |
| `--build` | 请求体 | `string[]` | 是 | 未声明 | 包含构建<br>数组元素类型：string |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态(wait 未开始 \| normal 已发布 \| fail 发布失败 \| terminate 停止维护) |
| `--date` | 请求体 | `string` | 是 | 未声明 | 计划发布日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-release-update"></a>

#### `zentao release update` · 修改发布

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao release update --releaseID=<number> --system=<number> --name=<string> --build=<string[]> --date=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--releaseID` | 路径 | `number` | 是 | 未声明 | 发布ID |
| `--system` | 请求体 | `number` | 是 | 未声明 | 所属应用<br>格式：int32<br>必须为整数 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 应用版本号 |
| `--build` | 请求体 | `string[]` | 是 | 未声明 | 包含构建<br>数组元素类型：string |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态(wait 未开始 \| normal 已发布 \| fail 发布失败 \| terminate 停止维护) |
| `--date` | 请求体 | `string` | 是 | 未声明 | 计划发布日期 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 描述 |

`--releaseID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-release-delete"></a>

#### `zentao release delete` · 删除发布

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao release delete --releaseID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--releaseID` | 路径 | `number` | 是 | 未声明 | 发布ID |

`--releaseID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-file"></a>

### file · 附件

附件管理，支持上传附件，使用【表单formdata】方式提交，不支持json、编辑附件，修改附件的名称、删除附件

快捷用法与字段查询：

```text
zentao file props --format=json
zentao help file
```

此模块没有默认 list；请明确指定下表中的操作。

| 操作 | 用途 |
| --- | --- |
| [create](#action-file-create) | 上传附件，使用【表单formdata】方式提交，不支持json |
| [update](#action-file-update) | 编辑附件，修改附件的名称 |
| [delete](#action-file-delete) | 删除附件 |

<a id="action-file-create"></a>

#### `zentao file create` · 上传附件，使用【表单formdata】方式提交，不支持json

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao file create --file=<string> --objectType=<string> --objectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--file` | 请求体 | `string` | 是 | 未声明 | 本地文件路径，将按 multipart/form-data 上传<br>格式：binary |
| `--objectType` | 请求体 | `string` | 是 | 未声明 | 关联对象类型(bug 缺陷 \| story 需求 \| task 任务 \| testcase 用例) |
| `--objectID` | 请求体 | `number` | 是 | 未声明 | 关联对象ID<br>格式：int32<br>必须为整数 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-file-update"></a>

#### `zentao file update` · 编辑附件，修改附件的名称

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao file update --fileID=<number> --fileName=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--fileID` | 路径 | `number` | 是 | 未声明 | 附件ID |
| `--fileName` | 请求体 | `string` | 是 | 未声明 | 附件名称 |

`--fileID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-file-delete"></a>

#### `zentao file delete` · 删除附件

最低禅道版本：`22.0` / `biz13.0` / `max8.0` / `ipd5.0`。

```text
zentao file delete --fileID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--fileID` | 路径 | `number` | 是 | 未声明 | 附件ID |

`--fileID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-workflow"></a>

### workflow · 工作流

工作流管理，支持获取工作流数据列表(以合同为例)、获取工作流数据详情(以合同为例)、获取工作流列表、获取工作流字段列表、获取工作流动作列表、获取工作流标签列表、获取工作流数据表列表、获取数据源列表、获取规则列表、创建工作流数据(以合同为例)、创建工作流、复制工作流、创建工作流字段、创建工作流动作、创建工作流标签、创建工作流数据表、创建数据源、创建规则、获取工作流详情、获取工作流字段详情、获取工作流动作详情、获取工作流标签详情、获取工作流数据表详情、获取数据源详情、获取规则详情、修改工作流数据(以合同为例)、修改工作流、修改工作流字段、修改工作流动作、修改工作流标签、修改工作流数据表、修改数据源、修改规则、删除工作流事项(以合同为例)、删除工作流、删除工作流字段、删除工作流动作、删除工作流标签、删除工作流数据表、删除数据源、删除规则、启用工作流、停用工作流、发布工作流、设置工作流审批、设置动作CSS、设置工作流CSS、设置字段导出、设置工作流全文检索、设置动作JS、设置工作流JS、设置动作通知、设置字段搜索、设置字段取值、设置动作验证

快捷用法与字段查询：

```text
zentao workflow [列表参数]
zentao workflow props --format=json
zentao help workflow
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-workflow-list) | 获取工作流数据列表(以合同为例) |
| [getContract](#action-workflow-getcontract) | 获取工作流数据详情(以合同为例) |
| [flows](#action-workflow-flows) | 获取工作流列表 |
| [fields](#action-workflow-fields) | 获取工作流字段列表 |
| [actions](#action-workflow-actions) | 获取工作流动作列表 |
| [labels](#action-workflow-labels) | 获取工作流标签列表 |
| [tables](#action-workflow-tables) | 获取工作流数据表列表 |
| [datasources](#action-workflow-datasources) | 获取数据源列表 |
| [rules](#action-workflow-rules) | 获取规则列表 |
| [create](#action-workflow-create) | 创建工作流数据(以合同为例) |
| [createFlow](#action-workflow-createflow) | 创建工作流 |
| [copyFlow](#action-workflow-copyflow) | 复制工作流 |
| [createField](#action-workflow-createfield) | 创建工作流字段 |
| [createAction](#action-workflow-createaction) | 创建工作流动作 |
| [createLabel](#action-workflow-createlabel) | 创建工作流标签 |
| [createTable](#action-workflow-createtable) | 创建工作流数据表 |
| [createDatasource](#action-workflow-createdatasource) | 创建数据源 |
| [createRule](#action-workflow-createrule) | 创建规则 |
| [getFlow](#action-workflow-getflow) | 获取工作流详情 |
| [getField](#action-workflow-getfield) | 获取工作流字段详情 |
| [getAction](#action-workflow-getaction) | 获取工作流动作详情 |
| [getLabel](#action-workflow-getlabel) | 获取工作流标签详情 |
| [getTable](#action-workflow-gettable) | 获取工作流数据表详情 |
| [getDatasource](#action-workflow-getdatasource) | 获取数据源详情 |
| [getRule](#action-workflow-getrule) | 获取规则详情 |
| [update](#action-workflow-update) | 修改工作流数据(以合同为例) |
| [updateFlow](#action-workflow-updateflow) | 修改工作流 |
| [updateField](#action-workflow-updatefield) | 修改工作流字段 |
| [updateAction](#action-workflow-updateaction) | 修改工作流动作 |
| [updateLabel](#action-workflow-updatelabel) | 修改工作流标签 |
| [updateTable](#action-workflow-updatetable) | 修改工作流数据表 |
| [updateDatasource](#action-workflow-updatedatasource) | 修改数据源 |
| [updateRule](#action-workflow-updaterule) | 修改规则 |
| [delete](#action-workflow-delete) | 删除工作流事项(以合同为例) |
| [deleteFlow](#action-workflow-deleteflow) | 删除工作流 |
| [deleteField](#action-workflow-deletefield) | 删除工作流字段 |
| [deleteAction](#action-workflow-deleteaction) | 删除工作流动作 |
| [deleteLabel](#action-workflow-deletelabel) | 删除工作流标签 |
| [deleteTable](#action-workflow-deletetable) | 删除工作流数据表 |
| [deleteDatasource](#action-workflow-deletedatasource) | 删除数据源 |
| [deleteRule](#action-workflow-deleterule) | 删除规则 |
| [activateFlow](#action-workflow-activateflow) | 启用工作流 |
| [deactivateFlow](#action-workflow-deactivateflow) | 停用工作流 |
| [releaseFlow](#action-workflow-releaseflow) | 发布工作流 |
| [setApproval](#action-workflow-setapproval) | 设置工作流审批 |
| [setActionCSS](#action-workflow-setactioncss) | 设置动作CSS |
| [setFlowCSS](#action-workflow-setflowcss) | 设置工作流CSS |
| [setExport](#action-workflow-setexport) | 设置字段导出 |
| [setFulltextSearch](#action-workflow-setfulltextsearch) | 设置工作流全文检索 |
| [setActionJS](#action-workflow-setactionjs) | 设置动作JS |
| [setFlowJS](#action-workflow-setflowjs) | 设置工作流JS |
| [setActionNotice](#action-workflow-setactionnotice) | 设置动作通知 |
| [setSearch](#action-workflow-setsearch) | 设置字段搜索 |
| [setValue](#action-workflow-setvalue) | 设置字段取值 |
| [setActionVerification](#action-workflow-setactionverification) | 设置动作验证 |

<a id="action-workflow-list"></a>

#### `zentao workflow list` · 获取工作流数据列表(以合同为例)

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao workflow list [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getcontract"></a>

#### `zentao workflow getContract` · 获取工作流数据详情(以合同为例)

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao workflow getContract [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-flows"></a>

#### `zentao workflow flows` · 获取工作流列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow flows [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--status` | 查询 | `string` | 否 | 未声明 | 工作流状态<br>可选值：normal（正常）；wait（待发布）；pause（已停用） |
| `--app` | 查询 | `string` | 否 | 未声明 | 所属应用，不传时不限。 |
| `--onlyCustom` | 查询 | `number` | 否 | 未声明 | 是否只显示自定义工作流<br>可选值：0（全部）；1（仅自定义） |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：app,createdBy,createdDate,desc,id,name |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-fields"></a>

#### `zentao workflow fields` · 获取工作流字段列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow fields --module=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-actions"></a>

#### `zentao workflow actions` · 获取工作流动作列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow actions --module=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-labels"></a>

#### `zentao workflow labels` · 获取工作流标签列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow labels --module=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-tables"></a>

#### `zentao workflow tables` · 获取工作流数据表列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow tables --module=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-datasources"></a>

#### `zentao workflow datasources` · 获取数据源列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow datasources [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-rules"></a>

#### `zentao workflow rules` · 获取规则列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow rules [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-create"></a>

#### `zentao workflow create` · 创建工作流数据(以合同为例)

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao workflow create --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 合同名称 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createflow"></a>

#### `zentao workflow createFlow` · 创建工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createFlow --module=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 请求体 | `string` | 是 | 未声明 | 工作流代号，只能包含英文字母。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 工作流名称。 |
| `--navigator` | 请求体 | `string` | 否 | 未声明 | 所属导航(primary 主导航 \| secondary 二级导航)。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-copyflow"></a>

#### `zentao workflow copyFlow` · 复制工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow copyFlow --flowID=<number> --module=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |
| `--module` | 请求体 | `string` | 是 | 未声明 | 新工作流代号，只能包含英文字母。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 新工作流名称。 |
| `--navigator` | 请求体 | `string` | 否 | 未声明 | 所属导航(primary 主导航 \| secondary 二级导航)。 |
| `--position` | 请求体 | `string` | 否 | 未声明 | 菜单位置。 |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createfield"></a>

#### `zentao workflow createField` · 创建工作流字段

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createField --module=<string> --name=<string> --field=<string> --control=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--name` | 请求体 | `string` | 是 | 未声明 | 字段名称。 |
| `--field` | 请求体 | `string` | 是 | 未声明 | 字段代号，只能包含英文字母。 |
| `--control` | 请求体 | `string` | 是 | 未声明 | 控件类型(input 单行文本 \| textarea 多行文本 \| select 下拉 \| date 日期 \| datetime 日期时间 \| richtext 富文本 \| checkbox 复选框 \| multi-select 多选 \| formula 公式)。 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 字段类型(varchar 字符 \| int 整数 \| float 浮点数 \| date 日期 \| datetime 日期时间 \| text 文本)。 |
| `--length` | 请求体 | `string` | 否 | 未声明 | 字段长度。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createaction"></a>

#### `zentao workflow createAction` · 创建工作流动作

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createAction --module=<string> --module=<string> --action=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--module` | 请求体 | `string` | 是 | 未声明 | 工作流代号。 |
| `--action` | 请求体 | `string` | 是 | 未声明 | 动作代号，只能包含小写英文字母。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 动作名称。 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 动作类型(single 单条操作 \| batch 批量操作)。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createlabel"></a>

#### `zentao workflow createLabel` · 创建工作流标签

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createLabel --module=<string> --module=<string> --action=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--module` | 请求体 | `string` | 是 | 未声明 | 工作流代号。 |
| `--action` | 请求体 | `string` | 是 | 未声明 | 关联动作代号。 |
| `--code` | 请求体 | `string` | 否 | 未声明 | 标签代号。 |
| `--label` | 请求体 | `string` | 否 | 未声明 | 标签名称。 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 标签类型(data 数据标签 \| sql SQL标签)。 |
| `--fields` | 请求体 | `string[]` | 否 | 未声明 | 数据标签的字段列表。<br>数组元素类型：string |
| `--operators` | 请求体 | `string[]` | 否 | 未声明 | 数据标签的运算符列表。<br>数组元素类型：string |
| `--values` | 请求体 | `string[]` | 否 | 未声明 | 数据标签的条件值列表。<br>数组元素类型：string |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createtable"></a>

#### `zentao workflow createTable` · 创建工作流数据表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createTable --module=<string> --module=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--module` | 请求体 | `string` | 是 | 未声明 | 数据表代号，只能包含英文字母。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 数据表名称。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createdatasource"></a>

#### `zentao workflow createDatasource` · 创建数据源

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createDatasource --type=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--type` | 请求体 | `string` | 是 | 未声明 | 数据源类型(sql SQL查询 \| system 系统方法 \| option 选项 \| lang 语言项 \| category 分类 \| func 函数)。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 数据源名称。 |
| `--code` | 请求体 | `string` | 否 | 未声明 | 数据源代码。 |
| `--sql` | 请求体 | `string` | 否 | 未声明 | SQL 语句，type=sql 时必填，支持 SELECT 查询。 |
| `--keyField` | 请求体 | `string` | 否 | 未声明 | 键字段，type=sql 时必填。 |
| `--valueField` | 请求体 | `string` | 否 | 未声明 | 值字段，type=sql 时必填。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-createrule"></a>

#### `zentao workflow createRule` · 创建规则

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow createRule --type=<string> --name=<string> --rule=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--type` | 请求体 | `string` | 是 | 未声明 | 规则类型(regex 正则表达式)。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 规则名称。 |
| `--rule` | 请求体 | `string` | 是 | 未声明 | 规则内容，正则表达式需要包含定界符。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getflow"></a>

#### `zentao workflow getFlow` · 获取工作流详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getFlow --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getfield"></a>

#### `zentao workflow getField` · 获取工作流字段详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getField --fieldID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--fieldID` | 路径 | `number` | 是 | 未声明 | fieldID |

`--fieldID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getaction"></a>

#### `zentao workflow getAction` · 获取工作流动作详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getAction --actionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getlabel"></a>

#### `zentao workflow getLabel` · 获取工作流标签详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getLabel --labelID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--labelID` | 路径 | `number` | 是 | 未声明 | labelID |

`--labelID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-gettable"></a>

#### `zentao workflow getTable` · 获取工作流数据表详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getTable --tableID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--tableID` | 路径 | `number` | 是 | 未声明 | tableID |

`--tableID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getdatasource"></a>

#### `zentao workflow getDatasource` · 获取数据源详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getDatasource --datasourceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--datasourceID` | 路径 | `number` | 是 | 未声明 | datasourceID |

`--datasourceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-getrule"></a>

#### `zentao workflow getRule` · 获取规则详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow getRule --ruleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ruleID` | 路径 | `number` | 是 | 未声明 | ruleID |

`--ruleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-update"></a>

#### `zentao workflow update` · 修改工作流数据(以合同为例)

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao workflow update --contractID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--contractID` | 路径 | `number` | 是 | 未声明 | 合同ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 合同名称 |

`--contractID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updateflow"></a>

#### `zentao workflow updateFlow` · 修改工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateFlow --flowID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 工作流名称。 |
| `--navigator` | 请求体 | `string` | 否 | 未声明 | 所属导航(primary 主导航 \| secondary 二级导航)。 |
| `--position` | 请求体 | `string` | 否 | 未声明 | 菜单位置(before 之前 \| after 之后 \| 空 直接放在模块下)。 |
| `--positionModule` | 请求体 | `string` | 否 | 未声明 | 位置模块，主导航下通常传 main；工作流发布后不能为空。 |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updatefield"></a>

#### `zentao workflow updateField` · 修改工作流字段

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateField --fieldID=<number> --name=<string> --control=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--fieldID` | 路径 | `number` | 是 | 未声明 | fieldID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 字段名称。 |
| `--control` | 请求体 | `string` | 是 | 未声明 | 控件类型。 |

`--fieldID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updateaction"></a>

#### `zentao workflow updateAction` · 修改工作流动作

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateAction --actionID=<number> --action=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |
| `--action` | 请求体 | `string` | 是 | 未声明 | 动作代号。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 动作名称。 |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updatelabel"></a>

#### `zentao workflow updateLabel` · 修改工作流标签

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateLabel --labelID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--labelID` | 路径 | `number` | 是 | 未声明 | labelID |
| `--label` | 请求体 | `string` | 否 | 未声明 | 标签名称。 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 标签类型。 |
| `--fields` | 请求体 | `string[]` | 否 | 未声明 | 数据标签的字段列表。<br>数组元素类型：string |
| `--operators` | 请求体 | `string[]` | 否 | 未声明 | 数据标签的运算符列表。<br>数组元素类型：string |
| `--values` | 请求体 | `string[]` | 否 | 未声明 | 数据标签的条件值列表。<br>数组元素类型：string |

`--labelID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updatetable"></a>

#### `zentao workflow updateTable` · 修改工作流数据表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateTable --tableID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--tableID` | 路径 | `number` | 是 | 未声明 | tableID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 数据表名称。 |

`--tableID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updatedatasource"></a>

#### `zentao workflow updateDatasource` · 修改数据源

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateDatasource --datasourceID=<number> --type=<string> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--datasourceID` | 路径 | `number` | 是 | 未声明 | datasourceID |
| `--type` | 请求体 | `string` | 是 | 未声明 | 数据源类型。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 数据源名称。 |
| `--code` | 请求体 | `string` | 否 | 未声明 | 数据源代码。 |
| `--sql` | 请求体 | `string` | 否 | 未声明 | SQL 语句。 |
| `--keyField` | 请求体 | `string` | 否 | 未声明 | 键字段。 |
| `--valueField` | 请求体 | `string` | 否 | 未声明 | 值字段。 |

`--datasourceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-updaterule"></a>

#### `zentao workflow updateRule` · 修改规则

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow updateRule --ruleID=<number> --type=<string> --name=<string> --rule=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ruleID` | 路径 | `number` | 是 | 未声明 | ruleID |
| `--type` | 请求体 | `string` | 是 | 未声明 | 规则类型。 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 规则名称。 |
| `--rule` | 请求体 | `string` | 是 | 未声明 | 规则内容。 |

`--ruleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-workflow-delete"></a>

#### `zentao workflow delete` · 删除工作流事项(以合同为例)

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao workflow delete --contractID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--contractID` | 路径 | `number` | 是 | 未声明 | 合同ID |

`--contractID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deleteflow"></a>

#### `zentao workflow deleteFlow` · 删除工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteFlow --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deletefield"></a>

#### `zentao workflow deleteField` · 删除工作流字段

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteField --fieldID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--fieldID` | 路径 | `number` | 是 | 未声明 | fieldID |

`--fieldID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deleteaction"></a>

#### `zentao workflow deleteAction` · 删除工作流动作

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteAction --actionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deletelabel"></a>

#### `zentao workflow deleteLabel` · 删除工作流标签

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteLabel --labelID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--labelID` | 路径 | `number` | 是 | 未声明 | labelID |

`--labelID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deletetable"></a>

#### `zentao workflow deleteTable` · 删除工作流数据表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteTable --tableID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--tableID` | 路径 | `number` | 是 | 未声明 | tableID |

`--tableID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deletedatasource"></a>

#### `zentao workflow deleteDatasource` · 删除数据源

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteDatasource --datasourceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--datasourceID` | 路径 | `number` | 是 | 未声明 | datasourceID |

`--datasourceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deleterule"></a>

#### `zentao workflow deleteRule` · 删除规则

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deleteRule --ruleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ruleID` | 路径 | `number` | 是 | 未声明 | ruleID |

`--ruleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-activateflow"></a>

#### `zentao workflow activateFlow` · 启用工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow activateFlow --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-deactivateflow"></a>

#### `zentao workflow deactivateFlow` · 停用工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow deactivateFlow --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-releaseflow"></a>

#### `zentao workflow releaseFlow` · 发布工作流

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow releaseFlow --flowID=<number> --navigator=<string> --positionModule=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |
| `--navigator` | 请求体 | `string` | 是 | 未声明 | 所属导航(primary 主导航 \| secondary 二级导航)。 |
| `--position` | 请求体 | `string` | 否 | 未声明 | 菜单位置(before 之前 \| after 之后 \| 空 直接放在模块下)。 |
| `--positionModule` | 请求体 | `string` | 是 | 未声明 | 位置模块，主导航下通常传 main。 |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setapproval"></a>

#### `zentao workflow setApproval` · 设置工作流审批

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setApproval --module=<string> --approval=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--approval` | 请求体 | `string` | 是 | 未声明 | 是否启用审批(enabled 启用 \| disabled 停用)。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setactioncss"></a>

#### `zentao workflow setActionCSS` · 设置动作CSS

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setActionCSS --actionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |
| `--css` | 请求体 | `string` | 否 | 未声明 | 动作自定义CSS。 |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setflowcss"></a>

#### `zentao workflow setFlowCSS` · 设置工作流CSS

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setFlowCSS --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |
| `--css` | 请求体 | `string` | 否 | 未声明 | 工作流自定义CSS。 |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setexport"></a>

#### `zentao workflow setExport` · 设置字段导出

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setExport --module=<string> --modules=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--modules` | 请求体 | `string[]` | 是 | 未声明 | 要设置的模块列表。<br>数组元素类型：string |
| `--fields` | 请求体 | `object` | 否 | 未声明 | 导出字段，键为模块、值为字段代号列表。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setfulltextsearch"></a>

#### `zentao workflow setFulltextSearch` · 设置工作流全文检索

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setFulltextSearch --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |
| `--contentField` | 请求体 | `string[]` | 否 | 未声明 | 参与全文检索的字段列表。<br>数组元素类型：string |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setactionjs"></a>

#### `zentao workflow setActionJS` · 设置动作JS

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setActionJS --actionID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |
| `--js` | 请求体 | `string` | 否 | 未声明 | 动作自定义JS。 |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setflowjs"></a>

#### `zentao workflow setFlowJS` · 设置工作流JS

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setFlowJS --flowID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--flowID` | 路径 | `number` | 是 | 未声明 | flowID |
| `--js` | 请求体 | `string` | 否 | 未声明 | 工作流自定义JS。 |

`--flowID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setactionnotice"></a>

#### `zentao workflow setActionNotice` · 设置动作通知

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setActionNotice --actionID=<number> --toList=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |
| `--toList` | 请求体 | `string[]` | 是 | 未声明 | 通知人账号列表。<br>数组元素类型：string |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setsearch"></a>

#### `zentao workflow setSearch` · 设置字段搜索

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setSearch --module=<string> --modules=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--modules` | 请求体 | `string[]` | 是 | 未声明 | 要设置的模块列表。<br>数组元素类型：string |
| `--fields` | 请求体 | `object` | 否 | 未声明 | 搜索字段，键为模块、值为字段代号列表（按数组顺序作为搜索排序）。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setvalue"></a>

#### `zentao workflow setValue` · 设置字段取值

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setValue --module=<string> --modules=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--module` | 路径 | `string` | 是 | 未声明 | module |
| `--modules` | 请求体 | `string[]` | 是 | 未声明 | 要设置的模块列表。<br>数组元素类型：string |
| `--fields` | 请求体 | `object` | 否 | 未声明 | 取值字段，键为模块、值为字段代号列表。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-workflow-setactionverification"></a>

#### `zentao workflow setActionVerification` · 设置动作验证

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflow setActionVerification --actionID=<number> --type=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--actionID` | 路径 | `number` | 是 | 未声明 | actionID |
| `--type` | 请求体 | `string` | 是 | 未声明 | 验证类型(data 数据验证 \| no 不验证)。 |
| `--message` | 请求体 | `string` | 否 | 未声明 | 验证失败提示。 |
| `--verifications` | 请求体 | `object` | 否 | 未声明 | 验证规则，包含 field(字段)、paramType(参数类型)、param(参数) 三个数组。 |

`--actionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-doc"></a>

### doc · 文档

文档管理，支持获取我的文档空间列表、获取团队文档空间列表、获取产品文档空间列表、获取项目文档空间列表、获取我的文档库列表、获取团队文档库列表、获取产品文档库列表、获取项目文档库列表、获取我的文档列表、获取团队文档列表、获取产品文档列表、获取项目文档列表、获取我的文档库目录列表、获取团队文档库目录列表、获取产品文档库目录列表、获取项目文档库目录列表、创建我的文档空间、创建团队文档空间、创建我的文档库、创建团队文档库、创建产品文档库、创建项目文档库、创建我的文档、创建团队文档、创建产品文档、创建项目文档、创建我的文档库目录、创建团队文档库目录、创建产品文档库目录、创建项目文档库目录、获取文档空间详情、获取文档库详情、获取文档详情、修改文档空间、修改文档库、修改文档、修改文档库目录、删除文档空间、删除文档库、删除文档、删除文档库目录

快捷用法与字段查询：

```text
zentao doc <id>
zentao doc props --format=json
zentao help doc
```

此模块没有默认 list；请明确指定下表中的操作。

| 操作 | 用途 |
| --- | --- |
| [mySpaces](#action-doc-myspaces) | 获取我的文档空间列表 |
| [teamSpaces](#action-doc-teamspaces) | 获取团队文档空间列表 |
| [productSpaces](#action-doc-productspaces) | 获取产品文档空间列表 |
| [projectSpaces](#action-doc-projectspaces) | 获取项目文档空间列表 |
| [myLibs](#action-doc-mylibs) | 获取我的文档库列表 |
| [teamLibs](#action-doc-teamlibs) | 获取团队文档库列表 |
| [productLibs](#action-doc-productlibs) | 获取产品文档库列表 |
| [projectLibs](#action-doc-projectlibs) | 获取项目文档库列表 |
| [myDocs](#action-doc-mydocs) | 获取我的文档列表 |
| [teamDocs](#action-doc-teamdocs) | 获取团队文档列表 |
| [productDocs](#action-doc-productdocs) | 获取产品文档列表 |
| [projectDocs](#action-doc-projectdocs) | 获取项目文档列表 |
| [myModules](#action-doc-mymodules) | 获取我的文档库目录列表 |
| [teamModules](#action-doc-teammodules) | 获取团队文档库目录列表 |
| [productModules](#action-doc-productmodules) | 获取产品文档库目录列表 |
| [projectModules](#action-doc-projectmodules) | 获取项目文档库目录列表 |
| [createMySpace](#action-doc-createmyspace) | 创建我的文档空间 |
| [createTeamSpace](#action-doc-createteamspace) | 创建团队文档空间 |
| [createMyLib](#action-doc-createmylib) | 创建我的文档库 |
| [createTeamLib](#action-doc-createteamlib) | 创建团队文档库 |
| [createProductLib](#action-doc-createproductlib) | 创建产品文档库 |
| [createProjectLib](#action-doc-createprojectlib) | 创建项目文档库 |
| [createMyDoc](#action-doc-createmydoc) | 创建我的文档 |
| [createTeamDoc](#action-doc-createteamdoc) | 创建团队文档 |
| [createProductDoc](#action-doc-createproductdoc) | 创建产品文档 |
| [createProjectDoc](#action-doc-createprojectdoc) | 创建项目文档 |
| [createMyModule](#action-doc-createmymodule) | 创建我的文档库目录 |
| [createTeamModule](#action-doc-createteammodule) | 创建团队文档库目录 |
| [createProductModule](#action-doc-createproductmodule) | 创建产品文档库目录 |
| [createProjectModule](#action-doc-createprojectmodule) | 创建项目文档库目录 |
| [getSpace](#action-doc-getspace) | 获取文档空间详情 |
| [getLib](#action-doc-getlib) | 获取文档库详情 |
| [get](#action-doc-get) | 获取文档详情 |
| [updateSpace](#action-doc-updatespace) | 修改文档空间 |
| [updateLib](#action-doc-updatelib) | 修改文档库 |
| [update](#action-doc-update) | 修改文档 |
| [updateModule](#action-doc-updatemodule) | 修改文档库目录 |
| [deleteSpace](#action-doc-deletespace) | 删除文档空间 |
| [deleteLib](#action-doc-deletelib) | 删除文档库 |
| [delete](#action-doc-delete) | 删除文档 |
| [deleteModule](#action-doc-deletemodule) | 删除文档库目录 |

<a id="action-doc-myspaces"></a>

#### `zentao doc mySpaces` · 获取我的文档空间列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc mySpaces [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-teamspaces"></a>

#### `zentao doc teamSpaces` · 获取团队文档空间列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc teamSpaces [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-productspaces"></a>

#### `zentao doc productSpaces` · 获取产品文档空间列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc productSpaces [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-projectspaces"></a>

#### `zentao doc projectSpaces` · 获取项目文档空间列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc projectSpaces [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-mylibs"></a>

#### `zentao doc myLibs` · 获取我的文档库列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc myLibs --spaceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-teamlibs"></a>

#### `zentao doc teamLibs` · 获取团队文档库列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc teamLibs --spaceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-productlibs"></a>

#### `zentao doc productLibs` · 获取产品文档库列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc productLibs --productID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-projectlibs"></a>

#### `zentao doc projectLibs` · 获取项目文档库列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc projectLibs --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-mydocs"></a>

#### `zentao doc myDocs` · 获取我的文档列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc myDocs --spaceID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-teamdocs"></a>

#### `zentao doc teamDocs` · 获取团队文档列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc teamDocs --spaceID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-productdocs"></a>

#### `zentao doc productDocs` · 获取产品文档列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc productDocs --productID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-projectdocs"></a>

#### `zentao doc projectDocs` · 获取项目文档列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc projectDocs --projectID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-mymodules"></a>

#### `zentao doc myModules` · 获取我的文档库目录列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc myModules --spaceID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-teammodules"></a>

#### `zentao doc teamModules` · 获取团队文档库目录列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc teamModules --spaceID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-productmodules"></a>

#### `zentao doc productModules` · 获取产品文档库目录列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc productModules --productID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-projectmodules"></a>

#### `zentao doc projectModules` · 获取项目文档库目录列表

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc projectModules --projectID=<number> --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createmyspace"></a>

#### `zentao doc createMySpace` · 创建我的文档空间

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createMySpace --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档空间名称 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createteamspace"></a>

#### `zentao doc createTeamSpace` · 创建团队文档空间

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createTeamSpace --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档空间名称 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createmylib"></a>

#### `zentao doc createMyLib` · 创建我的文档库

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createMyLib --spaceID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库名称 |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createteamlib"></a>

#### `zentao doc createTeamLib` · 创建团队文档库

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createTeamLib --spaceID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库名称 |
| `--acl` | 请求体 | `string` | 否 | 未声明 | open 公开 \| private 私有，默认是open |
| `--groups` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些权限分组可以访问<br>数组元素类型：string |
| `--users` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些用户可以访问<br>数组元素类型：string |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createproductlib"></a>

#### `zentao doc createProductLib` · 创建产品文档库

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createProductLib --productID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库名称 |
| `--acl` | 请求体 | `string` | 否 | 未声明 | default 默认产品权限 \| private 私有 |
| `--groups` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些权限分组可以访问<br>数组元素类型：string |
| `--users` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些用户可以访问<br>数组元素类型：string |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createprojectlib"></a>

#### `zentao doc createProjectLib` · 创建项目文档库

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createProjectLib --projectID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库名称 |
| `--acl` | 请求体 | `string` | 否 | 未声明 | default 默认项目权限 \| private 私有 |
| `--groups` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些权限分组可以访问<br>数组元素类型：string |
| `--users` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些用户可以访问<br>数组元素类型：string |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createmydoc"></a>

#### `zentao doc createMyDoc` · 创建我的文档

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createMyDoc --spaceID=<number> --libID=<number> --title=<string> --content=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--moduleID` | 请求体 | `number` | 否 | 未声明 | 所属目录<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 文档标题 |
| `--content` | 请求体 | `string` | 是 | 未声明 | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照 |
| `--contentType` | 请求体 | `string` | 否 | 未声明 | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑) |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createteamdoc"></a>

#### `zentao doc createTeamDoc` · 创建团队文档

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createTeamDoc --spaceID=<number> --libID=<number> --title=<string> --content=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--moduleID` | 请求体 | `number` | 否 | 未声明 | 所属目录<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 文档标题 |
| `--content` | 请求体 | `string` | 是 | 未声明 | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照 |
| `--contentType` | 请求体 | `string` | 否 | 未声明 | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑) |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createproductdoc"></a>

#### `zentao doc createProductDoc` · 创建产品文档

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createProductDoc --productID=<number> --libID=<number> --title=<string> --content=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--moduleID` | 请求体 | `number` | 否 | 未声明 | 所属目录<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 文档标题 |
| `--content` | 请求体 | `string` | 是 | 未声明 | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照 |
| `--contentType` | 请求体 | `string` | 否 | 未声明 | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑) |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createprojectdoc"></a>

#### `zentao doc createProjectDoc` · 创建项目文档

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createProjectDoc --projectID=<number> --libID=<number> --title=<string> --content=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--moduleID` | 请求体 | `number` | 否 | 未声明 | 所属目录<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 文档标题 |
| `--content` | 请求体 | `string` | 是 | 未声明 | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照 |
| `--contentType` | 请求体 | `string` | 否 | 未声明 | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑) |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createmymodule"></a>

#### `zentao doc createMyModule` · 创建我的文档库目录

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createMyModule --spaceID=<number> --libID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库目录 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父目录ID，必须属于当前文档库<br>格式：int32<br>必须为整数 |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createteammodule"></a>

#### `zentao doc createTeamModule` · 创建团队文档库目录

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createTeamModule --spaceID=<number> --libID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库目录 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父目录ID，必须属于当前文档库<br>格式：int32<br>必须为整数 |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createproductmodule"></a>

#### `zentao doc createProductModule` · 创建产品文档库目录

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createProductModule --productID=<number> --libID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--productID` | 路径 | `number` | 是 | 未声明 | 产品ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库目录 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父目录ID，必须属于当前文档库<br>格式：int32<br>必须为整数 |

`--productID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-createprojectmodule"></a>

#### `zentao doc createProjectModule` · 创建项目文档库目录

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc createProjectModule --projectID=<number> --libID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库目录 |
| `--parentID` | 请求体 | `number` | 否 | 未声明 | 父目录ID，必须属于当前文档库<br>格式：int32<br>必须为整数 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-getspace"></a>

#### `zentao doc getSpace` · 获取文档空间详情

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc getSpace --spaceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-getlib"></a>

#### `zentao doc getLib` · 获取文档库详情

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc getLib --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--libID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-get"></a>

#### `zentao doc get` · 获取文档详情

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc get --docID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--docID` | 路径 | `number` | 是 | 未声明 | 文档ID |

`--docID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-updatespace"></a>

#### `zentao doc updateSpace` · 修改文档空间

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc updateSpace --spaceID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档空间名称 |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-doc-updatelib"></a>

#### `zentao doc updateLib` · 修改文档库

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc updateLib --libID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库名称 |
| `--acl` | 请求体 | `string` | 否 | 未声明 | open 公开(适用于团队文档库) \| default 默认权限(适用于产品、项目文档库) \| private 私有(适用于所有类型文档库) |
| `--groups` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些权限分组可以访问<br>数组元素类型：string |
| `--users` | 请求体 | `string[]` | 否 | 未声明 | 如果acl=private,可以设置哪些用户可以访问<br>数组元素类型：string |

`--libID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-doc-update"></a>

#### `zentao doc update` · 修改文档

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc update --docID=<number> --title=<string> --content=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--docID` | 路径 | `number` | 是 | 未声明 | 文档ID |
| `--moduleID` | 请求体 | `number` | 否 | 未声明 | 所属目录<br>格式：int32<br>必须为整数 |
| `--title` | 请求体 | `string` | 是 | 未声明 | 文档标题 |
| `--content` | 请求体 | `string` | 是 | 未声明 | 文档正文，使用Markdown格式；系统会转换为块编辑器内容并生成HTML快照 |
| `--contentType` | 请求体 | `string` | 否 | 未声明 | 文档格式(doc 按Markdown处理，支持团队协同编辑 \| html 旧格式，直接保存HTML，不支持团队协同编辑) |

`--docID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-doc-updatemodule"></a>

#### `zentao doc updateModule` · 修改文档库目录

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc updateModule --moduleID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 文档库目录名称 |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-doc-deletespace"></a>

#### `zentao doc deleteSpace` · 删除文档空间

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc deleteSpace --spaceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 空间ID |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-deletelib"></a>

#### `zentao doc deleteLib` · 删除文档库

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc deleteLib --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--libID` | 路径 | `number` | 是 | 未声明 | 文档库ID |

`--libID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-delete"></a>

#### `zentao doc delete` · 删除文档

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc delete --docID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--docID` | 路径 | `number` | 是 | 未声明 | 文档ID |

`--docID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-doc-deletemodule"></a>

#### `zentao doc deleteModule` · 删除文档库目录

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao doc deleteModule --moduleID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--moduleID` | 路径 | `number` | 是 | 未声明 | 模块ID |

`--moduleID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-todo"></a>

### todo · 待办

待办管理，支持创建待办、获取待办详情、编辑待办、删除待办

快捷用法与字段查询：

```text
zentao todo <id>
zentao todo props --format=json
zentao help todo
```

此模块没有默认 list；请明确指定下表中的操作。

| 操作 | 用途 |
| --- | --- |
| [create](#action-todo-create) | 创建待办 |
| [get](#action-todo-get) | 获取待办详情 |
| [update](#action-todo-update) | 编辑待办 |
| [delete](#action-todo-delete) | 删除待办 |

<a id="action-todo-create"></a>

#### `zentao todo create` · 创建待办

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao todo create --date=<string> --type=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--date` | 请求体 | `string` | 是 | 未声明 | 日期 |
| `--type` | 请求体 | `string` | 是 | 未声明 | 类型：custom 自定义 \| task 任务 \| bug 缺陷 \| story 研发需求 \| epic 业务需求 \| requirement 用户需求 \| testtask 测试单 |
| `--name` | 请求体 | `string` | 否 | 未声明 | 待办名称，type为custom时必填；type为非custom时由关联对象的名称或标题自动生成 |
| `--objectID` | 请求体 | `number` | 否 | 未声明 | 关联对象ID，type为非custom时必填，必须是type对应对象的ID<br>格式：int32<br>必须为整数 |
| `--begin` | 请求体 | `string` | 否 | 未声明 | 开始时间，使用小时+分钟拼接 |
| `--end` | 请求体 | `string` | 否 | 未声明 | 结束时间，使用小时+分钟拼接 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 待办详情 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-todo-get"></a>

#### `zentao todo get` · 获取待办详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao todo get --todoID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--todoID` | 路径 | `number` | 是 | 未声明 | 待办ID |

`--todoID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-todo-update"></a>

#### `zentao todo update` · 编辑待办

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao todo update --todoID=<number> --date=<string> --type=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--todoID` | 路径 | `number` | 是 | 未声明 | 待办ID |
| `--date` | 请求体 | `string` | 是 | 未声明 | 日期 |
| `--type` | 请求体 | `string` | 是 | 未声明 | 类型：custom 自定义 \| task 任务 \| bug 缺陷 \| story 研发需求 \| epic 业务需求 \| requirement 用户需求 \| testtask 测试单 |
| `--name` | 请求体 | `string` | 否 | 未声明 | 待办名称，type为custom时必填；type为非custom时由关联对象的名称或标题自动生成 |
| `--objectID` | 请求体 | `number` | 否 | 未声明 | 关联对象ID，type为非custom时必填，必须是type对应对象的ID<br>格式：int32<br>必须为整数 |
| `--begin` | 请求体 | `string` | 否 | 未声明 | 开始时间，使用小时+分钟拼接 |
| `--end` | 请求体 | `string` | 否 | 未声明 | 结束时间，使用小时+分钟拼接 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派给 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 待办详情 |

`--todoID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-todo-delete"></a>

#### `zentao todo delete` · 删除待办

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao todo delete --todoID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--todoID` | 路径 | `number` | 是 | 未声明 | 待办ID |

`--todoID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-my"></a>

### my · 地盘

地盘管理，支持我的待办、指派给我的任务、指派给我的Bug、指派给我的研发需求、指派给我的业务需求、指派给我的用户需求、我负责的的测试单、我参与的项目、指派给我的反馈、指派给我的工单、指派给我的用例、我的会议、指派给我的问题、指派给我的风险、我的地盘-贡献任务、我的地盘-贡献 Bug、我的地盘-贡献研发需求、我的地盘-贡献业务需求、我的地盘-贡献用户需求、我的地盘-贡献测试单、我的地盘-贡献用例、我的地盘-贡献文档、我的地盘-贡献问题、我的地盘-贡献风险、我的地盘-贡献评审问题、我的地盘-贡献反馈、我的地盘-贡献审批、我的地盘-待处理评审问题、我的地盘-待处理审批、我的地盘-待处理审计计划、我的地盘-待处理不符合项

快捷用法与字段查询：

```text
zentao my props --format=json
zentao help my
```

此模块没有默认 list；请明确指定下表中的操作。

| 操作 | 用途 |
| --- | --- |
| [todos](#action-my-todos) | 我的待办 |
| [tasks](#action-my-tasks) | 指派给我的任务 |
| [bugs](#action-my-bugs) | 指派给我的Bug |
| [stories](#action-my-stories) | 指派给我的研发需求 |
| [epics](#action-my-epics) | 指派给我的业务需求 |
| [requirements](#action-my-requirements) | 指派给我的用户需求 |
| [testtasks](#action-my-testtasks) | 我负责的的测试单 |
| [projects](#action-my-projects) | 我参与的项目 |
| [feedbacks](#action-my-feedbacks) | 指派给我的反馈 |
| [tickets](#action-my-tickets) | 指派给我的工单 |
| [testcases](#action-my-testcases) | 指派给我的用例 |
| [meetings](#action-my-meetings) | 我的会议 |
| [issues](#action-my-issues) | 指派给我的问题 |
| [risks](#action-my-risks) | 指派给我的风险 |
| [activityTasks](#action-my-activitytasks) | 我的地盘-贡献任务 |
| [activityBugs](#action-my-activitybugs) | 我的地盘-贡献 Bug |
| [activityStories](#action-my-activitystories) | 我的地盘-贡献研发需求 |
| [activityEpics](#action-my-activityepics) | 我的地盘-贡献业务需求 |
| [activityRequirements](#action-my-activityrequirements) | 我的地盘-贡献用户需求 |
| [activityTestTasks](#action-my-activitytesttasks) | 我的地盘-贡献测试单 |
| [activityTestCases](#action-my-activitytestcases) | 我的地盘-贡献用例 |
| [activityDocs](#action-my-activitydocs) | 我的地盘-贡献文档 |
| [activityIssues](#action-my-activityissues) | 我的地盘-贡献问题 |
| [activityRisks](#action-my-activityrisks) | 我的地盘-贡献风险 |
| [activityReviewIssues](#action-my-activityreviewissues) | 我的地盘-贡献评审问题 |
| [activityFeedbacks](#action-my-activityfeedbacks) | 我的地盘-贡献反馈 |
| [activityAudits](#action-my-activityaudits) | 我的地盘-贡献审批 |
| [reviewIssues](#action-my-reviewissues) | 我的地盘-待处理评审问题 |
| [audits](#action-my-audits) | 我的地盘-待处理审批 |
| [auditPlans](#action-my-auditplans) | 我的地盘-待处理审计计划 |
| [ncs](#action-my-ncs) | 我的地盘-待处理不符合项 |
| [createSSH](#action-my-createssh) | 添加我的 SSH 公钥 |

<a id="action-my-todos"></a>

#### `zentao my todos` · 我的待办

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my todos [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--status` | 查询 | `string` | 否 | 未声明 | 待办状态；browseType=undone 时传 undone。 |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 状态，默认是all<br>可选值：all（全部）；today（今天）；thisWeek（本周）；thisMonth（本月）；future（将来）；undone（未完成，需同时传 status=undone）；cycle（周期待办）；assignedToOther（指派他人） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序(date_desc,status,begin 日期/状态/开始时间) |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-tasks"></a>

#### `zentao my tasks` · 指派给我的任务

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my tasks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值区分大小写<br>可选值：assignedTo（指派给我）；openedBy（由我创建）；finishedBy（由我完成）；myInvolved（由我参与）；closedBy（由我关闭）；canceledBy（由我取消）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序）；pri_asc（优先级 升序）；pri_desc（优先级 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(任务名称，示例：关键字)；keywords(关键词，示例：关键字)；id(编号，示例：1)；status(任务状态，枚举：wait 未开始 \| doing 进行中 \| done 已完成 \| pause 已暂停 \| cancel 已取消 \| closed 已关闭)；desc(任务描述，示例：关键字)；assignedTo(指派给，用户，示例：admin)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；project(所属项目，示例：all)；execution(所属执行，示例：all)；module(所属模块，示例：all)；estimate(最初预计，示例：关键字)；left(预计剩余，示例：关键字)；consumed(总计消耗，示例：关键字)；type(任务类型，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；story(相关用户故事，示例：all)；fromBug(来源Bug编号，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；closedReason(关闭原因，枚举：done 已完成 \| cancel 已取消)；openedBy(由谁创建，用户，示例：admin)；finishedBy(由谁完成，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；canceledBy(由谁取消，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedDate(创建日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；estStarted(预计开始，示例：2026-01-01)；realStarted(实际开始，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；finishedDate(实际完成，示例：2026-01-01)；closedDate(关闭时间，示例：2026-01-01)；canceledDate(取消时间，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-bugs"></a>

#### `zentao my bugs` · 指派给我的Bug

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my bugs [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值取自 zt_bug 的字段名（区分大小写）<br>可选值：assignedTo（指派给我）；openedBy（由我创建）；resolvedBy（由我解决）；closedBy（由我关闭）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序）；severity_asc（严重程度 升序）；severity_desc（严重程度 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active 激活 \| resolved 已解决 \| closed 已关闭)；confirmed(是否确认，枚举：1 已确认 \| 0 未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1 \| 2 \| 3 \| 4)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；type(Bug类型，枚举：codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| codeimprovement 代码改进 \| others 其他)；os(操作系统，枚举：all 全部 \| windows Windows \| win11 Windows 11 \| win10 Windows 10 \| win8 Windows 8 \| win7 Windows 7 \| winxp Windows XP \| osx Mac OS \| android Android \| ios IOS \| linux Linux \| ubuntu Ubuntu \| chromeos Chrome OS \| fedora Fedora \| unix Unix \| others 其他)；browser(浏览器，枚举：all 全部 \| chrome Chrome \| edge Edge \| ie IE系列 \| ie11 IE11 \| ie10 IE10 \| ie9 IE9 \| ie8 IE8 \| firefox firefox系列 \| opera Opera系列 \| safari \| 360 360浏览器 \| qq QQ浏览器 \| other 其他)；resolution(解决方案，枚举：bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因 \| fixed 已解决 \| notrepro 无法重现 \| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-stories"></a>

#### `zentao my stories` · 指派给我的研发需求

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my stories [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值区分大小写<br>可选值：all（全部）；assignedTo（指派给我）；openedBy（由我创建）；reviewBy（待我评审）；reviewedBy（我评审过）；closedBy（由我关闭）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-epics"></a>

#### `zentao my epics` · 指派给我的业务需求

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my epics [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值区分大小写<br>可选值：all（全部）；assignedTo（指派给我）；openedBy（由我创建）；reviewBy（待我评审）；reviewedBy（我评审过）；closedBy（由我关闭）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-requirements"></a>

#### `zentao my requirements` · 指派给我的用户需求

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my requirements [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值区分大小写<br>可选值：all（全部）；assignedTo（指派给我）；openedBy（由我创建）；reviewBy（待我评审）；reviewedBy（我评审过）；closedBy（由我关闭）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-testtasks"></a>

#### `zentao my testtasks` · 我负责的的测试单

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my testtasks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，接口固定返回“我参与的未完成测试单”<br>可选值：assignedTo（我参与的）；bySearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-projects"></a>

#### `zentao my projects` · 我参与的项目

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my projects [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"doing"` | 状态，默认是doing<br>可选值：doing（进行中）；wait（未开始）；suspended（已挂起）；closed（已关闭）；done（已完成）；undone（未完成）；delayed（已延期）；openedbyme（由我创建）；all（全部） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-feedbacks"></a>

#### `zentao my feedbacks` · 指派给我的反馈

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my feedbacks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"assigntome"` | 状态，默认是assigntome<br>可选值：assigntome（指派给我）；unclosed（未关闭）；wait（待处理）；doing（处理中）；toclosed（待关闭）；openedbyme（由我创建）；reviewedbyme（我评审过）；closedbyme（由我关闭）；assignedbyme（由我指派） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-tickets"></a>

#### `zentao my tickets` · 指派给我的工单

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my tickets [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"assignedtome"` | 状态，默认是assignedtome<br>可选值：assignedtome（指派给我）；unclosed（未关闭）；wait（待处理）；doing（处理中）；done（待关闭）；closed（已关闭）；openedbyme（由我创建）；finishedbyme（由我解决）；closedbyme（由我关闭）；assignedbyme（由我指派） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedCount,activatedDate,assignedTo,closedBy,closedDate,closedReason,contact,customer,deadline,desc,editedBy,editedDate,feedback,id,keywords,mailto,module,notifyEmail,openedBuild,openedBy,openedDate,pri,product,resolution,resolvedBy,resolvedDate,startedBy,startedDate,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-testcases"></a>

#### `zentao my testcases` · 指派给我的用例

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my testcases [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assigntome"` | 状态，默认是assigntome<br>可选值：assigntome（指派给我）；openedbyme（我创建的）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)；auto(自动化，枚举：auto 是 \| no 否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait 待评审 \| normal 正常 \| blocked 被阻塞 \| investigate 研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest 单元测试环节 \| feature 功能测试环节 \| intergrate 集成测试环节 \| system 系统测试环节 \| smoke 冒烟测试环节 \| bvt 版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 \| 1 \| 2 \| 4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass 通过 \| fail 失败 \| blocked 阻塞 \| null 未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-meetings"></a>

#### `zentao my meetings` · 我的会议

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my meetings [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"futureMeeting"` | 状态，默认是futureMeeting<br>可选值：futureMeeting（我参加的（未开始））；all（全部）；booked（我预约的）；participate（我参加的（全部）） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；date_asc（日期 升序）；date_desc（日期 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-issues"></a>

#### `zentao my issues` · 指派给我的问题

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my issues [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值取自 zt_issue 的字段名<br>可选值：assignedTo（指派给我）；createdBy（由我创建）；resolvedBy（由我解决）；closedBy（由我关闭）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；title_asc（标题 升序）；title_desc（标题 降序）；severity_asc（严重程度 升序）；severity_desc（严重程度 降序）；status_asc（状态 升序）；status_desc（状态 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-risks"></a>

#### `zentao my risks` · 指派给我的风险

最低禅道版本：`22.5` / `biz13.5` / `max8.5` / `ipd5.5`。

```text
zentao my risks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 状态，默认是assignedTo，取值取自 zt_risk 的字段名<br>可选值：assignedTo（指派给我）；createdBy（由我创建）；closedBy（由我关闭）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称 升序）；name_desc（名称 降序）；status_asc（状态 升序）；status_desc（状态 降序）；pri_asc（优先级 升序）；pri_desc（优先级 降序） |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activitytasks"></a>

#### `zentao my activityTasks` · 我的地盘-贡献任务

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityTasks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：name(任务名称，示例：关键字)；keywords(关键词，示例：关键字)；id(编号，示例：1)；status(任务状态，枚举：wait 未开始 \| doing 进行中 \| done 已完成 \| pause 已暂停 \| cancel 已取消 \| closed 已关闭)；desc(任务描述，示例：关键字)；assignedTo(指派给，用户，示例：admin)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；project(所属项目，示例：all)；execution(所属执行，示例：all)；module(所属模块，示例：all)；estimate(最初预计，示例：关键字)；left(预计剩余，示例：关键字)；consumed(总计消耗，示例：关键字)；type(任务类型，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；story(相关用户故事，示例：all)；fromBug(来源Bug编号，枚举：design 设计 \| devel 开发 \| request 需求 \| test 测试 \| study 研究 \| discuss 讨论 \| ui 界面 \| affair 事务 \| misc 其他)；closedReason(关闭原因，枚举：done 已完成 \| cancel 已取消)；openedBy(由谁创建，用户，示例：admin)；finishedBy(由谁完成，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；canceledBy(由谁取消，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedDate(创建日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；estStarted(预计开始，示例：2026-01-01)；realStarted(实际开始，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；finishedDate(实际完成，示例：2026-01-01)；closedDate(关闭时间，示例：2026-01-01)；canceledDate(取消时间，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activitybugs"></a>

#### `zentao my activityBugs` · 我的地盘-贡献 Bug

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityBugs [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(Bug标题，示例：关键字)；module(所属模块，模块，示例：0)；keywords(关键词，示例：关键字)；steps(重现步骤，示例：关键字)；assignedTo(指派给，用户，示例：admin)；resolvedBy(解决者，用户，示例：admin)；status(Bug状态，枚举：active 激活 \| resolved 已解决 \| closed 已关闭)；confirmed(是否确认，枚举：1 已确认 \| 0 未确认)；story(相关需求，示例：关键字)；project(所属项目，示例：all)；product(所属产品，示例：all)；branch(branch，示例：all)；plan(所属计划，示例：all)；id(Bug编号，示例：1)；execution(所属执行，执行，示例：3)；severity(严重程度，枚举：1 \| 2 \| 3 \| 4)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；type(Bug类型，枚举：codeerror 代码错误 \| config 配置相关 \| install 安装部署 \| security 安全相关 \| performance 性能问题 \| standard 标准规范 \| automation 测试脚本 \| designdefect 设计缺陷 \| codeimprovement 代码改进 \| others 其他)；os(操作系统，枚举：all 全部 \| windows Windows \| win11 Windows 11 \| win10 Windows 10 \| win8 Windows 8 \| win7 Windows 7 \| winxp Windows XP \| osx Mac OS \| android Android \| ios IOS \| linux Linux \| ubuntu Ubuntu \| chromeos Chrome OS \| fedora Fedora \| unix Unix \| others 其他)；browser(浏览器，枚举：all 全部 \| chrome Chrome \| edge Edge \| ie IE系列 \| ie11 IE11 \| ie10 IE10 \| ie9 IE9 \| ie8 IE8 \| firefox firefox系列 \| opera Opera系列 \| safari \| 360 360浏览器 \| qq QQ浏览器 \| other 其他)；resolution(解决方案，枚举：bydesign 设计如此 \| duplicate 重复Bug \| external 外部原因 \| fixed 已解决 \| notrepro 无法重现 \| postponed 延期处理 \| willnotfix 不予解决 \| tostory 转为用户故事)；activatedCount(激活次数，示例：关键字)；toTask(转任务，示例：关键字)；toStory(转用户故事，示例：关键字)；openedBy(由谁创建，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(修改者，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；openedBuild(影响版本，示例：builds)；resolvedBuild(解决版本，示例：builds)；openedDate(创建日期，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；resolvedDate(解决日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；deadline(截止日期，示例：2026-01-01)；activatedDate(激活时间，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activitystories"></a>

#### `zentao my activityStories` · 我的地盘-贡献研发需求

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityStories [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityepics"></a>

#### `zentao my activityEpics` · 我的地盘-贡献业务需求

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityEpics [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityrequirements"></a>

#### `zentao my activityRequirements` · 我的地盘-贡献用户需求

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityRequirements [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(需求名称，示例：关键字)；id(编号，示例：1)；keywords(关键词，示例：关键字)；status(当前状态，枚举：draft 草稿 \| reviewing 评审中 \| active 激活 \| changing 变更中 \| closed 已关闭)；pri(优先级，枚举：1 \| 2 \| 3 \| 4)；module(所属模块，示例：all)；stage(所处阶段，枚举：wait 未开始 \| planned 已计划 \| projected 研发立项 \| designing 设计中 \| designed 设计完毕 \| developing 研发中 \| developed 研发完毕 \| testing 测试中 \| tested 测试完毕 \| verified 已验收 \| rejected 验收失败 \| delivering 交付中 \| delivered 已交付 \| released 已发布 \| closed 已关闭)；product(所属产品，示例：all)；branch(branch，示例：all)；grade(需求层级，示例：all)；plan(所属计划，示例：all)；release(所属发布，示例：all)；estimate(预计小时，示例：关键字)；source(来源，枚举：customer 客户 \| user 用户 \| po 产品经理 \| market 市场 \| service 客服 \| operation 运营 \| support 技术支持 \| competitor 竞争对手 \| partner 合作伙伴 \| dev 开发人员 \| tester 测试人员 \| bug Bug \| forum 论坛 \| other 其他)；sourceNote(来源备注，示例：关键字)；fromBug(来源Bug，示例：关键字)；category(类别，枚举：feature 功能 \| interface 接口 \| performance 性能 \| safe 安全 \| experience 体验 \| improve 改进 \| other 其他)；openedBy(由谁创建，用户，示例：admin)；reviewedBy(已评审人，用户，示例：admin)；result(评审结果，枚举：pass 确认通过 \| revert 撤销变更 \| clarify 有待明确 \| reject 拒绝)；assignedTo(指派给，用户，示例：admin)；closedBy(由谁关闭，用户，示例：admin)；lastEditedBy(最后修改，用户，示例：admin)；mailto(抄送给，用户，示例：admin)；closedReason(关闭原因，枚举：done 已完成 \| subdivided 已拆分 \| duplicate 重复 \| postponed 延期 \| willnotdo 不做 \| cancel 已取消 \| bydesign 设计如此)；version(版本号，示例：关键字)；openedDate(创建日期，示例：2026-01-01)；reviewedDate(评审时间，示例：2026-01-01)；assignedDate(指派日期，示例：2026-01-01)；closedDate(关闭日期，示例：2026-01-01)；lastEditedDate(最后修改日期，示例：2026-01-01)；activatedDate(激活日期，示例：2026-01-01) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activitytesttasks"></a>

#### `zentao my activityTestTasks` · 我的地盘-贡献测试单

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityTestTasks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activitytestcases"></a>

#### `zentao my activityTestCases` · 我的地盘-贡献用例

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityTestCases [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：title(用例名称，示例：关键字)；story(关联需求，示例：all)；id(用例编号，示例：1)；keywords(关键词，示例：关键字)；lastEditedBy(修改者，用户，示例：admin)；type(用例类型，枚举：unit 单元测试 \| interface 接口测试 \| feature 功能测试 \| install 安装部署 \| config 配置相关 \| performance 性能测试 \| security 安全相关 \| other 其他)；auto(自动化，枚举：auto 是 \| no 否)；openedBy(由谁创建，用户，示例：admin)；status(用例状态，枚举：wait 待评审 \| normal 正常 \| blocked 被阻塞 \| investigate 研究中)；product(所属产品，示例：all)；branch(branch，示例：all)；stage(适用环节，枚举：unittest 单元测试环节 \| feature 功能测试环节 \| intergrate 集成测试环节 \| system 系统测试环节 \| smoke 冒烟测试环节 \| bvt 版本验证环节)；module(所属模块，模块，示例：0)；pri(优先级，枚举：3 \| 1 \| 2 \| 4)；lib(所属库，示例：all)；lastRunner(执行人，用户，示例：admin)；lastRunResult(结果，枚举：pass 通过 \| fail 失败 \| blocked 阻塞 \| null 未执行)；lastRunDate(执行时间，示例：2026-01-01)；openedDate(创建日期，示例：2026-01-01)；lastEditedDate(修改日期，示例：2026-01-01)；scene(所属场景，示例：all) |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activitydocs"></a>

#### `zentao my activityDocs` · 我的地盘-贡献文档

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityDocs [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityissues"></a>

#### `zentao my activityIssues` · 我的地盘-贡献问题

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityIssues [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityrisks"></a>

#### `zentao my activityRisks` · 我的地盘-贡献风险

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityRisks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activateBy,actualClosedDate,assignedTo,cancelBy,category,createdBy,createdDate,editedBy,editedDate,hangupBy,id,identifiedDate,impact,name,plannedClosedDate,prevention,pri,probability,project,rate,remedy,resolution,resolvedBy,source,status,strategy,trackedBy |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityreviewissues"></a>

#### `zentao my activityReviewIssues` · 我的地盘-贡献评审问题

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityReviewIssues [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,createdBy,createdDate,id,opinion,resolution,review,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityfeedbacks"></a>

#### `zentao my activityFeedbacks` · 我的地盘-贡献反馈

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityFeedbacks [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,activatedDate,assignedTo,closedBy,closedDate,closedReason,desc,feedbackBy,id,keywords,mailto,module,notifyEmail,openedBy,openedDate,pri,processedBy,processedDate,product,public,reviewedBy,solution,source,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-activityaudits"></a>

#### `zentao my activityAudits` · 我的地盘-贡献审批

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my activityAudits [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 贡献筛选类型，不传时使用禅道页面默认值。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-reviewissues"></a>

#### `zentao my reviewIssues` · 我的地盘-待处理评审问题

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my reviewIssues [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 或 bySearch 时必填。 |
| `--browseType` | 查询 | `string` | 否 | `"assignedTo"` | 待处理筛选类型，默认 assignedTo，取值取自 zt_reviewissue 的字段名<br>可选值：assignedTo（指派给我）；createdBy（由我创建）；resolutionBy（由我解决）；assignedBy（由我指派）；bysearch（按查询搜索，需同时传 param） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedDate,assignedTo,createdBy,createdDate,id,opinion,resolution,review,status,title,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-audits"></a>

#### `zentao my audits` · 我的地盘-待处理审批

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my audits [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 待处理审批类型，默认 all<br>可选值：all（全部）；demand（需求池需求）；story（研发需求）；requirement（用户需求）；epic（业务需求）；testcase（用例）；project（项目）；ppm（评审请求）；feedback（反馈）；自定义工作流模块代号（自定义工作流模块代号） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-auditplans"></a>

#### `zentao my auditPlans` · 我的地盘-待处理审计计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my auditPlans [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"mychecking"` | 待处理筛选类型，默认 mychecking，取值不区分大小写<br>可选值：mychecking（待我检查）；checked（已检查）；wait（未检查）；checking（检查中）；assignto（指派给我）；delay（已延期）；iscycle（周期性计划）；all（全部） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-ncs"></a>

#### `zentao my ncs` · 我的地盘-待处理不符合项

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao my ncs [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"assignedToMe"` | 待处理筛选类型，默认 assignedToMe<br>可选值：assignedToMe（指派给我）；createdByMe（由我创建）；resolvedByMe（由我解决）；closedByMe（由我关闭）；all（全部） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量，不超过1000 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码，从第1页开始<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-my-createssh"></a>

#### `zentao my createSSH` · 添加我的 SSH 公钥

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

需部署代码库 API 2.0 实现并配置 GitFox，将公钥添加到当前 Token 用户的 GitFox 账号，account 不能改变归属。成功仅返回 message，不返回密钥 ID；公钥错误保留在 rawMessage.publicKey 中。

```text
zentao my createSSH --name=<string> --publicKey=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--name` | 请求体 | `string` | 是 | 未声明 | 密钥名称，去除首尾空白后仅允许英文字母、数字、连字符、下划线、点和 $<br>最小长度：1 |
| `--publicKey` | 请求体 | `string` | 是 | 未声明 | 完整单行 SSH 公钥文本，去除首尾空白；支持 ssh-rsa、ecdsa-sha2-nistp256/384/521、ssh-ed25519、sk-ecdsa-sha2-nistp256@openssh.com、sk-ssh-ed25519@openssh.com 前缀，完整性及重复检查由 GitFox 处理<br>最小长度：1 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-process"></a>

### process · 过程裁剪

过程裁剪管理，支持获取过程裁剪列表，支持获取项目/执行下的过程裁剪、提交项目过程裁剪结果、提交执行过程裁剪结果

快捷用法与字段查询：

```text
zentao process [列表参数]
zentao process props --format=json
zentao help process
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-process-list) | 获取过程裁剪列表，支持获取项目/执行下的过程裁剪 |
| [setProject](#action-process-setproject) | 提交项目过程裁剪结果 |
| [setExecution](#action-process-setexecution) | 提交执行过程裁剪结果 |

<a id="action-process-list"></a>

#### `zentao process list` · 获取过程裁剪列表，支持获取项目/执行下的过程裁剪

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao process list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 过程裁剪所属范围<br>可选值：projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"wait"` | 过程裁剪筛选类型，默认 wait<br>可选值：wait（待裁剪）；yes（已裁剪适用）；no（已裁剪不适用） |
| `--moduleID` | 查询 | `number` | 否 | `"0"` | 过程 ID，用于只查询指定过程下的活动和交付物；默认 0。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-process-setproject"></a>

#### `zentao process setProject` · 提交项目过程裁剪结果

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao process setProject --projectID=<number> --items=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--items` | 请求体 | `string[]` | 是 | 未声明 | 裁剪结果列表，每项包含 type(activity 活动 \| deliverable 交付物)、id(对象ID)、result(yes 适用 \| no 不适用)<br>数组元素类型：string |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-process-setexecution"></a>

#### `zentao process setExecution` · 提交执行过程裁剪结果

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao process setExecution --executionID=<number> --items=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--items` | 请求体 | `string[]` | 是 | 未声明 | 裁剪结果列表，每项包含 type(activity 活动 \| deliverable 交付物)、id(对象ID)、result(yes 适用 \| no 不适用)<br>数组元素类型：string |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-auditplan"></a>

### auditplan · 质量保证计划

质量保证计划管理，支持获取质量保证计划列表，支持获取项目/执行下的质量保证计划、新增质量保证计划、检查质量保证计划、批量新增项目质量保证计划、获取质量保证详情、编辑质量保证计划、删除质量保证计划

快捷用法与字段查询：

```text
zentao auditplan <id>
zentao auditplan [列表参数]
zentao auditplan props --format=json
zentao help auditplan
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-auditplan-list) | 获取质量保证计划列表，支持获取项目/执行下的质量保证计划 |
| [create](#action-auditplan-create) | 新增质量保证计划 |
| [check](#action-auditplan-check) | 检查质量保证计划 |
| [batchCreate](#action-auditplan-batchcreate) | 批量新增项目质量保证计划 |
| [get](#action-auditplan-get) | 获取质量保证详情 |
| [update](#action-auditplan-update) | 编辑质量保证计划 |
| [delete](#action-auditplan-delete) | 删除质量保证计划 |

<a id="action-auditplan-list"></a>

#### `zentao auditplan list` · 获取质量保证计划列表，支持获取项目/执行下的质量保证计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 质量保证计划所属范围<br>可选值：projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 筛选类型，默认 all<br>可选值：all（全部）；wait（待检查）；checking（检查中）；checked（已检查）；assignto（指派给我）；delay（已延期）；today（今天）；yesterday（昨天）；lastmonth（上月）；month（本月）；nextmonth（下月）；iscycle（周期计划） |
| `--param` | 查询 | `number` | 否 | 未声明 | 筛选参数。browseType=bysearch 时传查询 ID；按过程筛选时传过程 ID；按执行筛选时传执行 ID。 |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：assignedTo,checkDate,checkedBy,createdBy,createdDate,execution,id,objectID,process,realCheckDate,status |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-auditplan-create"></a>

#### `zentao auditplan create` · 新增质量保证计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan create --projectID=<number> --process=<number> --objectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 请求体 | `number` | 是 | 未声明 | 所属项目或执行 ID<br>格式：int32<br>必须为整数 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级计划传 0；敏捷多执行项目下需要传执行 ID<br>格式：int32<br>必须为整数 |
| `--process` | 请求体 | `number` | 是 | 未声明 | 所属过程 ID<br>格式：int32<br>必须为整数 |
| `--objectID` | 请求体 | `number` | 是 | 未声明 | 检查对象 ID（活动或交付物 ID）<br>格式：int32<br>必须为整数 |
| `--objectType` | 请求体 | `string` | 否 | 未声明 | 检查对象类型(activity 活动 \| zoutput 交付物) |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态(wait 待检查 \| checking 检查中 \| checked 已检查) |
| `--isCycle` | 请求体 | `number` | 否 | 未声明 | 是否周期计划(0 否 \| 1 是)<br>格式：int32<br>必须为整数 |
| `--checkDateList` | 请求体 | `string[]` | 否 | 未声明 | 计划检查日期列表<br>数组元素类型：string |
| `--assignedToList` | 请求体 | `string[]` | 否 | 未声明 | 检查人账号列表<br>数组元素类型：string |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-auditplan-check"></a>

#### `zentao auditplan check` · 检查质量保证计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan check --auditplanID=<number> --listID=<string[]> --result=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--auditplanID` | 路径 | `number` | 是 | 未声明 | auditplanID |
| `--listID` | 请求体 | `string[]` | 是 | 未声明 | 检查清单项 ID 列表<br>数组元素类型：string |
| `--result` | 请求体 | `string[]` | 是 | 未声明 | 检查结果列表(pass 通过 \| fail 不通过)<br>数组元素类型：string |
| `--status` | 请求体 | `string[]` | 否 | 未声明 | 结果状态列表(normal 正式提交 \| draft 草稿)<br>数组元素类型：string |

`--auditplanID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-auditplan-batchcreate"></a>

#### `zentao auditplan batchCreate` · 批量新增项目质量保证计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan batchCreate --projectID=<number> --process=<string[]> --objectID=<string[]> --checkDate=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--process` | 请求体 | `string[]` | 是 | 未声明 | 过程 ID 列表<br>数组元素类型：string |
| `--execution` | 请求体 | `string[]` | 否 | 未声明 | 执行 ID 列表，项目级计划传 0<br>数组元素类型：string |
| `--objectID` | 请求体 | `string[]` | 是 | 未声明 | 检查对象 ID 列表<br>数组元素类型：string |
| `--objectType` | 请求体 | `string[]` | 否 | 未声明 | 对象类型列表(activity 活动 \| zoutput 交付物)<br>数组元素类型：string |
| `--checkDate` | 请求体 | `string[]` | 是 | 未声明 | 计划检查日期列表<br>数组元素类型：string |
| `--assignedTo` | 请求体 | `string[]` | 否 | 未声明 | 指派人账号列表<br>数组元素类型：string |
| `--status` | 请求体 | `string[]` | 否 | 未声明 | 状态列表(wait 待检查 \| checking 检查中 \| checked 已检查)<br>数组元素类型：string |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-auditplan-get"></a>

#### `zentao auditplan get` · 获取质量保证详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan get --auditplanID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--auditplanID` | 路径 | `number` | 是 | 未声明 | auditplanID |

`--auditplanID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-auditplan-update"></a>

#### `zentao auditplan update` · 编辑质量保证计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan update --auditplanID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--auditplanID` | 路径 | `number` | 是 | 未声明 | auditplanID |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级计划传 0。<br>格式：int32<br>必须为整数 |
| `--process` | 请求体 | `number` | 否 | 未声明 | 所属过程 ID。<br>格式：int32<br>必须为整数 |
| `--objectID` | 请求体 | `number` | 否 | 未声明 | 检查对象 ID。<br>格式：int32<br>必须为整数 |
| `--objectType` | 请求体 | `string` | 否 | 未声明 | 检查对象类型(activity 活动 \| zoutput 交付物) |
| `--status` | 请求体 | `string` | 否 | 未声明 | 状态(wait 待检查 \| checking 检查中 \| checked 已检查) |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派人账号。 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 编辑备注。 |

`--auditplanID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-auditplan-delete"></a>

#### `zentao auditplan delete` · 删除质量保证计划

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao auditplan delete --auditplanID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--auditplanID` | 路径 | `number` | 是 | 未声明 | auditplanID |

`--auditplanID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-nc"></a>

### nc · 不符合项

不符合项管理，支持获取不符合项列表，支持获取项目/执行下的不符合项、新建项目不符合项、新建执行不符合项、获取不符合项详情、编辑不符合项、删除不符合项

快捷用法与字段查询：

```text
zentao nc <id>
zentao nc [列表参数]
zentao nc props --format=json
zentao help nc
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-nc-list) | 获取不符合项列表，支持获取项目/执行下的不符合项 |
| [createProject](#action-nc-createproject) | 新建项目不符合项 |
| [createExecution](#action-nc-createexecution) | 新建执行不符合项 |
| [get](#action-nc-get) | 获取不符合项详情 |
| [update](#action-nc-update) | 编辑不符合项 |
| [delete](#action-nc-delete) | 删除不符合项 |

<a id="action-nc-list"></a>

#### `zentao nc list` · 获取不符合项列表，支持获取项目/执行下的不符合项

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao nc list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 不符合项所属范围<br>可选值：projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"unclosed"` | 筛选类型，默认 unclosed<br>可选值：all（全部）；unclosed（未关闭）；assignedtome（指派给我）；assignedbyme（由我指派）；bysearch（搜索） |
| `--param` | 查询 | `string` | 否 | 未声明 | browseType=bysearch 时传查询 ID。 |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-nc-createproject"></a>

#### `zentao nc createProject` · 新建项目不符合项

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao nc createProject --projectID=<number> --objectType=<string> --title=<string> --severity=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--objectType` | 请求体 | `string` | 是 | 未声明 | 不符合项对象类型(auditplan 质量保证计划 \| deliverable 交付物) |
| `--title` | 请求体 | `string` | 是 | 未声明 | 不符合项名称 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级不符合项传 0<br>格式：int32<br>必须为整数 |
| `--auditplan` | 请求体 | `number` | 否 | 未声明 | 质量保证计划 ID，objectType=auditplan 时必填<br>格式：int32<br>必须为整数 |
| `--listID` | 请求体 | `number` | 否 | 未声明 | 检查清单项 ID，objectType=auditplan 时必填<br>格式：int32<br>必须为整数 |
| `--severity` | 请求体 | `number` | 是 | 未声明 | 严重程度(1 严重 \| 2 中等 \| 3 轻微)<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 不符合项分类 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-nc-createexecution"></a>

#### `zentao nc createExecution` · 新建执行不符合项

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao nc createExecution --executionID=<number> --objectType=<string> --title=<string> --severity=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--executionID` | 路径 | `number` | 是 | 未声明 | 执行ID |
| `--objectType` | 请求体 | `string` | 是 | 未声明 | 不符合项对象类型(auditplan 质量保证计划 \| deliverable 交付物) |
| `--title` | 请求体 | `string` | 是 | 未声明 | 不符合项名称 |
| `--auditplan` | 请求体 | `number` | 否 | 未声明 | 质量保证计划 ID，objectType=auditplan 时必填<br>格式：int32<br>必须为整数 |
| `--listID` | 请求体 | `number` | 否 | 未声明 | 检查清单项 ID，objectType=auditplan 时必填<br>格式：int32<br>必须为整数 |
| `--severity` | 请求体 | `number` | 是 | 未声明 | 严重程度(1 严重 \| 2 中等 \| 3 轻微)<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 不符合项分类 |

`--executionID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-nc-get"></a>

#### `zentao nc get` · 获取不符合项详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao nc get --ncID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ncID` | 路径 | `number` | 是 | 未声明 | ncID |

`--ncID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-nc-update"></a>

#### `zentao nc update` · 编辑不符合项

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao nc update --ncID=<number> --title=<string> --severity=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ncID` | 路径 | `number` | 是 | 未声明 | ncID |
| `--title` | 请求体 | `string` | 是 | 未声明 | 不符合项名称 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 不符合项分类 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级不符合项传 0。<br>格式：int32<br>必须为整数 |
| `--auditplan` | 请求体 | `number` | 否 | 未声明 | 质量保证计划 ID，基于质量保证计划的不符合项必填。<br>格式：int32<br>必须为整数 |
| `--listID` | 请求体 | `number` | 否 | 未声明 | 检查清单项 ID，基于质量保证计划的不符合项必填。<br>格式：int32<br>必须为整数 |
| `--severity` | 请求体 | `number` | 是 | 未声明 | 严重程度(1 严重 \| 2 中等 \| 3 轻微)<br>格式：int32<br>必须为整数 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派人账号。 |
| `--deadline` | 请求体 | `string` | 否 | 未声明 | 计划解决日期。 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 完成情况说明。 |

`--ncID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-nc-delete"></a>

#### `zentao nc delete` · 删除不符合项

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao nc delete --ncID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--ncID` | 路径 | `number` | 是 | 未声明 | ncID |

`--ncID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-opportunity"></a>

### opportunity · 机会

机会管理，支持获取机会列表，支持获取项目/执行下的机会、创建项目机会、批量创建项目机会、获取机会详情、编辑机会、删除机会

快捷用法与字段查询：

```text
zentao opportunity <id>
zentao opportunity [列表参数]
zentao opportunity props --format=json
zentao help opportunity
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-opportunity-list) | 获取机会列表，支持获取项目/执行下的机会 |
| [create](#action-opportunity-create) | 创建项目机会 |
| [batchCreate](#action-opportunity-batchcreate) | 批量创建项目机会 |
| [get](#action-opportunity-get) | 获取机会详情 |
| [update](#action-opportunity-update) | 编辑机会 |
| [delete](#action-opportunity-delete) | 删除机会 |

<a id="action-opportunity-list"></a>

#### `zentao opportunity list` · 获取机会列表，支持获取项目/执行下的机会

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao opportunity list --project=<id> [选项]
```

范围必填：用法中以 `--project` 为例，也可从 `--project=<id>`（项目）、`--execution=<id>`（执行） 中选择一个，代替 scope 与 scopeID。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--scope` | 路径 | `string` | 是 | 未声明 | 机会所属范围<br>可选值：projects（项目）；executions（执行） |
| `--scopeID` | 路径 | `number` | 是 | 未声明 | 所属范围ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 筛选类型，默认 all<br>可选值：all（全部）；active（开放）；assignTo（指派给我）；closed（已关闭）；hangup（已挂起）；canceled（已取消）；review（待评审）；bysearch（搜索） |
| `--param` | 查询 | `string` | 否 | 未声明 | 搜索参数；browseType=bysearch 时使用。 |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |
| `--filters` | 查询 | `array` | 否 | 未声明 | 搜索条件数组，每项包含 field/operator/value/join/group；field 必须是该接口支持的搜索字段，operator 使用该接口搜索配置支持的操作符。支持搜索字段：activatedBy,actualClosedDate,assignedTo,canceledBy,chance,createdBy,createdDate,desc,editedBy,editedDate,hangupedBy,id,identifiedDate,impact,lastCheckedBy,name,plannedClosedDate,prevention,pri,ratio,resolution,resolvedBy,source,status,strategy,type |
| `--groupJoin` | 查询 | `string` | 否 | 未声明 | 条件组之间的连接方式<br>可选值：and（and）；or（or） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-opportunity-create"></a>

#### `zentao opportunity create` · 创建项目机会

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao opportunity create --projectID=<number> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 机会名称。 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 机会来源。 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级机会传 0；传执行 ID 时机会同时归属项目和执行。<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 机会类型。 |
| `--strategy` | 请求体 | `string` | 否 | 未声明 | 机会应对策略。 |
| `--impact` | 请求体 | `number` | 否 | 未声明 | 影响程度，1-5。<br>格式：int32<br>必须为整数 |
| `--chance` | 请求体 | `number` | 否 | 未声明 | 发生概率，1-5。<br>格式：int32<br>必须为整数 |
| `--ratio` | 请求体 | `number` | 否 | 未声明 | 机会系数，通常为 impact * chance。<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，1 高、2 中、3 低。<br>格式：int32<br>必须为整数 |
| `--identifiedDate` | 请求体 | `string` | 否 | 未声明 | 机会识别日期。 |
| `--plannedClosedDate` | 请求体 | `string` | 否 | 未声明 | 计划关闭日期。 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派人账号。 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 机会描述。 |
| `--prevention` | 请求体 | `string` | 否 | 未声明 | 应对措施。 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-opportunity-batchcreate"></a>

#### `zentao opportunity batchCreate` · 批量创建项目机会

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao opportunity batchCreate --projectID=<number> --name=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string[]` | 是 | 未声明 | 机会名称列表<br>数组元素类型：string |
| `--source` | 请求体 | `string[]` | 否 | 未声明 | 机会来源列表<br>数组元素类型：string |
| `--execution` | 请求体 | `string[]` | 否 | 未声明 | 所属执行 ID 列表，项目级机会传 0<br>数组元素类型：string |
| `--impact` | 请求体 | `string[]` | 否 | 未声明 | 影响程度列表，1-5<br>数组元素类型：string |
| `--chance` | 请求体 | `string[]` | 否 | 未声明 | 发生概率列表，1-5<br>数组元素类型：string |
| `--pri` | 请求体 | `string[]` | 否 | 未声明 | 优先级列表，1 高、2 中、3 低<br>数组元素类型：string |
| `--desc` | 请求体 | `string[]` | 否 | 未声明 | 机会描述列表<br>数组元素类型：string |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-opportunity-get"></a>

#### `zentao opportunity get` · 获取机会详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao opportunity get --opportunityID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--opportunityID` | 路径 | `number` | 是 | 未声明 | opportunityID |

`--opportunityID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-opportunity-update"></a>

#### `zentao opportunity update` · 编辑机会

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao opportunity update --opportunityID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--opportunityID` | 路径 | `number` | 是 | 未声明 | opportunityID |
| `--name` | 请求体 | `string` | 否 | 未声明 | 机会名称。 |
| `--source` | 请求体 | `string` | 否 | 未声明 | 机会来源。 |
| `--execution` | 请求体 | `number` | 否 | 未声明 | 所属执行 ID，项目级机会传 0。<br>格式：int32<br>必须为整数 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 机会类型。 |
| `--strategy` | 请求体 | `string` | 否 | 未声明 | 机会应对策略。 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 机会状态(active 开放 \| closed 已关闭 \| hangup 已挂起 \| canceled 已取消) |
| `--impact` | 请求体 | `number` | 否 | 未声明 | 影响程度，1-5。<br>格式：int32<br>必须为整数 |
| `--chance` | 请求体 | `number` | 否 | 未声明 | 发生概率，1-5。<br>格式：int32<br>必须为整数 |
| `--pri` | 请求体 | `number` | 否 | 未声明 | 优先级，1 高、2 中、3 低。<br>格式：int32<br>必须为整数 |
| `--assignedTo` | 请求体 | `string` | 否 | 未声明 | 指派人账号。 |
| `--desc` | 请求体 | `string` | 否 | 未声明 | 机会描述。 |
| `--prevention` | 请求体 | `string` | 否 | 未声明 | 应对措施。 |

`--opportunityID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-opportunity-delete"></a>

#### `zentao opportunity delete` · 删除机会

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao opportunity delete --opportunityID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--opportunityID` | 路径 | `number` | 是 | 未声明 | opportunityID |

`--opportunityID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-deliverable"></a>

### deliverable · 交付物

交付物管理，支持获取交付物列表，支持获取项目下的交付物、获取项目可选交付物列表、新增项目交付物、获取交付物详情、删除项目交付物

快捷用法与字段查询：

```text
zentao deliverable <id>
zentao deliverable [列表参数]
zentao deliverable props --format=json
zentao help deliverable
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-deliverable-list) | 获取交付物列表，支持获取项目下的交付物 |
| [options](#action-deliverable-options) | 获取项目可选交付物列表 |
| [create](#action-deliverable-create) | 新增项目交付物 |
| [get](#action-deliverable-get) | 获取交付物详情 |
| [delete](#action-deliverable-delete) | 删除项目交付物 |

<a id="action-deliverable-list"></a>

#### `zentao deliverable list` · 获取交付物列表，支持获取项目下的交付物

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao deliverable list --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 所属项目ID |
| `--browseType` | 查询 | `string` | 否 | `"normal"` | 交付物筛选类型，默认 normal<br>可选值：normal（已提交）；wait（未提交）；mine（我提交）；submitbyme（由我发起）；pending（待评审）；pendingme（待我评审）；reviewing（评审中）；reviewedbyme（我评审过）；pass（评审通过）；fail（评审失败）；bymodule（按模块）；bysearch（搜索） |
| `--param` | 查询 | `string` | 否 | 未声明 | browseType 为 bymodule 时传模块 ID，为 bysearch 时传已保存查询 ID。 |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-deliverable-options"></a>

#### `zentao deliverable options` · 获取项目可选交付物列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

获取当前项目流程下可以提交的交付物定义。返回结果中 deliverables 的属性名为交付物定义 ID，值为交付物名称，可用于创建项目交付物。

```text
zentao deliverable options --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-deliverable-create"></a>

#### `zentao deliverable create` · 新增项目交付物

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao deliverable create --projectID=<number> --deliverable=<number> --sourceType=<string> --sourceID=<number> --doc=<object> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--deliverable` | 请求体 | `number` | 是 | 未声明 | 交付物定义 ID，取自交付物列表返回的 deliverable 字段。<br>格式：int32<br>必须为整数 |
| `--sourceType` | 请求体 | `string` | 是 | 未声明 | 来源类型(project 项目 \| task 任务)。 |
| `--sourceID` | 请求体 | `number` | 是 | 未声明 | 来源对象 ID，sourceType=project 时传项目 ID。<br>格式：int32<br>必须为整数 |
| `--doc` | 请求体 | `object` | 是 | 未声明 | 交付物文档，键为交付物定义 ID；每项包含 doc(文档 ID 列表)、docVersion(版本列表)、name(名称列表)。 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-deliverable-get"></a>

#### `zentao deliverable get` · 获取交付物详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao deliverable get --deliverableID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--deliverableID` | 路径 | `number` | 是 | 未声明 | deliverableID |

`--deliverableID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-deliverable-delete"></a>

#### `zentao deliverable delete` · 删除项目交付物

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao deliverable delete --deliverableID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--deliverableID` | 路径 | `number` | 是 | 未声明 | deliverableID |

`--deliverableID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-baseline"></a>

### baseline · 基线

基线管理，支持获取基线列表，支持获取项目下的基线、创建项目基线、获取基线详情、编辑项目基线、删除项目基线

快捷用法与字段查询：

```text
zentao baseline <id>
zentao baseline [列表参数]
zentao baseline props --format=json
zentao help baseline
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-baseline-list) | 获取基线列表，支持获取项目下的基线 |
| [create](#action-baseline-create) | 创建项目基线 |
| [get](#action-baseline-get) | 获取基线详情 |
| [update](#action-baseline-update) | 编辑项目基线 |
| [delete](#action-baseline-delete) | 删除项目基线 |

<a id="action-baseline-list"></a>

#### `zentao baseline list` · 获取基线列表，支持获取项目下的基线

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao baseline list --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 所属项目ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 基线状态筛选，默认 all<br>可选值：all（全部）；wait（待提交）；reviewing（评审中）；pass（已通过）；reject（已拒绝） |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-baseline-create"></a>

#### `zentao baseline create` · 创建项目基线

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao baseline create --projectID=<number> --title=<string> --version=<string> --category=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--title` | 请求体 | `string` | 是 | 未声明 | 基线名称。 |
| `--version` | 请求体 | `string` | 是 | 未声明 | 基线版本。 |
| `--category` | 请求体 | `string[]` | 是 | 未声明 | 纳入基线的交付物 ID 列表。<br>数组元素类型：string |
| `--type` | 请求体 | `string` | 否 | 未声明 | 基线类型。 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 基线状态。 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-baseline-get"></a>

#### `zentao baseline get` · 获取基线详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao baseline get --baselineID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--baselineID` | 路径 | `number` | 是 | 未声明 | baselineID |

`--baselineID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-baseline-update"></a>

#### `zentao baseline update` · 编辑项目基线

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao baseline update --baselineID=<number> --title=<string> --version=<string> --category=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--baselineID` | 路径 | `number` | 是 | 未声明 | baselineID |
| `--title` | 请求体 | `string` | 是 | 未声明 | 基线名称。 |
| `--version` | 请求体 | `string` | 是 | 未声明 | 基线版本。 |
| `--category` | 请求体 | `string[]` | 是 | 未声明 | 纳入基线的交付物 ID 列表。<br>数组元素类型：string |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 编辑备注。 |

`--baselineID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-baseline-delete"></a>

#### `zentao baseline delete` · 删除项目基线

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao baseline delete --baselineID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--baselineID` | 路径 | `number` | 是 | 未声明 | baselineID |

`--baselineID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-change"></a>

### change · 项目变更

项目变更管理，支持获取项目变更列表，支持获取项目下的项目变更、创建项目变更、获取变更详情、编辑项目变更、删除项目变更

快捷用法与字段查询：

```text
zentao change <id>
zentao change [列表参数]
zentao change props --format=json
zentao help change
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-change-list) | 获取项目变更列表，支持获取项目下的项目变更 |
| [create](#action-change-create) | 创建项目变更 |
| [get](#action-change-get) | 获取变更详情 |
| [update](#action-change-update) | 编辑项目变更 |
| [delete](#action-change-delete) | 删除项目变更 |

<a id="action-change-list"></a>

#### `zentao change list` · 获取项目变更列表，支持获取项目下的项目变更

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao change list --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 所属项目ID |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 变更状态筛选，默认 all<br>可选值：all（全部）；wait（待提交）；reviewing（评审中）；pass（已通过）；reject（已拒绝）；reverting（撤销中） |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序字段，默认 id_desc。 |
| `--recPerPage` | 查询 | `number` | 否 | `"20"` | 每页数量，默认 20。 |
| `--pageID` | 查询 | `number` | 否 | `"1"` | 页码，默认 1。<br>也可使用 --page |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-change-create"></a>

#### `zentao change create` · 创建项目变更

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao change create --projectID=<number> --name=<string> --urgency=<string> --type=<string> --owner=<string> --reason=<string> --desc=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 路径 | `number` | 是 | 未声明 | 项目ID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 变更名称。 |
| `--urgency` | 请求体 | `string` | 是 | 未声明 | 紧急程度。 |
| `--type` | 请求体 | `string` | 是 | 未声明 | 变更类型。 |
| `--owner` | 请求体 | `string` | 是 | 未声明 | 变更负责人。 |
| `--reason` | 请求体 | `string` | 是 | 未声明 | 变更原因。 |
| `--desc` | 请求体 | `string` | 是 | 未声明 | 变更描述。 |

`--projectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-change-get"></a>

#### `zentao change get` · 获取变更详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao change get --changeID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--changeID` | 路径 | `number` | 是 | 未声明 | changeID |

`--changeID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-change-update"></a>

#### `zentao change update` · 编辑项目变更

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao change update --changeID=<number> --name=<string> --urgency=<string> --type=<string> --owner=<string> --reason=<string> --desc=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--changeID` | 路径 | `number` | 是 | 未声明 | changeID |
| `--name` | 请求体 | `string` | 是 | 未声明 | 变更名称。 |
| `--urgency` | 请求体 | `string` | 是 | 未声明 | 紧急程度。 |
| `--type` | 请求体 | `string` | 是 | 未声明 | 变更类型。 |
| `--owner` | 请求体 | `string` | 是 | 未声明 | 变更负责人。 |
| `--reason` | 请求体 | `string` | 是 | 未声明 | 变更原因。 |
| `--desc` | 请求体 | `string` | 是 | 未声明 | 变更描述。 |

`--changeID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-change-delete"></a>

#### `zentao change delete` · 删除项目变更

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao change delete --changeID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--changeID` | 路径 | `number` | 是 | 未声明 | changeID |

`--changeID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-relation"></a>

### relation · 对象关联

对象关联管理，支持关联对象、查询可关联对象、查询关联对象、删除关联关系

快捷用法与字段查询：

```text
zentao relation [列表参数]
zentao relation props --format=json
zentao help relation
```

| 操作 | 用途 |
| --- | --- |
| [link](#action-relation-link) | 关联对象 |
| [candidates](#action-relation-candidates) | 查询可关联对象 |
| [list](#action-relation-list) | 查询关联对象 |
| [unlink](#action-relation-unlink) | 删除关联关系 |

<a id="action-relation-link"></a>

#### `zentao relation link` · 关联对象

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao relation link --objectType=<string> --objectID=<number> --relatedObjectType=<string> --relation=<string[]> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--objectType` | 路径 | `string` | 是 | 未声明 | objectType |
| `--objectID` | 路径 | `number` | 是 | 未声明 | objectID |
| `--relatedObjectType` | 路径 | `string` | 是 | 未声明 | relatedObjectType |
| `--relation` | 请求体 | `string[]` | 是 | 未声明 | 被关联对象 ID 与关系 key 的映射，键为候选接口返回的 objects[].id，值为 relationPairs 返回的 key。<br>数组元素类型：string |

`--objectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-relation-candidates"></a>

#### `zentao relation candidates` · 查询可关联对象

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao relation candidates --objectType=<string> --objectID=<number> --relatedObjectType=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--objectType` | 路径 | `string` | 是 | 未声明 | objectType |
| `--objectID` | 路径 | `number` | 是 | 未声明 | objectID |
| `--relatedObjectType` | 路径 | `string` | 是 | 未声明 | relatedObjectType |
| `--browseType` | 查询 | `string` | 否 | 未声明 | 候选对象筛选类型。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量。 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码。<br>也可使用 --page |

`--objectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-relation-list"></a>

#### `zentao relation list` · 查询关联对象

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao relation list --objectType=<string> --objectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--objectType` | 路径 | `string` | 是 | 未声明 | objectType |
| `--objectID` | 路径 | `number` | 是 | 未声明 | objectID |

`--objectID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-relation-unlink"></a>

#### `zentao relation unlink` · 删除关联关系

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

根据关系记录 ID 删除自定义关联关系。relationID 从查询关联对象接口返回的 relations[].relationID 字段获取，只有 relationType 为 custom 的自定义关系可以删除。

```text
zentao relation unlink --relationID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--relationID` | 路径 | `number` | 是 | 未声明 | relationID |

`--relationID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-workflowgroup"></a>

### workflowgroup · 项目流程

项目流程管理，支持获取项目流程列表

快捷用法与字段查询：

```text
zentao workflowgroup [列表参数]
zentao workflowgroup props --format=json
zentao help workflowgroup
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-workflowgroup-list) | 获取项目流程列表 |

<a id="action-workflowgroup-list"></a>

#### `zentao workflowgroup list` · 获取项目流程列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao workflowgroup list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 项目流程状态筛选，默认 all<br>可选值：all（全部）；normal（正常）；pause（已停用） |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量。 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码。<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="module-resourcecalendar"></a>

### resourcecalendar · 人力资源日历

人力资源日历管理，支持查询人力资源日历

快捷用法与字段查询：

```text
zentao resourcecalendar get [查询参数]
zentao resourcecalendar props --format=json
zentao help resourcecalendar
```

此模块没有默认 list；请明确指定下表中的操作。

| 操作 | 用途 |
| --- | --- |
| [get](#action-resourcecalendar-get) | 查询人力资源日历 |

<a id="action-resourcecalendar-get"></a>

#### `zentao resourcecalendar get` · 查询人力资源日历

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao resourcecalendar get [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--type` | 查询 | `string` | 否 | `"company"` | 日历维度，默认 company<br>可选值：company（按部门）；person（按人员） |
| `--mode` | 查询 | `string` | 否 | `"wait"` | 统计模式，默认 wait<br>可选值：wait（待处理）；done（已完成） |
| `--accounts` | 查询 | `string` | 否 | 未声明 | 逗号分隔的用户账号；结果会继续按部门、项目和用户权限过滤。 |
| `--projectID` | 查询 | `number` | 否 | 未声明 | 项目 ID；传入后仅查询该项目成员的日历数据。 |
| `--depts` | 查询 | `string` | 否 | 未声明 | 逗号分隔的部门 ID；仅拥有查看所有人权限时生效。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="module-weekly"></a>

### weekly · 项目周报

项目周报管理，支持获取项目周报列表、创建项目周报、获取项目周报详情、编辑项目周报、删除项目周报

快捷用法与字段查询：

```text
zentao weekly <id>
zentao weekly [列表参数]
zentao weekly props --format=json
zentao help weekly
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-weekly-list) | 获取项目周报列表 |
| [create](#action-weekly-create) | 创建项目周报 |
| [get](#action-weekly-get) | 获取项目周报详情 |
| [update](#action-weekly-update) | 编辑项目周报 |
| [delete](#action-weekly-delete) | 删除项目周报 |

<a id="action-weekly-list"></a>

#### `zentao weekly list` · 获取项目周报列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao weekly list --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 查询 | `number` | 是 | 未声明 | 项目 ID。 |
| `--browseType` | 查询 | `string` | 否 | `"all"` | 筛选类型，默认 all<br>可选值：all（全部）；bymodule（按目录）；bysearch（搜索） |
| `--param` | 查询 | `string` | 否 | 未声明 | browseType=bymodule 时传目录 ID，browseType=bysearch 时传查询 ID。 |
| `--orderBy` | 查询 | `string` | 否 | 未声明 | 排序字段。 |
| `--recPerPage` | 查询 | `number` | 否 | 未声明 | 每页数量。 |
| `--pageID` | 查询 | `number` | 否 | 未声明 | 页码。<br>也可使用 --page |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-weekly-create"></a>

#### `zentao weekly create` · 创建项目周报

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao weekly create --projectID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--projectID` | 请求体 | `number` | 是 | 未声明 | 项目 ID。<br>格式：int32<br>必须为整数 |
| `--reportModule` | 请求体 | `string` | 否 | 未声明 | 项目周报分类 ID，没有分类时可传 0。 |
| `--title` | 请求体 | `string` | 否 | 未声明 | 周报标题。 |
| `--templateID` | 请求体 | `number` | 否 | 未声明 | 报告模板 ID，不使用模板时传 0。<br>格式：int32<br>必须为整数 |
| `--templateDesc` | 请求体 | `string` | 否 | 未声明 | 周报描述。 |
| `--acl` | 请求体 | `string` | 否 | 未声明 | 访问控制(open 公开 \| private 私有)。 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 周报状态(draft 草稿 \| normal 正常)。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="action-weekly-get"></a>

#### `zentao weekly get` · 获取项目周报详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao weekly get --reportID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--reportID` | 路径 | `number` | 是 | 未声明 | reportID |

`--reportID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="action-weekly-update"></a>

#### `zentao weekly update` · 编辑项目周报

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao weekly update --reportID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--reportID` | 路径 | `number` | 是 | 未声明 | reportID |
| `--title` | 请求体 | `string` | 否 | 未声明 | 周报标题。 |
| `--status` | 请求体 | `string` | 否 | 未声明 | 周报状态。 |
| `--contentType` | 请求体 | `string` | 否 | 未声明 | 内容类型，默认 doc。 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 文档类型，默认 text。 |
| `--content` | 请求体 | `string` | 否 | 未声明 | 周报 HTML 内容。 |
| `--rawContent` | 请求体 | `string` | 否 | 未声明 | 周报原始内容。 |
| `--comment` | 请求体 | `string` | 否 | 未声明 | 编辑备注。 |

`--reportID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。

<a id="action-weekly-delete"></a>

#### `zentao weekly delete` · 删除项目周报

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao weekly delete --reportID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--reportID` | 路径 | `number` | 是 | 未声明 | reportID |

`--reportID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--yes`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。

<a id="module-db"></a>

### db · 数据库

数据库管理，支持获取数据库表列表、执行SQL查询、获取数据库表结构

快捷用法与字段查询：

```text
zentao db props --format=json
zentao help db
```

此模块没有默认 list；请明确指定下表中的操作。

| 操作 | 用途 |
| --- | --- |
| [tables](#action-db-tables) | 获取数据库表列表 |
| [query](#action-db-query) | 执行SQL查询 |
| [table](#action-db-table) | 获取数据库表结构 |

<a id="action-db-tables"></a>

#### `zentao db tables` · 获取数据库表列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao db tables [选项]
```

此操作没有业务参数。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`；其他全局选项见[全局选项](#global-options)。

<a id="action-db-query"></a>

#### `zentao db query` · 执行SQL查询

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

返回查询结果行及分页；使用 raw: true 可获取原始响应中的 SQL、列信息和执行耗时。

```text
zentao db query --sql=<string> [选项]
```

请求体示例（数组使用 JSON，以保留元素类型）：

```bash
zentao db query --data '{"sql":"SELECT id, account FROM zt_user","page":1,"limit":100,"count":true}'
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--sql` | 请求体 | `string` | 是 | 未声明 | 只读 SQL 语句，仅支持 SELECT 查询。 |
| `--page` | 请求体 | `number` | 否 | 未声明 | 页码，默认 1。<br>格式：int32<br>必须为整数 |
| `--limit` | 请求体 | `number` | 否 | 未声明 | 每页条数，默认 100。<br>格式：int32<br>必须为整数 |
| `--count` | 请求体 | `boolean` | 否 | 未声明 | 是否统计总条数，默认 true。 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--data`；其他全局选项见[全局选项](#global-options)。

这是带请求体的查询操作。可直接传 --data JSON 或使用 --params 中的正式字段名；当前不支持此类操作的 --data @- 或隐式标准输入。参数约束来自 SDK 定义，部分规则由服务端校验。

此处 limit 是服务端请求体字段，建议放入 --data JSON。非 raw 输出时，平铺 --limit 会同时参与请求体组装和客户端截取；--data 中的 limit 覆盖请求体同名值，但不覆盖客户端 --limit。

SDK 描述中的 raw: true 在 CLI 中对应 --format=raw，可查看原始响应的 SQL、列信息与执行耗时。

<a id="action-db-table"></a>

#### `zentao db table` · 获取数据库表结构

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

meta 返回表信息、主键和列定义；sql 返回包含表信息、dialect 和建表 SQL 的对象。

```text
zentao db table --table=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--table` | 路径 | `string` | 是 | 未声明 | 数据库表名，例如 zt_config |
| `--type` | 查询 | `string` | 否 | `"meta"` | 表结构返回格式<br>可选值：meta（元数据）；sql（建表 SQL） |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="module-knowledgelib"></a>

### knowledgelib · 知识库

知识库管理，支持获取 AI 知识库列表

快捷用法与字段查询：

```text
zentao knowledgelib [列表参数]
zentao knowledgelib props --format=json
zentao help knowledgelib
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-knowledgelib-list) | 获取 AI 知识库列表 |

<a id="action-knowledgelib-list"></a>

#### `zentao knowledgelib list` · 获取 AI 知识库列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

```text
zentao knowledgelib list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--type` | 查询 | `string` | 否 | 未声明 | 库类型，省略或空字符串时合并两类可见库<br>可选值：my（我的知识库）；team（组织知识库） |
| `--keyword` | 查询 | `string` | 否 | 未声明 | 知识库名称或描述关键词，首尾空白会被移除 |
| `--pageID` | 查询 | `number` | 否 | `1` | 页码，从 1 开始的正整数<br>也可使用 --page |
| `--recPerPage` | 查询 | `number` | 否 | `20` | 每页条数，范围 1～100 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="module-knowledge"></a>

### knowledge · 知识

知识管理，支持获取 AI 知识库内的知识列表、在多个 AI 知识库内向量搜索、按关键词搜索 AI 知识、获取 AI 知识详情

快捷用法与字段查询：

```text
zentao knowledge <id>
zentao knowledge [列表参数]
zentao knowledge props --format=json
zentao help knowledge
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-knowledge-list) | 获取 AI 知识库内的知识列表 |
| [embeddingsSearch](#action-knowledge-embeddingssearch) | 在多个 AI 知识库内向量搜索 |
| [search](#action-knowledge-search) | 按关键词搜索 AI 知识 |
| [get](#action-knowledge-get) | 获取 AI 知识详情 |

<a id="action-knowledge-list"></a>

#### `zentao knowledge list` · 获取 AI 知识库内的知识列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

返回当前用户可见的知识条目，按本地 ID 降序排列；不支持标题关键词查询。

```text
zentao knowledge list --libID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--libID` | 路径 | `number` | 是 | 未声明 | 本地知识库 ID，正整数 |
| `--type` | 查询 | `string` | 否 | 未声明 | 知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。<br>可选值：object（对象知识）；text（文本知识）；file（文件知识） |
| `--objectType` | 查询 | `string` | 否 | 未声明 | 来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。<br>可选值：story（需求）；task（任务）；case（测试用例）；bug（Bug）；plan（产品计划）；release（发布）；feedback（反馈）；ticket（工单）；doc（文档（含接口文档））；issue（问题）；risk（风险）；opportunity（机会）；practice（最佳实践）；component（组件） |
| `--pageID` | 查询 | `number` | 否 | `1` | 页码，从 1 开始的正整数<br>也可使用 --page |
| `--recPerPage` | 查询 | `number` | 否 | `20` | 每页条数，范围 1～100 |

`--libID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-knowledge-embeddingssearch"></a>

#### `zentao knowledge embeddingsSearch` · 在多个 AI 知识库内向量搜索

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

仅检索已有索引，需 ai.searchknowledgelib 权限。按匹配度降序返回片段，不分页；用 knowledgeID 获取完整正文，chunkID 仅标识片段。

```text
zentao knowledge embeddingsSearch --keyword=<string> --libIDs=<integer[]> [选项]
```

请求体示例（数组使用 JSON，以保留元素类型）：

```bash
zentao knowledge embeddingsSearch --data '{"keyword":"如何处理接口请求超时","libIDs":[12,18],"minSimilarity":0.7,"limit":5}'
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--keyword` | 请求体 | `string` | 是 | 未声明 | 搜索问题或关键词，去除首尾空白后不能为空<br>最小长度：1 |
| `--libIDs` | 请求体 | `integer[]` | 是 | 未声明 | 本地知识库 ID 的非空正整数数组，例如 [12,18]；不接受字符串元素，重复 ID 自动去重<br>最少元素数：1<br>数组元素类型：integer<br>数组元素最小值：1 |
| `--type` | 请求体 | `string` | 否 | 未声明 | 知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。<br>可选值：object（对象知识）；text（文本知识）；file（文件知识） |
| `--objectType` | 请求体 | `string` | 否 | 未声明 | 来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。<br>可选值：story（需求）；task（任务）；case（测试用例）；bug（Bug）；plan（产品计划）；release（发布）；feedback（反馈）；ticket（工单）；doc（文档（含接口文档））；issue（问题）；risk（风险）；opportunity（机会）；practice（最佳实践）；component（组件） |
| `--minSimilarity` | 请求体 | `number` | 否 | `0.5` | 最小匹配度，范围 [0,1]<br>最小值：0<br>最大值：1 |
| `--limit` | 请求体 | `number` | 否 | `5` | 整次多库搜索最多返回的片段数，范围 1～100<br>必须为整数<br>最小值：1<br>最大值：100 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--data`；其他全局选项见[全局选项](#global-options)。

这是带请求体的查询操作。可直接传 --data JSON 或使用 --params 中的正式字段名；当前不支持此类操作的 --data @- 或隐式标准输入。参数约束来自 SDK 定义，部分规则由服务端校验。

此处 limit 是服务端请求体字段，建议放入 --data JSON。非 raw 输出时，平铺 --limit 会同时参与请求体组装和客户端截取；--data 中的 limit 覆盖请求体同名值，但不覆盖客户端 --limit。

<a id="action-knowledge-search"></a>

#### `zentao knowledge search` · 按关键词搜索 AI 知识

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

需 ai.searchknowledgelib 权限，按字面文本匹配 title 或已保存的 content，不依赖向量索引。标题与正文分别匹配，单个关键词不能跨字段拼接。返回完整正文及 contentType，正文为空或 null 时返回空字符串；每条知识只返回一次，按知识 ID 降序分页。

```text
zentao knowledge search --keywords=<string[]> --libIDs=<integer[]> [选项]
```

请求体示例（数组使用 JSON，以保留元素类型）：

```bash
zentao knowledge search --data '{"keywords":["登录","超时"],"libIDs":[12,18],"matchMode":"any","pageID":1,"recPerPage":20}'
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--keywords` | 请求体 | `string[]` | 是 | 未声明 | 非空关键词数组，每项去除首尾空白后为 1～200 个 Unicode 字符，去重后最多 20 项；%、_ 和反斜杠按普通字符匹配<br>最少元素数：1<br>数组元素类型：string<br>数组元素最小长度：1 |
| `--libIDs` | 请求体 | `integer[]` | 是 | 未声明 | 本地知识库 ID 的非空正整数数组，例如 [12,18]；不接受字符串元素，重复 ID 自动去重<br>最少元素数：1<br>数组元素类型：integer<br>数组元素最小值：1 |
| `--matchMode` | 请求体 | `string` | 否 | `"any"` | any 表示任一关键词出现在标题或正文中；all 表示同一条知识的每个关键词均出现在标题或正文之一，可分别命中两个字段。仅省略时使用 any，空字符串和 null 无效<br>可选值：any（任一关键词匹配标题或正文）；all（全部关键词匹配同一条知识） |
| `--type` | 请求体 | `string` | 否 | 未声明 | 知识类型，省略或空字符串表示不限；text/file 不可与非空 objectType 同时使用。<br>可选值：object（对象知识）；text（文本知识）；file（文件知识） |
| `--objectType` | 请求体 | `string` | 否 | 未声明 | 来源对象类型；单独指定时按 type=object 筛选，每次只接受一个编码。<br>可选值：story（需求）；task（任务）；case（测试用例）；bug（Bug）；plan（产品计划）；release（发布）；feedback（反馈）；ticket（工单）；doc（文档（含接口文档））；issue（问题）；risk（风险）；opportunity（机会）；practice（最佳实践）；component（组件） |
| `--pageID` | 请求体 | `number` | 否 | `1` | 页码，从 1 开始的正整数<br>必须为整数<br>最小值：1<br>请使用 --pageID 或 --data 中的 pageID；此请求体字段不支持 --page 别名 |
| `--recPerPage` | 请求体 | `number` | 否 | `20` | 每页条数，范围 1～100<br>必须为整数<br>最小值：1<br>最大值：100 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--data`；其他全局选项见[全局选项](#global-options)。

这是带请求体的查询操作。可直接传 --data JSON 或使用 --params 中的正式字段名；当前不支持此类操作的 --data @- 或隐式标准输入。参数约束来自 SDK 定义，部分规则由服务端校验。

<a id="action-knowledge-get"></a>

#### `zentao knowledge get` · 获取 AI 知识详情

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

返回已保存的完整正文及来源信息，不触发文件提取、知识同步或索引更新。按 contentType 解释正文，尚未保存正文时 content 可为空。

```text
zentao knowledge get --knowledgeID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--knowledgeID` | 路径 | `number` | 是 | 未声明 | 本地知识条目 ID，正整数；不可使用 chunkID 或来源对象 objectID |

`--knowledgeID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`；其他全局选项见[全局选项](#global-options)。

<a id="module-space"></a>

### space · 代码库空间

需部署代码库 API 2.0 实现，仅返回当前用户可访问的未删除空间。

快捷用法与字段查询：

```text
zentao space [列表参数]
zentao space props --format=json
zentao help space
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-space-list) | 获取代码库空间列表 |

<a id="action-space-list"></a>

#### `zentao space list` · 获取代码库空间列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

需 space.browse 权限，按空间 ID 降序排列；先按当前用户权限过滤，再分页。

```text
zentao space list [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--pageID` | 查询 | `number` | 否 | `1` | 页码，从 1 开始的正整数<br>也可使用 --page |
| `--recPerPage` | 查询 | `number` | 否 | `20` | 每页条数，范围 1～100 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="module-repo"></a>

### repo · 代码库

需部署代码库 API 2.0 实现，支持查询空间代码库和创建 GitFox 代码库。

快捷用法与字段查询：

```text
zentao repo [列表参数]
zentao repo props --format=json
zentao help repo
```

| 操作 | 用途 |
| --- | --- |
| [list](#action-repo-list) | 获取空间下的代码库列表 |
| [create](#action-repo-create) | 创建代码库 |

<a id="action-repo-list"></a>

#### `zentao repo list` · 获取空间下的代码库列表

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

需 repo.maintain 权限及空间访问权限，独立授权空间另需空间内的 repo.maintain 权限。仅返回未删除、非导入中且当前用户可访问的代码库；url.http、url.ssh 可能缺省，克隆地址保持服务端原值。

```text
zentao repo list --spaceID=<number> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--spaceID` | 路径 | `number` | 是 | 未声明 | 代码库空间 ID，正整数 |
| `--pageID` | 查询 | `number` | 否 | `1` | 页码，从 1 开始的正整数<br>也可使用 --page |
| `--recPerPage` | 查询 | `number` | 否 | `20` | 每页条数，范围 1～100 |
| `--orderBy` | 查询 | `string` | 否 | `"id_desc"` | 排序方式<br>可选值：id_asc（ID 升序）；id_desc（ID 降序）；name_asc（名称升序）；name_desc（名称降序） |

`--spaceID` 可用 `--id` 或首个数字位置参数代替；其余路径 ID 需分别提供。

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--pick`、`--filter`、`--sort`、`--search`、`--search-fields`、`--limit`、`--page`；其他全局选项见[全局选项](#global-options)。

<a id="action-repo-create"></a>

#### `zentao repo create` · 创建代码库

最低禅道版本：`22.7` / `biz13.7` / `max8.7` / `ipd5.7`。

需配置 GitFox，具备 repo.createRepo 全局权限、空间及关联产品访问权限；私有空间或独立授权空间另需空间内的 repo.create 权限，独立授权空间还需 repo.createRepo 权限。以当前 Token 用户创建，默认 main 分支并初始化 README；返回 id，不返回克隆地址。超时或后续步骤失败时远端代码库可能已创建，重试前应查询目标空间核对。

```text
zentao repo create --space=<number> --product=<integer[]> --name=<string> [选项]
```

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明与可选值 |
| --- | --- | --- | --- | --- | --- |
| `--space` | 请求体 | `number` | 是 | 未声明 | 代码库空间 ID，使用 JSON 数字；字段名为 space<br>必须为整数<br>最小值：1 |
| `--product` | 请求体 | `integer[]` | 是 | 未声明 | 关联产品 ID 的非空正整数数组，例如 [12]；不接受字符串元素或逗号分隔字符串<br>最少元素数：1<br>数组元素类型：integer<br>数组元素最小值：1 |
| `--name` | 请求体 | `string` | 是 | 未声明 | 去除首尾空白后，以英文字母或下划线开头，后续仅允许英文字母、数字、下划线、连字符和点<br>最小长度：1 |
| `--desc` | 请求体 | `string` | 否 | `""` | 代码库描述；可选字段使用默认值时应省略，不传 null |
| `--acl` | 请求体 | `string` | 否 | `"open"` | 访问权限，private 时 members 必须非空<br>可选值：open（公开）；private（私有） |
| `--members` | 请求体 | `string[]` | 否 | `[]` | 成员账号数组，账号须存在、未删除且未关闭；acl=private 时必填且非空，服务端自动加入当前创建者<br>数组元素类型：string<br>数组元素最小长度：1 |

可配合[公共选项](#data-options)：`--params`、`--format`、`--silent`、`--data`、`--batch-fail-fast`；其他全局选项见[全局选项](#global-options)。
