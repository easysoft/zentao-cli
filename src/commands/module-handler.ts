import type { ZentaoClient } from '../api/index.js';
import { getModuleActionParams } from 'zentao-api';
import type { ModuleDefinition, ModuleAction, ModuleActionType, Profile, ModuleActionName, UserConfig } from '../types/index.js';
import { findAction, getAction, getAvailableActions, getObjectProps } from '../modules/helper.js';
import { buildParams } from '../modules/args.js';
import { executeModuleCommand } from '../modules/executor.js';
import { getProfileConfig } from '../config/store.js';
import { formatJson, formatOutput } from '../utils/format.js';
import type { ModuleActionOptions } from '../types/index.js';
import { createInterface } from 'node:readline';
import { renderError, renderObject } from '../utils/render.js';
import { ZentaoError } from '../errors.js';


/** JSON/raw 模式下跳过交互确认，便于脚本化调用 */
async function confirmDelete(format: string, count: number): Promise<boolean> {
    if (format === 'json' || format === 'raw') return true;

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve) => {
        rl.question(`确认删除 ${count} 个对象？(y/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

function splitNumericIds(value: unknown): string[] | undefined {
    const rawIds = Array.isArray(value) ? value : [value];
    const ids = rawIds
        .flatMap((id) => String(id ?? '').split(','))
        .map((id) => id.trim())
        .filter(Boolean);

    if (ids.length <= 1 || !ids.every((id) => /^\d+$/.test(id))) {
        return undefined;
    }
    return ids;
}

function pickBatchIds(args: string[], options: ModuleActionOptions): { ids: string[]; args: string[] } | undefined {
    const optionIds = splitNumericIds(options.id);
    if (optionIds) {
        return { ids: optionIds, args };
    }

    const positionalIds = splitNumericIds(args[0]);
    if (positionalIds) {
        return { ids: positionalIds, args: args.slice(1) };
    }

    return undefined;
}

async function renderModuleExecution(
    client: ZentaoClient,
    module: ModuleDefinition,
    actionName: ModuleActionName,
    args: string[],
    options: ModuleActionOptions,
    config: UserConfig,
): Promise<void> {
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';
    const silent = options.silent ?? config.silent ?? false;

    const execution = await executeModuleCommand(client, module, actionName, args, options, config);
    if (silent) {
        return;
    }

    if (format === 'raw') {
        const output = formatOutput(execution.data, {
            format,
            isList: execution.isList,
            fields: execution.fields,
            pager: execution.pager,
            jsonPretty: config.jsonPretty,
            rawResponse: execution.rawResponse,
        });
        if (output) console.log(output);
        return;
    }

    if (execution.action.type === 'list') {
        const output = formatOutput(execution.data, {
            format,
            isList: true,
            fields: execution.fields,
            pager: execution.pager,
            jsonPretty: config.jsonPretty,
        });
        if (output) console.log(output);
        return;
    }

    if (execution.action.type === 'get') {
        const output = renderObject(execution.data as Record<string, unknown>, format, { fields: execution.fields });
        if (output) console.log(output);
        return;
    }

    const output = formatOutput(execution.data, {
        format,
        isList: false,
        fields: execution.fields,
        jsonPretty: config.jsonPretty,
    });
    if (output) console.log(output);
}

/** 输出模块对应对象的属性定义（与 `zentao <module> props` 对应） */
export function showModuleProps(mod: ModuleDefinition, options: ModuleActionOptions): void {
    if (options.silent) return;

    const props = getObjectProps(mod.name);
    const format = options.format ?? 'markdown';
    const output = format === 'markdown' ? renderObject(props, format) : formatJson(props);
    if (output) console.log(output);
}


/**
 * 执行模块级 CRUD 或扩展操作：负责拼路径、分页拉取、客户端过滤/排序、HTML 转 Markdown 及格式化输出。
 */
export async function handleModuleCommand(
    client: ZentaoClient,
    module: ModuleDefinition,
    actionName: ModuleActionName,
    args: string[],
    profile: Profile,
    options: ModuleActionOptions,
): Promise<void> {
    const config = getProfileConfig(profile);
    const batchFailFast = options.batchFailFast ?? config.batchFailFast ?? false;
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';

    const batch = pickBatchIds(args, options);
    if (batch) {
        if (actionName === 'delete' && !options.yes) {
            if (!await confirmDelete(format, batch.ids.length)) {
                return;
            }
        }

        for (const id of batch.ids) {
            let caughtError: Error | undefined;
            try {
                await handleModuleCommand(
                    client,
                    module,
                    actionName,
                    batch.args,
                    profile,
                    { ...options, id, yes: options.yes || actionName === 'delete' },
                );
            } catch (error) {
                caughtError = error as Error;
            }
            if (caughtError) {
                if (batchFailFast) {
                    throw caughtError;
                }
                console.error(renderError(caughtError, format));
            }
        }

        return;
    }

    const action = getAction(module, actionName);
    if (!action) {
        throw new ZentaoError('E2005', { module: module.name });
    }

    const params = buildParams(options, actionName, args);
    const hasId = params.id !== undefined && params.id !== '';

    if (action.type === 'delete' && !options.yes) {
        if (!await confirmDelete(format, hasId ? 1 : 0)) {
            return;
        }
    }

    if (!hasId && (action.type === 'delete' || action.type === 'update' || action.type === 'action')) {
        throw new ZentaoError('E2009', { option: 'id', reason: '必须提供要操作的对象 ID' });
    }

    await renderModuleExecution(client, module, actionName, args, options, config);
}

/**
 * 打印模块级内建帮助（与 `zentao <module> help` 对应）
 *
 * 首先输出模块名称和描述，然后输出操作列表，每个操作需要包含命令形式和描述，描述尽量详细，确保用户能够凭借说明进行操作而不会出错。
 * 然后输出扩展操作列表，每个扩展操作需要包含命令形式和描述，描述尽量详细，确保用户能够凭借说明进行操作而不会出错。
 * 最后输出 ModuleActionOptions 中定义的公共参数列表
 */
export function showModuleHelp(mod: ModuleDefinition): void {
    const n = mod.name;
    console.log(`模块: ${mod.display ?? n}`);
    if (mod.description) console.log(`描述: ${mod.description}`);

    type CmdEntry = { cmd: string; desc: string };
    const cmds: CmdEntry[] = [];

    const listAction = findAction(mod, 'list');
    if (listAction) {
        cmds.push({ cmd: `zentao ${n} [选项]`, desc: listAction.display ?? '获取列表' });
    }
    const getAction = findAction(mod, 'get');
    if (getAction) {
        cmds.push({ cmd: `zentao ${n} <id> [选项]`, desc: getAction.display ?? '获取详情' });
    }
    cmds.push({ cmd: `zentao ${n} props [选项]`, desc: '获取对象属性定义' });
    const createAction = findAction(mod, 'create');
    if (createAction) {
        cmds.push({ cmd: `zentao ${n} create [--key=value ...]`, desc: createAction.display ?? '创建' });
    }
    const updateAction = findAction(mod, 'update');
    if (updateAction) {
        cmds.push({ cmd: `zentao ${n} update <id> [--key=value ...]`, desc: updateAction.display ?? '更新' });
    }
    const deleteAction = findAction(mod, 'delete');
    if (deleteAction) {
        cmds.push({ cmd: `zentao ${n} delete <id>[,<id>...] [选项]`, desc: deleteAction.display ?? '删除' });
    }

    if (cmds.length > 0) {
        console.log(`\n操作:`);
        const cmdCol = Math.max(...cmds.map(c => c.cmd.length), 24) + 4;
        for (const c of cmds) {
            console.log(`  ${c.cmd.padEnd(cmdCol)}${c.desc}`);
        }
    }

    const actions = getAvailableActions(mod);
    if (actions.length > 0) {
        const extCmds: CmdEntry[] = [];
        for (const actionName of actions) {
            const action = findAction(mod, 'action', actionName);
            const desc = action?.display ?? actionName;
            extCmds.push({ cmd: `zentao ${n} ${actionName} <id> [--key=value ...]`, desc });
        }
        console.log(`\n扩展操作:`);
        const cmdCol = Math.max(...extCmds.map(c => c.cmd.length), 24) + 4;
        for (const c of extCmds) {
            console.log(`  ${c.cmd.padEnd(cmdCol)}${c.desc}`);
        }
    }

    if (listAction?.pathParams) {
        const hasScopePattern = 'scope' in listAction.pathParams;
        const scopeParams = Object.entries(listAction.pathParams)
            .filter(([key]) => key !== 'scope' && key !== 'scopeID');

        if (hasScopePattern || scopeParams.length > 0) {
            const contextEntries: ParamEntry[] = [];
            if (hasScopePattern) {
                const scopeDef = listAction.pathParams.scope;
                if (typeof scopeDef === 'object' && scopeDef.options) {
                    for (const opt of scopeDef.options) {
                        const name = String(opt.value).replace(/s$/, '');
                        contextEntries.push({ name, placeholder: 'id', description: `按${opt.label}范围筛选，值为${opt.label} ID` });
                    }
                } else {
                    contextEntries.push({ name: 'product', placeholder: 'id', description: '按产品范围筛选，值为产品 ID' });
                    contextEntries.push({ name: 'project', placeholder: 'id', description: '按项目范围筛选，值为项目 ID' });
                    contextEntries.push({ name: 'execution', placeholder: 'id', description: '按执行范围筛选，值为执行 ID' });
                }
            }
            for (const [key, def] of scopeParams) {
                const desc = typeof def === 'string' ? def : def.description ?? key;
                contextEntries.push({ name: key, placeholder: 'id', description: desc });
            }
            console.log(`\n上下文参数${hasScopePattern ? '（获取列表时必须指定其一）' : ''}:`);
            printParamEntries(contextEntries);
        }
    }

    console.log('\n公共选项:');
    printParamEntries([
        { name: 'pick', placeholder: 'fields', description: '摘取指定字段（逗号分隔），适用于 list/get 操作' },
        { name: 'filter', placeholder: 'expr', description: '过滤条件，逗号分隔条件为 AND，多次指定为 OR，适用于 list 操作' },
        { name: 'sort', placeholder: 'expr', description: '客户端排序，格式: field:asc 或 field:desc（兼容下划线写法），适用于 list 操作' },
        { name: 'search', placeholder: 'keywords', description: '搜索关键词，逗号分隔关键词为 AND，多次指定为 OR，适用于 list 操作' },
        { name: 'search-fields', placeholder: 'fields', description: '搜索字段（逗号分隔），配合 --search 使用，适用于 list 操作' },
        { name: 'page', placeholder: 'number', description: '页码（等同于 API 的 pageID 参数），适用于 list 操作' },
        { name: 'recPerPage', placeholder: 'number', description: '每页条数，适用于 list 操作' },
        { name: 'data', placeholder: 'json', description: '请求数据（JSON 格式），适用于 create/update 操作' },
        { name: 'params', placeholder: 'json', description: 'API 调用参数（JSON 对象），可替代单独的 --key=value 传参' },
        { name: 'options', placeholder: 'json', description: 'CLI 调用选项（JSON 对象），可替代单独的公共选项' },
        { name: 'yes', description: '跳过确认提示，适用于 delete 操作' },
        { name: 'silent', description: '静默模式，不输出任何结果' },
        // { name: 'batch-fail-fast', description: '批量操作遇到错误时立即停止，适用于批量 create/update/delete 操作' },
        { name: 'id', placeholder: 'id', description: '对象 ID，适用于 get/update/delete 操作' },
        { name: 'format', placeholder: 'type', description: '输出格式，支持 markdown、json、raw' },
    ]);

    console.log(`\n提示:`);
    console.log(`  使用 zentao ${n} <操作> help 查看操作的详细参数说明`);
    console.log(`  参数传入方式: --key=value 或 --params '{"key":"value"}'`);
    console.log(`  请求数据传入: --data '{"key":"value"}' 或直接 --key=value`);
}

/**
 * 打印模块级扩展操作帮助（与 `zentao <module> <action> help` 对应
 * 输出操作标题和参数，每个参数描述尽量详细，确保用户能够凭借说明进行操作而不会出错，其中参数包括两部分：
 *
 * 1. 通过 zentao-api 的 getModuleActionParams 生成 API 参数名称
 * 2. ModuleActionOptions 中定义的公共参数，需要注意的是根据操作类型不同，有些选项可能不适用
 */
export function showModuleActionHelp(mod: ModuleDefinition, action: ModuleAction): void {
    console.log(action.display ?? `${mod.display ?? mod.name} ${action.name}`);
    if (action.description && action.description !== action.display) {
        console.log(`描述: ${action.description}`);
    }

    const actionParams = getModuleActionParams(mod.name, action.name);
    const apiParams: ParamEntry[] = actionParams
        .filter((param) => param.name !== 'scope' && param.name !== 'scopeID')
        .map((param) => {
            const isObjectId = param.role === 'path' && param.name.endsWith('ID');
            return {
                name: isObjectId ? 'id' : param.name,
                placeholder: isObjectId ? 'number' : getParamPlaceholder(param),
                description: param.description ?? (isObjectId ? `${mod.display ?? mod.name} ID` : param.name),
                required: param.required,
                defaultValue: param.defaultValue,
                options: param.options,
            };
        });

    const needsBody = action.type === 'create' || action.type === 'update' || action.type === 'action';
    if (needsBody && !actionParams.some((param) => param.role === 'body' && param.name === 'data')) {
        apiParams.push({ name: 'data', placeholder: 'json', description: '请求数据（完整 JSON 对象），可替代以上逐个字段传参' });
    }
    apiParams.push({ name: 'params', placeholder: 'json', description: 'API 调用参数（JSON 对象），可替代以上逐个 --key=value 传参' });
    apiParams.push({ name: 'options', placeholder: 'json', description: 'CLI 调用选项（JSON 对象），可替代以下公共选项' });

    if (apiParams.length > 0) {
        console.log('\nAPI 参数:');
        printParamEntries(apiParams);
    }

    const scopeParam = actionParams.find((param) => param.role === 'path' && param.name === 'scope');
    if (scopeParam) {
        const contextEntries: ParamEntry[] = [];
        if (scopeParam.options) {
            for (const opt of scopeParam.options) {
                const name = String(opt.value).replace(/s$/, '');
                contextEntries.push({ name, placeholder: 'id', description: `按${opt.label}范围筛选，值为${opt.label} ID` });
            }
        } else {
            contextEntries.push({ name: 'product', placeholder: 'id', description: '按产品范围筛选，值为产品 ID' });
            contextEntries.push({ name: 'project', placeholder: 'id', description: '按项目范围筛选，值为项目 ID' });
            contextEntries.push({ name: 'execution', placeholder: 'id', description: '按执行范围筛选，值为执行 ID' });
        }
        console.log('\n上下文参数（必须指定其一）:');
        printParamEntries(contextEntries);
    }

    const commonOpts: ParamEntry[] = [];
    if (action.resultType === 'list' || action.type === 'list') {
        commonOpts.push(
            { name: 'pick', placeholder: 'fields', description: '摘取指定字段（逗号分隔），仅输出指定的字段' },
            { name: 'filter', placeholder: 'expr', description: '过滤条件，逗号分隔条件为 AND，多次指定为 OR' },
            { name: 'sort', placeholder: 'expr', description: '客户端排序，格式: field:asc 或 field:desc（兼容下划线写法）' },
            { name: 'search', placeholder: 'keywords', description: '搜索关键词，逗号分隔关键词为 AND，多次指定为 OR' },
            { name: 'search-fields', placeholder: 'fields', description: '搜索字段（逗号分隔），配合 --search 使用' },
            { name: 'page', placeholder: 'number', description: '页码（等同于 API 的 pageID 参数）' },
            { name: 'recPerPage', placeholder: 'number', description: '每页条数' },
        );
    } else if (action.resultType === 'object' || action.type === 'get') {
        commonOpts.push(
            { name: 'pick', placeholder: 'fields', description: '摘取指定字段（逗号分隔），仅输出指定的字段' },
        );
    }
    if (action.type === 'delete') {
        commonOpts.push({ name: 'yes', description: '跳过确认提示，直接执行删除' });
    }
    commonOpts.push({ name: 'format', placeholder: 'type', description: '输出格式，支持 markdown、json、raw' });
    commonOpts.push({ name: 'silent', description: '静默模式，不输出任何结果' });
    if (action.type !== 'list' && action.type !== 'get') {
        commonOpts.push({ name: 'batch-fail-fast', description: '批量操作遇到错误时立即停止' });
    }

    console.log('\n公共选项:');
    printParamEntries(commonOpts);
}

const MODULE_HELP_CRUD_ORDER: ModuleActionType[] = ['list', 'get', 'create', 'update', 'delete'];

/**
 * 依次输出模块各内建操作与扩展操作的详细参数说明（供 `zentao help <module>` 使用，内部对每种操作调用 {@link showModuleActionHelp}）。
 */
export function showModuleAllActionsHelp(mod: ModuleDefinition): void {
    let first = true;
    for (const type of MODULE_HELP_CRUD_ORDER) {
        const action = findAction(mod, type);
        if (!action) continue;
        if (!first) console.log(`\n${'─'.repeat(56)}\n`);
        first = false;
        showModuleActionHelp(mod, action);
    }
    for (const extName of getAvailableActions(mod)) {
        const action = findAction(mod, 'action', extName);
        if (!action) continue;
        if (!first) console.log(`\n${'─'.repeat(56)}\n`);
        first = false;
        showModuleActionHelp(mod, action);
    }
    if (first) {
        showModuleHelp(mod);
    }
}

type ParamEntry = {
    name: string;
    placeholder?: string;
    description: string;
    required?: boolean;
    defaultValue?: unknown;
    options?: readonly { value: unknown; label: string }[];
};

function typePlaceholder(type: string, itemsType?: string): string | undefined {
    if (type === 'number' || type === 'integer') return 'number';
    if (type === 'boolean') return undefined;
    if (type === 'array') return itemsType ? `${itemsType}[]` : 'array';
    return 'string';
}

function getParamPlaceholder(param: { type?: string; items?: { type?: string } }): string | undefined {
    return typePlaceholder(param.type ?? 'string', param.items?.type);
}

function printParamEntries(params: ParamEntry[]): void {
    const colWidth = Math.max(
        ...params.map(p => formatParamLeft(p).length),
        24,
    ) + 2;
    for (const p of params) {
        const left = formatParamLeft(p);
        const parts: string[] = [p.description];
        if (p.required) parts.push('(必填)');
        if (p.defaultValue !== undefined) parts.push(`(默认值: ${p.defaultValue})`);
        console.log(left.padEnd(colWidth) + parts.join(' '));

        if (p.options?.length) {
            const indent = ' '.repeat(colWidth);
            const optStr = p.options.map(o => `${o.value}(${o.label})`).join(' | ');
            console.log(`${indent}可选值: ${optStr}`);
        }
    }
}

function formatParamLeft(p: ParamEntry): string {
    return `  --${p.name}${p.placeholder ? ` <${p.placeholder}>` : ''}`;
}
