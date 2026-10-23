# 写入、状态流转与批量操作

先用实际操作帮助核对字段。下面的 ID、账号、日期和内容只是语法示例，执行时替换为用户授权的真实值。

## 请求体

业务字段使用 `--field=value`；CLI 额外 API 参数不支持通用的 `--field value` 写法。少量标量可直接传入，数组字符串按逗号拆分；嵌套对象、数字数组和长文本优先用 JSON。

用引号包裹的 `--field=value` 支持多行文本，换行、末尾换行和值中的 `=` 都会保留。参数格式无效时会报错，不会静默忽略。

```bash
zentao story create --productID=1 --title="需求标题" --assignedTo=admin --pri=3
zentao story update 11 --plan=1
zentao story change 11 --data '{"title":"调整后的需求标题","reviewer":["reviewer1","reviewer2"]}'
zentao doc createMyDoc --spaceID=1 --libID=2 --data '{"title":"开发说明","content":"# 正文","contentType":"doc"}'
```

`story`、`requirement`、`epic` 的 `create` / `change` 在未提供有效 `reviewer`（省略、空数组或只含空白字符串）时跳过评审。SDK 0.8.2 会发送 `needNotReview: "1"`，状态默认 `active`；需要保留草稿时显式传入 `status: "draft"`，空状态字符串仍会回落为 `active`。有有效评审人时状态固定为 `reviewing`，即使同时指定了其他状态。不要机械补评审人；`change` 不会自动保留对象原来的草稿状态。

```bash
zentao story create --productID=1 --title="草稿需求" --status=draft
zentao requirement change 11 --data '{"title":"调整后的草稿","reviewer":[],"status":"draft"}'
```

上述 `status` 也可由 MCP 的 `params.status` 或 `params.data.status` 传入，`reviewer` 使用账号数组。其余字段要求以当前动作帮助为准。

长文本可以先写入 JSON 文件，再通过 stdin 传入：

```bash
zentao story create --productID=1 --data @- < /path/to/story.json
```

也支持无 `--data` 的 JSON 管道输入。`--data @file.json` 不支持；只有 `@-` 表示 stdin。文件内为有效 JSON 请求体，复杂文本交给 JSON 编码器处理，避免手工拼接 shell 字符串。

`--data` 中同名字段优先于平铺业务字段，不要同时给出互相冲突的值。`--params` 可传路径、查询及请求体参数的对象；一般操作优先用具名路径参数和 `--data`，无需另造包装层。

`bug create` 的 `--product=1` 是 `--productID=1` 的别名。平铺参数同时提供两者时必须指定同一个产品，否则报错；归一化后仍以 `--data` 内的 `productID` 为准。JSON 请求体中使用正式字段 `productID`。

## 更新补全的边界

CLI 对 `type=update` 的操作启用补全：当该模块存在同路径的详情操作，且更新声明了对象请求体时，先读取当前对象，仅补上更新 schema 内尚未传入的字段。用户显式给出的值优先；读取失败则中止写入。

- 不能把 GET 返回的所有字段原样回传，返回属性不一定可写。
- 没有匹配详情接口的更新不会自动补全，例如项目、版本、发布、待办的更新。按帮助准备必要字段；需要现值时从所属列表或其他受支持的查询获取。
- `change`、`resolve`、`start`、`finish` 等状态动作不使用更新补全；按各自动作的必填项提交。

命名更新也按路径匹配详情，例如 `workflow updateFlow` 会先调用 `getFlow`，保留未显式修改的导航和位置字段：

```bash
zentao workflow updateFlow --flowID=5 --name="新的工作流名称"
```

## 代码库、SSH 公钥与对象关联

代码库接口需站点已配置 GitFox，并具备操作、空间及产品访问权限。先查询可用空间和目标空间下的代码库，再用实际空间、产品 ID 创建：

```bash
zentao space list --recPerPage=20 --format=json
zentao repo list --spaceID=10 --recPerPage=20 --format=json
zentao repo create --data '{"space":10,"product":[12,13],"name":"demo_repo"}'
```

`space` 是正整数，`product` 是非空正整数数组。不能用逗号分隔字符串或字符串数组代替；MCP 同样使用 `params.product: [12,13]`，顶层 `product` 数字简写不适用于此动作。私有代码库使用 `acl: "private"`，并提供非空 `members` 账号数组。创建返回 ID；克隆地址需从目标空间的代码库列表读取 `url.http` / `url.ssh`，字段可能缺省。创建超时或后续步骤失败时，先查列表核对是否已经创建，再决定是否重试。

用户要求添加 SSH 公钥时，使用用户指定的完整单行公钥文本，替换下方占位内容；不提交私钥：

```bash
zentao my createSSH --data '{"name":"developer","publicKey":"ssh-ed25519 <完整公钥内容> developer@example.com"}'
```

GitFox 负责公钥完整性及重复检查。该操作修改当前 Token 用户的密钥，不是查询；MCP 只读模式会拒绝执行。

先查已有关系或候选对象。解除关联时选择用户授权删除且 `relationType=custom` 的关系，读取该条记录的 `relationID`；下方 `8` 是关系记录 ID 示例：

```bash
zentao relation list --objectType=story --objectID=42 --format=json
zentao relation candidates --objectType=story --objectID=42 --relatedObjectType=bug --format=json
zentao relation unlink --relationID=8 --yes
```

SDK 0.8.1 起，`relation unlink` 只使用关系记录 `relationID`，不能用关联对象 ID 或 `relationKey` 代替。此动作的位置 ID / `--id` 也表示 `relationID`；旧的五个路径参数已停用，脚本需要迁移。查询关联与候选对象仍使用 `objectType`、`objectID` 等参数。

当前 SDK 的 `relation link` 将 `relation` 声明为数组，但说明和请求示例使用对象映射；在上游契约统一前，不据此拼接新增关联请求。

## 常用状态操作

```bash
zentao bug create --productID=1 --title="Bug标题" --severity=2 --pri=2 --type=codeerror --openedBuild=trunk
zentao bug resolve 42 --resolution=fixed
zentao bug close 42
zentao bug activate 42
zentao story close 11 --closedReason=done
zentao task create --executionID=1 --name="任务名" --type=devel --assignedTo=admin --estimate=4
zentao task start 100 --realStarted="<YYYY-MM-DD HH:mm:ss>"
zentao task finish 100 --currentConsumed=4 --realStarted="<YYYY-MM-DD HH:mm:ss>" --finishedDate="<YYYY-MM-DD HH:mm:ss>"
```

解决、完成和关闭需要用户给出的实际结果；不要为了演示流程把现有记录改成已完成。若真实意图只是修改负责人或预估，使用更新，不顺带流转状态。

上传附件可用：

```bash
zentao file create --file=/path/to/screenshot.png --objectType=bug --objectID=42
```

上传成功不代表附件已经作为图片嵌入对象正文；根据返回结果核实用户要求的关联和展示方式。

## 删除与批量结果

删除前落实对象 ID 和授权范围；用户已明确授权这一组对象时一次执行，不逐条重复询问。非交互、JSON/raw 或 `--machine-readable` 模式均要求显式 `--yes`；这个参数只跳过 CLI 提示，不扩展用户授权。

```bash
zentao bug delete 42 --yes
zentao bug get 42,43 --format=json
zentao bug update 42,43 --assignedTo=admin --batch-fail-fast --format=json
zentao bug delete 42,43 --yes --format=json
```

逗号分隔的数字 ID 会逐个请求；这是同一操作作用于多个对象，不能用来传递文档等操作的多个路径 ID。批量也可使用 `--id=42,43`。

JSON 和 raw 模式的批量结果都包在：

```json
{
  "status": "failed",
  "result": {
    "success": [42],
    "failed": [43],
    "skipped": [44],
    "errors": [{"objectID": 43, "error": {"code": "2006", "message": "当前用户没有权限执行此操作"}}],
    "data": [{"objectID": 42, "value": {"id": 42}}]
  }
}
```

`success` / `failed` / `skipped` 是 ID 数组；非删除请求的返回值在 `data` 的 `{objectID,value}` 项中，删除不含 `data`。默认遇错继续，`--batch-fail-fast` 会把后续对象计入 `skipped`；任一失败令退出码为 1。

分别报告三组结果及原因。对超时等结果不明确的失败项，先查询是否已写入，再决定是否重试；`skipped` 是本轮尚未执行的对象，可在原授权范围内继续处理。不要重跑已经成功的对象，也不要把汇总 `status` 当成全批事务的回滚标记。
