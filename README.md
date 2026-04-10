# zentao-cli

禅道命令行工具，支持在你喜爱的终端里访问和操作禅道数据，对 AI Agents 友好。

## 主要特性

* 基于最新的禅道 RESTful API 2.0 实现
* 安全的用户认证管理，支持多用户切换
* 支持工作区切换，记住当前产品、项目、执行等信息，简化操作
* 支持对数据进行摘取、过滤、排序等操作，自动处理数据中的 HTML 为 Markdown
* 对 AI Agents 友好，完善的帮助信息，支持输出 Markdown
* 使用方便，通过 npx zentao 立即使用
* 使用现代的 bun、TypeScript 开发，类型安全
* 完善的测试覆盖，确保代码质量

## 快速使用

```bash
# 全局安装 zentao-cli 工具
npm install -g zentao

# 其他安装使用方式
# bun install -g zentao  # ← 使用 bun 安装
# npx zentao             # ← 通过 npx 免安装运行
# pnpm dlx zentao        # ← 通过 pnpm 免安装运行

# 首次执行会提示用户输入禅道 URL、用户和账号来登录禅道，登录成功后会记住用户信息，方便后续使用
zentao

# 查看禅道产品
zentao product

# 查看给定 ID 的产品
zentao product 1

# 更新禅道产品#1
zentao product update 1 --name=产品1

# 其他功能可以通过 zentao help 查看帮助信息
zentao help
```

## 核心功能

### 用户验证

#### 登录验证

首次执行 `zentao` 会提示用户输入禅道 URL、用户名和密码来登录禅道，登录成功后会记住用户信息（包括禅道 URL、账号、Token，不包括密码），方便后续使用。
也可以通过 `zentao login` 命令来进行登录，支持通过 `-s <zentao_url>`、`-u <account>`、`-p <password>` 参数指定禅道 URL、用户名和密码，例如：

```bash
# 登录禅道
zentao login -s https://zentao.example.com -u admin -p 123456
```

#### 环境变量

zentao-cli 支持从环境变量获取禅道服务地址、用户账号和密码，如果已经指定了 `-s`、`-u`、`-p` 参数，则优先使用这些参数，环境变量将不会生效。有时虽然有设置环境变量，但之前已经手动进行过身份验证，如果想忽略之前的身份信息，则可以通过 `zentao login --useEnv` 参数来强制使用环境变量重新进行验证。支持如下环境变量：

* `ZENTAO_URL`：禅道服务地址
* `ZENTAO_ACCOUNT`：用户账号
* `ZENTAO_PASSWORD`：密码
* `ZENTAO_TOKEN`：TOKEN，当没有密码时，可以通过该环境变量获取 TOKEN

#### 账户切换

zentao-cli 支持登录多个禅道服务，或者同一个服务登录多个账号，登录成功后会以最后一次登录的服务账号为当前账户，可以通过 `zentao profile` 命令查看当前用户信息和切换当前用户。

```bash
# 查看当前用户信息
$ zentao profile

* https://admin@zentao.example.com (当前)
* https://dev1@zentao.example.com

# 切换当前用户
$ zentao profile dev1@zentao.example.com

* https://admin@zentao.example.com
* https://dev1@zentao.example.com (当前)
```

#### 退出登录

使用 `zentao logout` 来退出当前用户，同时会移除 `~/.config/zentao/zentao.json` 文件中的用户信息。

```bash
# 退出当前用户：
$ zentao logout

# 退出指定的用户：
$ zentao logout dev1@zentao.example.com
```

### 工作区管理

zentao-cli 支持记住用户上次访问的产品、项目和执行，这样在调用相关 API 时自动使用上次的参数，方便用户快速访问和操作禅道数据。可以通过如下命令来管理工作区：

* `zentao workspace`：查看当前工作区信息
* `zentao workspace ls`：查看所有工作区信息
* `zentao workspace <id>`：查看指定 ID 的工作区信息
* `zentao workspace set <id>`：设置当前工作区为指定 ID 的工作区
* `zentao workspace set --product=<id>`：自动设置产品所属的工作区
* `zentao workspace set --project=<id>`：自动设置项目所属的工作区
* `zentao workspace set --execution=<id>`：自动设置执行所属的工作区

```bash
# 查看当前工作区信息
$ zentao workspace

* ID: 1
* 产品: #12 产品1
* 项目: #5 项目1
* 执行: #4 执行1

# 查看所有工作区信息
$ zentao workspace ls

| ID | 产品 | 项目 | 执行 | 使用中 |
| --- | --- | --- | --- | --- |
| 1 | #12 产品1 | #5 项目1 | #4 执行1 | 否 |
| 2 | #12 产品1 | #5 项目1 | #4 执行1 | 否 |
| 3 | #12 产品1 | #5 项目1 | #4 执行1 | 是 |

# 设置当前工作区为指定 ID 的工作区
$ zentao workspace set 2

* ID: 2
* 产品: #12 产品1
* 项目: #5 项目1
* 执行: #4 执行1

# 自动设置执行所属的项目和产品
$ zentao workspace --execution=2

# 设置工作区后调用一些 API 可以省略相关参数
$ zentao bug ls # ← 无需指定 --product 参数

# 输出略
```

用户工作区信息和相关设置保存在 `~/.config/zentao/zentao.json` 文件中。

如果配置了 `autoSetWorkspace` 选项，则在调用相关操作时会**自动设置工作区**，具体包括：

* 获取单个产品详情，创建新产品，更新产品等操作时，会自动设置工作区为产品所属的工作区
* 获取单个项目详情，创建新项目，更新项目等操作时，会自动设置工作区为项目所属的工作区
* 获取单个执行详情，创建新执行，更新执行等操作时，会自动设置工作区为执行所属的工作区

下面为自动设置工作区后的输出示例：

```bash
# 获取禅道产品#1 信息
$ zentao product 1

* id: 1
* name: 产品1
* ...

已设置工作区
```

### 禅道数据访问和操作

#### 命令调用方式

禅道数据访问和操作支持两种方式：

第一种：**原始方式**，通过如下 `ls`、`get` 等命令来访问和操作禅道数据，具体包括:

* `zentao ls`：获取对象列表
* `zentao get <moduleName> <objectID>`：获取单个对象
* `zentao delete <moduleName> <objectID>`：删除对象
* `zentao create <moduleName> [params]`：创建对象
* `zentao update <moduleName> <objectID> [params]`：更新对象
* `zentao do <moduleName> <action> <objectID> [params]`：执行对象操作
* `zentao help <moduleName>`：获取模块帮助信息

第二种：**简写方式**，通过如下 `zentao <moduleName>` 命令来访问和操作禅道数据，具体包括:

* `zentao <moduleName>`：获取对象列表
* `zentao <moduleName> <objectID>`：获取单个对象
* `zentao <moduleName> delete <objectID>`：删除对象
* `zentao <moduleName> create [params]`：创建对象
* `zentao <moduleName> update <objectID> [params]`：更新对象
* `zentao <moduleName> <action> <objectID> [params]`：执行对象操作
* `zentao <moduleName> help`：获取模块帮助信息

> [!TIP]
> 优先推荐简写方式，当简写方式模块名与命令行一级命令冲突时，则必须使用原始方式调用。

#### 获取禅道对象列表

支持通过 `zentao <moduleName>` 的方式来获取给定模块的对象列表。

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

# 获取项目 #5 下的执行列表，如果省略 --project 参数则使用当前工作区中的项目
$ zentao execution --project=5

# 输出略
```

<details>
<summary>原始方式</summary>

通过 `zentao ls <moduleName>` 获取给定模块的对象列表。

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

支持通过 `zentao <moduleName> <objectID>` 获取给定模块的指定 ID 的对象信息。

```bash
# 获取禅道产品#1 信息
$ zentao product 1

* id: 1
* name: 产品1
* ...
```

<details>
<summary>原始方式</summary>

通过 `zentao get <moduleName> <objectID>` 获取给定模块的指定 ID 的对象信息。

```bash
# 获取禅道产品#1 信息
$ zentao get product 1

# 输出略
```

</details>

#### 删除禅道对象

支持通过 `zentao <moduleName> delete <objectIDs>` 删除给定模块的指定 ID 的对象，如果要删除多个对象，则可以通过逗号分隔多个 ID，默认删除前会输出删除对象的详细信息以供确认，如果不需要确认，则可以通过 `--yes` 参数来强制删除。

```bash
# 删除禅道产品#1
$ zentao product delete 1

要删除的产品 #1：

* id: 1
* name: 产品1
* ...

是否继续？（y/n）: y
已删除 产品 #1

# 删除禅道产品#1 和 #2
$ zentao product delete 1,2

要删除的产品（共 2 个）：

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

是否继续？（y/n）: y
已删除 2 个产品

# 强制删除禅道产品#1 和 #2
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

通过 `zentao delete <moduleName> <objectIDs>` 删除给定模块的指定 ID 的对象，如果要删除多个对象，则可以通过逗号分隔多个 ID。

```bash
# 删除禅道产品#1
$ zentao delete product 1

# 输出略

# 删除禅道产品#1 和 #2
$ zentao delete product 1,2

# 输出略
```

</details>

#### 创建禅道对象

支持通过 `zentao <moduleName> create [params]` 创建给定模块的对象。

```bash
# 创建禅道产品
$ zentao product create --name=产品1
```

可以通过 `--data='JSON_STRING'` 参数，指定创建对象的 JSON 数据，如果 JSON 数据是一个对象数组，则可以进行批量创建。

```bash
# 创建禅道产品，并指定 JSON 数据
$ zentao product create --data='{"name": "产品1"}'

# 创建禅道产品，并指定 JSON 数据，进行批量创建
$ zentao product create --data='[{"name": "产品1"}, {"name": "产品2"}]'
```

<details>
<summary>原始方式</summary>

通过 `zentao create <moduleName> [params]` 创建给定模块的对象。

```bash
# 创建禅道产品
$ zentao create product --name=产品1
```

可以通过 `--data='JSON_STRING'` 参数，指定创建对象的 JSON 数据，如果 JSON 数据是一个对象数组，则可以进行批量创建。

```bash
# 创建禅道产品，并指定 JSON 数据
$ zentao create product --data='{"name": "产品1"}'

# 创建禅道产品，并指定 JSON 数据，进行批量创建
$ zentao create product --data='[{"name": "产品1"}, {"name": "产品2"}]'
```

</details>

#### 更新禅道对象

支持通过 `zentao <moduleName> update [objectID] [params]` 更新给定模块的指定 ID 的对象。

```bash
# 更新禅道产品#1
$ zentao product update 1 --name=产品1
```

可以通过 `--data='JSON_STRING'` 参数，指定更新对象的 JSON 数据，如果 JSON 数据是一个对象数组，则可以进行批量更新。

```bash
# 更新禅道产品#1，并指定 JSON 数据
$ zentao product update 1 --data='{"name": "产品1"}'

# 更新禅道产品#1 和 #2，并指定 JSON 数据，进行批量更新
$ zentao product update --data='[{"id": 1, "name": "产品1"}, {"id": 2, "name": "产品2"}]'
```

<details>
<summary>原始方式</summary>

通过 `zentao update <moduleName> [objectID] [params]` 更新给定模块的指定 ID 的对象。

```bash
# 更新禅道产品#1
$ zentao update product 1 --name=产品1
```

可以通过 `--data='JSON_STRING'` 参数，指定更新对象的 JSON 数据，如果 JSON 数据是一个对象数组，则可以进行批量更新。

```bash
# 更新禅道产品#1，并指定 JSON 数据
$ zentao update product 1 --data='{"name": "产品1"}'

# 更新禅道产品#1 和 #2，并指定 JSON 数据，进行批量更新
$ zentao update product --data='[{"id": 1, "name": "产品1"}, {"id": 2, "name": "产品2"}]'
```

</details>

#### 其他操作

支持通过 `zentao <moduleName> <action> <objectID> [params]` 执行给定模块的指定 ID 的对象的指定操作。

```bash
# 解决禅道 BUG #1
$ zentao bug resolve 1 --comment "已解决"
```

不同的对象支持的操作不同，具体可以通过 `zentao <moduleName> --help` 获取给定模块支持的操作。

<details>
<summary>原始方式</summary>

通过 `zentao do <moduleName> <action> <objectID> [params]` 执行给定模块的指定 ID 的对象的指定操作。

```bash
# 解决禅道 BUG #1
$ zentao do bug resolve 1 --comment "已解决"
```

不同的对象支持的操作不同，具体可以通过 `zentao do <moduleName> --help` 获取给定模块支持的操作。

</details>

### 命令行管道与标准输入 (Stdin) 支持

支持通过命令行管道与标准输入 (Stdin) 来传递 `--data` 参数，例如创建产品时通过管道传递 JSON 数据：

```bash
# 创建禅道产品，通过管道传递 JSON 数据
$ cat products.json | zentao product create --data @-

# 或者直接通过管道传递
echo '{"name": "新产品"}' | zentao product create
```

### 批量操作错误处理

当进行批量操作出错时默认情况将自动跳过出错的对象，继续执行后续操作，如果需要停止执行后续操作，则可以通过 `--batch-fail-fast` 参数来实现。
也可以通过 `batchFailFast` 配置项来全局开启此功能。下面为批量删除产品出错时的输出示例：

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

支持通过 `--silent` 参数，在执行命令时启用静默模式，不输出任何信息，仅在出错时输出错误信息。

```bash
# 在执行命令时启用静默模式，不输出任何信息，仅在出错时输出错误信息
$ zentao product create --silent
```

支持通过 `silent` 配置项来全局开启此功能。

```bash
# 设置全局静默模式
$ zentao config set silent true
```

### 获取帮助

支持通过 `zentao help` 获取所有一级命令帮助信息，支持通过 `zentao <command> --help` 获取给定命令的帮助信息。

```bash
# 获取所有一级命令帮助信息
$ zentao help

# 获取给定命令的帮助信息
$ zentao <command> --help
```

### 输出格式

支持通过 `--format=json｜markdown|raw` 参数，指定输出格式。默认输出 Markdown 格式，其中 `raw` 表示输出原始 JSON 数据。

```bash
# 获取禅道产品信息，并输出 Markdown 格式
$ zentao product

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 如果获取的是单个对象，则以列表的形式输出
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

zentao-cli 支持对数据进行摘取、过滤、排序等操作，方便用户快速获取需要的数据。

#### 摘取给定属性

支持通过 `--pick=<field1>,<field2>,...` 参数，指定获取对象的指定字段，多个字段用逗号分隔，支持通过 `.` 连接子字段。

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

支持通过 `--filter=<field1><operator><value>,<field2><operator><value>,...` 参数，指定过滤条件，多个条件用逗号分隔，字段名称支持通过 `.` 连接子字段，当参数值包含逗号时，需要使用引号包裹参数值。

在同一个 `--filter` 内通过逗号分隔多个过滤条件，会使用 AND 逻辑进行过滤。如果要使用 OR 逻辑，则可以通过多个 `--filter` 参数来实现。

支持的运算符：

* `:` 等于
* `!=` 不等于
* `>` 大于
* `<` 小于
* `>=` 大于等于
* `<=` 小于等于
* `~` 包含
* `!~` 不包含

下面为一些使用示例：

```bash
# 获取禅道产品信息，并过滤产品名称包含 "产品" 的产品
$ zentao product --filter 'name~产品'

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品信息，并过滤产品名称包含 "产品" 或 产品名称为"项目1" 的产品
$ zentao product --filter 'name~产品' --filter 'name:项目1'

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |
| 3 | 项目1 | ... |
| 4 | 项目2 | ... |

已显示 4 项，共 4 项，当前第 1 页，每页 100 条

# 当参数值包含逗号时，需要使用引号包裹参数值，例如：
$ zentao product --filter 'name~"产品1,产品2"'

# 输出略
```

#### 模糊搜索

当输出的数据是列表时支持进行模糊搜索，通过 `--search=<keyword>,<keyword>,...` 参数，指定模糊搜索关键词，多个关键词使用逗号分隔；通过 `--search-fields=<field1>,<field2>,...` 参数，指定模糊搜索的字段，多个字段用逗号分隔，支持通过 `.` 连接子字段。

如果要使用 OR 逻辑，则可以通过多个 `--search` 参数来实现。

```bash
# 获取禅道产品信息，并模糊搜索产品名称或描述包含 "产品" 的产品
$ zentao product --search=产品 --search-fields=name,desc

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条

# 获取禅道产品信息，并模糊搜索产品名称包含 "产品1" 或 "产品2" 的产品
$ zentao product --search=产品1 --search=产品2

| id | name | ... |
| --- | --- | --- |
| 1 | 产品1 | ... |
| 2 | 产品2 | ... |

已显示 2 项，共 2 项，当前第 1 页，每页 100 条
```

#### 排序数据

支持通过 `--sort=<field1>_asc,<field2>_desc,...` 参数，指定排序条件，多个排序条件用逗号分隔，字段名称支持通过 `.` 连接子字段。

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

当输出的数据是列表时可以通过如下选项来控制分页：

* `--page=<pageNumber>`：指定分页页码，默认值为 1
* `--recPerPage=<recPerPage>`：指定分页大小，默认值为 20
* `--all`：获取所有数据，不进行分页
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

```bash
# 设置默认输出格式为 JSON
$ zentao config set defaultOutputFormat json

# 设置界面语言为英文
$ zentao config set lang en
```

通过 `zentao config get [key]` 来查看默认配置，如果不指定 `key`，则获取所有默认配置。

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

通过 `zentao version` 获取 zentao-cli 版本信息，如果已经登录了禅道，则获取当前登录的禅道版本信息。

```bash
# 获取 zentao-cli 版本信息
$ zentao version

zentao-cli 1.0.0
zentao https://zentao.example.com 22.2
```

### 自动补全

支持通过 `zentao autocomplete` 命令生成自动补全脚本，支持 zsh、bash 和 fish 三种 shell。

```bash
# 生成 zsh 自动补全脚本
$ zentao autocomplete zsh

# 生成 bash 自动补全脚本
$ zentao autocomplete bash

# 生成 fish 自动补全脚本
$ zentao autocomplete fish
```

## 在 AI 中使用

### 在 AI Agents 中使用

提示 AI Agents 提示用户安装 zentao-cli，然后让 AI 调用 zentao-cli 来访问和操作禅道数据。下面是参考提示词：

提示安装 zentao-cli 工具：

```prompt
通过 npm 全局安装 zentao-cli 工具。
```

安装完成后就可以提示调用 zentao-cli 工具，获取禅道产品信息：

```prompt
通过 zentao-cli 工具，获取禅道产品信息。
```

### 通过 zentao-api Skill 使用

[禅道 API 技能](https://github.com/easysoft/zentao-skills) 中已经实现了 zentao-cli 工具的使用，推荐使用该技能来访问和操作禅道数据。具体使用方法参考[文档](https://github.com/easysoft/zentao-skills)。

## 开发指引

### 技术栈

* 使用 Bun + TypeScript 开发，构建为 Node.js 兼容产物，通过 npm 发布，无需用户安装 Bun
* 用户配置存储：[configstore](https://github.com/sindresorhus/configstore)
* 终端开发辅助库：[commander.js](https://github.com/tj/commander.js)
* 对象的嵌套属性访问：[dot-prop](https://github.com/sindresorhus/dot-prop)
* HTML 转 Markdown：[turndown](https://github.com/mixmark-io/turndown)
* [Node.js CLI 应用程序最佳实践](https://github.com/lirantal/nodejs-cli-apps-best-practices/blob/main/README_zh-Hans.md)

### 项目结构

```sh
zentao-cli/
├── src/
│   ├── commands/           # 命令实现
│   ├── api/                # API 客户端（HTTP 请求封装、Token管理
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

### 用户配置管理

用户配置管理使用 [configstore](https://github.com/sindresorhus/configstore) 来管理用户配置，配置文件保存在 `~/.config/zentao/zentao.json` 文件中，该文件在首次创建时强制设置文件权限为 `600`，防止同主机的其他用户越权读取。

下面为一个配置文件示例：

```json
{
    /* 当前用户配置的账号@禅道服务地址 */
    "currentProfile": "admin@https://zentao.example.com",

    /* 用户配置列表 */
    "profiles": [
        {
            /* 禅道服务地址 */
            "server": "https://zentao.example.com",

            /* 用户账号 */
            "account": "admin",

            /* TOKEN */
            "token": "xxxxxx",

            /* 登录验证通过后用户在禅道中的信息 */
            "user": {
                /* 用户在禅道中的 ID */
                "id": 1,

                /* 用户姓名 */
                "realname": "Admin",

                // ... 其他属性
            },

            /* 登录时间 */
            "loginTime": "2026-04-10 10:00:00",

            /* 最后使用时间 */
            "lastUsedTime": "2026-04-10 10:00:00",

            /* 当前工作区 GID */
            "currentWorkspace": 1,

            /* 工作区列表 */
            "workspaces": [
                {
                    "id": 1,
                    "product":   {"id": 1, "name": "产品1"},
                    "project":   {"id": 1, "name": "项目1"},
                    "execution": {"id": 1, "name": "执行1"}
                },
                {
                    "id": 2,
                    "product":   {"id": 1, "name": "产品1"},
                    "project":   {"id": 2, "name": "项目2"},
                    "execution": {"id": 3, "name": "执行3"}
                }
            ],

            /* 配置 */
            "config": {
                /* 默认输出格式 */
                "defaultOutputFormat": "markdown",

                /* 界面语言 */
                "lang": "zh-CN",

                /* 默认分页大小 */
                "defaultRecPerPage": 20,

                /* 是否忽略 SSL/TLS 证书验证 */
                "insecure": false,

                /* 是否将对象属性中的 HTML 转换为 Markdown */
                "htmlToMarkdown": true,

                /* 请求超时时间 */
                "timeout": 10000,

                /* 是否在批量操作出错时停止执行后续操作 */
                "batchFailFast": false,

                /* 是否自动设置工作区 */
                "autoSetWorkspace": true,

                /* 分页配置 */
                "pagers": {
                    "product": 50   // 产品分页大小
                },
            }
        },
        {
            "server": "https://zentao.example.com",
            "account": "dev1",
            "token": "xxxxxx",
            "loginTime": "2026-04-10 10:00:00",
            "lastUsedTime": "2026-04-10 10:00:00",
        }
    ],
}
```

### 错误提示

当执行命令或调用禅道 API 出错时，会输出错误信息，并提示用户检查配置文件，目前可能存在如下错误：

| 错误代码 | 错误原因 |
| --- | --- |
| **认证与配置 (10xx)** | |
| 1001 | 必须提供有效的禅道服务地址、用户名和密码 |
| 1002 | 所提供的禅道服务地址 xxx 无法访问 |
| 1003 | 当前用户名和密码不正确 |
| 1004 | 所提供的 Token 失效，请提供密码重新进行登录，或者提供新的 TOKEN |
| 1005 | 配置文件损坏或无法读取，请检查 `~/.config/zentao/zentao.json` |
| 1006 | 未找到指定的用户配置，请先使用 `zentao login` 登录 |
| 1007 | 指定的用户配置不存在，请通过 `zentao profile` 查看可用配置 |
| 1008 | 当前禅道版本不受支持，请使用禅道 22.0 及以上版本 |
| **API 调用 (20xx)** | |
| 2001 | 未找到指定的模块（moduleName），请通过 `zentao help` 查看支持的模块 |
| 2002 | 未找到指定的对象（objectType #id），请检查对象 ID 是否正确 |
| 2003 | 缺少必要参数 field1,field2,...，请通过 `zentao <moduleName> --help` 查看必要参数 |
| 2004 | field1 参数值 field1Value 无效，请检查参数格式是否正确 |
| 2005 | 不支持的操作，请通过 `zentao <moduleName> --help` 查看支持的操作 |
| 2006 | 当前用户没有权限执行此操作 |
| 2007 | `--data` 参数的 JSON 数据格式无效 |
| 2008 | 禅道服务端返回错误，请查看详细错误信息 |
| **数据处理 (30xx)** | |
| 3001 | `--pick` 指定的字段不存在 |
| 3002 | `--filter` 表达式格式无效，请检查过滤条件格式 |
| 3003 | `--sort` 表达式格式无效，请检查排序条件格式 |
| **工作区 (40xx)** | |
| 4001 | 未找到指定的工作区，请通过 `zentao workspace ls` 查看可用工作区 |
| 4002 | 当前未设置工作区，请通过 `zentao workspace set` 设置工作区 |
| **网络通信 (50xx)** | |
| 5001 | 请求超时，请检查网络连接或禅道服务是否正常 |
| 5002 | SSL/TLS 证书验证失败，请检查禅道服务地址是否正确 |

下面为一个常见错误输出：

```bash
# 在没有登录验证的情况下访问禅道数据
$ zentao product

Error(E1001): 必须提供有效的禅道服务地址、用户名和密码

# 以 JSON 格式执行
$ zentao product --format=json

{
    "error": {
        "code": "1001",
        "message": "必须提供有效的禅道服务地址、用户名和密码"
    },
}
```

### 用户验证过程

禅道 API 2.0 的验证过程如下：

1. 检查 `~/.config/zentao/zentao.json` 文件是否存在，如果存在则读取文件中的信息，并执行步骤 3，如果不存在则执行步骤 2
2. 从环境变量 `ZENTAO_URL`、`ZENTAO_ACCOUNT`、`ZENTAO_TOKEN` 或 `ZENTAO_PASSWORD` 获取禅道服务地址、用户账号和 TOKEN/密码，如果没有 TOKEN 但有密码则执行登录请求获取 TOKEN，如果 TOKEN 存在则并执行步骤 3，如果不存在则执行步骤 4
3. 使用拿到的 TOKEN 进行一次测试请求（获取用户列表信息），如果请求成功则将相关信息缓存到 `~/.config/zentao/zentao.json` 文件中，如果请求失败则执行步骤 4
4. 如果 TOKEN 实现，尝试从环境变量读取 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 和 `ZENTAO_PASSWORD`，并执行一次登录操作，尝试重新获取 TOKEN 信息，如果成功则将相关信息缓存到 `~/.config/zentao/zentao.json` 文件中，如果失败则执行步骤 5
5. 则终端输出提示用户采用 `zentao login -s <zentao_url> -u <account> -p <password>` 命令手动登录

### 禅道 API 调用

禅道 API 2.0 基础路径 `$BASE_URL` 为 `$ZENTAO_URL/api.php/v2`，在 [zentao-openapi.json](./data/zentao-openapi.json) 文件中存储了禅道 API 2.0 的 OpenAPI 规范，可以参考该文件来了解禅道 API 2.0 的详细信息。

下面说明常见的 API 调用方式。

#### 获取用户 Token

请求地址：`POST $BASE_URL/users/login`，请求体：

```json
{
    "account": "admin",
    "password": "123456"
}
```

返回结果：

```json
{
    "status": "success",
    "token": "xxxxxx"
}
```

#### 获取用户列表信息

获取用户列表信息，通常也用于验证 Token 是否有效。

请求地址：`GET $BASE_URL/users`，请求参数：

```json
{
    "browseType": "inside",
    "recPerPage": 100
}
```

返回结果：

```json
{
    "status": "success",
    "users": [
        {
            "id": 1,
            "name": "Admin"
        }
    ]
}
```

#### 创建产品

请求地址：`POST $BASE_URL/products`，请求体：

```json
{
    "name": "产品1"
}
```

返回结果：

```json
{
    "status": "success",
    "id": 1
}
```

### 测试

使用 bun 的测试框架 [bun:test](https://bun.sh/docs/test) 来编写测试用例。

```bash
# 运行所有测试
bun test

# 运行指定测试文件
bun test tests/zentao.test.ts
```
