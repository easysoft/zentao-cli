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
