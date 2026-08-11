---
name: release
description: 为 zentao-cli 准备并可选发布新版本：检查工作区和上个 Git tag 以来的变更，按 SemVer 确认版本号，更新 package.json、CHANGES.md 及已变更随包技能的 metadata.version，运行 Bun 验证，创建发布提交与 tag，并在明确要求后发布到 npm。用户提出发布版本、准备 release、升级版本号、整理变更日志、同步技能版本、创建发布 tag，或发布 zentao-cli npm 包时使用。
---

# 发布 zentao-cli

从仓库根目录执行流程并遵守 `AGENTS.md`。尊重用户指定的执行范围；用户要求完整发布时，完成本地发布准备、提交和 tag。不要擅自丢弃既有改动、推送远端或发布 npm 包。

## 1. 检查发布前状态

1. 运行 `git rev-parse --show-toplevel`，确认正在操作 `zentao-cli` 仓库根目录。
2. 运行 `git status --short --branch`，记录当前分支和工作区状态。
3. 如存在未提交或未跟踪文件，列出文件并暂停；请用户先提交、暂存或明确哪些改动应纳入发布。不要自行暂存、覆盖或丢弃它们。
4. 读取 `package.json` 的当前版本，并确认对应的 `v<当前版本>` tag 与发布历史没有明显冲突。

## 2. 收集版本和变更范围

1. 运行 `git describe --tags --abbrev=0` 获取最近 tag。没有 tag 时，以全部历史为发布范围。
2. 有 tag 时运行 `git log <最近-tag>..HEAD --oneline`；没有 tag 时运行 `git log --oneline`。
3. 同时检查提交正文、`git diff --stat`、`git diff --name-status` 和必要的源码差异。不要只根据提交标题判断用户影响或破坏性变更。
4. 如最近 tag 后没有实际变更，停止并说明没有内容可发布。
5. 读取 `CHANGES.md` 顶部和最近版本条目，沿用既有结构、分类和中文措辞。
6. 收集发布范围内 `skills/` 下的变更文件，并归并到各顶层技能目录。没有 tag 时，将当前所有随包技能视为首发范围。`.agents/skills/` 是项目开发技能，不属于随 npm 包发布的 `skills/`，不要同步其版本号。

## 3. 确认新版本号

- 用户已指定版本号时，校验它是合法、递增且尚未使用的 SemVer。`package.json` 使用裸版本号，tag 使用 `v<版本号>`。
- 用户未指定版本号时，按实际影响推荐版本：
  - 存在不兼容的 CLI、配置、MCP 工具或随包技能行为变更：递增 major。
  - 存在向下兼容的新命令、新模块或新能力：递增 minor。
  - 仅包含向下兼容的修复、文档、测试、内部重构或维护：递增 patch。
- 不要只依赖 `feat`、`fix` 等提交前缀；以代码和用户可见行为为准。
- 用户未预先指定版本时，展示“当前版本 → 推荐版本”、主要变更依据和 SemVer 理由，并等待明确确认后再修改文件。
- 修改前确认 `v<版本号>` 不存在。版本号无效、不递增或 tag 已存在时，停止并处理冲突。

## 4. 更新发布文件

### 更新 package.json

仅精确修改 `package.json` 的 `version` 字段。不要改动 `bun.lock`；它不记录本项目版本。构建脚本会从 `package.json` 注入 `BUILD_VERSION`，不要另设版本常量。

### 同步已变更的随包技能

1. 仅处理发布范围内实际有文件变动的 `skills/<技能名>/` 目录。
2. 对每个受影响技能，精确更新其 `SKILL.md` frontmatter 中的 `metadata.version` 为新版本号。
3. 逐个检查和编辑，不要批量替换整个 `skills/` 目录，也不要更新未变更技能。
4. 记录所有版本号发生变化的技能名称，供变更日志和最终报告使用。

### 更新 CHANGES.md

1. 以提交记录和实际 diff 为准，核对 `## Unreleased` 中的内容是否完整、准确并去重。
2. 如存在 `## Unreleased`，将其标题改为 `## <版本号>`；如不存在，则在 `# Changes` 后插入新版本条目。不要额外保留空的 `Unreleased` 条目。
3. 按现有格式组织内容，只保留有实际内容的分类：

   ```markdown
   ## <版本号>

   ### ✨ 新特性 (Feat)

   - ...

   ### 🐛 修复 (Fix)

   - ...

   ### 🚀 优化与重构 (Refactor)

   - ...

   ### ✅ 测试 (Test)

   - ...

   ### 📝 文档 (Docs)

   - ...

   ### 🤸 技能更新（Skill）

   - **<技能名称>**:
     - ...
   ```

4. 使用简洁中文描述用户影响，合并重复提交，忽略纯发布 housekeeping，并沿用既有标点和措辞风格。
5. 每个有变动的随包技能在“技能更新”中单独列出；没有技能变动时省略该分类。

## 5. 验证发布内容

依次运行：

```bash
bun run typecheck
bun test
bun run build
node bin/zentao.js -V
```

要求所有命令成功，并确认构建后的 CLI 输出新版本号。命令失败时先诊断并修复根因，不要创建发布提交或 tag。

随后运行 `git diff --check`，并检查 `git status --short`、完整 diff 和 diff 统计：

- 确认 `package.json`、`CHANGES.md` 和受影响技能版本正确。
- 确认没有意外修改 `bun.lock`、未变更技能或其他无关文件。
- 如出现不属于本次发布的变化，暂停并说明，不要擅自纳入。

## 6. 创建发布提交和 tag

1. 仅暂存确认过的 `package.json`、`CHANGES.md` 和版本号实际变化的 `skills/<技能名>/SKILL.md`，不要笼统暂存整个工作区。
2. 运行 `git diff --cached --check`，再检查暂存 diff 和统计；有错误或意外文件时先处理。
3. 使用项目约定的英文提交信息：`git commit -m "* release v<版本号>"`。
4. 提交成功后运行 `git tag v<版本号>` 创建轻量 tag。
5. 不自动推送。报告新版本号、变更日志摘要、同步版本的技能、验证结果、提交和 tag，并提示用户可执行 `git push && git push --tags`。

## 7. 可选发布到 npm

只有用户明确要求或确认发布 npm 包后才继续：

1. 运行 `npm whoami` 检查登录状态；未登录时让用户运行 `npm login` 完成认证。
2. 运行 `bun publish`。
3. 发布成功后报告 [zentao-cli npm 包](https://www.npmjs.com/package/zentao-cli)。

发布失败时保留本地提交和 tag，说明失败步骤；不要重复发布、强制移动 tag 或改写已创建的版本历史。
