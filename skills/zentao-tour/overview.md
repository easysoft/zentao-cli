# 禅道与 zentao-cli 速览

供 [SKILL.md](SKILL.md) 按需读取。用户只想了解概念时，介绍与当前角色相关的对象即可。

## 对象怎么串起来

禅道覆盖需求、项目、任务、Bug、测试与交付管理。产品承载需求；项目组织研发工作并关联产品；执行按项目模型表现为迭代、阶段或看板，任务在执行中推进。

```mermaid
flowchart LR
    Program[项目集] --> Project[项目]
    Project -->|关联| Product[产品]
    Product --> Story[需求]
    Product --> Plan[产品计划]
    Plan -->|安排| Story
    Project --> Execution[执行：迭代/阶段/看板]
    Execution --> Task[任务]
    Task -->|关联| Story
    Product --> Bug[Bug]
    Product --> Case[测试用例]
    Execution --> Build[版本/构建]
    Build --> TestTask[测试单]
    Product --> Release[发布]
```

这是常见路线，不是所有关系的穷举。产品计划安排交付范围和时间，不等于执行迭代；测试单指定提测版本，也可关联执行。不要仅凭图中关系推断 CLI 有相应关联动作。

## 安装与登录

先复用已经可用的 CLI 或 MCP。命令不存在且用户需要本地 CLI 时，使用用户已有的包管理器安装，例如：

```bash
npm install -g zentao-cli
```

需要登录时，由 Agent 发起浏览器登录并保持命令进程运行，让用户在本机浏览器中填写服务地址、用户名和密码：

```bash
zentao login --web
```

未自动打开浏览器时，将命令输出的本机链接交给用户手动打开。等待命令报告登录成功后，再重试原业务命令。远程服务器或容器中的本机链接属于 CLI 执行端；无法在该执行端打开页面时，让用户在相同执行环境的交互终端运行 `zentao login --no-browser`，不要反复启动登录进程。

不要让用户把密码或 Token 发到聊天里，也不要读取浏览器表单或把真实凭证写进命令参数、示例、日志或仓库文件。已有自动化环境可使用安全注入的 `ZENTAO_URL`、`ZENTAO_ACCOUNT` 和 `ZENTAO_PASSWORD` / `ZENTAO_TOKEN`；需要强制按这些环境变量登录时使用 `zentao login --useEnv`。不要为检查变量而打印值。

配置保存账号、服务器和 Token，不保存密码。路径按 `--config`、`ZENTAO_CONFIG_FILE`、`$XDG_CONFIG_HOME/zentao/zentao.json`、`~/.config/zentao/zentao.json` 的顺序选择；XDG 必须是绝对路径。显式更换目录后不会迁移或回退读取旧配置。沿用用户当前路径，不读取或展示整份凭证文件；业务认证支持只读配置。

## 就绪检查与离线帮助

```bash
zentao profile --help
zentao profile --effective --format=json
zentao product --pick=id,name --page=1 --recPerPage=5
```

先确认安装版本支持 `--effective`，再用它查看实际来源与账号。`source=environment` 表示完整环境凭据且不读取本地 Profile，`source=profile` 表示本地账号；`verified=false` 表示尚未验证。最后一条才是真实的只读业务请求。用户已指定别的业务范围时，可用该范围内的只读请求替代产品查询。产品返回空列表不代表服务未连通，更不代表必须新建产品。旧版本的 `profile` 只读本地账号，没有本地 Profile 时的 `E1006` 不能证明环境凭据不可用。

CLI 已安装但尚未登录时，仍可使用：

```bash
zentao version
zentao my tasks --help
zentao task start --help
zentao task props --format=json
```

`version` 展示 CLI 版本及本地记录的服务器信息，不主动验证服务端版本。操作帮助列出输入参数与最低禅道版本；`props` 展示返回对象属性，不能据此猜测写入参数。实际业务请求会获取服务端配置并检查当前版本，帮助中有操作不等于当前服务器和账号允许执行。

新增操作如 `my tasks`、`my bugs`、`execution projectExecutions` 通常要求 22.5 / biz13.5 / max8.5 / ipd5.5，具体按操作帮助。出现 E2010 时按角色文件降级；服务配置/版本不合法（E2011 / E2012）时先解决配置问题。

## MCP 接入

已连接 MCP 时直接复用。无需登录的 `zentao_action_help` 接受 `{"module":"my","action":"tasks"}` 等参数，返回路径、参数类型、必填项及 `minVersion`；适合先讲解能力，再连接业务环境。业务调用使用实际暴露的模块工具及其参数，不把 CLI 命令字符串当作 MCP 参数。

用户需要配置 MCP 时，先查看本地支持的目标，再为他选定的客户端安装：

```bash
zentao add-mcp --help
zentao add-mcp cursor
```

第二条是用户选用 Cursor 时的示例，会将当前服务器、账号和 Token 写入该客户端的本地 MCP 配置；应在用户要求配置该客户端的范围内使用，不自动配置全部客户端。不要打印配置里的 Token。CLI 认证细节见 [zentao-cli 技能](../zentao-cli/SKILL.md)。

## 查询结果的边界

默认 Markdown 适合浏览，`--format=json` 适合处理结构化数据。查询候选时可以只看一页；做完整统计时，根据返回 `pager` 逐页读取，保留统计所需字段，并记录账号可见范围。

`--filter`、`--sort`、`--search`、`--pick`、`--limit` 都在客户端处理当前页。单个 `--filter` 内的条件是 AND，重复该选项表示 OR。服务端 `browseType`、`orderBy`、`filters` 则以当前操作帮助为准；各操作的默认范围并不相同。只对帮助列出分页参数的操作使用分页选项，不能用 `--all` 自动拉全量。

## 外部资料

- [禅道官网](https://www.zentao.net/)
- [禅道使用手册](https://www.zentao.net/book/zentaopms/38.html)
- [zentao-cli 仓库](https://github.com/easysoft/zentao-cli)
