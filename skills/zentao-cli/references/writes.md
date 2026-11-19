# 写入、状态流转与批量

先读取动作帮助，替换示例 ID 与账号为用户授权的真实值。

```bash
zentao story create --product-id 1 --title '需求标题' --assigned-to admin --pri 3
zentao story update 11 --plan 1
zentao story change 11 --data '{"title":"调整后的需求","reviewer":["reviewer1"]}'
zentao doc create-my-doc --space-id 1 --lib-id 2 --data '{"title":"说明","content":"# 正文","contentType":"doc"}'
zentao bug create --product 1 --title 'Bug 标题' --opened-build trunk
zentao bug update 329 --steps '这是**重现步骤**' --markdown
zentao bug create --product 12 --opened-build trunk --title '登录失败' --steps '<img src="file:./screenshot.png" alt="登录截图">'
zentao bug update 329 --markdown --steps '![复现截图](file:~/imgs/screenshot.png)'
zentao story change 11 --data '{"spec":"支持**扫码登录**","verify":"<p>进入首页</p>"}' --markdown spec
zentao story create --product-id 1 --data @body.json
zentao story create --product-id 1 --data @- < body.json
```

空格与等号赋值等价，多行文本和额外等号保持原文。类型由 schema 决定，不猜测字符串类型。请求体 JSON 必须是对象，同名字段来自多个入口且值不同时报错。只有显式 @- 才读取标准输入。API 数组需要数值时，用重复数值选项或 JSON 数字数组，不能把字符串数字混入。

用户提供 Markdown 正文时，查看动作 JSON 帮助的 `markdownFields`。`--markdown` 转换本次输入的所有 HTML 字段，`--markdown spec,verify` 只转换列出的字段。混用 Markdown 与已有 HTML 时指定字段名。目标 ID 放在选项前。协同文档的 `content` 直接传原生 Markdown，写入旧式 HTML 文档时显式指定 `--content-type html`。

story/requirement/epic 的 create/change：没有有效 reviewer 时跳过评审，状态默认 active；显式 status=draft 保留草稿。有有效 reviewer 时状态固定 reviewing。change 不自动保存原草稿状态，先核对业务意图。

更新 autoFill 仅在存在匹配的详情操作时生效，只补动作声明的可写字段；显式空字符串不会被当成缺省。状态流转不自动补全。不要复制整份 GET 结果作为请求体。

用户指定本地截图时，在对应 HTML 字段的图片位置写 `file:./`、`file:../`、`file:~/` 或绝对文件 URL。相对路径以命令执行目录为准。CLI 和本地 stdio MCP 会自动上传并绑定图片。保存成功后，CLI 单项 JSON 的警告在 `meta.fileWarnings`，批量 JSON 的警告在每个成功项的 `meta.fileWarnings`，MCP 的警告在 `structuredContent.fileWarnings`。向用户指出上传失败后用文字占位的图片。

分步上传编辑器图片时，每个目标对象使用独立 UID。先用 `zentao file create --file ./screenshot.png --uid "$uid" --format=json` 上传，再用同一 Token 执行支持 `--uid` 的对象保存动作。正文用 `<img src="file:42">` 引用上传返回的实际文件 ID，并传入相同的 `--uid "$uid"`。服务端需支持客户端 UID（23.0 / biz14.0 / max9.0 / ipd6.0 起，并包含 `0a4de3a66f5` 或等效修复）。

```bash
zentao bug resolve --ids 123,124 --resolution fixed --format=json
zentao bug delete --ids 123,124 --yes --no-input --format=json
zentao repo create --data '{"space":10,"product":[12,13],"name":"demo_repo"}'
zentao relation unlink 8 --yes
```

ids 只用于帮助声明支持批量的对象动作；与单个目标互斥，先完整校验和去重。创建多条记录显式逐条 create。relation unlink 使用 relation list 返回的关系记录 ID，不能用对象 ID 或 relationKey 替代。

批量逐项保留数据与错误；batch-fail-fast 不回滚已经成功的部分。写入超时或结果不明确时先按返回 ID、标题或列表核实，不盲目重复创建。
