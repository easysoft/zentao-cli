import { z } from 'zod';
import { getModuleActionParams, request } from 'zentao-api';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAction, getAllModules, getModule } from '../modules/helper.js';
import type { ModuleDefinition, ModuleAction, ModuleActionOptions } from '../types/index.js';
import { executeModuleCommand } from '../modules/executor.js';
import { ZentaoError } from '../errors.js';
import type { AuthProvider } from './server.js';
import { findProfileByKey, getProfileConfig, profileKey } from '../config/store.js';
import { withRequestSignal } from '../api/index.js';
import { normalizeToolParams } from './params.js';
import { listOutputSchema, outputSchema, toolError, toolResult } from './results.js';

export interface McpToolOptions {
    readOnly?: boolean;
    modules?: string[];
    splitTools?: boolean;
}

function isReadAction(action: ModuleAction): boolean {
    return (action.type === 'list' || action.type === 'get') && (action.method ?? 'get').toLowerCase() === 'get';
}

function buildToolDescription(mod: ModuleDefinition): string {
    return `${mod.display ?? mod.name}操作；参数、示例和最低版本见 zentao_action_help`;
}

function buildActionEnum(mod: ModuleDefinition): [string, ...string[]] {
    const names = mod.actions.map(a => a.name);
    return [names[0], ...names.slice(1)];
}

function buildInputSchema(mod: ModuleDefinition) {
    const actionEnum = buildActionEnum(mod);
    const parameters = mod.actions.flatMap(action => getModuleActionParams(mod.name, action.name));
    const names = new Set(parameters.map(param => param.name));
    const shape: Record<string, z.ZodType> = {
        action: z.enum(actionEnum).describe(mod.actions.map(action => `${action.name}: ${action.display ?? action.name}`).join('; ')),
        params: z.record(z.string(), z.unknown()).optional().describe('路径、查询或请求体参数；必填项见 zentao_action_help'),
    };
    if (parameters.some(param => param.role === 'path' && param.name.endsWith('ID') && param.name !== 'scopeID')) {
        shape.id = z.number().int().nonnegative().optional().describe('首个路径 ID 简写；多 ID 用 params');
    }
    for (const name of ['product', 'project', 'execution']) {
        if (names.has(name) || names.has(`${name}ID`) || parameters.some(param => param.name === 'scope' && param.options?.some(option => option.value === `${name}s`))) {
            shape[name] = z.number().int().nonnegative().optional().describe(`${name}ID 或 scope/scopeID 简写，冲突时报错`);
        }
    }
    if (mod.actions.some(action => action.type === 'list' || action.type === 'get')) {
        shape.pick = z.string().optional().describe('返回字段，逗号分隔');
    }
    if (mod.actions.some(action => action.type === 'list')) {
        shape.filter = z.array(z.string()).optional().describe('当前页过滤，组内逗号为 AND、多组为 OR；远端筛选见 params.filters');
        shape.sort = z.string().optional().describe('当前页排序，如 pri:asc');
        shape.search = z.array(z.string()).optional().describe('当前页搜索，组内逗号为 AND、多组为 OR');
        shape.searchFields = z.string().optional().describe('搜索字段，逗号分隔');
    }
    if (names.has('pageID')) shape.page = z.number().int().positive().optional().describe('页码，从 1 开始');
    if (names.has('recPerPage')) shape.recPerPage = z.number().int().min(1).max(1000).optional().describe('每页 1–1000 条');
    return z.object(shape).strict();
}

/** Examples use typed placeholders, not real object IDs or ready-to-submit business data. */
function actionExample(mod: ModuleDefinition, action: ModuleAction, splitTools?: boolean) {
    const params = Object.fromEntries(getModuleActionParams(mod.name, action.name)
        .filter(param => param.required && param.defaultValue === undefined)
        .map(param => [param.name, param.type === 'array' ? [] : param.options?.[0]?.value
            ?? (param.type === 'number' || (param.role === 'path' && param.name.endsWith('ID')) ? 1
                : param.type === 'boolean' ? false : param.type === 'object' ? {} : `<${param.name}>`)]));
    return {
        name: `zentao_${mod.name}${splitTools ? isReadAction(action) ? '_read' : '_write' : ''}`,
        arguments: { action: action.name, ...(Object.keys(params).length ? { params } : {}) },
        note: 'ID、文本等均为格式示例，请替换为实际值后调用。',
    };
}

interface ToolInput {
    action: string;
    id?: number;
    product?: number;
    project?: number;
    execution?: number;
    params?: Record<string, unknown>;
    pick?: string;
    filter?: string[];
    sort?: string;
    search?: string[];
    searchFields?: string;
    page?: number;
    recPerPage?: number;
}

async function handleProfileTool(auth: AuthProvider, signal?: AbortSignal): Promise<CallToolResult> {
    const { client, profile } = await auth.getContext();
    const scopedClient = withRequestSignal(client, signal);
    let user: Record<string, unknown> | undefined;
    let previousPage: string | undefined;
    for (let pageID = 1; ; pageID++) {
        const response = await request('user/list', {
            browseType: 'inside', orderBy: 'id_asc', recPerPage: 100, pageID,
            filters: [{ field: 'account', operator: '=', value: profile.account }],
        }, { client: scopedClient, throwOnFail: true });
        const users = Array.isArray(response.data) ? response.data as Record<string, unknown>[] : [];
        user = users.find(item => item.account === profile.account);
        if (user || !users.length) break;
        // Older servers may ignore filters; continue paging without silently truncating.
        const page = JSON.stringify(users.map(item => [item.id, item.account]));
        if (page === previousPage || (response.pager && response.pager.page !== pageID)) {
            throw new ZentaoError('E2008', { url: profile.server, status: '', serverResponse: '用户列表分页未向前推进，无法确认当前用户详情' });
        }
        previousPage = page;
        if (response.pager
            ? pageID * response.pager.recPerPage >= response.pager.total
            : users.length < 100) break;
    }
    const identity = {
        account: profile.account,
        server: profile.server,
        userFound: Boolean(user),
        user: user ? Object.fromEntries(['id', 'account', 'realname', 'dept', 'role']
            .filter(key => user![key] !== undefined).map(key => [key, user![key]])) : null,
    };

    return toolResult(identity);
}

interface SwitchProfileInput {
    profileKey: string;
}

async function handleSwitchProfileTool(input: SwitchProfileInput, auth: AuthProvider): Promise<CallToolResult> {
    const profile = findProfileByKey(input.profileKey);
    if (!profile) {
        throw new ZentaoError('E1007');
    }

    const { profile: current } = await auth.getContext(profile);
    const currentKey = profileKey(current.account, current.server);
    return toolResult({ status: 'success', currentProfile: currentKey });
}

async function handleModuleTool(
    mod: ModuleDefinition,
    input: ToolInput,
    auth: AuthProvider,
    signal?: AbortSignal,
): Promise<CallToolResult> {
    const action = getAction(mod, input.action);
    if (!action) throw new ZentaoError('E2005', { module: mod.name });
    for (const option of ['filter', 'sort', 'search', 'searchFields', 'pick'] as const) {
        if (input[option] !== undefined && action.type !== 'list' && !(option === 'pick' && action.type === 'get')) {
            throw new ZentaoError('E2009', { option, reason: `不适用于 ${mod.name}/${action.name}` });
        }
    }
    const params = normalizeToolParams(mod, action, input);
    const { client, profile } = await auth.getContext();
    const config = getProfileConfig(profile);
    const actionName = input.action;

    const opts: ModuleActionOptions = {
        pick: input.pick,
        filter: input.filter,
        sort: input.sort,
        search: input.search,
        searchFields: input.searchFields,
        recPerPage: input.recPerPage != null ? String(input.recPerPage) : undefined,
        format: 'json',
    };

    const execution = await executeModuleCommand(withRequestSignal(client, signal), mod, actionName, [], opts, config, params);

    if (execution.action.type === 'list') {
        return toolResult(execution.data, {
            ...(execution.pager ? { pager: execution.pager } : {}),
            meta: {
                processingScope: 'page',
                returnedCount: Array.isArray(execution.data) ? execution.data.length : 0,
                ...(execution.pager ? { totalScope: 'serverBeforeLocalProcessing' } : {}),
            },
        });
    }

    if (execution.action.type === 'get') {
        return toolResult(execution.data);
    }

    // create / update / delete / action
    return toolResult(execution.data ?? execution.rawResponse);
}

function toolAnnotations(actions: readonly ModuleAction[]) {
    const readOnly = actions.every(isReadAction);
    const destructive = actions.some(action => ['update', 'delete', 'action'].includes(action.type));
    return {
        readOnlyHint: readOnly,
        destructiveHint: destructive,
        openWorldHint: true,
    };
}

export function registerModuleTools(server: McpServer, auth: AuthProvider, options: McpToolOptions = {}): void {
    const selectedModules = options.modules ? [...new Set(options.modules)].map(name => {
        const mod = getModule(name);
        if (!mod) throw new ZentaoError('E2001', { module: name });
        return mod;
    }) : getAllModules();
    if (!selectedModules.length) throw new ZentaoError('E2009', { option: 'modules', reason: '至少指定一个模块' });

    server.registerTool(
        'zentao_action_help',
        {
            description: '查看禅道操作的路径、参数定义和最低版本要求，无需登录；调用业务工具前可按需查询',
            inputSchema: z.object({ module: z.string().describe('模块名，如 doc、story'), action: z.string().describe('操作名，如 createMyDoc、getGrades') }).strict(),
            outputSchema,
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        },
        async ({ module, action }) => {
            try {
                const mod = getModule(module);
                if (!mod) throw new ZentaoError('E2001', { module });
                const definition = getAction(mod, action);
                if (!definition) throw new ZentaoError('E2005', { module: mod.name });
                return toolResult({
                    module: mod.name,
                    action: definition.name,
                    display: definition.display,
                    type: definition.type,
                    path: definition.path,
                    minVersion: definition.minVersion,
                    parameters: getModuleActionParams(mod.name, definition.name),
                    available: selectedModules.some(selected => selected.name === mod.name) && (!options.readOnly || isReadAction(definition)),
                    example: actionExample(mod, definition, options.splitTools),
                });
            } catch (error) {
                return toolError(error, { module, action });
            }
        },
    );

    server.registerTool(
        'zentao_profile',
        {
            description: '获取当前 MCP 绑定的账号和站点，并查询远端用户详情；userFound=false 表示未找到详情，服务端失败会报错',
            inputSchema: z.object({}).strict(),
            outputSchema,
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
        },
        async (_input, extra) => {
            try {
                return await handleProfileTool(auth, extra.signal);
            } catch (error) {
                return toolError(error, { module: 'user', action: 'list' });
            }
        },
    );

    if (!options.readOnly) server.registerTool(
        'zentao_switch_profile',
        {
            description: '切换当前 MCP 实例的登录账号，不改变 CLI 或其他 MCP 实例的账号',
            inputSchema: z.object({ profileKey: z.string().describe('目标用户配置标识，支持 account@server、account 或 account@hostname') }).strict(),
            outputSchema,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
        },
        async (input) => {
            try {
                return await handleSwitchProfileTool(input as SwitchProfileInput, auth);
            } catch (error) {
                return toolError(error);
            }
        },
    );

    for (const source of new Set(selectedModules)) {
        const actions = options.readOnly ? source.actions.filter(isReadAction) : source.actions;
        const groups = options.splitTools
            ? [{ suffix: '_read', actions: actions.filter(isReadAction) }, { suffix: '_write', actions: actions.filter(action => !isReadAction(action)) }]
            : [{ suffix: '', actions }];
        for (const group of groups) {
            if (!group.actions.length) continue;
            const mod = { ...source, actions: group.actions };
            const name = `zentao_${mod.name}${group.suffix}`;
            const description = buildToolDescription(mod);
            const inputSchema = buildInputSchema(mod);
            const annotations = toolAnnotations(mod.actions);

            server.registerTool(name, { description, inputSchema, outputSchema: mod.actions.some(action => action.type === 'list') ? listOutputSchema : outputSchema, annotations }, async (raw, extra) => {
                const input = raw as unknown as ToolInput;
                try {
                    // Keep full module metadata for autoFill, but enforce this tool's subset.
                    if (!group.actions.some(action => action.name === input.action)) throw new ZentaoError('E2006');
                    return await handleModuleTool(source, input as ToolInput, auth, extra.signal);
                } catch (error) {
                    return toolError(error, { module: mod.name, action: input.action });
                }
            });
        }
    }
}
