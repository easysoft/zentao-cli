## WorkBuddy 连接器

本技能通过 WorkBuddy 托管的 Node.js 和 `zentao-cli` 使用禅道，接入方式为 CLI + Skill。安装和浏览器授权由连接器调度。

- 所有命令必须带 `--config "~/.config/zentao/workbuddy.json"`，下文及参考资料已补入。不要复用普通 CLI 的默认凭据。
- 执行业务命令时，将该进程的 `ZENTAO_URL`、`ZENTAO_ACCOUNT`、`ZENTAO_PASSWORD`、`ZENTAO_TOKEN` 设为空字符串，避免环境凭据覆盖专用 Profile。不要读取或打印原值。
- 首次连接或 Token 失效时，让用户使用 WorkBuddy 的连接/重新连接操作。连接器会在本机浏览器收集禅道地址、账号和密码，并选中专用 Profile；不要在对话中收集凭据。
- 生命周期命令的 `env` 不保证影响业务执行工具。工具无法单独设置环境时，POSIX shell 使用 `env ZENTAO_URL= ZENTAO_ACCOUNT= ZENTAO_PASSWORD= ZENTAO_TOKEN= zentao --config "~/.config/zentao/workbuddy.json" ...`；PowerShell 在本次子进程中清空这四个环境变量，再执行带相同 `--config` 的命令。
- 状态检查在线验证当前会话，且不写配置。网络故障也可能导致未连接，应区分 E1002/E5001 与凭据失效 E1004，不反复重试登录。
- 断开连接会撤销并核实专用配置内所有账号的远端会话，再清理对应本地凭据。失败时保留未完成项供重试；普通 CLI 配置不受影响。
