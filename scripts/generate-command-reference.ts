import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { getModuleActionParams } from 'zentao-api';
import { registerAllCommands } from '../src/commands/index.js';
import { addDataOptions } from '../src/commands/register-modules.js';
import { getAllModules } from '../src/modules/helper.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import packageInfo from '../package.json';

const root = fileURLToPath(new URL('../', import.meta.url));
const documentPath = join(root, 'docs/command-reference.md');
const marker = '<!-- BEGIN GENERATED COMMAND REFERENCE -->';
const document = readFileSync(documentPath, 'utf8');
assert.equal(document.split(marker).length, 2, 'Expected exactly one generated section marker');

const program = new Command().name('zentao');
registerAllCommands(program);
const modules = getAllModules();
const builtins = program.commands.filter((command) => !modules.some((mod) => mod.name === command.name()));
const sdkVersion = JSON.parse(readFileSync(join(root, 'node_modules/zentao-api/package.json'), 'utf8')).version;
const commonOptions = addDataOptions(new Command()).options;
const commonFlags = new Set(commonOptions.map((option) => option.flags));
const sections: string[] = [];
const add = (...blocks: string[]) => sections.push(...blocks);
const code = (value: string) => '`' + value + '`';
const fence = (value: string, language = 'text') => '```' + language + '\n' + value.trim() + '\n```';
const cell = (value: unknown): string => {
    const text = String(value ?? '—');
    const escaped = text.startsWith('`') && text.endsWith('`') ? text
        : text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return escaped.replaceAll('|', '\\|').replaceAll('\n', '<br>');
};
const table = (headers: string[], rows: unknown[][]) => [
    headers, headers.map(() => '---'), ...rows,
].map((row) => '| ' + row.map(cell).join(' | ') + ' |').join('\n');
const anchor = (id: string) => '<a id="' + id + '"></a>';
const commandId = (name: string) => 'command-' + name.replaceAll(' ', '-');
const actionId = (mod: string, action: string) => 'action-' + mod + '-' + action.toLowerCase();

const commandNotes: Record<string, { text: string; examples: string[] }> = {
    help: { text: '模块名会展开该模块全部操作；内置命令名会显示该命令帮助。支持离线使用。', examples: ['zentao help', 'zentao help bug', 'zentao help login', 'zentao doc createMyDoc --help'] },
    login: {
        text: '省略完整凭证时，桌面环境默认打开本机浏览器登录，否则使用终端交互；非交互且未检测到桌面环境时返回 E1006。默认浏览器启动明确失败且有交互终端时，会关闭临时服务并回退到终端登录。`--web` 显式启动浏览器登录，打开失败时保留服务，供手动访问输出的链接。`--no-browser` 强制终端交互。浏览器页面支持通过 server 和 user 预填地址和账号，不预填密码或 Token。`--message <text>` 仅设置登录页的纯文本副标题，默认为“完成登录后，回到 ZenTao CLI 即可继续使用禅道。”。\n\n完整参数 server、user，以及 password 或 token 仍直接登录；同时提供两者时优先使用 token。--useEnv 强制从环境变量读取完整凭证。`--web` 不能与 `--no-browser`、`--useEnv`、`--password` 或 `--token` 混用。成功后保存服务地址、账号和 Token，并设为当前账号，不保存密码。浏览器登录期间应保持命令运行；远程或容器中的本机链接指 CLI 执行端。',
        examples: ['zentao login', 'zentao login --web', 'zentao login --web --message "完成登录后，回到 Codex 即可继续使用禅道。"', 'zentao login --no-browser', "zentao login --server=https://zentao.example.com --user=admin --token='替换为实际Token'", 'zentao login --useEnv'],
    },
    logout: { text: '不传 profileKey 时退出当前账号；传入时删除指定的本地登录记录。', examples: ['zentao logout', "zentao logout 'admin@https://zentao.example.com'"] },
    profile: { text: '不传参数时列出已保存的账号并标记当前账号；传入 account@server 可切换账号。--effective 只读显示业务命令实际使用的认证来源、站点、账号、凭据类型和配置路径，不能与切换账号同时使用。完整环境凭证优先于当前本地账号，使用环境凭证时 configFile 为 null 且不读取本地配置。不会显示 Token 或密码，不发起网络请求，verified 固定为 false。支持 --format=json 和 --format=raw。', examples: ['zentao profile', "zentao profile 'admin@https://zentao.example.com'", 'zentao profile --effective --format=json'] },
    config: { text: '配置保存在当前账号下，需要先登录。使用 get 查看、set 修改，见上方配置项表。', examples: ['zentao config get', 'zentao config set defaultOutputFormat json'] },
    'config get': { text: '省略 key 时返回当前账号的全部配置，包括未显式设置的默认值。', examples: ['zentao config get', 'zentao --format=json config get pagers'] },
    'config set': { text: '布尔值只接受 true/false；数值与 pagers 的有效范围见配置项表。', examples: ['zentao config set timeout 30000', 'zentao config set defaultRecPerPage 50', 'zentao config set pagers \'{"product":50,"bug":100}\''] },
    version: { text: '显示 CLI 版本以及本地已保存的当前服务器信息，不用于实时探测服务器。--version / -V 只输出 CLI 版本号。JSON/raw 输出包含 CLI 版本和已保存的服务器地址。', examples: ['zentao version', 'zentao --version', 'zentao --format=json version'] },
    autocomplete: { text: '支持 bash、zsh、fish，省略 shell 时在交互终端选择。脚本写入 $XDG_CONFIG_HOME/zentao/.zentao-completion.<shell>；XDG_CONFIG_HOME 未设置、为空或为相对路径时，根目录回退到 ~/.config。--config 和 ZENTAO_CONFIG_FILE 不改变补全脚本目录。命令会打印启用方式，不会将脚本正文直接输出到标准输出。Bash 使用生成脚本时需要提供 _init_completion 的 bash-completion 环境。', examples: ['zentao autocomplete zsh', 'source ~/.config/zentao/.zentao-completion.zsh'] },
    'add-skill': { text: '安装或更新内置的 zentao-cli 和 zentao-tour 两个技能。省略 agent 时交互选择，all 表示全部目标。--output 导出到指定目录，与 agent 不能同时使用；重复运行会覆盖目标中的同名技能文件。支持的 Agent 见参数表。', examples: ['zentao add-skill codex', 'zentao add-skill all', 'zentao add-skill --output ./exported-skills'] },
    'add-mcp': { text: '使用已登录账号配置目标 Agent 的本地 stdio MCP 服务；HTTP MCP 需要手动配置。省略 agent 时交互选择，all 表示全部目标。多数目标写入包含服务地址、账号和 Token 的配置；Cherry Studio 打印手动添加说明。包含注释或尾逗号的 JSONC 配置会提示手动处理。支持的 Agent 见参数表。', examples: ['zentao add-mcp codex', 'zentao add-mcp cursor'] },
    mcp: { text: '默认使用 stdio，由客户端管理进程并使用本地登录或环境凭证。--transport http 启动无状态 Streamable HTTP 服务，默认监听 127.0.0.1:9090；--url（回退到 ZENTAO_URL）固定一个禅道站点，不使用本地账号。--url、--host、--port 仅适用于 HTTP 模式，端口为 1–65535。每个 POST /mcp 请求须单独提供 token 或 Authorization: Bearer 禅道 Token，不能同时提供；不接受密码、OAuth、查询参数凭证或浏览器 Origin。GET /healthz 无需认证，GET/DELETE /mcp 返回 405，不提供旧 /sse。HTTP 模式不提供账号切换，zentao_profile 的 account 为 null；运行需要 Node.js 18.14.1+ 或 Bun，远程访问应使用 HTTPS 反向代理。两种模式均支持 --read-only、--modules、--split-tools 和全局 --timeout、--insecure。完整部署与客户端示例见 [MCP 使用说明](cli-usage.md#mcp-服务)。', examples: ['zentao mcp', 'zentao --config ./zentao.json mcp', 'zentao mcp --read-only --modules product,story,task,bug', 'zentao mcp --split-tools --modules product,story,task,bug', 'zentao mcp --transport http --url https://zentao.example.com', 'zentao --timeout 15000 mcp --transport http --host 127.0.0.1 --port 9090 --url https://zentao.example.com --read-only'] },
    ls: { text: '通用列表入口，list 是此一级命令的别名。需要模块存在默认 list；业务参数与对应模块 list 的参数相同。建议日常使用 zentao <模块>。', examples: ['zentao ls product', 'zentao list product'] },
    get: { text: '通用详情入口，模块需支持 get。首个 ID 使用位置参数；额外路径参数可通过 --params 提供。', examples: ['zentao get bug 42', 'zentao get product 1 --pick=id,name'] },
    create: { text: '通用创建入口，模块需支持 create；字段与对应模块 create 的参数相同。', examples: ["zentao create product --name='团队知识库'"] },
    update: { text: '通用更新入口，模块需支持 update；可使用数字位置参数或 --id。未提供的字段按更新规则自动补全。', examples: ["zentao update product --id=1 --name='团队知识库新版'"] },
    delete: { text: '通用删除入口，模块需支持 delete；确认与批量规则同模块删除操作。', examples: ['zentao delete product --id=1,2 --yes'] },
    do: { text: '通用命名操作入口，action 必须来自该模块的操作列表；是否需要 ID 以具体操作为准。', examples: ['zentao do bug resolve 42 --resolution=fixed', 'zentao do story getGrades'] },
    upgrade: { text: '联网检查最新 CLI 版本；发现新版本后确认升级，--yes 可跳过确认。通过检测到的包管理器执行全局安装。', examples: ['zentao upgrade', 'zentao upgrade --yes'] },
};

const configDescriptions: Record<string, string> = {
    defaultOutputFormat: '业务命令默认输出：markdown、json 或 raw',
    defaultRecPerPage: '默认每页条数，整数 1–1000；仅适用于支持分页的列表',
    insecure: '是否跳过 SSL/TLS 证书验证',
    timeout: '请求超时时间，单位毫秒，必须为正整数',
    htmlToMarkdown: '是否将查询结果中的 HTML 字段转换为 Markdown；raw 输出不转换',
    batchFailFast: '批量操作遇到失败时是否停止后续处理',
    pagers: '各模块每页条数的 JSON 对象，值为整数 1–1000，覆盖 defaultRecPerPage',
    silent: '业务命令是否省略正常结果输出；错误仍会报告',
    jsonPretty: '是否缩进输出业务命令的 JSON',
};

add(anchor('coverage'), '## 覆盖范围', `对应当前工作区：CLI **${packageInfo.version}**，API 定义 **${sdkVersion}**；覆盖 **${builtins.length} 个内置一级命令**（另含 config get/set）、**${modules.length} 个业务模块、${modules.reduce((sum, mod) => sum + mod.actions.length, 0)} 个业务操作**。已安装版本不同时，请以本机命令的 --help 为准。`);

// Read only root help against a temporary empty config, never the user's saved credentials.
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'zentao-command-reference-'));
try {
    const result = Bun.spawnSync([process.execPath, 'run', join(root, 'src/index.ts'), '--config', join(temporaryDirectory, 'config.json'), '--help'], {
        cwd: root, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore',
    });
    assert.equal(result.exitCode, 0, result.stderr.toString());
    const help = result.stdout.toString();
    assert(help.includes('\n命令:'), 'Root help format changed');
    add(anchor('global-options'), '## 全局选项', fence(help.split('\n命令:')[0]));
} finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
}

add('全局选项并不保证每个内置命令都改变输出格式或完全静默；业务命令支持情况见公共选项和各操作说明。');
add('### 环境变量', table(['变量', '用途'], [
    ['ZENTAO_URL', '禅道服务地址'],
    ['ZENTAO_ACCOUNT', '登录账号'],
    ['ZENTAO_PASSWORD', '登录密码'],
    ['ZENTAO_TOKEN', '登录 Token；完整环境凭证中同时存在密码与 Token 时优先使用 Token'],
    ['ZENTAO_CONFIG_FILE', '自定义配置文件路径；显式 --config 优先'],
    ['XDG_CONFIG_HOME', '配置根目录；仅接受绝对路径，未设置、为空或相对路径时使用 ~/.config；--config 和 ZENTAO_CONFIG_FILE 优先'],
]));
add('CLI 业务调用和 stdio MCP 优先使用完整环境凭证（地址、账号以及 Token 或密码），否则使用当前本地登录记录。HTTP MCP 仅用 ZENTAO_URL 作为站点地址的后备值，凭证必须来自当前请求头。zentao login 的 --useEnv 专门用于强制使用环境变量登录。配置文件路径支持 ~ 和相对路径；更改配置路径会隔离登录记录与账号配置。');

add(anchor('data-options'), '## 业务命令公共选项', '以下选项由业务模块与通用增删改查入口共用。参数是否适用于当前操作，仍由结果类型和操作参数表决定。');
add(table(['选项', '说明'], commonOptions.map((option) => [code(option.flags), option.description])));
add('列表操作支持客户端筛选、搜索、排序、字段摘取和数量限制；详情操作支持字段摘取；具有请求体的操作可提交 --data JSON；删除可使用 --yes。--params 接受路径、查询和请求体的业务参数，不应作为 --filter、--sort、--format 等客户端选项的替代入口。db query 等操作的 page、limit 也是业务字段，具体传法见对应操作说明。');
add('分页、raw 输出、批量处理和动态字段的等号写法见前文。--silent 对业务命令省略正常结果，仍报告错误；--batch-fail-fast 只控制当前批次，不回滚已完成的操作。');

add(anchor('configuration'), '## 配置项', '以下默认值用于当前账号尚未配置的项目。命令行中显式指定的对应选项优先。');
add(table(['配置项', '默认值', '允许值与用途'], Object.entries(DEFAULT_CONFIG).map(([key, value]) => {
    assert(configDescriptions[key], 'Missing config documentation: ' + key);
    return [code(key), code(JSON.stringify(value)), configDescriptions[key]];
})));

add(anchor('builtin-commands'), '## 内置命令');
add(table(['命令', '用途'], builtins.map((command) => [
    '[' + command.name() + '](#' + commandId(command.name()) + ')', command.description(),
])));

function renderCommand(command: Command, path: string, level = 3): void {
    const note = commandNotes[path];
    assert(note, 'Missing user-facing examples for ' + path);
    add(anchor(commandId(path)), '#'.repeat(level) + ' ' + code('zentao ' + path), command.description());
    add(fence('zentao ' + path + ' ' + command.usage()), note.text);
    if (command.aliases().length) add('别名：' + command.aliases().map(code).join('、') + '。');
    const argumentsHelp = command.registeredArguments.map((argument) => [
        code(argument.name() + (argument.variadic ? '...' : '')),
        argument.required ? '是' : '否', argument.description,
    ]);
    if (argumentsHelp.length) add(table(['位置参数', '必填', '说明'], argumentsHelp));
    const options = command.createHelp().visibleOptions(command);
    add(table(['选项', '说明'], options.filter((option) => !commonFlags.has(option.flags)).map((option) => [
        code(option.flags), option.long === '--help' ? '显示命令帮助' : option.description,
    ])));
    if (options.some((option) => commonFlags.has(option.flags))) add('同时接受上方列出的[业务命令公共选项](#data-options)；其实际效果取决于具体业务操作。');
    add('示例：', fence(note.examples.join('\n'), 'bash'));
    for (const child of command.commands) renderCommand(child, path + ' ' + child.name(), level + 1);
}
for (const command of builtins) renderCommand(command, command.name());

add(anchor('modules'), '## 业务模块索引', '本文使用规范操作名，参数名应保留大小写。每个模块同时提供 props 与离线帮助；下表的操作数量只统计业务操作。');
add('参数表的默认值列记录显式声明的默认值；“未声明”不表示空值或 0，服务端默认行为还可能写在说明中。分页条数另外受 CLI 配置控制。');
add(table(['模块', '名称', '别名', '操作数'], modules.map((mod) => [
    '[' + mod.name + '](#module-' + mod.name + ')', mod.display ?? mod.name,
    program.commands.find((command) => command.name() === mod.name)?.aliases().join('、') || '—', mod.actions.length,
])));

let parameterCount = 0;
const roles = { path: '路径', query: '查询', body: '请求体' };
for (const mod of modules) {
    add(anchor('module-' + mod.name), '### ' + mod.name + ' · ' + (mod.display ?? mod.name));
    if (mod.description) add(mod.description);
    const shortcuts = ['zentao ' + mod.name + ' props --format=json', 'zentao help ' + mod.name];
    if (mod.actions.some((action) => action.name === 'list')) shortcuts.unshift('zentao ' + mod.name + ' [列表参数]');
    if (mod.actions.some((action) => action.name === 'get')) shortcuts.unshift('zentao ' + mod.name + ' <id>');
    add('快捷用法与字段查询：', fence(shortcuts.join('\n')));
    if (!mod.actions.some((action) => action.name === 'list')) add('此模块没有默认 list；请明确指定下表中的操作。');
    add(table(['操作', '用途'], mod.actions.map((action) => [
        '[' + action.name + '](#' + actionId(mod.name, action.name) + ')', action.display ?? action.name,
    ])));
    for (const action of mod.actions) {
        const params = getModuleActionParams(mod.name, action.name);
        parameterCount += params.length;
        const scope = params.find((param) => param.name === 'scope' && param.role === 'path');
        const scopeOptions = scope?.options?.map((option) => ({
            name: String(option.value).replace(/s$/, ''), label: option.label,
        })) ?? [];
        assert(!scope || scopeOptions.length > 0, 'Missing scope choices: ' + mod.name + '/' + action.name);
        const type = (param: { name: string; role?: string; type?: string; items?: { type?: string } }) => param.type === 'array'
            ? (param.items?.type ? param.items.type + '[]' : 'array')
            : param.type ?? (param.role === 'path' && param.name.endsWith('ID') ? 'number' : 'string');
        const required = params.filter((param) => param.required && !['scope', 'scopeID'].includes(param.name))
            .map((param) => '--' + param.name + '=<' + type(param) + '>');
        if (scopeOptions.length) required.unshift('--' + scopeOptions[0].name + '=<id>');
        add(anchor(actionId(mod.name, action.name)), '#### ' + code('zentao ' + mod.name + ' ' + action.name) + ' · ' + (action.display ?? action.name));
        add('最低禅道版本：' + action.minVersion.map(code).join(' / ') + '。');
        if (action.description && action.description !== action.display) add(action.description);
        add(fence(['zentao ' + mod.name + ' ' + action.name, ...required, '[选项]'].join(' ')));
        const bodyExample = action.requestBody?.example ?? action.requestBody?.schema.example;
        if (action.type === 'list' && bodyExample) add('请求体示例（数组使用 JSON，以保留元素类型）：', fence('zentao ' + mod.name + ' ' + action.name + " --data '" + JSON.stringify(bodyExample).replaceAll("'", "'\\''") + "'", 'bash'));
        if (scopeOptions.length) add('范围必填：用法中以 ' + code('--' + scopeOptions[0].name) + ' 为例，也可从 ' + scopeOptions.map((option) => code('--' + option.name + '=<id>') + '（' + option.label + '）').join('、') + ' 中选择一个，代替 scope 与 scopeID。');
        if (params.length) {
            add(table(['参数', '位置', '类型', '必填', '默认值', '说明与可选值'], params.map((param) => {
                assert(param.role, 'Missing parameter role: ' + mod.name + '/' + action.name + '/' + param.name);
                const description = [param.description ?? param.name];
                if (param.options?.length) description.push('可选值：' + param.options.map((option) => String(option.value) + '（' + option.label + '）').join('；'));
                if (param.format) description.push('格式：' + param.format);
                const bodyProperties = action.requestBody?.schema.properties as Record<string, { type?: string }> | undefined;
                if (param.role === 'body' && bodyProperties?.[param.name]?.type === 'integer') description.push('必须为整数');
                // The SDK preserves schema constraints at runtime beyond its public parameter type.
                const schema = param as typeof param & Record<string, unknown> & { items?: { type?: string; minimum?: number; minLength?: number } };
                for (const [key, label] of Object.entries({ minimum: '最小值', maximum: '最大值', minLength: '最小长度', maxLength: '最大长度', minItems: '最少元素数', maxItems: '最多元素数' })) {
                    if (schema[key] !== undefined) description.push(label + '：' + schema[key]);
                }
                if (schema.items) {
                    if (schema.items.type) description.push('数组元素类型：' + schema.items.type);
                    if (schema.items.minimum !== undefined) description.push('数组元素最小值：' + schema.items.minimum);
                    if (schema.items.minLength !== undefined) description.push('数组元素最小长度：' + schema.items.minLength);
                }
                if (param.name === 'pageID') description.push(param.role === 'query' ? '也可使用 --page' : '请使用 --pageID 或 --data 中的 pageID；此请求体字段不支持 --page 别名');
                return [code('--' + param.name), roles[param.role], code(type(param)), param.required ? '是' : '否',
                    param.defaultValue === undefined ? '未声明' : code(JSON.stringify(param.defaultValue)), description.join('\n')];
            })));
        } else add('此操作没有业务参数。');
        const firstId = params.find((param) => param.role === 'path' && param.name.endsWith('ID') && param.name !== 'scopeID');
        if (firstId) add(code('--' + firstId.name) + ' 可用 ' + code('--id') + ' 或首个数字位置参数代替；其余路径 ID 需分别提供。');
        if (mod.name === 'bug' && action.name === 'create') {
            add('可用 `--product` 代替 `--productID`；平铺参数同时提供两者时必须指定同一个产品。`--data` 内的 `productID` 仍优先，最终产品 ID 会同时发送到查询串和请求体。');
        }
        const applicable = ['--params', '--format', '--silent'];
        if (action.type === 'list') applicable.push('--pick', '--filter', '--sort', '--search', '--search-fields', '--limit');
        if (action.type === 'get') applicable.push('--pick');
        if (params.some((param) => param.name === 'pageID' && param.role === 'query')) applicable.push('--page');
        if (params.some((param) => param.role === 'body')) applicable.push('--data');
        if (action.type === 'create' || action.type === 'update' || action.type === 'action') applicable.push('--batch-fail-fast');
        if (action.type === 'delete') applicable.push('--yes', '--batch-fail-fast');
        add('可配合[公共选项](#data-options)：' + applicable.map(code).join('、') + '；其他全局选项见[全局选项](#global-options)。');
        if (action.type === 'update') add('未提供的更新字段会从当前对象自动补全；上表必填请求体字段可由原值补齐。');
        if (action.type === 'list' && params.some((param) => param.role === 'body')) add('这是带请求体的查询操作。可直接传 --data JSON 或使用 --params 中的正式字段名；当前不支持此类操作的 --data @- 或隐式标准输入。参数约束来自 SDK 定义，部分规则由服务端校验。');
        if (params.some((param) => param.name === 'limit' && param.role === 'body')) add('此处 limit 是服务端请求体字段，建议放入 --data JSON。非 raw 输出时，平铺 --limit 会同时参与请求体组装和客户端截取；--data 中的 limit 覆盖请求体同名值，但不覆盖客户端 --limit。');
        if (mod.name === 'db' && action.name === 'query') add('SDK 描述中的 raw: true 在 CLI 中对应 --format=raw，可查看原始响应的 SQL、列信息与执行耗时。');
    }
}

const output = document.slice(0, document.indexOf(marker)) + marker + '\n\n' + sections.join('\n\n') + '\n';
const ids = [...output.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate document anchors');
for (const [, target] of output.matchAll(/\]\(#([^\s)]+)\)/g)) assert(ids.includes(target), 'Broken document link: ' + target);
assert.equal((output.match(/^#### `zentao /gm) ?? []).length, modules.reduce((sum, mod) => sum + mod.actions.length, 0) + builtins.reduce((sum, command) => sum + command.commands.length, 0));

type ReferenceEntry = {
    title: string; description: string; group: string; type: string;
    parameterCount?: number; aliases?: string;
};
const entryMetadata = new Map<string, ReferenceEntry>();
const guides: Record<string, [string, string]> = {
    coverage: ['覆盖范围', '当前工作区 CLI / SDK 版本与自动生成的命令数量'],
    usage: ['命令格式与传参', '简写、别名、ID、JSON、数组、管道和批量操作'],
    examples: ['常用示例', '登录、查询、筛选、业务操作、文档和附件的实际用法'],
    errors: ['错误处理与版本兼容', '输出格式、失败处理、版本要求和参考文档覆盖范围'],
    'global-options': ['全局选项', '输出格式、配置文件、超时、证书验证和环境变量'],
    'data-options': ['业务命令公共选项', '字段摘取、过滤、搜索、排序、分页和请求数据'],
    configuration: ['配置项', '各项配置的默认值、允许值和作用范围'],
    'builtin-commands': ['内置命令索引', '登录、账号、配置、MCP、技能安装和通用操作'],
    modules: ['业务模块索引', '查看全部模块、别名和业务操作数量'],
};
for (const [id, [title, description]] of Object.entries(guides)) entryMetadata.set(id, { title, description, group: 'guides', type: 'guide' });
const reviews: Record<string, [string, string]> = {
    'review-summary': ['更新与优化总览', '2026-10-03 · 当前基线、已完成改进、优先级与验证范围'],
    'review-input': ['P1 · 参数与请求体契约', '按操作定义校验输入，处理 page / limit 冲突和查询请求体'],
    'review-output': ['P1 · CLI 机器输出一致性', '复用 MCP 结果契约，统一 JSON 错误和分页语义'],
    'review-mcp': ['P1 / P2 · MCP 能力与约束', '补齐 SDK 字段约束，准确表达 POST 查询与传输限制'],
    'review-maintenance': ['P2 · 文档与发现机制', '复用注册表提供离线机器帮助，把文档一致性纳入 CI'],
};
for (const [id, [title, description]] of Object.entries(reviews)) entryMetadata.set(id, { title, description, group: 'review', type: 'review' });
function indexCommand(command: Command, path: string): void {
    entryMetadata.set(commandId(path), { title: 'zentao ' + path, description: command.description(), group: 'builtin', type: 'builtin', aliases: command.aliases().join(' ') });
    for (const child of command.commands) indexCommand(child, path + ' ' + child.name());
}
for (const command of builtins) indexCommand(command, command.name());
for (const mod of modules) {
    const aliases = program.commands.find((command) => command.name() === mod.name)?.aliases().join(' ') ?? '';
    entryMetadata.set('module-' + mod.name, { title: (mod.display ?? mod.name) + ' · ' + mod.name, description: mod.actions.length + ' 个业务操作与模块快捷用法', group: mod.name, type: 'overview', aliases });
    for (const action of mod.actions) entryMetadata.set(actionId(mod.name, action.name), {
        title: 'zentao ' + mod.name + ' ' + action.name, description: action.display ?? action.name, group: mod.name, type: action.type,
        parameterCount: getModuleActionParams(mod.name, action.name).length, aliases,
    });
}
const anchors = [...output.matchAll(/<a id="([^"]+)"><\/a>/g)];
const entries = anchors.map((match, index) => {
    const id = match[1];
    const metadata = entryMetadata.get(id);
    assert(metadata, 'Missing HTML entry metadata: ' + id);
    const markdown = output.slice(match.index! + match[0].length, anchors[index + 1]?.index).trim();
    const html = Bun.markdown.html(markdown).replace(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\s*/, '');
    return { id, ...metadata, html };
});
assert.equal(entries.length, entryMetadata.size, 'HTML reference has missing sections');
const templatePath = join(root, 'scripts/command-reference.template.html');
const htmlTemplate = readFileSync(templatePath, 'utf8');
assert.equal(htmlTemplate.split('__REFERENCE_DATA__').length, 2, 'Expected one HTML data placeholder');
const referenceData = JSON.stringify({
    version: packageInfo.version, sdkVersion, actionCount: modules.reduce((sum, mod) => sum + mod.actions.length, 0),
    modules: modules.map((mod) => ({ name: mod.name, display: mod.display ?? mod.name })), entries,
}).replaceAll('<', '\\u003c');
const htmlOutput = htmlTemplate.replace('__REFERENCE_DATA__', () => referenceData);
const htmlPath = join(root, 'docs/command-reference.html');
for (const [, script] of htmlOutput.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(script);
assert.equal(JSON.parse(referenceData).entries.length, entries.length, 'Invalid embedded reference data');

if (process.argv.includes('--check')) {
    assert(document === output, 'Command reference is stale; run bun run scripts/generate-command-reference.ts');
    assert(readFileSync(htmlPath, 'utf8') === htmlOutput, 'HTML reference is stale; run bun run scripts/generate-command-reference.ts');
    console.log(`Command references are current: ${builtins.length} built-ins, ${modules.length} modules, ${modules.reduce((sum, mod) => sum + mod.actions.length, 0)} actions, ${parameterCount} parameter entries, ${entries.length} HTML sections.`);
} else {
    writeFileSync(documentPath, output);
    writeFileSync(htmlPath, htmlOutput);
    console.log('Updated docs/command-reference.md and docs/command-reference.html');
}
