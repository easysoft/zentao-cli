# zentao-cli 开发指引

本文档面向希望为项目做贡献或了解项目结构的开发者。

## 技术栈

* 使用 Bun + TypeScript 开发，构建为 Node.js 兼容产物，通过 npm 发布，用户无需安装 Bun
* 用户配置存储：[configstore](https://github.com/sindresorhus/configstore)
* 终端开发辅助库：[commander.js](https://github.com/tj/commander.js)
* 对象嵌套属性访问：[dot-prop](https://github.com/sindresorhus/dot-prop)
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
├── data/                   # 数据文件
│   └── zentao-openapi.json # 禅道 API 2.0 规范
└── package.json
```

## 测试

使用 bun 的测试框架 [bun:test](https://bun.sh/docs/test) 编写测试用例。

```bash
# 运行所有测试
bun test

# 运行指定测试文件
bun test tests/zentao.test.ts
```
