# 项目经理视角

从“这个项目下一步怎么安排”切入，把项目、执行、任务和人员串起来。遵循 [共同规则](../SKILL.md)，优先使用现有项目和执行；体验不要求重新建一套，也不要求把任务全部流转到完成。

## 先选已有项目与执行

```bash
zentao project --browseType=all --pick=id,name,model,status,begin,end --page=1 --recPerPage=10
zentao execution projectExecutions --projectID=<项目ID> --browseType=all --pick=id,name,type,status,begin,end --page=1 --recPerPage=20
```

第二条是直接查询项目执行的新入口，使用前可查 `zentao execution projectExecutions --help`。E2010 时，改用全局执行列表分页读取并按 `project` 筛选；过滤后空页不能作为终止条件：

```bash
zentao execution --browseType=all --filter='project=<项目ID>' --pick=id,name,type,status,project --page=<页码> --recPerPage=100 --format=json
```

项目可关联产品，产品不是项目的必填“父对象”。下面的创建例子走常见的产品研发路线，只在用户确实需要新项目或演示对象时采用。

## 需要新建时，明确模型和日期

说明项目名称、起止日期、管理方式和关联产品。`scrum` 是敏捷项目示例，不替用户已有的瀑布或看板项目改模型。数组字段用 JSON；下文 `12` 是示例产品 ID，必须替换为实际选定产品。

```bash
zentao project create --name="<项目名称>" --model=scrum --begin=<YYYY-MM-DD> --end=<YYYY-MM-DD> --workflowGroup=0 --data '{"products":[12]}'
```

当前 CLI 将 `workflowGroup` 定义为必填：开源版示例用 `0`；付费版应使用实际项目流程 ID，不照抄 `0`。服务器支持时可用 `zentao workflow --help`、`zentao workflow` 查看流程；不支持时使用用户提供或界面中核实的配置，不能编造 ID。

拿到真实项目 ID 后，创建迭代：

```bash
zentao execution create --project=<项目ID> --name="Sprint 1" --type=sprint --begin=<YYYY-MM-DD> --end=<YYYY-MM-DD> --data '{"products":[12]}'
```

执行并非都叫 sprint。按 `zentao execution create --help` 与项目模型选用 `sprint`、`stage` 或 `kanban`；阶段还可用 `parent` 指定父阶段、`attribute` 指定阶段类型。用户使用 IPD 时，创建阶段必须显式传 `type=stage`；仅在确实需要时展开这些字段。

## 把已有需求拆成任务

先在实际产品范围内找需求，查看其状态和是否已关联执行：

```bash
zentao story --product=<产品ID> --browseType=allstory --pick=id,title,pri,status,stage --page=1 --recPerPage=20
```

选一条讨论任务拆分、负责人和预估工时。读取需求详情，确认具备进入该执行的条件；如需把需求关联到执行，而当前 CLI 没有对应动作，说明应在禅道界面完成，不把创建任务当作已经关联需求的证据。

```bash
zentao task create --executionID=<执行ID> --story=<需求ID> --name="<任务名称>" --type=devel --assignedTo=<账号> --estimate=<小时>
```

`assignedTo` 使用实际账号，必要时从执行成员里核对，不能从姓名猜账号。已批准的任务可以按批次完成，结果部分失败时仅继续处理未成功部分。

## 看分工与进展

```bash
zentao task --executionID=<执行ID> --browseType=all --pick=id,name,status,assignedTo,estimate,consumed,left --page=<页码> --recPerPage=100 --format=json
```

按 pager 完整读取后，才能统计这个执行的工作量或状态分布。区分预计、累计消耗和剩余工时；少数任务或当前页不能代表整个项目。

如果用户只想了解状态，说明 `wait → doing → done` 即可。需要实际登记开始/完成时，转到 [开发视角](dev.md) 的工时与状态命令，核对真实进展和时间；不要为展示看板效果写入虚假完成记录。

收尾说明已确认的项目、执行、分工和未完成安排，按 [收尾规则](../SKILL.md) 处理。测试组织问题可转到 [测试视角](test.md)。
