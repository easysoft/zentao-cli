import type { ZentaoClient } from '../api/client.js';
import type { ModuleDefinition, ModuleAction, ModuleActionType, Profile, ModuleActionName, ResolvedModuleCommand, UserConfig } from '../types/index.js';
import { findAction, getAvailableActions, extractResult, extractPager, hasActionType, resolveModuleCommand } from '../modules/resolver.js';
import { getProfileConfig } from '../config/store.js';
import { convertHtmlFields, convertHtmlFieldsInArray } from '../utils/html.js';
import { filterData, sortData, searchData, pickFields, pickFieldsSingle } from '../utils/data.js';
import { formatOutput } from '../utils/format.js';
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

/** 处理列表操作 */
async function handleListCommand(client: ZentaoClient, module: ModuleDefinition, command: ResolvedModuleCommand, options: ModuleActionOptions, config: UserConfig) {
    const {action, path, query} = command;
    const silent = options.silent ?? config.silent ?? false;
    const result = await client.get(path, query);
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';
    const data = extractResult(action, result) as Record<string, unknown>[];
    const pager = extractPager(action, result);
    let processed: Record<string, unknown>[] = data;

    if (config.htmlToMarkdown !== false) {
        processed = convertHtmlFieldsInArray(processed);
    }
    if (options.filter?.length) {
        processed = filterData(processed, options.filter);
    }
    if (options.search?.length) {
        const searchFields = options.searchFields?.split(',');
        processed = searchData(processed, options.search, searchFields);
    }
    if (options.sort) {
        processed = sortData(processed, options.sort);
    }

    if (options.limit && Number(options.limit) < processed.length) {
        processed = processed.slice(0, Number(options.limit));
    }

    const fields = options.pick?.split(',');
    if (fields) {
        processed = pickFields(processed, fields);
    }

    if (silent) {
        return;
    }
    const output = formatOutput(processed, { format, isList: true, fields, pager, jsonPretty: config.jsonPretty });
    if (output) console.log(output);
}

/** 处理获取单个对象操作 */
async function handleGetCommand(client: ZentaoClient, module: ModuleDefinition, command: ResolvedModuleCommand, options: ModuleActionOptions, config: UserConfig) {
    const {action, path, query} = command;
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';
    const silent = options.silent ?? config.silent ?? false;

    const response = await client.get(path, query);
    if (silent) {
        return;
    }

    let data = (extractResult(action, response) ?? response) as Record<string, unknown>;
    if (config.htmlToMarkdown !== false) {
        data = convertHtmlFields(data);
    }
    const fields = options.pick?.split(',');
    if (fields) {
        data = pickFieldsSingle(data, fields);
    }

    const output = renderObject(data, format, { fields });
    if (output) console.log(output);
}

/** 处理对象通用操作 */
async function handleActionCommand(client: ZentaoClient, module: ModuleDefinition, command: ResolvedModuleCommand, options: ModuleActionOptions, config: UserConfig) {
    const {action, path, query, data: body} = command;
    const format = options.format ?? config.defaultOutputFormat ?? 'markdown';
    const silent = options.silent ?? config.silent ?? false;

    if (action.type === 'delete' && !options.yes) {
        if (!await confirmDelete(format, options.id?.length ?? 0)) {
            return;
        }
    }

    if (!command.id && (action.type === 'delete' || action.type === 'update' || action.type === 'action')) {
        throw new ZentaoError('E2009', { option: 'id', reason: '必须提供要操作的对象 ID' });
    }

    const result = await client.request(action.method, path, { query, body });
    if (silent) {
        return;
    }

    const data = extractResult(action, result);
    const output = formatOutput(data, { format, isList: false, fields: options.pick?.split(','), jsonPretty: config.jsonPretty });

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

    /** 批量操作时，如果 id 是数组，则遍历每个 ID 执行操作，如果出错则停止 */
    if (Array.isArray(options.id)) {
        if (options.id.length > 1) {
            for (const id of options.id) {
                let error: Error | undefined;
                try {
                    await handleModuleCommand(client, module, actionName, args, profile, { ...options, id });
                } catch (error) {
                    error = error as Error;
                }
                if (error) {
                    if (batchFailFast) {
                        throw error;
                    }
                    console.error(renderError(error, format));
                }
            }

            return;
        }
        options.id = options.id[0];
    }

    const command = resolveModuleCommand(module, actionName, options, args);
    console.log('> handleActionCommand', module.name, command.action.name, {options, args, path: command.path, query: command.query, params: command.params, data: command.data})
    switch (command.action.type) {
        case 'list': {
            await handleListCommand(client, module, command, options, config);
            break;
        }
        case 'get': {
            await handleGetCommand(client, module, command, options, config);
            break;
        }
        case 'create':
        case 'update':
        case 'delete':
        case 'action': {
            await handleActionCommand(client, module, command, options, config);
            break;
        }
    }
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
        { name: 'filter', placeholder: 'expr', description: '过滤条件，格式: field=value 或 field!=value，可多次指定，适用于 list 操作' },
        { name: 'sort', placeholder: 'expr', description: '客户端排序，格式: field_asc 或 field_desc，适用于 list 操作' },
        { name: 'search', placeholder: 'keywords', description: '搜索关键词，可多次指定，适用于 list 操作' },
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
 * 1. 根据 action 中的 params、pathParams 和 requestBody 定义生成 API 参数名称
 * 2. ModuleActionOptions 中定义的公共参数，需要注意的是根据操作类型不同，有些选项可能不适用
 */
export function showModuleActionHelp(mod: ModuleDefinition, action: ModuleAction): void {
    console.log(action.display ?? `${mod.display ?? mod.name} ${action.name}`);
    if (action.description && action.description !== action.display) {
        console.log(`描述: ${action.description}`);
    }
    console.log(`HTTP: ${action.method.toUpperCase()} ${action.path}`);

    const apiParams: ParamEntry[] = [];

    if (action.pathParams) {
        for (const [key, def] of Object.entries(action.pathParams)) {
            if (key === 'scope' || key === 'scopeID') continue;
            if (key.endsWith('ID')) {
                apiParams.push({
                    name: 'id',
                    placeholder: 'number',
                    description: typeof def === 'string' ? def : def.description ?? `${mod.display ?? mod.name} ID`,
                    required: true,
                });
                continue;
            }
            const isObj = typeof def === 'object';
            apiParams.push({
                name: key,
                placeholder: typePlaceholder(isObj && def.type ? def.type : 'string'),
                description: typeof def === 'string' ? def : def.description ?? key,
                required: isObj ? def.required : undefined,
                defaultValue: isObj ? def.defaultValue : undefined,
                options: isObj ? def.options : undefined,
            });
        }
    }

    if (action.params?.length) {
        for (const param of action.params) {
            apiParams.push({
                name: param.name,
                placeholder: typePlaceholder(param.type ?? 'string'),
                description: param.description ?? param.name,
                required: param.required,
                defaultValue: param.defaultValue,
                options: param.options,
            });
        }
    }

    if (action.requestBody?.schema) {
        const schema = action.requestBody.schema as {
            properties?: Record<string, { type?: string; description?: string; items?: { type?: string }; format?: string; defaultValue?: unknown }>;
            required?: string[];
        };
        if (schema.properties) {
            const requiredSet = new Set(schema.required ?? []);
            for (const [key, prop] of Object.entries(schema.properties)) {
                apiParams.push({
                    name: key,
                    placeholder: typePlaceholder(prop.type ?? 'string', prop.items?.type),
                    description: prop.description ?? key,
                    required: requiredSet.has(key),
                    defaultValue: prop.defaultValue,
                });
            }
        }
    }

    const needsBody = action.type === 'create' || action.type === 'update' || action.type === 'action';
    if (needsBody) {
        apiParams.push({ name: 'data', placeholder: 'json', description: '请求数据（完整 JSON 对象），可替代以上逐个字段传参' });
    }
    apiParams.push({ name: 'params', placeholder: 'json', description: 'API 调用参数（JSON 对象），可替代以上逐个 --key=value 传参' });
    apiParams.push({ name: 'options', placeholder: 'json', description: 'CLI 调用选项（JSON 对象），可替代以下公共选项' });

    if (apiParams.length > 0) {
        console.log('\nAPI 参数:');
        printParamEntries(apiParams);
    }

    if (action.pathParams && ('scope' in action.pathParams)) {
        const scopeDef = action.pathParams.scope;
        const contextEntries: ParamEntry[] = [];
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
        console.log('\n上下文参数（必须指定其一）:');
        printParamEntries(contextEntries);
    }

    const commonOpts: ParamEntry[] = [];
    if (action.resultType === 'list' || action.type === 'list') {
        commonOpts.push(
            { name: 'pick', placeholder: 'fields', description: '摘取指定字段（逗号分隔），仅输出指定的字段' },
            { name: 'filter', placeholder: 'expr', description: '过滤条件，格式: field=value 或 field!=value，可多次指定' },
            { name: 'sort', placeholder: 'expr', description: '客户端排序，格式: field_asc 或 field_desc' },
            { name: 'search', placeholder: 'keywords', description: '搜索关键词，可多次指定' },
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
    options?: { value: unknown; label: string }[];
};

function typePlaceholder(type: string, itemsType?: string): string | undefined {
    if (type === 'number' || type === 'integer') return 'number';
    if (type === 'boolean') return undefined;
    if (type === 'array') return itemsType ? `${itemsType}[]` : 'array';
    return 'string';
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
