# Zentao CLI 使用指南

本文档帮助你在终端中使用 `zentao` 查询和操作禅道数据，以及在 AI Agents 中使用 Zentao CLI 技能或 MCP 服务。

## 简单介绍

`zentao-cli` 是禅道的命令行工具。你可以直接在终端里完成常见工作，主要特性：

- 基于最新的禅道 RESTful API 2.0 实现
- 使用便捷，可通过 `npx zentao-cli` 立即运行
- 安全的用户认证管理，支持多用户切换
- 支持对数据进行摘取、过滤、排序等处理，并自动将 HTML 转换为 Markdown
- 对 AI Agents 友好，帮助信息完善，支持输出 Markdown
- 支持以 AI 技能点方式使用，支持通过 `zentao add-skill` 一键安装技能到 AI Agent
- 支持 MCP 服务，使用 `npx zentao-cli mcp` 启动 MCP 服务
- 使用现代的 bun 与 TypeScript 开发，具备类型安全
- 提供完善的测试覆盖，保障代码质量

如果你正在使用 AI Agent（如 Cursor、Claude Code、Codex 等），也可以把 Zentao CLI 作为技能或 MCP 服务接入。

## 快速开始

### 1) 安装或免安装运行

你可以任选一种方式：

```bash
# 全局安装（推荐长期使用）
npm install -g zentao-cli

# 免安装运行
npx zentao-cli
```

安装后，命令名是 `zentao`。

### 2) 登录禅道

首次运行会引导你登录：

```bash
zentao
```

也可以手动登录：

```bash
zentao login -s https://zentao.example.com -u admin -p 123456
```

### 3) 试几个最常用命令

```bash
# 查看产品列表
zentao product

# 查看某个产品详情（例如 ID=1）
zentao product 1

# 查看帮助
zentao help
```

## 常见使用场景

### 查看数据

```bash
# 查看项目列表
zentao project

# 查看 Bug 列表
zentao bug

# 查看某条需求（ID=123）
zentao story 123
```

### 创建、更新、删除

```bash
# 创建产品（示例）
zentao product create --name=新产品

# 更新产品（示例）
zentao product update 1 --name=产品1-新名称

# 删除产品（示例）
zentao product delete 1
```

> 不同模块（如 bug、task、story）可用参数可能不同，建议先看该模块帮助：`zentao <module> help`

### 按条件筛选和搜索

```bash
# 只看指定字段
zentao product --pick=id,name

# 过滤：名称包含“平台”
zentao product --filter 'name~平台'

# 搜索关键词
zentao product --search=平台

# 排序
zentao product --sort=name_asc
```

### 分页和限制返回数量

```bash
# 指定页码和每页数量
zentao product --page=1 --recPerPage=20

# 只取前 10 条
zentao product --limit=10

# 获取全部
zentao product --all
```

## 推荐掌握的 8 个命令

```bash
zentao login                 # 登录
zentao profile               # 查看/切换当前账号
zentao logout                # 退出登录
zentao <module>              # 列表查询
zentao <module> <id>         # 单条详情
zentao <module> create ...   # 创建
zentao <module> update ...   # 更新
zentao <module> delete ...   # 删除
```

示例中的 `<module>` 常见为：`product`、`project`、`execution`、`story`、`bug`、`task`。

## 输出格式与安静模式

### 切换输出格式

```bash
# 默认是 markdown 表格/列表
zentao product

# JSON（适合程序处理）
zentao product --format=json

# 原始返回
zentao product --format=raw
```

### 安静模式（脚本常用）

```bash
zentao product --silent
```

启用后仅在出错时输出信息，适合自动化脚本。

## 账号与配置

### 多账号切换

```bash
# 查看当前保存的账号
zentao profile

# 切换账号（示例）
zentao profile dev1@https://zentao.example.com
```

### 常用配置

```bash
# 设置默认输出为 JSON
zentao config set defaultOutputFormat json

# 查看配置
zentao config get
```

## 在 AI Agent 中使用（可选）

如果你希望让 AI 直接帮你操作禅道，可以使用：

```bash
# 安装 Zentao CLI 技能
zentao add-skill

# 配置 MCP 服务
zentao add-mcp
```

这两种方式都可以让 AI Agent 调用 Zentao CLI 能力。

## 常见问题

### Q1: 命令报未登录？

先执行：

```bash
zentao login
```

### Q2: 不知道某个模块支持哪些参数？

执行：

```bash
zentao <module> help
```

例如：

```bash
zentao bug help
```

### Q3: 如何确认版本？

```bash
zentao version
```
