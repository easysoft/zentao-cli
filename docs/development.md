# 开发指引

本文档面向希望为项目做贡献或了解项目结构的开发者。

## 技术栈

* 使用 Bun + TypeScript 开发，构建为 Node.js 兼容产物，通过 npm 发布，用户无需安装 Bun
* 用户配置存储：[configstore](https://github.com/sindresorhus/configstore)
* 终端开发辅助库：[commander.js](https://github.com/tj/commander.js)
* HTML 转 Markdown：[turndown](https://github.com/mixmark-io/turndown)
* [Node.js CLI 应用程序最佳实践](https://github.com/lirantal/nodejs-cli-apps-best-practices/blob/main/README_zh-Hans.md)

## 项目结构

```sh
zentao-cli/
├── src/
│   ├── commands/           # 命令实现
│   ├── api/                # API 客户端（HTTP 请求封装、Token 管理）
│   ├── auth/               # 认证逻辑
│   ├── utils/              # 工具函数
│   ├── config/             # 配置管理
│   ├── types/              # TypeScript 类型定义
│   └── index.ts            # 入口文件
├── tests/                  # 测试
├── bin/                    # CLI 入口
├── docs/                   # 文档
├── scripts/                # 脚本
└── package.json
```

## 测试

使用 bun 的测试框架 [bun:test](https://bun.sh/docs/test) 编写测试用例。

```bash
# 运行所有测试
bun test

# 运行指定测试文件
bun test tests/module-handler.test.ts
```

## 构建

```bash
# 构建 npm 发布产物
bun run build

# 构建当前操作系统所属平台的单文件版本，输出到 release/
bun run build:sf

# 构建所有主流平台的单文件版本，输出到 release/
bun run build:sf -- --targets=all

# 指定目标平台和输出目录
bun run build:sf -- --targets=linux-x64,darwin-arm64 --outdir ./artifacts

# 单目标构建时指定完整输出文件
bun run build:sf -- --targets=linux-x64 --outfile ./release/zentao
```

## 更多技术文档

完整的用户命令参考提供 [Markdown 版本](./command-reference.md) 和 [可搜索的 HTML 版本](./command-reference.html)。HTML 是单文件页面，可直接用浏览器打开，无需启动服务。更新命令或升级 `zentao-api` 后，运行以下命令同时同步两种格式，并检查文档是否过期：

```bash
bun run scripts/generate-command-reference.ts
bun run scripts/generate-command-reference.ts --check
```

文档开头的用法与场景示例手动维护；生成标记之后的内容来自命令注册、API 参数定义和脚本内的用户说明。HTML 页面模板位于 `scripts/command-reference.template.html`，与 Markdown 共用同一份正文。生成过程只读取离线帮助，不访问禅道服务。

* [技术方案与实现细节](./implementation.md) - 详解内部接口调用规则、验证机制与持久化配置
* [常见错误排查与参考手册](./errors.md) - 使用命令遇到错误（格式：Exxxx）时进行查阅
* [后续计划](./roadmap.md) - 待实现的功能和改进计划
