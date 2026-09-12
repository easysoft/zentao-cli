import { z } from 'zod';
import { getModuleActionParams } from 'zentao-api';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAction, getActionDescription, getAllModules, getModule } from '../modules/helper.js';
import type { ModuleDefinition, ModuleAction, ModuleActionOptions } from '../types/index.js';
import { executeModuleCommand } from '../modules/executor.js';
import { ZentaoError } from '../errors.js';
import type { AuthProvider } from './server.js';
import { findProfileByKey, getProfileConfig, profileKey } from '../config/store.js';

function buildToolDescription(mod: ModuleDefinition): string {
    const actions = mod.actions.map(a => a.name);
    const parts: string[] = [];
    if (mod.description) {
        parts.push(mod.description);
    } else {
        parts.push(`${mod.display ?? mod.name} 管理`);
    }
    parts.push(`支持操作: ${actions.join(', ')}`);
    parts.push('使用 zentao_action_help 查看操作参数与最低版本，调用前自动校验当前服务器版本');

    const listAction = mod.actions.find(a => a.type === 'list');
    if (listAction?.pathParams && 'scope' in listAction.pathParams) {
        const scopeDef = listAction.pathParams.scope;
        if (typeof scopeDef === 'object' && scopeDef.options) {
            const scopes = scopeDef.options.map((o: { value: unknown; label: string }) =>
                `--${String(o.value).replace(/s$/, '')}`
            );
            parts.push(`列表范围参数: ${scopes.join(', ')}`);
        } else {
            parts.push('列表范围参数: --product, --project, --execution');
        }
    }

    return parts.join('。');
}

function buildActionEnum(mod: ModuleDefinition): [string, ...string[]] {
    const names = mod.actions.map(a => a.name);
    return [names[0], ...names.slice(1)];
}

function buildInputSchema(mod: ModuleDefinition) {
    const actionEnum = buildActionEnum(mod);
    return {
        action: z.enum(actionEnum).describe('要执行的操作。' + mod.actions.map(a =>
            `${a.name}: ${getActionDescription(a)}`
        ).join('; ')),
        id: z.number().optional().describe('首个路径 ID 的简写；是否必填取决于操作，有多个路径参数时通过 params 分别传入'),
        product: z.number().optional().describe('产品 ID（范围参数）'),
        project: z.number().optional().describe('项目 ID（范围参数）'),
        execution: z.number().optional().describe('执行 ID（范围参数）'),
        params: z.record(z.string(), z.unknown()).optional().describe('API 路径、查询和请求体参数（如 spaceID、libID、title、contentType）；通过 zentao_action_help 查看完整定义'),
        pick: z.string().optional().describe('摘取字段（逗号分隔）'),
        filter: z.array(z.string()).optional().describe('过滤条件组（组内逗号分隔为 AND，多组为 OR，如 status=active,severity<=2）'),
        sort: z.string().optional().describe('排序（如 pri:asc,severity:desc；兼容下划线写法）'),
        search: z.array(z.string()).optional().describe('搜索关键词组（组内逗号分隔为 AND，多组为 OR）'),
        searchFields: z.string().optional().describe('搜索字段（逗号分隔），配合 search 使用'),
        page: z.number().optional().describe('页码'),
        recPerPage: z.number().optional().describe('每页条数'),
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

async function handleProfileTool(auth: AuthProvider): Promise<CallToolResult> {
    const { client, profile } = await auth.getContext();
    const account = profile.account;

    const usersResp = await client.get<Record<string, unknown>>('/users', {
        query: { browseType: 'inside', recPerPage: 100 },
    });

    const usersRaw = (usersResp as Record<string, unknown>).users;
    const users = Array.isArray(usersRaw) ? usersRaw as Array<Record<string, unknown>> : [];
    const user = account
        ? users.find((item) => String(item.account ?? '') === account)
        : undefined;

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(user ?? profile.user ?? {}, null, 2),
        }],
    };
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
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                status: 'success',
                currentProfile: currentKey,
            }, null, 2),
        }],
    };
}

async function handleModuleTool(
    mod: ModuleDefinition,
    input: ToolInput,
    auth: AuthProvider,
): Promise<CallToolResult> {
    const { client, profile } = await auth.getContext();
    const config = getProfileConfig(profile);
    const actionName = input.action;

    const opts: ModuleActionOptions = {
        id: input.id != null ? String(input.id) : undefined,
        product: input.product != null ? String(input.product) : undefined,
        project: input.project != null ? String(input.project) : undefined,
        execution: input.execution != null ? String(input.execution) : undefined,
        params: input.params ? JSON.stringify(input.params) : undefined,
        pick: input.pick,
        filter: input.filter,
        sort: input.sort,
        search: input.search,
        searchFields: input.searchFields,
        page: input.page != null ? String(input.page) : undefined,
        recPerPage: input.recPerPage != null ? String(input.recPerPage) : undefined,
        format: 'json',
        yes: true,
    };

    const execution = await executeModuleCommand(client, mod, actionName, [], opts, config);

    if (execution.action.type === 'list') {
        const response: Record<string, unknown> = { data: execution.data };
        if (execution.pager) response.pager = execution.pager;
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }

    if (execution.action.type === 'get') {
        return { content: [{ type: 'text', text: JSON.stringify(execution.data, null, 2) }] };
    }

    // create / update / delete / action
    return { content: [{ type: 'text', text: JSON.stringify(execution.data ?? execution.rawResponse, null, 2) }] };
}

function toolAnnotations(actions: readonly ModuleAction[]) {
    const readOnly = actions.every(action => action.type === 'list' || action.type === 'get');
    const destructive = actions.some(action => action.type === 'delete');
    return {
        readOnlyHint: readOnly,
        destructiveHint: destructive,
        openWorldHint: true,
    };
}

function toolError(error: unknown): CallToolResult {
    return {
        isError: true,
        content: [{
            type: 'text',
            text: error instanceof ZentaoError
                ? `E${error.code}: ${error.message}`
                : error instanceof Error ? error.message : String(error),
        }],
    };
}

export function registerModuleTools(server: McpServer, auth: AuthProvider): void {
    server.tool(
        'zentao_action_help',
        '查看禅道操作的路径、参数定义和最低版本要求，无需登录；调用业务工具前可按需查询',
        { module: z.string().describe('模块名，如 doc、story'), action: z.string().describe('操作名，如 createMyDoc、getGrades') },
        { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
        async ({ module, action }) => {
            try {
                const mod = getModule(module);
                if (!mod) throw new ZentaoError('E2001', { module });
                const definition = getAction(mod, action);
                if (!definition) throw new ZentaoError('E2005', { module: mod.name });
                return { content: [{ type: 'text', text: JSON.stringify({
                    module: mod.name,
                    action: definition.name,
                    display: definition.display,
                    type: definition.type,
                    path: definition.path,
                    minVersion: definition.minVersion,
                    parameters: getModuleActionParams(mod.name, definition.name),
                }, null, 2) }] };
            } catch (error) {
                return toolError(error);
            }
        },
    );

    server.tool(
        'zentao_profile',
        '获取当前登录禅道账号信息',
        {},
        { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
        async () => {
            try {
                return await handleProfileTool(auth);
            } catch (error) {
                return toolError(error);
            }
        },
    );

    server.tool(
        'zentao_switch_profile',
        '切换当前登录账号（等价于 switch-profile）',
        {
            profileKey: z.string().describe('目标用户配置标识，支持 account@server、account 或 account@hostname'),
        },
        { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
        async (input) => {
            try {
                return await handleSwitchProfileTool(input as SwitchProfileInput, auth);
            } catch (error) {
                return toolError(error);
            }
        },
    );

    for (const mod of getAllModules()) {
        const name = `zentao_${mod.name}`;
        const description = buildToolDescription(mod);
        const inputSchema = buildInputSchema(mod);

        const annotations = toolAnnotations(mod.actions);

        server.tool(name, description, inputSchema, annotations, async (input) => {
            try {
                return await handleModuleTool(mod, input as ToolInput, auth);
            } catch (error) {
                return toolError(error);
            }
        });
    }
}
