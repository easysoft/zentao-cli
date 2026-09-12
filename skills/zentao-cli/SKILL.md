---
name: zentao-cli
description: 使用 zentao CLI 或已连接的禅道 MCP 查询、创建和更新禅道数据，执行需求、任务、Bug 等状态流转，汇总项目进展，并排查认证、参数与版本兼容问题。用户要求操作禅道、查询个人工作或配置 zentao-cli 接入时使用；首次体验和按角色上手可结合 zentao-tour。
license: MIT
metadata:
  author: Sun Hao <sunhao@chandao.com>
  repository: https://github.com/easysoft/zentao-cli.git
  keywords: [zentao, 禅道, cli, project-management]
  version: 0.1.7
---

# 禅道 CLI

通过 `zentao` 操作禅道。以当前安装版本的离线帮助为命令依据；字段、动作和最低服务器版本可能随 CLI / SDK 更新。

## 开始工作

已有可用 CLI 或禅道 MCP 时直接复用。先确认用户要访问的站点、对象范围和操作；上下文已明确的内容不用重复询问。

```bash
zentao --version
zentao help
zentao profile --format=json
```

- `help`、模块/操作 `--help`、`props` 无需登录。先查帮助再准备请求，不必为查看参数连接服务器。
- `profile` 只列出本地保存的账号和站点，不校验 Token、网络或业务角色。需要验证连接时，在用户要访问的范围内执行一个只读查询。
- 未配置本地账号时 `profile` 返回 `E1006`；完整环境凭证仍可用于业务命令。不要据此断言服务不可用。
- 未安装时按用户环境选择 `npm install -g zentao-cli`、`bun install -g zentao-cli` 或 `pnpm install -g zentao-cli`；一次性运行可用 `npx zentao-cli <参数>`。

### 认证与账号选择

业务命令缺少凭证会报错，不会自动弹出登录。需要登录时让用户在自己的交互终端执行 `zentao login`，由 CLI 收集凭证。不要在对话里收集密码或 Token，不要读取、打印凭证环境变量或本地凭证文件。

自动化凭证由运行环境提供：`ZENTAO_URL` + `ZENTAO_ACCOUNT` + `ZENTAO_TOKEN` 或 `ZENTAO_PASSWORD`。同源同时提供 Token 和密码时优先 Token。业务命令优先使用完整环境凭证，再回退到当前保存的 Profile。

```bash
zentao profile 'admin@https://zentao.example.com'
```

上述命令切换本地默认账号；完整环境凭证仍会优先，不能仅凭切换成功认定后续请求使用了该账号。需由运行环境维护者调整凭证来源；MCP 显式切换见 [references/mcp.md](references/mcp.md)。

默认凭证文件为 `~/.config/zentao/zentao.json`；自定义路径可用全局 `--config <路径>` 或 `ZENTAO_CONFIG_FILE`，前者优先。沿用用户选定的配置路径，不通过直接读取文件确认身份。

## 查找命令与参数

| 意图 | 命令形式 |
|------|----------|
| 列表（仅支持默认列表的模块） | `zentao <module> [范围参数]` |
| 详情（仅支持 get 的模块） | `zentao <module> <id>` |
| 创建 / 更新 / 删除 | `zentao <module> create` / `zentao <module> update <id>` / `zentao <module> delete <id>` |
| 状态流转或命名操作 | `zentao <module> <action> [参数]` |
| 操作参数、必填项、最低版本 | `zentao <module> <action> --help` |
| 返回对象的字段定义 | `zentao <module> props --format=json` |

`props` 不是写入字段清单，也不代表当前站点的动态选项。创建、更新、状态流转都以操作帮助为准；先读懂参数用途，再选值。

- 业务字段优先使用 `--field=value`，保留帮助中的大小写。复杂对象、数组或长文本见 [references/writes.md](references/writes.md)。
- 不要推断每个模块都有 CRUD。`doc`、`my` 无默认列表，必须选择命名操作。
- 多个路径参数要分别传入；位置 ID / `--id` 仅代表首个路径 ID，不能代替后续 ID。
- 不知道 ID 时先按产品、项目或执行查找，出现同名对象再澄清，不能套用示例 ID。
- `browseType` 是各接口自己的服务端筛选值，例如项目 `doing`、需求 `allstory`；不能在不同模块间照搬。

### 常用入口

先用对应操作的 `--help` 确认安装版本支持，再代入真实 ID：

```bash
zentao product --pick=id,name
zentao story --product=1 --pick=id,title,status
zentao bug --product=1 --pick=id,title,status
zentao task --executionID=1 --pick=id,name,status
zentao project --browseType=doing --pick=id,name,status
zentao execution projectExecutions --projectID=5 --browseType=all
zentao productplan --productID=1
zentao release --productID=1
zentao build --project=5
zentao my tasks --pick=id,name,status
zentao my bugs --pick=id,title,status
zentao my todos
zentao doc myDocs --spaceID=1 --libID=2
```

需求分为 `epic`（业务需求）、`requirement`（用户需求）、`story`（研发需求）。问题 `issue`、风险 `risk`、会议 `meeting`、工作流 `workflow`、文档 `doc` 等能力通过模块帮助发现，无需套用任务或 Bug 的字段。

### 服务器版本

帮助离线列出完整注册表，不等于服务器支持全部动作。请求前会检查实际服务器版本；最低版本按同一系列比较，例如 `22.5 / biz13.5 / max8.5 / ipd5.5`。具体门槛以该动作帮助为准，不用统一版本号推断所有新增能力。

遇到 `E2010` 时报告当前版本和该动作要求。可改用已支持且语义等价的查询，例如按执行查任务，或逐页查询全局执行再按项目筛选；不能把替代查询当成全量结果，不能为绕过检查修改版本信息。`zentao version` 中的服务器信息来自本地缓存，不是实时兼容性验证。

## 执行与核实

- 查询默认适合阅读；程序处理显式加 `--format=json`。全量统计、过滤、排序、原始响应及 JSON 结构见 [references/data-output.md](references/data-output.md)。
- 创建、更新和状态流转按用户已授权的目标与字段执行；明确的请求不再重复确认。缺少目标、状态含义或必要信息时，只补问影响本次操作的内容。
- 用户只要求查看、分析或建议时，先返回结果。演示不代表授权修改已有业务记录。
- 更新自动补全仅在存在可用详情操作时生效，并且只补当前动作声明的可写字段；不能假设所有模块都有详情、所有字段都能保留。具体边界与示例见 [references/writes.md](references/writes.md)。
- 删除和批量操作先落实用户授权的对象集合；自动化删除必须显式传 `--yes`。批量部分失败时分开报告成功、失败和跳过的对象，不能整体重试。
- 根据返回的 ID 查询详情或在所属列表中核实关键字段，再宣告创建、关联、完成等结果。写入超时或返回不明确时先查询是否已生效，尤其不要盲目重试创建。
- 已连接 MCP 时直接调用可用工具，操作发现和接入配置见 [references/mcp.md](references/mcp.md)。

## 错误处理

保留错误要点，按原因处理；不要将所有错误都归为重新登录。

| 错误码 | 处理 |
|--------|------|
| E1001 / E1006 | 凭证不完整或没有可用配置；请用户交互登录或配置完整环境凭证 |
| E1003 / E1004 | 账号密码错误或 Token 失效；请用户重新登录 |
| E1005 / E1007 | 配置不可读或指定 Profile 不存在；核对配置路径，使用 profile 查看可用账号 |
| E2001 / E2005 | 模块或动作不存在；查本地帮助 |
| E2002 | 对象或接口未找到；核对 ID、范围和具体错误 URL，不立即断定记录已删除 |
| E2003 / E2004 / E2007 / E2009 | 缺参数、类型/选项错误或无效 JSON；对照动作帮助修正 |
| E2006 | 无权限；说明受限操作，交由用户处理授权 |
| E2008 | 服务端业务或 HTTP 错误；检查具体响应，不以 HTTP 200 或 raw 输出认定成功 |
| E2010 | 服务器版本不支持；说明要求，选择受支持的等价能力或由用户升级 |
| E2011 / E2012 | 版本格式或站点配置无法识别；核对站点根地址及其 `?mode=getconfig` 响应 |
| E1002 / E5001 / E5002 | 地址不可达、超时或证书验证失败；核对网络、地址和证书，写请求先核实结果再决定是否重试 |
