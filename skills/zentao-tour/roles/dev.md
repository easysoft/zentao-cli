# 开发视角

从“我今天做什么”切入，陪用户看任务、理解工时，再看分给自己的 Bug。按 [共同规则](../SKILL.md) 使用真实数据；开始、完成和解决都应对应真实工作进展或已授权的演练，不为了走完路线流转记录。

## 先看我的任务

已知账号时直接查询，无需再跑一次 profile。先用 `zentao my tasks --help` 看最低版本，然后：

```bash
zentao my tasks --browseType=assignedtome --pick=id,name,status,estimate,consumed,left --page=1 --recPerPage=20
```

这条入口不用先找执行 ID。让用户挑一条感兴趣的任务，再看 `zentao task <id>`。只查了第一页时说“这一页有这些任务”，不要断言“只有这些”或“没有任务”。需要找某条或确认没有时继续翻页。

如果返回 E2010，先确定用户所在执行，在旧接口支持的范围内查询：

```bash
zentao task --executionID=<执行ID> --browseType=all --pick=id,name,status,assignedTo,estimate --page=<页码> --recPerPage=100 --format=json
```

按 pager 翻页，核对 `assignedTo` 的实际返回结构后按账号筛选；若是用户对象，使用其中的 `account`，不要拿姓名和账号比较。这个结果仅代表选定执行，不能称为全部“我的任务”。权限错误按权限处理，不能借降级宣称拿到了完整结果。

没有可处理的任务时，可看一条已有任务的详情，或在用户明确指定的执行中查看未分派任务。不要自动认领公共池的记录。用户决定认领后再执行：

```bash
zentao task update <id> --assignedTo=<账号>
```

## 开始与工时

说明 `estimate` 是预计总工时、`consumed` 是累计消耗、`left` 是预计剩余。用户确实开始工作且需要更新时，使用实际时间；不把估计时间写成已经发生的工时。

```bash
zentao task update <id> --estimate=<小时>
zentao task start <id> --realStarted="<YYYY-MM-DD HH:mm:ss>"
```

两条按需要选择，修改预计不是开始任务的必要步骤。依据返回结果确认状态；返回不足时再查详情。实际完成并掌握开始时间、完成时间和本次消耗后，才使用：

```bash
zentao task finish <id> --currentConsumed=<本次小时> --realStarted="<YYYY-MM-DD HH:mm:ss>" --finishedDate="<YYYY-MM-DD HH:mm:ss>"
```

保留原本正确的实际开始时间，`currentConsumed` 填本次新增工时，不要把累计工时重复计入。教学时可以展示 `wait → doing → done`，但仅展示命令不代表任务已经做完。

## 再看我的 Bug

```bash
zentao my bugs --browseType=assignedtome --pick=id,title,status,severity,pri --page=1 --recPerPage=20
```

挑一条后读取 `zentao bug <id>`，先了解现象、重现条件和修复情况。E2010 时在用户指定产品里分页查询，再按实际 `assignedTo` 结构筛选账号：

```bash
zentao bug --product=<产品ID> --browseType=all --pick=id,title,status,severity,pri,assignedTo --page=<页码> --recPerPage=100 --format=json
```

当用户已修复并要求登记时，核对真实解决版本后执行：

```bash
zentao bug resolve <id> --resolution=fixed --resolvedBuild=<版本ID>
```

`resolvedBuild=trunk` 仅用于实际在主干解决的情况。其他解决方案及其业务含义以 `zentao bug resolve --help` 为准，不用 `fixed` 掩盖“无法重现”“设计如此”或“重复 Bug”。开发标记解决后，测试通常还需回归，不能顺手当作已回归关闭。

结束时简短回顾本次实际处理的任务和 Bug，保留未完成事项；测试回归问题可转到 [测试视角](test.md)，其余按 [收尾规则](../SKILL.md) 处理。
