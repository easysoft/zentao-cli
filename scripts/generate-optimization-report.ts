import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';

const live = JSON.parse(readFileSync('docs/optimization-live-results.json', 'utf8'));
const commits = execFileSync('git', ['log', '--reverse', '--format=%h\t%s', 'f1af0b4..HEAD'], { encoding: 'utf8' }).trim().split('\n').map(line => line.split('\t'));
const e = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!).replaceAll('\r', '&#13;');
const f = live.fixtures;
const prefix = 'bun --env-file=.env.test src/index.ts';
const improvements = [
    ['显式批量目标', '使用 --ids；先校验全部 ID，再去重。禁止创建操作批量化，部分失败保留逐项结果并返回非零退出码。', '86fa6a7'],
    ['Schema 类型与输入冲突', '字符串 007 / true 保真；数字、布尔、重复数组按 schema 解析；未知字段与重复来源冲突在认证前失败。', '0a3b77d · e4587e4'],
    ['真实命令树', '统一 resource action target；根级 CRUD、do、隐式 list/get 已移除。auth/profile/config/mcp/skill/completion/self 各司其职。', 'e4587e4 · 2d981b6'],
    ['请求体与显式 stdin', '按 requestBody 能力支持 JSON、@file 和 @-，涵盖 SQL、关键词与向量 POST 查询；没有 @- 就不读 stdin。', '0a3b77d'],
    ['分页与处理范围', 'page/page-size/all/max-items 分离；聚合后统一处理。缺少 pager、重复页、空页仍宣称有更多数据时明确失败。', 'f7851f8'],
    ['稳定 JSON 与数据保真', '统一 {ok,data,meta}；保留 HTML，显式转换。raw 拒绝批量、本地处理与内置命令，使用退出码 0/1/2/130。', 'ce5e1d9 · 0aa1106'],
    ['终端展示', '默认 table 精简列；Markdown/JSON 不截断；空列表显示 0 条。异构键、标量数组和字面量点号字段有回归覆盖。', 'ce5e1d9'],
    ['身份选择与配置并发', '--profile 优先于完整环境凭据，再到默认账号。保存与选择分离；歧义和部分环境报错；配置短事务防止更新丢失。', '623bae6 · 0aa1106'],
    ['交互、期限和取消', 'no-input/yes/quiet/color 独立。取消覆盖 stdin、认证、预取、上传和批量执行；data-deadline 避免与全局 deadline 冲突。', '2d981b6 · 0aa1106'],
    ['MCP 能力与认证', '知识 POST 搜索标记只读，SQL 保守归入写组；HTTP 不发现本地上传。共享用户分页查找，单个取消不误伤并发认证。', 'ed06ba8'],
    ['发现、技能与文档', '42 个模块、361 个动作、1571 个参数来自共享定义；机器帮助、补全、HTML、随包技能、CI 与发布前检查同步。', '455b27e'],
];
const manual = [
    ['离线发现与帮助', '无需登录即可得到版本与完整动作契约，POST 搜索有 requestBody 和 readOnly=true。',
        ['bun --no-env-file src/index.ts version --format=json', 'bun --no-env-file src/index.ts help knowledge search --format=json']],
    ['认证来源', 'source=environment、verified=true；输出不包含密码或 Token。', [`${prefix} auth status --verify --format=json`]],
    ['跨页与截断', '两页 Bug 聚合后倒序，返回 1 条；meta.processingScope=all、fetched=2、truncated=true。',
        [`${prefix} bug list --product ${f.product} --all --page-size 1 --sort id:desc --max-items 1 --fields id,title --format=json`]],
    ['过滤后的空页', 'data=[]，但 hasMore=true。空页不代表已经读完全部结果。',
        [`${prefix} bug list --product ${f.product} --page-size 1 --filter id=2147483647 --format=json`]],
    ['批量去重与部分失败', '重复 ID 只请求一次，存在对象与不存在对象均有结果；命令退出码为 1。',
        [`${prefix} product get --ids ${f.product},${f.product},2147483647 --format=json`]],
    ['JSON 与 raw', 'JSON 包含 ok/data/meta 并保留 desc 中的 HTML；raw 为服务器响应结构。',
        [`${prefix} product get ${f.product} --format=json`, `${prefix} product get ${f.product} --format=raw`]],
    ['终端表格和 Markdown', '表格有精简列与明确截断标记，Markdown 保留完整文字；quiet 仍输出结果。',
        [`${prefix} bug list --product ${f.product} --format=table --quiet`, `${prefix} bug list --product ${f.product} --format=markdown --color never`]],
    ['SQL 与点号列名', 'code 是字符串 007，flag 是字符串 true；a.b 显示为字面量列名，值为 1。',
        [`${prefix} db query --sql "SELECT '007' AS code, 'true' AS flag" --no-count --format=json`, `${prefix} db query --sql 'SELECT 1 AS \`a.b\`' --no-count --format=table`]],
    ['知识 POST 搜索', '使用实际 AI 知识库；支持重复关键词、数字数组和页大小，返回统一 JSON。',
        [`${prefix} knowledge search --keywords ${live.tag} --keywords 007 --lib-ids ${f.knowledgeLib} --page-size 1 --format=json`]],
    ['任务截止日期与状态', '帮助同时区分业务 --data-deadline 和全局 --deadline；样本任务为 closed。',
        ['bun --no-env-file src/index.ts task update --help', `${prefix} task get ${f.task} --deadline 30000 --format=json`]],
    ['参数错误不进入认证', '未知选项、冲突或禁止交互均返回退出码 2，错误写 stderr。',
        ['bun --no-env-file src/index.ts product list --paeg 2 --format=json', 'bun --no-env-file src/index.ts product create --name x --name y --format=json', 'bun --no-env-file src/index.ts auth login --web --no-input --format=json']],
    ['Shell 补全与命令参考', '补全输出真实动作；HTML 参考可搜索命令、参数和最低版本。',
        ['bun --no-env-file src/index.ts completion candidates -- --profile test bug cr', 'bun --no-env-file src/index.ts completion bash']],
];
const names: Record<string, string> = {
    'Offline version and shared machine help': '离线版本与机器帮助',
    'Password authentication saves without selecting a default': '密码认证只保存凭据',
    'Profile choice, online verification and environment precedence': '身份选择、验证与环境优先级',
    'Config set/get/unset retains identity and exposes source': '配置增删改查与来源',
    'Product create with string and HTML fidelity': '创建产品及 HTML 保真',
    'Product update autofills its required fields': '产品更新自动补全',
    'JSON file creates a second product': 'JSON 文件请求体',
    'Explicit batch deduplicates and preserves target order': '批量去重与顺序',
    'Partial batch failure and fail-fast have per-target results': '部分失败与 fail-fast',
    'Bug creates support explicit stdin and repeated array flags': '显式 stdin 与 Bug 创建',
    'All pages aggregate before sorting and max-items': '全量分页后排序与截断',
    'Filtered empty first page retains hasMore': '过滤空页仍保留 hasMore',
    'Table and Markdown render while raw preserves server structure': '表格、Markdown 与 raw',
    'Bug resolve, close and activate are confirmed by readback': 'Bug 解决、关闭、激活并读回',
    'Story create and change preserve explicit review status': '需求创建、变更与状态',
    'SQL POST body preserves false, strings and literal dotted columns': 'SQL POST、布尔值与点号列名',
    'Project and execution create with schema-typed arrays': '项目、执行及数组字段',
    'Task deadline flag coexists with command deadline and autofill': '任务截止日期与更新补全',
    'Task start, finish and close are confirmed by readback': '任务开始、完成、关闭并读回',
    'Document library, document create and update use explicit actions': '文档库、文档创建与更新',
    'Multipart file upload uses only the explicit local fixture': '本地附件 multipart 上传',
    'Discover an accessible published AI knowledge library': '发现实际 AI 知识库',
    'Keyword POST search supports repeated typed arrays and pagination': '关键词 POST 搜索与分页',
    'Stdio MCP reads live data and classifies POST search as read-only': 'stdio MCP 查询及只读策略',
    'HTTP MCP reads live data and hides local file actions': 'HTTP MCP 查询及上传发现过滤',
    'Explicit batch delete removes disposable objects': '批量删除及不存在读回',
};
const invocationCount = live.records.reduce((n: number, item: any) => n + item.commands.length, 0);
const code = (text: string) => `<pre><code>${e(text)}</code></pre>`;
const script = `
const key = ${JSON.stringify(`zentao-review-${live.tag}`)};
const checks = [...document.querySelectorAll('.manual input')];
const saved = JSON.parse(localStorage.getItem(key) || '[]');
checks.forEach((input, i) => { input.checked = saved.includes(i); input.addEventListener('change', update); });
function update() {
    const selected = checks.flatMap((input, i) => input.checked ? [i] : []);
    localStorage.setItem(key, JSON.stringify(selected));
    document.getElementById('progress').textContent = selected.length + ' / ' + checks.length + ' 项已人工验收';
    document.getElementById('progressbar').value = selected.length;
}
update();
document.getElementById('reset').addEventListener('click', () => { checks.forEach(input => input.checked = false); update(); });
document.getElementById('print').addEventListener('click', () => window.print());
document.querySelectorAll('.copy').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.closest('.manual').querySelector('code').textContent); button.textContent = '已复制'; }
    catch { button.textContent = '请选中命令复制'; }
    setTimeout(() => button.textContent = '复制命令', 1800);
}));
function filter() {
    const term = document.getElementById('search').value.toLowerCase();
    const status = document.getElementById('status').value;
    let visible = 0;
    document.querySelectorAll('.case').forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(term) || (status !== 'all' && status !== row.dataset.status);
        if (!row.hidden) visible++;
    });
    document.getElementById('shown').textContent = visible + ' / ' + ${live.records.length} + ' 项';
    document.getElementById('empty').hidden = visible > 0;
}
document.getElementById('search').addEventListener('input', filter);
document.getElementById('status').addEventListener('change', filter);
filter();
`;
new Script(script);
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>禅道 CLI 优化验收报告</title><style>
:root{--ink:#172e35;--muted:#52666a;--line:#d8e2df;--paper:#fff;--bg:#f4f7f5;--green:#176951;--tint:#e8f2ec;--red:#ac3434}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--green);text-underline-offset:3px}header,main,footer{max-width:1120px;margin:auto;padding:28px 28px}header{padding-top:48px;padding-bottom:12px}.eyebrow{font:12px/1.5 ui-monospace,monospace;letter-spacing:.13em;color:var(--green);text-transform:uppercase}.title-row{display:flex;justify-content:space-between;align-items:start;gap:20px}h1{font-size:40px;font-weight:650;letter-spacing:-.04em;line-height:1.2;margin:14px 0 20px}h2{font-size:23px;line-height:1.3;letter-spacing:-.025em;margin:0 0 10px}h3{font-size:16px;margin:0 0 5px}p{margin:8px 0;color:var(--muted)}.lead{max-width:760px;font-size:17px}.badge{border:1px solid #bdd8ca;background:var(--tint);color:var(--green);padding:5px 10px;border-radius:5px;white-space:nowrap;font-size:12px;font-weight:650}.fail{background:#ffeded;color:var(--red);border-color:#efc7c7}.meta{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12px;color:var(--muted);margin:18px 0}.meta code{font-size:12px;overflow-wrap:anywhere}nav{display:flex;gap:24px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:18px 0 16px}nav a{text-decoration:none;font-size:14px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0 35px}.stat{border-top:3px solid var(--green);background:var(--paper);padding:20px 18px}.stat strong{font-size:34px;line-height:1.2;display:block;letter-spacing:-.04em;font-weight:600}.stat span{font-size:13px;color:var(--muted)}section{scroll-margin-top:18px;margin-bottom:44px}.sectionhead{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:16px}.sectionhead p{font-size:13px}.scope{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;background:white;padding:10px 24px;border:1px solid var(--line);border-radius:7px}.item{padding:17px 0;border-bottom:1px solid var(--line)}.item:last-child{border:0}.item p{font-size:13px;margin:3px 0}.commit{font:11px/1.6 ui-monospace,monospace;color:#627971}.evidence{display:grid;grid-template-columns:1fr 1fr;gap:14px}.evidence article{padding:18px;background:white;border:1px solid var(--line);border-radius:7px}.evidence p{font-size:13px}.toolbar{display:flex;gap:10px;align-items:center;margin:18px 0}input[type=search],select,button{font:inherit;border:1px solid #bbcfc6;border-radius:5px;background:white;color:var(--ink);padding:9px 12px}input[type=search]{min-width:0;flex:1}button{cursor:pointer;white-space:nowrap;font-size:13px}button:hover{border-color:var(--green);background:var(--tint)}:focus-visible{outline:3px solid #548b78;outline-offset:3px}#shown{min-width:75px;text-align:right;font:12px ui-monospace,monospace}.case{background:white;border:1px solid var(--line);border-radius:6px;margin:8px 0}.case summary{display:flex;align-items:center;gap:12px;cursor:pointer;padding:13px 16px;font-size:14px}.case summary::before{content:'+';color:var(--muted);font-family:monospace}.case[open] summary::before{content:'−'}.case summary .label{flex:1}.time{font:11px ui-monospace,monospace;color:var(--muted)}.casebody{padding:0 16px 16px}.casebody p{font-size:12px}.casebody pre{max-height:350px;overflow:auto}pre{margin:10px 0 0;padding:14px 16px;background:#f0f4f2;border:1px solid #e0e8e3;border-radius:5px;overflow:auto;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}table{border-collapse:collapse;width:100%;background:white;font-size:13px}th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top}th{font-weight:550;color:var(--muted);background:#eaf0ec}.tablewrap{overflow:auto;border:1px solid var(--line);border-radius:6px}.manual{border:1px solid var(--line);border-radius:7px;background:white;margin:12px 0;padding:18px}.manualtop{display:flex;gap:12px;align-items:start}.manualtop label{flex:1;font-weight:600;cursor:pointer}.manual input{width:18px;height:18px;margin:4px 9px 0 0;accent-color:var(--green);vertical-align:top}.manual p{font-size:13px;padding-left:28px}.manual:has(input:checked){border-color:#77b498;background:#f5faf6}.manual:has(input:checked) label{color:var(--green)}.progress{background:var(--tint);padding:16px 18px;display:flex;align-items:center;gap:14px;border-radius:6px;font-size:14px}.progress progress{flex:1;min-width:50px;accent-color:var(--green);height:10px}.fine{font-size:12px;color:var(--muted)}.note{padding:15px 18px;background:#eaf0ec;border-left:3px solid #7f9e90;font-size:13px;margin:20px 0}.reportlinks{display:flex;gap:18px;flex-wrap:wrap}footer{border-top:1px solid var(--line);font-size:12px;padding-bottom:40px}.empty{text-align:center;padding:28px;color:var(--muted)}[hidden]{display:none!important}@media(max-width:700px){header,main,footer{padding:22px 16px}h1{font-size:31px}.title-row{display:block}.title-row>.badge{display:inline-block;margin-bottom:10px}.stats{grid-template-columns:1fr 1fr;gap:10px}.stat{padding:15px}.stat strong{font-size:29px}.scope,.evidence{grid-template-columns:1fr}.scope{padding:0 18px}.sectionhead{display:block}.progress{flex-wrap:wrap}.progress progress{min-width:100px}nav{gap:16px}.time{display:none}.toolbar{flex-wrap:wrap}.toolbar input{min-width:180px}.manual{padding:14px}.manual p{padding-left:0}.manualtop{gap:6px}pre{font-size:11px}th,td{padding:9px}.case summary{padding:12px}.badge{font-size:11px}}@media print{body{background:white;font-size:11px}header,main,footer{max-width:none;padding:12px}.toolbar,button,nav,.copy{display:none!important}.casebody{display:block!important}details:not([open])>*:not(summary){display:block!important}pre{max-height:none!important}.manual,.item,.evidence article{break-inside:avoid}.stats{margin:10px 0}.case{break-inside:avoid}}
</style></head><body>
<header><div class="eyebrow">ZenTao CLI / Acceptance report / 2026.10.23</div><div class="title-row"><div><h1>CLI 优化验收报告</h1><p class="lead">本页记录 2026-10-23 的历史验收，不代表合并后的版本已重新通过真实环境验收；当前状态见实施记录。</p></div><span class="badge">${live.summary.fail ? '存在未通过项' : '自动验收全部通过'}</span></div><div class="meta"><span>分支 <code>devx/cli-contract-optimization</code></span><span>CLI 0.4.0 / SDK 0.8.2</span><span>测试环境 ${e(live.serverVersion)}</span><span>尚未推送或发布</span></div><nav aria-label="报告导航"><a href="#scope">逐项变更</a><a href="#evidence">验证证据</a><a href="#live">真实环境</a><a href="#manual">手动验收</a><a href="#commits">提交记录</a></nav></header>
<main><div class="stats"><div class="stat"><strong>449 <small style="font-size:15px">/ 449</small></strong><span>自动测试 · 45 文件 / 5982 断言</span></div><div class="stat"><strong>${live.summary.pass} <small style="font-size:15px">/ ${live.records.length}</small></strong><span>真实场景 · ${invocationCount} 次 CLI 调用 + MCP</span></div><div class="stat"><strong>361</strong><span>动作契约 · 42 模块 / 1571 参数</span></div><div class="stat"><strong>Node 18</strong><span>最低运行时 · 18.20.8 实际验证</span></div></div>
<section id="scope"><div class="sectionhead"><div><h2>建议逐项落地</h2><p>依据「1003 📝 HTML 命令参考与优化建议更新」最新一轮的不兼容设计，同时覆盖此前修复建议。</p></div><a href="command-reference.html">打开完整命令参考 ↗</a></div><div class="scope">${improvements.map(([name, detail, commit], i) => `<article class="item"><h3>${String(i + 1).padStart(2, '0')} · ${e(name)}</h3><p>${e(detail)}</p><span class="commit">${e(commit)}</span></article>`).join('')}</div><div class="note">这是尚未发布的命令契约调整，版本号暂未提升。旧脚本需要迁移；验收请使用此分支的源码或构建产物。此前 WorkBuddy ZIP 结论已被后续 npm 产物校验取代；当前只验证本地预览包，正式分发前仍须发布兼容的 CLI。</div></section>
<section id="evidence"><h2>本地验证证据</h2><div class="evidence"><article><h3>代码与回归</h3><p>TypeScript 检查、449 项 Bun 测试、git diff --check 均通过。测试覆盖模拟 HTTP、CLI 子进程、MCP、并发配置写入、取消及全动作帮助示例。</p></article><article><h3>构建与分发内容</h3><p>Node 构建、当前平台独立程序、WorkBuddy ZIP、npm pack dry-run 通过。Node 18 与独立程序各导出 13 个技能文件，逐字节核对原文件。</p></article><article><h3>帮助、补全与文档</h3><p>文档生成及 --check 通过，包含 440 个章节。Bash/Zsh/Fish 脚本来自同一命令树；技能示例通过真实 Commander 解析验证。</p></article><article><h3>覆盖边界</h3><p>全部 361 个动作做契约和示例验证。真实环境选择 ${live.records.length} 个代表场景，覆盖核心变化；没有逐个执行全部业务动作。取消和并发竞态主要由可控制的模拟服务器验证。</p></article></div><p class="fine">报告页面已在 Codex 桌面内置浏览器的 localhost 预览中验证：搜索筛选、勾选持久化、复制命令、清空进度和参考链接均通过，控制台无错误。未进行移动设备实测；内置浏览器不接受 file:// 预览。</p></section>
<section id="live"><div class="sectionhead"><div><h2>真实环境结果</h2><p>${e(live.runtime)} · ${e(live.serverVersion)} · ${e(live.generatedAt)} · 临时配置已清理。</p></div><a href="optimization-live-results.json">查看 JSON 证据 ↗</a></div><div class="toolbar"><input id="search" type="search" aria-label="搜索验收场景" placeholder="搜索场景、命令或结果…"><select id="status" aria-label="筛选状态"><option value="all">全部状态</option><option value="pass">通过</option><option value="fail">未通过</option></select><span id="shown" aria-live="polite"></span></div>${live.records.map((r: any, i: number) => `<details class="case" data-status="${e(r.status)}"><summary><span class="label">${String(i + 1).padStart(2, '0')} · ${e(names[r.name] ?? r.name)}</span><span class="time">${r.ms} ms</span><span class="badge ${r.status === 'pass' ? '' : 'fail'}">${r.status === 'pass' ? '通过' : '未通过'}</span></summary><div class="casebody"><p>验证结果</p>${code(typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail, null, 2))}${r.commands.length ? `<p>调用记录（配置和文件路径已脱敏；复验请使用下方命令）</p>${code(r.commands.join('\n'))}` : '<p>通过 MCP SDK 客户端实际调用并核对 structuredContent。</p>'}</div></details>`).join('')}<p id="empty" class="empty" hidden>没有匹配的场景。</p><h3 style="margin-top:24px">保留的手动验收对象</h3><div class="tablewrap"><table><thead><tr><th>对象</th><th>编号</th><th>当前状态 / 用途</th></tr></thead><tbody>${[['产品',f.product,'描述含 HTML；保留为验收容器'],['Bug',`${f.bug} / ${f.secondBug}`,'active；第二条标题为字符串 007'],['需求',f.story,'active；已执行 change'],['项目 / 执行',`${f.project} / ${f.execution}`,'本次创建'],['任务',f.task,'closed；已经 start → finish → close'],['文档库 / 文档',`${f.lib} / ${f.doc}`,'本次创建，文档库已更新'],['AI 知识库',f.knowledgeLib,'已有可见库，仅用于查询'],['删除样本产品',f.deleteProduct,'已删除，详情请求返回不存在']].map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="fine">运行标签 ${e(live.tag)}。迭代验证产生的测试对象保留在测试环境中。账号、密码及 Token 不写入报告。</p></section>
<section id="manual"><div class="sectionhead"><div><h2>手动验收清单</h2><p>在仓库目录运行，命令从 .env.test 读取测试凭据。勾选状态仅保存在当前浏览器。</p></div><button id="print">打印 / 保存 PDF</button></div><div class="progress"><span id="progress" aria-live="polite"></span><progress id="progressbar" max="${manual.length}" value="0" aria-label="手动验收进度"></progress><button id="reset">清空勾选</button></div>${manual.map(([name, expected, cmds], i) => `<article class="manual"><div class="manualtop"><label><input type="checkbox" aria-label="${e(name)}">${String(i + 1).padStart(2, '0')} · ${e(name)}</label><button class="copy">复制命令</button></div><p>${e(expected)}</p>${code((cmds as string[]).join('\n'))}</article>`).join('')}<p class="fine">重新运行完整实测：<code>bun run build &amp;&amp; bun --env-file=.env.test scripts/verify-live.ts</code>。该脚本会新增独立验收对象并更新 JSON 结果；随后运行 <code>bun run scripts/generate-optimization-report.ts</code> 更新此报告。</p></section>
<section id="commits"><h2>功能与验收提交</h2><p>报告生成时的提交列表；所有提交均在新开发分支，本任务未推送、打标签或发布。</p><div class="tablewrap"><table><thead><tr><th>提交</th><th>变更</th></tr></thead><tbody>${commits.map(([sha, subject]) => `<tr><td><code>${e(sha)}</code></td><td>${e(subject)}</td></tr>`).join('')}</tbody></table></div></section>
<div class="reportlinks"><a href="command-reference.html">完整命令参考</a><a href="optimization-live-results.json">实测 JSON</a><a href="optimization-progress.md">实施记录</a><a href="command-guide.md">命令迁移指南</a></div></main><footer>禅道 CLI · 基线 f1af0b4 · 验收结论以本报告附带的数据和运行时为准。</footer><script>${script}</script></body></html>`;
writeFileSync('docs/optimization-report.html', html);
console.log(`Generated acceptance report: ${live.records.length} live scenarios, ${manual.length} manual checks.`);
