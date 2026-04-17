# zentao-cli

禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据，对 AI Agents 友好。

## 主要特性

* 基于最新的禅道 RESTful API 2.0 实现
* 使用便捷，可通过 `npx zentao-cli` 立即运行
* 安全的用户认证管理，支持多用户切换
* 支持对数据进行摘取、过滤、排序等处理，并自动将 HTML 转换为 Markdown
* 对 AI Agents 友好，帮助信息完善，支持输出 Markdown
* 支持以 AI 技能点方式使用，支持通过 `zentao add-skill` 一键安装技能到 AI Agent
* 支持 MCP 服务，使用 `npx zentao-cli mcp` 启动 MCP 服务
* 使用现代的 bun 与 TypeScript 开发，具备类型安全
* 提供完善的测试覆盖，保障代码质量

## 快速使用

```bash
# 全局安装 zentao-cli 工具
npm install -g zentao-cli

# 其他安装与运行方式
# bun install -g zentao-cli  # ← 使用 bun 安装
# npx zentao-cli             # ← 通过 npx 免安装运行
# pnpm dlx zentao-cli        # ← 通过 pnpm 免安装运行

# 首次执行时会提示输入禅道 URL、用户名和密码完成登录
# 登录成功后会记住用户信息，方便后续使用
zentao

# 手动进行登录
zentao login -s https://zentao.example.com -u admin -p 123456

# 查看禅道产品
zentao product

# 查看指定 ID 的产品
zentao product 1

# 更新禅道产品 #1
zentao product update --id=1 --name=产品1

# 更多功能可通过 help 查看
zentao help

# 安装 zentao-cli 技能
zentao add-skill
```

## 在 AI Agents 中使用

### 通过 Zentao CLI 技能使用

支持通过 `zentao-cli` 技能访问和操作禅道数据。安装技能可以通过 `zentao add-skill` 一键安装技能到 AI Agent，目前支持 Claude Code、Cursor、Cherry Studio、Codex、OpenCode、VS Code 等 AI Agent。

```bash
# 安装 zentao-cli 技能
$ zentao add-skill

请选择要安装的 AI Agent:
  1) Claude Code
  2) Cursor
  3) Codex
  4) OpenCode
  5) VS Code
  6) 全部安装
请输入编号 (1-6):6

# 安装技能到 Claude Code
$ zentao add-skill claude-code
```

如果还未安装 zentao-cli，可以通过下面的命令，一键安装、登录和配置 Skill：

```bash
# 一键安装、登录和配置 Skill
$ pnpm install -g zentao-cli && zentao login && zentao add-skill --all
```

安装技能后即可在对应 Agent 工具中使用禅道 CLI 技能。

```txt
禅道中有哪些产品？

产品 xxx 有哪些研发中的需求？

需求 xxx 有哪些风险？
```

### 通过 MCP 服务使用

Zentao CLI 支持一键配置 MCP 服务，只需要执行 `zentao add-mcp` 命令，然后按照提示输入禅道 URL、用户名和密码即可。

```bash
# 一键配置 MCP 服务
$ zentao add-mcp

请输入禅道 URL: https://zentao.example.com
请输入用户名: admin
请输入密码: 123456

请选择要配置的 AI Agent:
   1) Cursor
   2) Claude Desktop
   3) Claude Code
   4) Windsurf
   5) Cline
   6) Trae
   7) VS Code
   8) Cherry Studio
   9) OpenCode
  10) Codex
  11) 全部配置
请输入编号 (1-11): 7
```

如果还未安装 zentao-cli，可以通过下面的命令，一键安装、登录和配置 MCP 服务：

```bash
# 一键安装、登录和配置 MCP 服务
$ pnpm install -g zentao-cli && zentao login && zentao add-mcp
```

统一支持通过 `npx -y zentao-cli mcp` 手动启动 MCP 服务，然后通过 MCP 客户端访问和操作禅道数据。目前各大 Agents 工具无需提前安装 zentao-cli 本身，只需要在 MCP 服务配置中增加如下配置即可：

```json
{
  "mcpServers": {
    "zentao-cli": {
      "command": "npx",
      "args": ["-y", "zentao-cli", "mcp"],
      "env": {
        "ZENTAO_URL": "https://zentao.example.com",
        "ZENTAO_ACCOUNT": "admin",
        "ZENTAO_PASSWORD": "123456"
      }
    }
  }
}
```

## 核心功能

### 用户验证

#### 登录验证

首次执行 `zentao` 时，会提示输入禅道 URL、用户名和密码完成登录。登录成功后会记住用户信息（包括禅道 URL、账号和 Token，不包括密码），方便后续使用。

也可以通过 `zentao login` 命令登录，支持使用 `-s <zentao_url> -u <account> -p <password>` 参数指定禅道 URL、用户名和密码，例如：

```bash
# 登录禅道
zentao login -s https://zentao.example.com -u admin -p 123456
```

#### 环境变量

`zentao-cli` 支持从环境变量中读取禅道服务地址、用户账号和密码。如果已经显式指定了 `-s`、`-u`、`-p` 参数，则优先使用这些参数，环境变量不会生效。

有时即使已经设置了环境变量，之前手动登录过的身份信息仍可能被优先使用。如果希望忽略已有身份信息并强制使用环境变量重新验证，可以通过 `zentao login --useEnv` 来实现。

支持如下环境变量：

* `ZENTAO_URL`：禅道服务地址
* `ZENTAO_ACCOUNT`：用户账号
* `ZENTAO_PASSWORD`：密码
* `ZENTAO_TOKEN`：TOKEN。当未提供密码时，可通过该环境变量读取 TOKEN

#### 账户切换

`zentao-cli` 支持登录多个禅道服务，或在同一服务下登录多个账号。登录成功后，默认将最后一次登录的服务账号设为当前账户。可以通过 `zentao profile` 查看当前用户信息并切换当前用户。

```bash
# 查看当前用户信息
$ zentao profile

* admin@https://zentao.example.com (当前)
* dev1@https://zentao.example.com

# 切换当前用户
$ zentao profile dev1@https://zentao.example.com

* admin@https://zentao.example.com
* dev1@https://zentao.example.com (当前)
```

#### 退出登录

使用 `zentao logout` 可退出当前用户，同时移除 `~/.config/zentao/zentao.json` 文件中的对应用户信息。

```bash
# 退出当前用户
$ zentao logout

# 退出指定用户
$ zentao logout dev1@https://zentao.example.com
```

#### 自定义配置文件

默认情况下，zentao-cli 会将用户配置保存在 `~/.config/zentao/zentao.json`。也可以通过全局选项 `--config <config_file>` 或环境变量 `ZENTAO_CONFIG_FILE` 指定自定义配置文件路径；此时所有读写均作用于该文件，不再使用默认路径。

```bash
# 通过 --config 选项使用自定义配置文件
$ zentao --config /path/to/zt.json profile

# 通过环境变量指定（便于在 shell 中持久设置）
$ ZENTAO_CONFIG_FILE=~/work/zt.json zentao product
```

路径支持 `~` 展开与相对路径（相对当前工作目录）。当 `--config` 与 `ZENTAO_CONFIG_FILE` 同时存在时，`--config` 优先。

### 禅道数据访问和操作

#### 命令调用方式

禅道数据访问和操作支持两种调用方式：

第一种：**原始方式**，通过如下 `ls`、`get` 等命令访问和操作禅道数据，具体包括：

* `zentao ls`：获取对象列表
* `zentao get <moduleName> <objectID>`：获取单个对象
* `zentao delete <moduleName> <objectID>`：删除对象
* `zentao create <moduleName> [params]`：创建对象
* `zentao update <moduleName> <objectID> [params]`：更新对象
* `zentao do <moduleName> <action> <objectID> [params]`：执行对象操作
* `zentao help <moduleName>`：获取模块帮助信息

第二种：**简写方式**，通过如下 `zentao <moduleName>` 命令访问和操作禅道数据，具体包括：

* `zentao <moduleName>`：获取对象列表
* `zentao <moduleName> <objectID>`：获取单个对象
* `zentao <moduleName> delete <objectID>`：删除对象
* `zentao <moduleName> create [params]`：创建对象
* `zentao <moduleName> update <objectID> [params]`：更新对象
* `zentao <moduleName> <action> <objectID> [params]`：执行对象操作
* `zentao <moduleName> help`：获取模块帮助信息

> [!TIP]
> 推荐优先使用简写方式。当简写方式中的模块名与命令行一级命令冲突时，必须改用原始方式调用。

#### 获取禅道对象列表

支持通过 `zentao <moduleName>` 的方式获取指定模块的对象列表。

```bash
# 获取禅道产品列表
$ zentao product

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品列表，并输出 JSON 格式
$ zentao product --format=json

{
    "status": "success",
    "data": [
        {"id": 1, "name": "产品1", ...},
        {"id": 2, "name": "产品2", ...}
    ],
    "pager": {
        "total": 2,
        "page": 1,
        "recPerPage": 100,
        "totalPage": 1
    }
}

# 获取项目 #5 下的执行列表；如果省略 --project 参数，则使用当前工作区中的项目
$ zentao execution --project=5

# 输出略
```

<details>
<summary>原始方式</summary>

通过 `zentao ls <moduleName>` 获取指定模块的对象列表。

```bash
# 获取禅道产品列表
$ zentao ls product

# 输出略

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品列表，并输出 JSON 格式
$ zentao ls product --format=json

# 输出略
```

</details>

#### 获取禅道单个对象

支持通过 `zentao <moduleName> <objectID>` 获取指定模块、指定 ID 的对象信息。

```bash
# 获取禅道产品 #1 信息
$ zentao product 1

* id: 1
* name: 产品1
* ...
```

<details>
<summary>原始方式</summary>

通过 `zentao get <moduleName> <objectID>` 获取指定模块、指定 ID 的对象信息。

```bash
# 获取禅道产品 #1 信息
$ zentao get product 1

# 输出略
```

</details>

#### 删除禅道对象

支持通过 `zentao <moduleName> delete <objectIDs>` 删除指定模块中的指定 ID 对象。删除多个对象时，可使用逗号分隔多个 ID。默认删除前会输出待删除对象的详细信息供用户确认；如果无需确认，可通过 `--yes` 参数强制删除。

```bash
# 删除禅道产品 #1
$ zentao product delete 1

要删除的产品 #1：

* id: 1
* name: 产品1
* ...

是否继续？（y/n）: y
已删除 产品 #1

# 删除禅道产品 #1 和 #2
$ zentao product delete 1,2

要删除的产品（共 2 个）：

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

是否继续？（y/n）: y
已删除 2 个产品

# 强制删除禅道产品 #1 和 #2
$ zentao product delete 1,2 --yes

已删除 2 个产品：1, 2

# 使用 JSON 输出
$ zentao product delete 1,2 --yes --format=json

{
    "status": "success",
    "result": [
        "success": [1, 2]
        "failed": [],
        "skipped": []
    ]
}
```

<details>
<summary>原始方式</summary>

通过 `zentao delete <moduleName> <objectIDs>` 删除指定模块中的指定 ID 对象。删除多个对象时，可通过逗号分隔多个 ID。

```bash
# 删除禅道产品 #1
$ zentao delete product 1

# 输出略

# 删除禅道产品 #1 和 #2
$ zentao delete product 1,2

# 输出略
```

</details>

#### 创建禅道对象

支持通过 `zentao <moduleName> create [params]` 创建指定模块中的对象。

```bash
# 创建禅道产品
$ zentao product create --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定创建对象所需的 JSON 数据；如果 JSON 数据是对象数组，则可进行批量创建。

```bash
# 创建禅道产品，并指定 JSON 数据
$ zentao product create --data='{"name": "产品1"}'

# 创建禅道产品，并指定 JSON 数据，进行批量创建
$ zentao product create --data='[{"name": "产品1"}, {"name": "产品2"}]'
```

<details>
<summary>原始方式</summary>

通过 `zentao create <moduleName> [params]` 创建指定模块中的对象。

```bash
# 创建禅道产品
$ zentao create product --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定创建对象所需的 JSON 数据；如果 JSON 数据是对象数组，则可进行批量创建。

```bash
# 创建禅道产品，并指定 JSON 数据
$ zentao create product --data='{"name": "产品1"}'

# 创建禅道产品，并指定 JSON 数据，进行批量创建
$ zentao create product --data='[{"name": "产品1"}, {"name": "产品2"}]'
```

</details>

#### 更新禅道对象

支持通过 `zentao <moduleName> update [objectID] [params]` 更新指定模块中指定 ID 的对象。

```bash
# 更新禅道产品 #1
$ zentao product update 1 --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定更新对象所需的 JSON 数据；如果 JSON 数据是对象数组，则可进行批量更新。

```bash
# 更新禅道产品 #1，并指定 JSON 数据
$ zentao product update 1 --data='{"name": "产品1"}'

# 更新禅道产品 #1 和 #2，并指定 JSON 数据，进行批量更新
$ zentao product update --data='[{"id": 1, "name": "产品1"}, {"id": 2, "name": "产品2"}]'
```

<details>
<summary>原始方式</summary>

通过 `zentao update <moduleName> [objectID] [params]` 更新指定模块中指定 ID 的对象。

```bash
# 更新禅道产品 #1
$ zentao update product 1 --name=产品1
```

也可以通过 `--data='JSON_STRING'` 指定更新对象所需的 JSON 数据；如果 JSON 数据是对象数组，则可进行批量更新。

```bash
# 更新禅道产品 #1，并指定 JSON 数据
$ zentao update product 1 --data='{"name": "产品1"}'

# 更新禅道产品 #1 和 #2，并指定 JSON 数据，进行批量更新
$ zentao update product --data='[{"id": 1, "name": "产品1"}, {"id": 2, "name": "产品2"}]'
```

</details>

#### 其他操作

支持通过 `zentao <moduleName> <action> <objectID> [params]` 对指定模块、指定 ID 的对象执行特定操作。

```bash
# 解决禅道 BUG #1
$ zentao bug resolve 1 --comment "已解决"
```

不同对象支持的操作不同，具体可通过 `zentao <moduleName> --help` 查看对应模块支持的操作。

<details>
<summary>原始方式</summary>

通过 `zentao do <moduleName> <action> <objectID> [params]` 对指定模块、指定 ID 的对象执行特定操作。

```bash
# 解决禅道 BUG #1
$ zentao do bug resolve 1 --comment "已解决"
```

不同对象支持的操作不同，具体可通过 `zentao do <moduleName> --help` 查看对应模块支持的操作。

</details>

### 命令行管道与标准输入 (Stdin) 支持

支持通过命令行管道与标准输入（Stdin）传递 `--data` 参数。例如，创建产品时可以通过管道传入 JSON 数据：

```bash
# 创建禅道产品，通过管道传递 JSON 数据
$ cat products.json | zentao product create --data @-

# 或者直接通过管道传递
echo '{"name": "新产品"}' | zentao product create
```

### 批量操作错误处理

进行批量操作时，默认会在某个对象出错后自动跳过该对象，并继续执行后续操作。如果希望在出错后立即停止，可使用 `--batch-fail-fast` 参数。

也可以通过 `batchFailFast` 配置项在全局范围内开启此行为。下面是批量删除产品出错时的输出示例：

```bash
# 批量删除 5 个产品，但在第三个产品时出错
$ zentao product delete 1,2,3,4,5 --yes

已删除 4 个产品：1, 2, 4, 5
操作失败：3
失败原因：Error(E2006): 当前用户没有权限执行此操作

# 批量删除 5 个产品，但在第三个产品时出错，使用 batchFailFast 选项
$ zentao product delete 1,2,3,4,5 --yes --batch-fail-fast

已删除 1 个产品：1
操作失败：3
已跳过 2 个产品：4, 5
失败原因：Error(E2006): 当前用户没有权限执行此操作

# 使用 JSON 输出
$ zentao product delete 1,2,3,4,5 --yes --batch-fail-fast --format=json

{
    "status": "success",
    "result": {
        "success": [1, 2],
        "failed": [3],
        "skipped": [4, 5],
        "errors": [
            {
                "objectID": 3,
                "error": {
                    "code": "2006",
                    "message": "当前用户没有权限执行此操作"
                }
            }
        ]
    },
    "error": {
        "code": "2006",
        "message": "当前用户没有权限执行此操作"
    }
}
```

### 静默模式

支持通过 `--silent` 参数在执行命令时启用静默模式。启用后，不再输出普通信息，仅在出错时输出错误信息。

```bash
# 启用静默模式，仅在出错时输出错误信息
$ zentao product create --silent
```

也可以通过 `silent` 配置项在全局范围内开启该功能。

```bash
# 设置全局静默模式
$ zentao config set silent true
```

### 获取帮助

支持通过 `zentao help` 获取所有一级命令的帮助信息，也支持通过 `zentao <command> --help` 获取指定命令的帮助信息。

```bash
# 获取所有一级命令帮助信息
$ zentao help

# 获取指定命令的帮助信息
$ zentao <command> --help
```

### 输出格式

支持通过 `--format=json|markdown|raw` 参数指定输出格式。默认输出 Markdown 格式，其中 `raw` 表示输出原始 JSON 数据。

```bash
# 获取禅道产品信息，并输出 Markdown 格式
$ zentao product

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 如果获取的是单个对象，则以列表形式输出
$ zentao product 1

* id: 1
* name: 产品1
* ...

# 获取禅道产品信息，并输出 JSON 格式
$ zentao product --format=json

{
    status: "success",
    data: [
        {"id": 1, "name": "产品1", ...},
        {"id": 2, "name": "产品2", ...}
    ],
    pager: {
        total: 2,
        page: 1,
        recPerPage: 100,
        totalPage: 1,
    }
}

# 获取禅道产品信息，并输出原始 JSON 格式
$ zentao product --format=raw

{
    "status": "success",
    "products": [
        {"id": 1, "name": "产品1", ...},
        {"id": 2, "name": "产品2", ...}
    ],
    "pager": {
        "recTotal": 5,
        "recPerPage": 20,
        "pageTotal": 1,
        "pageID": 1
    }
}
```

### 数据处理

`zentao-cli` 支持对数据进行摘取、过滤、排序等处理，方便用户快速获取所需信息。

#### 摘取给定属性

支持通过 `--pick=<field1>,<field2>,...` 参数指定需要输出的字段。多个字段用逗号分隔，支持通过 `.` 访问子字段。

```bash
# 获取禅道产品信息，并摘取产品名称和 ID
$ zentao product --pick=id,name

| id | name |
| --- | --- |
| 1 | 产品1 |
| 2 | 产品2 |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

#### 过滤数据

支持通过 `--filter=<field1><operator><value>,<field2><operator><value>,...` 参数指定过滤条件。多个条件用逗号分隔，字段名支持通过 `.` 访问子字段。当参数值中包含逗号时，需要使用引号包裹。

在同一个 `--filter` 参数内使用逗号分隔多个条件时，会按 AND 逻辑进行过滤。如果需要 OR 逻辑，则可使用多个 `--filter` 参数。

支持的运算符：

* `:` 等于
* `!=` 不等于
* `>` 大于
* `<` 小于
* `>=` 大于等于
* `<=` 小于等于
* `~` 包含
* `!~` 不包含

下面是一些使用示例：

```bash
# 获取禅道产品信息，并过滤名称包含 "产品" 的产品
$ zentao product --filter 'name~产品'

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品信息，并过滤名称包含 "产品" 或名称为 "项目1" 的产品
$ zentao product --filter 'name~产品' --filter 'name:项目1'

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |
| 3 | 项目1 | ... |
| 4 | 项目2 | ... |

已显示 4 项，共 4 项，当前第 1 页，每页 100 条

# 当参数值中包含逗号时，需要使用引号包裹，例如：
$ zentao product --filter 'name~"产品1,产品2"'

# 输出略
```

#### 模糊搜索

当输出结果为列表时，支持通过 `--search=<keyword>,<keyword>,...` 参数进行模糊搜索。多个关键词使用逗号分隔；通过 `--search-fields=<field1>,<field2>,...` 指定搜索字段，多个字段用逗号分隔，并支持通过 `.` 访问子字段。

如果需要 OR 逻辑，则可以使用多个 `--search` 参数。

```bash
# 获取禅道产品信息，并搜索名称或描述中包含 "产品" 的产品
$ zentao product --search=产品 --search-fields=name,desc

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品信息，并搜索名称中包含 "产品1" 或 "产品2" 的产品
$ zentao product --search=产品1 --search=产品2

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

#### 排序数据

支持通过 `--sort=<field1>_asc,<field2>_desc,...` 参数指定排序条件。多个排序条件用逗号分隔，字段名支持通过 `.` 访问子字段。

```bash
# 获取禅道产品信息，并按产品名称排序
$ zentao ls product --sort=name_asc

| id | name |
| --- | --- |
| 1 | 产品1 |
| 2 | 产品2 |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

#### 分页数据

当输出结果为列表时，可以通过如下选项控制分页：

* `--page=<pageNumber>`：指定页码，默认值为 1
* `--recPerPage=<recPerPage>`：指定分页大小，默认值为 20
* `--all`：获取全部数据，不分页
* `--limit=<number>`：指定获取数据的数量

```bash
# 获取禅道产品信息，并分页获取
$ zentao product --page=1 --recPerPage=100

| id | name |
| --- | --- |
| 1 | 产品1 |
| 2 | 产品2 |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

### 设置默认配置

支持通过 `zentao config set <key> <value>` 设置默认配置，支持的配置项包括：

* `defaultOutputFormat`：默认输出格式，支持 `markdown`、`json`、`raw`
* `lang`：界面语言，支持 `zh-cn`、`zh-tw`、`en`
* `defaultRecPerPage`：默认分页大小
* `insecure`：是否忽略 SSL/TLS 证书验证
* `timeout`：请求超时时间
* `htmlToMarkdown`：是否将对象属性中的 HTML 转换为 Markdown
* `batchFailFast`：是否在批量操作出错时停止执行后续操作
* `pagers`：分页配置，支持 `product`、`project`、`execution` 等模块
* `autoSetWorkspace`：是否自动设置工作区，默认值为 `false`
* `silent`：是否启用静默模式，默认值为 `false`
* `jsonPretty`：是否在 JSON 格式化时添加空格，默认值为 `false`

```bash
# 设置默认输出格式为 JSON
$ zentao config set defaultOutputFormat json

# 设置界面语言为英文
$ zentao config set lang en
```

通过 `zentao config get [key]` 查看默认配置；如果不指定 `key`，则返回全部默认配置。

```bash
# 查看默认输出格式
$ zentao config get defaultOutputFormat

json

# 查看所有默认配置
$ zentao config get

defaultOutputFormat: "json"
lang: "en"
defaultRecPerPage: 20
insecure: false
timeout: 10000
htmlToMarkdown: true
batchFailFast: false
```

### 获取版本信息

通过 `zentao version` 获取 `zentao-cli` 版本信息；如果已经登录禅道，还会同时输出当前登录的禅道版本信息。

```bash
# 获取 zentao-cli 版本信息
$ zentao version

Zentao CLI: 0.1.0
Zentao Server: 22.1 (https://zentao.example.com)
```

### 自动补全

支持通过 `zentao autocomplete` 命令生成自动补全脚本，支持 `zsh`、`bash` 和 `fish` 三种 shell。

```bash
# 生成 zsh 自动补全脚本
$ zentao autocomplete zsh

# 生成 bash 自动补全脚本
$ zentao autocomplete bash

# 生成 fish 自动补全脚本
$ zentao autocomplete fish
```

## 更多文档

* [开发指引](./docs/development.md) - 关于技术选型、目录解构以及扩展测试的开发帮助说明
* [技术方案与实现细节](./docs/implementation.md) - 详解内部接口调用规则、验证机制与持久化配置
* [常见错误排查与参考手册](./docs/errors.md) - 使用命令遇到错误（格式：Exxxx）时进行查阅

