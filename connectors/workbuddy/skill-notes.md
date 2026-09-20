## WorkBuddy 连接器

本技能通过 WorkBuddy 托管的 Node.js 和 `zentao-cli` 使用禅道，接入方式为 CLI + Skill。安装由连接器的 `init` 完成。

- 本连接器所有 CLI 调用均使用 `--config "~/.config/zentao/workbuddy.json"`。下文及参考资料中的命令已带此参数，不要去掉，也不要复用普通 CLI 的默认凭证文件。
- 执行业务命令时，将该进程的 `ZENTAO_URL`、`ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD`、`ZENTAO_TOKEN` 设为空字符串，以免继承的完整环境凭证覆盖专用 Profile。使用命令执行工具的环境参数；不要读取或打印这些变量的原值。
- `cli.json` 的 `env` 只保证连接器生命周期命令的环境。若业务命令工具不能单独设置环境，POSIX shell 可用 `env ZENTAO_URL= ZENTAO_ACCOUNT= ZENTAO_PASSWORD= ZENTAO_TOKEN= zentao ...`；PowerShell 可在本次子进程中先执行 `$env:ZENTAO_URL=''; $env:ZENTAO_ACCOUNT=''; $env:ZENTAO_PASSWORD=''; $env:ZENTAO_TOKEN=''`。其后的 `zentao` 命令仍须包含上述 `--config`。
- 首次连接需要用户在自己的交互终端执行 `npx --yes zentao-cli@0.3.1 --config "~/.config/zentao/workbuddy.json" login`。让 CLI 收集服务地址、账号和密码或 Token，不在对话中收集凭证。完成后返回 WorkBuddy 重新连接；不要在无 TTY 的工具进程中执行交互登录。
- 用户终端需能运行 `npx`，或已安装可用的 `zentao`。WorkBuddy 的托管运行时不保证出现在系统终端 PATH 中；不能假设安装连接器就已完成终端环境准备。
- 连接状态只表示本地保存了当前 Profile，不保证 Token 未过期或服务器可达。首次业务查询或遇到认证错误时按下文处理，不能把连接器的“已连接”当作业务权限验证。
- 断开连接会删除专用文件中的全部 Profile。普通 CLI 的默认配置不受影响；服务端 Token 不会被主动撤销。

