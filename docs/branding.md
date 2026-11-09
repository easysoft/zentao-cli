# 自定义发行品牌

品牌只在构建时选择。用户安装后的命令不读取品牌文件，也不需要设置品牌环境变量。未指定品牌时，保留现有禅道行为。

创建一个 JSON 配置文件，例如：

```json
{
  "displayName": "Example",
  "commandName": "example",
  "packageName": "example-cli",
  "homepage": "https://example.com/",
  "logo": "./logo.svg",
  "repository": null
}
```

LOGO 相对于配置文件解析，必须是无脚本、无外部引用的 SVG。`repository` 为 `null` 时，生成文档不提供上游仓库、Issue 或 Release 的公开入口。命令和包名称仅接受小写、不带 scope 的名称。

```sh
bun run build -- --brand /path/to/brand.json --outdir ./release/example/package
bun run scripts/generate-command-reference.ts --brand /path/to/brand.json --outdir ./release/example/package
bun run build:site -- --brand /path/to/brand.json --outdir ./release/example/site
```

构建目录应为空，或是之前由品牌构建创建的目录。构建重新生成旧产物，拒绝覆盖源码和不受管理的目录。CLI 依赖在根目录安装，网站依赖在 `site/` 安装，均使用 `bun install --frozen-lockfile`。

包目录可以直接执行 `npm pack --ignore-scripts`。程序、配置和补全采用 `commandName`；环境变量采用其大写前缀；MCP 工具以 `commandName_` 开头。技能目录使用 `commandName-cli` 和 `commandName-tour`。不同品牌的默认配置相互隔离，不自动迁移凭证。

SDK 包名、API 字段、枚举值和原始数据保持不变。自有模板先格式化，再插入业务值；SDK 的帮助元数据使用只读展示副本。不要对 stdout、响应对象或完整错误消息执行全局品牌替换。

新增面向用户的文案时使用 `brandText('固定文案')`，含业务值时使用标记模板 `brandText`，让插值保持原样。SDK 错误取 `error.params`，不要从英文 `message` 中解析字段。命令参考与网站构建必须使用同一配置。
