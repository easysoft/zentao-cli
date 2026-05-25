---
name: release
description: 发布新版本前的准备工作（确定版本号、更新 CHANGES.md、打 tag）
---

## 任务目标

完成新版本发布前的所有准备工作。

## 执行步骤

### 前期检查：工作区状态检查

检查当前工作区是否有未提交的代码，如果有则提示用户提交或暂存。

### 第一步：收集变更范围

运行以下命令，获取自上次发布 tag 以来的所有提交：

```bash
# 获取最近一个 tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

# 列出变更提交
if [ -n "$LAST_TAG" ]; then
  git log ${LAST_TAG}..HEAD --oneline
else
  git log --oneline
fi
```

同时获取当前版本号：

```bash
node -e "console.log(require('./package.json').version)"
```

### 第二步：确定新版本号

**如果用户已指定版本号**，直接使用该版本号。

**如果用户未指定**，根据提交内容按照 [SemVer 语义化版本规范](https://semver.org/lang/zh-CN/) 判断：

| 变更类型 | 版本号规则 |
|---------|-----------|
| 存在不兼容的 API 破坏性改动（breaking change） | 递增**主版本号** (major) |
| 新增向下兼容的功能（`feat`、新命令、新模块等） | 递增**次版本号** (minor) |
| 仅有向下兼容的 bug 修复、文档、测试、重构等 | 递增**修订号** (patch) |

判断后，向用户展示推荐的新版本号并说明理由，**等待用户确认**再继续。

### 第三步：更新 `package.json` 版本号

使用 StrReplace 工具修改 `package.json` 中的 `"version"` 字段为新版本号。

### 第四步：检查并更新技能版本号

检查 `skills/` 目录下所有技能在本次发布范围内是否有文件变动：

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  git diff --name-only ${LAST_TAG}..HEAD -- skills/
else
  git diff --name-only HEAD -- skills/
fi
```

对于每个**有变动**的技能目录，将其 `SKILL.md` frontmatter 中的 `metadata.version` 字段更新为新版本号：

```yaml
metadata:
  version: <新版本号>   # 将此处更新
```

使用 StrReplace 工具逐个修改，不要批量替换以避免误改无变动的技能。

### 第五步：更新 `CHANGES.md`

在 `CHANGES.md` 文件顶部（`# Changes` 标题之后）插入本次变更内容，格式如下：

```markdown
## <新版本号>

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
  - <本次更新内容描述>
  - ...
- **<技能名称>**:
  - <本次更新内容描述>
  - ...
```

**注意**：

- 只保留有实际内容的分类，空分类直接省略
- 「技能更新」分类中每个有变动的技能单独一条，技能名称加粗；如果本次无任何技能变动则省略该分类
- 每条变更描述用中文撰写，简洁清晰，突出对用户的影响
- 参考 `CHANGES.md` 中已有条目的表述风格保持一致

### 第六步：提交变更

```bash
git add CHANGES.md package.json skills/
git commit -m "* release v<新版本号>"
```

### 第七步：打 git tag

```bash
git tag v<新版本号>
```

完成后告知用户：

- 新版本号
- CHANGES.md 已更新的内容摘要
- 有版本号变动的技能列表（如有）
- 已创建的 tag 名称
- 提示用户执行 `git push && git push --tags` 将变更推送到远端
