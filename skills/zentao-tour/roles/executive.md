# 高管视角

只读查看项目节奏、产品健康、发布或团队反馈，选用户最关心的一两个方向展开。不要为了演示报表修改任何业务记录；需要操作时先明确新范围，再转对应角色。

## 先说明数据范围

确认关注的项目/产品和时间范围，展示结果时说明当前账号可见范围与查询时间。以下 `<页码>` 从 1 开始，按各请求的 pager 逐页读取；每个执行的任务也分别翻完。客户端筛选后为空仍可能有后续页，不能因此结束读取。完整规则见 [SKILL.md](../SKILL.md)。

一页候选可以帮助用户选目标；做总数、分布、最近记录或全局排序时，先拿全约定范围。权限、版本或分页失败的范围标为缺失，不计作零。`--pick` 保留判断所用字段，不用缺失字段推断健康状态。

## 项目节奏

先列进行中的项目供选择；若要包含未开始、已延期或已关闭项目，按约定范围改用 `browseType=all`：

```bash
zentao project --browseType=doing --pick=id,name,status,begin,end,progress --page=<页码> --recPerPage=100 --format=json
```

围绕一个项目查看执行和任务：

```bash
zentao execution projectExecutions --projectID=<项目ID> --browseType=all --pick=id,name,status,begin,end --page=<页码> --recPerPage=100 --format=json
zentao task --executionID=<执行ID> --browseType=all --pick=id,name,status,assignedTo,estimate,consumed,left --page=<页码> --recPerPage=100 --format=json
```

`projectExecutions` 的最低版本见 `zentao execution projectExecutions --help`。遇到 E2010，分页读取全局执行，再筛选项目并收集执行 ID：

```bash
zentao execution --browseType=all --filter='project=<项目ID>' --pick=id,name,status,project --page=<页码> --recPerPage=100 --format=json
```

按对象 ID 去重，汇总每种实际状态的数量，不把 `pause`、`cancel`、`closed` 隐去。若计算完成率，先说明分母是否排除取消任务；不要把任务数量完成率、工时进度和服务端 `progress` 当作同一指标。计划结束日已过可以提示核对延期，不能仅据此断言实际交付失败。

## 产品健康度

```bash
zentao product --pick=id,name,status --page=<页码> --recPerPage=100 --format=json
zentao story --product=<产品ID> --browseType=allstory --pick=id,title,pri,status,stage,plan --page=<页码> --recPerPage=100 --format=json
zentao bug --product=<产品ID> --browseType=all --pick=id,title,severity,pri,status --page=<页码> --recPerPage=100 --format=json
```

明确统计口径后再计算。例如“激活状态、优先级 1–2、尚未排入计划的需求”和“激活状态、严重程度 1–2 的 Bug”。`pri` 是优先级，`severity` 是严重程度，不能互相代替；`plan` 的空值/数组/对象形态以实际返回为准，缺失时补查询或说明无法判断。

用一两句话报告数量和集中位置，再挑影响最大的具体对象查看；没有历史对照数据时不声称数量“正在上升”或“持续好转”。

## 发布与版本

```bash
zentao release --productID=<产品ID> --browseType=all --pick=id,name,date,status --page=<页码> --recPerPage=100 --format=json
zentao build --project=<项目ID> --browseType=all --pick=id,name,date,product --page=<页码> --recPerPage=100 --format=json
```

读完整个约定范围后，再按日期及状态挑近期记录。发布的 `date` 是计划发布日期，不能直接当作实际完成上线的时间；构建存在也不等于已经发布。只在返回状态和已知事实支持时说明实际交付情况。

## 反馈与工单

```bash
zentao feedback --productID=<产品ID> --browseType=all --pick=id,title,status,pri,type --page=<页码> --recPerPage=100 --format=json
zentao ticket --productID=<产品ID> --browseType=all --pick=id,title,status,pri,type --page=<页码> --recPerPage=100 --format=json
```

说明哪些状态算未处理，再统计数量与类型。反馈、工单是不同对象，不直接相加当作去重后的“用户问题总数”；标题相似也不能自动认定同一问题。模块不可用或无权访问时，说明缺失范围并继续已有的只读分析。

## 收尾

用几句话回顾本次查到的事实、统计口径和仍需核对的点，保留关键对象 ID 便于追查。用户要定期看这些数字时再讨论查询脚本或定期运行，不把一次查询默认变成持续监控。回到 [SKILL.md](../SKILL.md) 结束或切换角色。
