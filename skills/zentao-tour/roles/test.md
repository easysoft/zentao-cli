# 测试视角

围绕“怎么知道功能符合预期、发现的问题怎么跟进”展开，从需求、用例到测试单与 Bug。遵循 [共同规则](../SKILL.md)，已存在的业务缺陷不用于随意演练解决和关闭。

## 选需求与提测版本

复用用户已给定的产品和执行；不清楚时先选范围，再列候选：

```bash
zentao story --product=<产品ID> --browseType=allstory --pick=id,title,pri,stage,status --page=1 --recPerPage=20
zentao build --project=<项目ID> --pick=id,name,date,product --page=1 --recPerPage=20
```

第一页仅供选择，找不到目标时继续分页，不自动创建替代需求或虚构版本。需要筛选多个阶段时，可使用重复的 `--filter` 表示 OR，例如 `--filter='stage=developed' --filter='stage=testing'`；阶段枚举与业务范围以实际需求为准。

## 写一条能执行的用例

读所选需求详情，让用户描述一个正常场景和一个异常场景。把前置条件、操作步骤、预期结果对齐，再在已授权范围内创建。简单步骤与预期用等长数组传入；下面是内容示例，应替换为真实场景：

```bash
zentao testcase create --productID=<产品ID> --story=<需求ID> --data '{"title":"正常账号可以登录","pri":2,"type":"feature","precondition":"账号可用且已退出登录","steps":["输入正确账号和密码并提交"],"expects":["进入首页并显示当前用户"],"stepType":["step"]}'
```

需要分组或嵌套步骤时先读 `zentao testcase create --help`，不自行猜结构。创建用例只代表记录了测试设计，不代表已执行或通过。

## 组织测试单

测试单指定本次要测的真实构建/版本；明确名称、日期与执行后再创建：

```bash
zentao testtask create --productID=<产品ID> --name="<测试单名称>" --build=<版本ID> --execution=<执行ID> --begin=<YYYY-MM-DD> --end=<YYYY-MM-DD>
```

`build` 是数值版本 ID，不能用 Bug 接口的 `trunk` 值替代。当前 CLI 没有将用例关联到测试单或执行用例的动作，应在禅道界面完成这些步骤。不要把创建测试单描述为“用例已经关联并跑通”。此模块也没有 `get`，必要时通过列表核实创建结果：

```bash
zentao testtask --product=<产品ID> --pick=id,name,status,build --page=<页码> --recPerPage=100 --format=json
```

用户只想看自己负责的测试单时，可先查看 `zentao my testtasks --help`，支持当前服务器版本后调用 `zentao my testtasks --page=1 --recPerPage=20`；E2010 时仍使用上面的产品范围查询。

## 发现 Bug 后记录证据

确认标题、严重度、优先级、重现步骤、实际与预期结果，以及影响版本。`openedBuild` 是字符串数组，下例 `"34"` 为示例版本 ID；只有实际影响主干时才用 `"trunk"`。

```bash
zentao bug create --productID=<产品ID> --title="<Bug 标题>" --severity=<1-4> --pri=<1-4> --type=codeerror --steps="<前置条件、重现步骤、实际与预期结果>" --data '{"openedBuild":["34"]}'
```

用户有本地截图并明确要上传时，可关联到刚创建或指定的 Bug：

```bash
zentao file create --file=<本地截图路径> --objectType=bug --objectID=<BugID>
```

上传前核对文件与目标，成功后引用实际返回的附件信息，不把附件上传当作 Bug 已解决。

## 解决与回归是两个动作

只想认识生命周期时，说明 `active → resolved → closed` 的含义并展示命令即可。实际记录须对应已核实的解决与回归结果；`fixed` 要有修复依据，关闭前要有回归依据。用户授权的演示对象可用于演练，但应明确是演示。

```bash
zentao bug resolve <id> --resolution=fixed --resolvedBuild=<版本ID>
zentao bug close <id>
```

两条是不同阶段的动作，不因放在同一段示例就连续执行。回归仍失败时，先看 `zentao bug activate --help` 的必填字段，在授权范围内重新激活；不要为了演示闭环把真实 Bug 关闭。

回顾时区分已写用例、已建测试单、已关联/执行的步骤及已登记的 Bug。按 [收尾规则](../SKILL.md) 保留记录；开发处理问题可转到 [开发视角](dev.md)。
