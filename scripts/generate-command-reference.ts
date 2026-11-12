import { mkdirSync } from 'node:fs';
import { brandDocument, loadBrand, option, outputDirectory } from './brand-config.js';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';
import { createProgram } from '../src/cli.js';
import { getAllModules } from '../src/modules/helper.js';
import { actionContract, kebabCase } from '../src/modules/contract.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import packageInfo from '../package.json';

const root = fileURLToPath(new URL('../', import.meta.url));
const selectedBrand = loadBrand(option(process.argv.slice(2), '--brand'));
const destination = option(process.argv.slice(2), '--outdir');
const outputRoot = destination ? outputDirectory(destination, root) : root;
if (selectedBrand && !destination) throw new Error('--brand requires --outdir');
const program = createProgram();
// Commander wraps help to the live terminal width and may color it. Pin both so --check matches CI.
program.configureOutput({ getOutHelpWidth: () => 80, getErrHelpWidth: () => 80, getOutHasColors: () => false, getErrHasColors: () => false });
const modules = getAllModules();
const builtins = program.commands.filter(cmd => !modules.some(mod => mod.name === cmd.name()));
const sdkVersion = JSON.parse(readFileSync(join(root, 'node_modules/zentao-api/package.json'), 'utf8')).version;
const actionCount = modules.reduce((sum, mod) => sum + mod.actions.length, 0);
const sections: string[] = [];
const metadata = new Map<string, { title: string; description: string; group: string; type: string; parameterCount?: number }>();
const code = (text: string) => '`' + text + '`';
const fence = (text: string) => '```text\n' + text.trim() + '\n```';
const cell = (value: unknown) => String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\n', '<br>');
function assertFresh(path: string, next: string) {
    const current = readFileSync(join(outputRoot, path), 'utf8');
    if (current === next) return;
    const currentLines = current.split('\n');
    const nextLines = next.split('\n');
    let line = 0;
    while (currentLines[line] === nextLines[line]) line++;
    throw new Error(`Stale ${path}:${line + 1}; run bun run scripts/generate-command-reference.ts\n- ${currentLines[line] ?? ''}\n+ ${nextLines[line] ?? ''}`);
}
const table = (headers: string[], rows: unknown[][]) => [headers, headers.map(() => '---'), ...rows].map(row => '| ' + row.map(cell).join(' | ') + ' |').join('\n');
function section(id: string, title: string, group: string, type: string, content: string, parameterCount?: number) {
    assert(!metadata.has(id));
    metadata.set(id, { title, description: title, group, type, parameterCount });
    sections.push(`<a id="${id}"></a>\n\n## ${title}\n\n${content}`);
}
const guide = readFileSync(join(root, 'docs/command-guide.md'), 'utf8');
for (const match of guide.matchAll(/<a id="([^"]+)"><\/a>\s*\n## ([^\n]+)/g)) {
    metadata.set(match[1], { title: match[2], description: match[2], group: match[1] === 'review-summary' ? 'review' : 'guides', type: 'guide' });
}
section('coverage', '覆盖范围', 'guides', 'guide', `开发版本 CLI **${packageInfo.version}** / SDK **${sdkVersion}**，${builtins.length} 个内置一级命令、${modules.length} 个模块、${actionCount} 个业务动作。数量、参数和实际 Commander 命令来自同一注册表。`);
section('global-options', '全局选项', 'guides', 'guide', table(['选项', '说明'], program.options.map(option => [option.flags, option.description])) + '\n\n环境变量：ZENTAO_URL、ZENTAO_ACCOUNT、ZENTAO_TOKEN 或 ZENTAO_PASSWORD；配置路径 --config → ZENTAO_CONFIG_FILE → 绝对路径 XDG_CONFIG_HOME/zentao/zentao.json → ~/.config/zentao/zentao.json。完整环境凭据不读取本地账号。');
section('configuration', '配置项默认值', 'guides', 'guide', table(['配置项', '默认值'], Object.entries(DEFAULT_CONFIG).map(([key, value]) => [key, JSON.stringify(value)])));
function renderCommand(command: Command, path: string) {
    section('command-' + path.replaceAll(' ', '-'), 'zentao ' + path, 'builtin', 'builtin', fence(command.helpInformation()));
    for (const child of command.commands.filter(child => child.name() !== 'candidates')) renderCommand(child, path + ' ' + child.name());
}
for (const command of builtins) renderCommand(command, command.name());
let parameterCount = 0;
for (const mod of modules) {
    const resource = program.commands.find(cmd => cmd.name() === mod.name)!;
    section('module-' + mod.name, `${mod.display ?? mod.name} · ${mod.name}`, mod.name, 'overview', fence(resource.helpInformation()));
    for (const action of mod.actions) {
        const contract = actionContract(mod, action);
        const cmd = resource.commands.find(cmd => cmd.name() === kebabCase(action.name))!;
        assert(cmd, `Missing command ${mod.name}/${action.name}`);
        parameterCount += contract.parameters.length;
        const body = [fence(cmd.helpInformation()), `最低版本：${action.minVersion.join(' / ')}。`,
            action.description ?? '',
            `能力：${contract.readOnly ? '只读' : '写入或需服务端确认'}；批量：${contract.batch ? '--ids' : '不支持'}；分页：${contract.pagination ? '--page / --page-size / --all' : '不支持'}；本地文件：${contract.localFiles ? '是，HTTP MCP 不可用' : '否'}。`,
            contract.autoFill ? '未提供的请求体字段可由匹配的详情操作自动补全。' : '',
            table(['参数', 'JSON 字段', '位置', '类型', '必填', '默认值', '说明与约束'], contract.parameters.map(param => [
                param.name === contract.pagination?.page ? '--page' : param.name === contract.pagination?.pageSize ? '--page-size' : param.flag,
                param.name, param.role, param.type, param.required ? '是' : '否', JSON.stringify(param.defaultValue),
                [param.description, JSON.stringify(Object.fromEntries(Object.entries(param).filter(([key]) => ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'items', 'options', 'format'].includes(key))))].filter(Boolean).join('\n'),
            ])),
        ].filter(Boolean).join('\n\n');
        section('action-' + mod.name + '-' + kebabCase(action.name), 'zentao ' + contract.command, mod.name, action.type, body, contract.parameters.length);
    }
}
const output = guide.trimEnd() + '\n\n<!-- BEGIN GENERATED COMMAND REFERENCE -->\n\n' + sections.join('\n\n') + '\n';
const anchors = [...output.matchAll(/<a id="([^"]+)"><\/a>/g)];
assert.equal(anchors.length, metadata.size);
const entries = anchors.map((match, index) => {
    const item = metadata.get(match[1]); assert(item);
    const markdown = output.slice(match.index! + match[0].length, anchors[index + 1]?.index).trim();
    const html = Bun.markdown.html(markdown).replace(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\s*/, '');
    return { id: match[1], ...item, html };
});
const referenceData = JSON.stringify({ version: packageInfo.version, sdkVersion, actionCount, modules: modules.map(mod => ({ name: mod.name, display: mod.display ?? mod.name })), entries }).replaceAll('<', '\\u003c');
const template = readFileSync(join(root, 'scripts/command-reference.template.html'), 'utf8');
assert.equal(template.split('__REFERENCE_DATA__').length, 2);
const html = template.replace('__REFERENCE_DATA__', () => referenceData);
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(script);
for (const [path, content] of [['docs/command-reference.md', output], ['docs/command-reference.html', html]]) {
    const branded = brandDocument(content, selectedBrand, path);
    if (process.argv.includes('--check')) assertFresh(path, branded);
    else {
        mkdirSync(join(outputRoot, 'docs'), { recursive: true });
        writeFileSync(join(outputRoot, path), branded);
    }
}
console.log(`Command reference: ${modules.length} modules, ${actionCount} actions, ${parameterCount} parameters, ${entries.length} sections.`);
