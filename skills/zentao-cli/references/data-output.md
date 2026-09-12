# 输出、筛选与全量统计

## 选择输出格式

| 目的 | 选项与结果 |
|------|------------|
| 阅读 | 默认 Markdown，受当前 Profile 的 `defaultOutputFormat` 影响；需固定时传 `--format=markdown` |
| 程序处理 | `--format=json`，执行字段摘取、过滤等本地处理 |
| 排查响应 | `--format=raw`，返回服务端原始响应，跳过归一化、HTML 转换和本地数据处理 |

`--machine-readable` 只禁用 Markdown ANSI 渲染，不等同于 JSON；需要解析时显式使用 `--format=json`。需要结果时不要加 `--silent`。

CLI JSON 结构随操作类型变化：

- 列表：`{"status":"success","data":[...],"pager":{"total":120,"page":1,"recPerPage":50}}`，无分页信息时省略 `pager`。
- 详情：直接返回对象，例如 `{"id":42,"title":"登录失败"}`，不要再取 `.data`。
- 创建、更新、删除和状态操作：`{"status":"success","data":...}`，没有数据时可能省略 `data`。
- 错误：stderr 输出 `{"error":{"code":"2008","message":"...","details":...}}`，退出码非零；`code` 不含 `E` 前缀，`details` 可省略。

同时检查退出码、stderr 和 JSON 内容。批量请求使用另一种汇总结构，见 [writes.md](writes.md)；MCP 输出也不同，见 [mcp.md](mcp.md)。

## 当前页的数据处理

范围参数及接口声明的 `browseType` 等控制服务端查询；`--filter`、`--search`、`--sort`、`--limit`、`--pick` 在收到当前页后处理，不能扩大服务器已返回的集合。

```bash
zentao bug --product=1 --browseType=all --pick=id,title,status
zentao bug --product=1 --browseType=all --filter='status=active'
zentao bug --product=1 --browseType=all --filter='severity<=2,pri<=2'
zentao bug --product=1 --browseType=all --filter='status=active' --filter='status=resolved'
zentao bug --product=1 --search=登录 --search-fields=title,steps
zentao bug --product=1 --search=登录,失败 --search=注册,超时
zentao bug --product=1 --sort=pri:asc,severity:asc
zentao bug --product=1 --limit=10
```

- 一条 `--filter` 内逗号连接为 AND；多次 `--filter` 之间为 OR。`--search` 同样是组内 AND、组间 OR。
- 过滤运算符：`=`（推荐）、`:`（兼容等于）、`!=`、`>`、`<`、`>=`、`<=`、`~`（包含）、`!~`（不包含）。包含比较符的表达式用引号包裹。
- 排序优先写 `field:asc` / `field:desc`；旧的 `field_asc` / `field_desc` 仍兼容。
- `--limit` 只截取当前页；当前页优先级最高的 10 条不能称作全产品 Top 10。
- `--format=raw` 下上述本地选项不生效，不能一边要求原始响应一边期待过滤或脱敏字段。

## 分页与统计

只有列表操作帮助列出 `--page` / `--recPerPage` 时才使用分页选项。CLI 不自动翻页；`--all` 会显式报 `E2009`。

```bash
zentao bug list --help
zentao bug --product=1 --browseType=all --page=1 --recPerPage=50 --pick=id,status,severity,pri --format=json
```

要回答“所有”“总共”“各状态数量”或全局排序：

1. 选择覆盖目标范围的服务端条件，收集用于聚合的字段。
2. 按返回的 `pager.page` 递增请求；当 `pager.page * pager.recPerPage >= pager.total` 时完成该范围。以返回的页码和页大小为准，服务器可能限制每页数量。
3. 对收集结果按 ID 去重，再统计或全局排序、取 Top N。期间数据可能变化，说明查询范围和时间。

`pager.total` 是服务端匹配总数，本地过滤后 `data.length` 可能更小甚至为 0，不能据此判断末页；也不能把 `pager.total` 当作本地条件命中数。列表没有 pager 或页码不再推进时，说明完整性限制，不猜测还有多少，也不无限请求。

跨执行统计任务时，先完整取得目标项目的执行列表，再逐个执行分页查任务。旧版本不支持 `projectExecutions` 时，可按全局执行列表每页的 `project` 字段筛选目标项目；仍需遍历该列表所有页。
