# 后续计划

## 提供自动安装脚本

根据用户环境自动安装 zentao-cli 工具，支持 macOS、Linux 和 Windows 系统。
如果用户已经安装则自动检查更新并升级。

## 自动升级

支持通过 `zentao update` 命令检查新版本并自动升级 zentao-cli 工具

## 分层安全 Token 存储方案

### Layer 0：文件权限（零成本基线）

当前方案最低限度应该加上文件权限控制，创建和写入配置文件时强制设为 0600（仅文件所有者可读写）：

```ts
import { writeFileSync, chmodSync } from 'node:fs';
function writeConfig(path: string, data: object) {
  writeFileSync(path, JSON.stringify(data, null, 2));
  chmodSync(path, 0o600);
}
```

这是 SSH (~/.ssh/)、AWS CLI (~/.aws/credentials) 等工具的通用做法，可以防止同机器其他用户读取。

### Layer 1：敏感字段加密存储（纯 JS 无依赖）

不存明文 Token，使用 node:crypto 对 Token 加密后再写入 JSON。加密密钥从机器特征信息派生，这样配置文件即使被拷贝到其他机器也无法解密。

### Layer 2：OS 原生密钥链（最安全，推荐作为可选项）

将 Token 存入操作系统的密钥管理服务，这是 GitHub CLI (gh)、Docker 等工具的做法。不需要 native 依赖——直接通过子进程调用系统命令即可。

### Layer 3：Token 生命周期管理（纵深防御）

* 记录 Token 创建时间，超过一定期限（如 30 天）自动提示重新登录
* 启动时校验 Token 有效性，失效则清除并提示
* logout 时主动吊销 Token（如果禅道 API 支持 revoke），而不仅仅是本地删除

## Shell 自动补全 (Autocompletion)

支持 zsh、bash 或 fish 的自动补全能极大地提升高级用户的体验。建议在核心功能中加入 `zentao autocomplete` 或类似机制。

## 本地缓存机制

在 ~/.config/zentao/ 下增加一个极简的缓存机制（带过期时间），用于存储变动不频繁的数据（如产品列表、项目列表），提升命令行响应速度。

## 工作区管理

`zentao-cli` 支持记住用户上次访问的产品、项目和执行信息，这样在调用相关 API 时可以自动使用上次的上下文参数，方便快速访问和操作禅道数据。可以通过如下命令管理工作区：

* `zentao workspace`：查看当前工作区信息
* `zentao workspace ls`：查看所有工作区信息
* `zentao workspace <id>`：查看指定 ID 的工作区信息
* `zentao workspace set <id>`：将指定 ID 的工作区设为当前工作区
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

# 设置工作区后，调用部分 API 时可省略相关参数
$ zentao bug ls # ← 无需指定 --product 参数

# 输出略
```

用户的工作区信息及相关设置保存在 `~/.config/zentao/zentao.json` 文件中。

如果启用了 `autoSetWorkspace` 选项，则在调用相关操作时会**自动设置工作区**，具体包括：

* 获取单个产品详情、创建新产品、更新产品等操作时，会自动将工作区设置为该产品所属的工作区
* 获取单个项目详情、创建新项目、更新项目等操作时，会自动将工作区设置为该项目所属的工作区
* 获取单个执行详情、创建新执行、更新执行等操作时，会自动将工作区设置为该执行所属的工作区

下面是自动设置工作区后的输出示例：

```bash
# 获取禅道产品 #1 信息
$ zentao product 1

* id: 1
* name: 产品1
* ...

已设置工作区
```
