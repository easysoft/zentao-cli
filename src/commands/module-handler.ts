import type { ZentaoClient } from '../api/client.js';
import type { ModuleDefinition, ModuleAction, Profile, ModuleActionName, ResolvedModuleCommand, UserConfig } from '../types/index.js';
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

/** 打印模块级内建帮助（与 `zentao <module> help` 对应） */
export function showModuleHelp(mod: ModuleDefinition): void {
    console.log(`模块: ${mod.display ?? mod.name}`);
    if (mod.description) console.log(`描述: ${mod.description}`);

    console.log(`\n操作:`);
    if (hasActionType(mod, 'list')) console.log(`  zentao ${mod.name}                    获取列表`);
    if (hasActionType(mod, 'get')) console.log(`  zentao ${mod.name} <id>               获取详情`);
    if (hasActionType(mod, 'create')) console.log(`  zentao ${mod.name} create [params]    创建`);
    if (hasActionType(mod, 'update')) console.log(`  zentao ${mod.name} update <id>        更新`);
    if (hasActionType(mod, 'delete')) console.log(`  zentao ${mod.name} delete <ids>       删除`);

    const actions = getAvailableActions(mod);
    if (actions.length > 0) {
        console.log(`\n扩展操作:`);
        for (const actionName of actions) {
            const action = findAction(mod, 'action', actionName);
            const display = action?.display ?? actionName;
            console.log(`  zentao ${mod.name} ${actionName} <id>     ${display}`);
        }
    }

    const listAction = findAction(mod, 'list');
    if (listAction?.pathParams) {
        const scopeParams = Object.entries(listAction.pathParams)
            .filter(([key]) => key !== 'scope' && key !== 'scopeID');
        const hasScopePattern = 'scope' in listAction.pathParams;

        if (hasScopePattern || scopeParams.length > 0) {
            console.log(`\n上下文参数:`);
            if (hasScopePattern) {
                const scopeDef = listAction.pathParams.scope;
                if (typeof scopeDef === 'object' && scopeDef.options) {
                    for (const opt of scopeDef.options) {
                        const singular = String(opt.value).replace(/s$/, '');
                        console.log(`  --${singular} <id>          ${opt.label}`);
                    }
                } else {
                    console.log(`  --product <id>          产品`);
                    console.log(`  --project <id>          项目`);
                    console.log(`  --execution <id>        执行`);
                }
            }
            for (const [key, def] of scopeParams) {
                const desc = typeof def === 'string' ? def : def.description ?? key;
                console.log(`  --${key} <id>          ${desc}`);
            }
        }
    }
}

export function showModuleActionHelp(mod: ModuleDefinition, action: ModuleAction): void {
    // TODO
}
