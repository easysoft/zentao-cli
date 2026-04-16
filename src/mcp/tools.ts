import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MODULES } from '../modules/registry.js';
import type { ModuleDefinition, ModuleAction } from '../types/index.js';
import { resolveModuleCommand, extractResult, extractPager } from '../modules/resolver.js';
import { convertHtmlFields, convertHtmlFieldsInArray } from '../utils/html.js';
import { filterData, sortData, searchData, pickFields, pickFieldsSingle } from '../utils/data.js';
import { ZentaoError } from '../errors.js';
import type { AuthProvider } from './server.js';

function buildToolDescription(mod: ModuleDefinition): string {
    const actions = mod.actions.map(a => a.name);
    const parts: string[] = [];
    if (mod.description) {
        parts.push(mod.description);
    } else {
        parts.push(`${mod.display ?? mod.name} 管理`);
    }
    parts.push(`支持操作: ${actions.join(', ')}`);

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
            `${a.name}: ${a.display ?? a.name}`
        ).join('; ')),
        id: z.number().optional().describe('对象 ID（get/update/delete 及扩展操作必填）'),
        product: z.number().optional().describe('产品 ID（范围参数）'),
        project: z.number().optional().describe('项目 ID（范围参数）'),
        execution: z.number().optional().describe('执行 ID（范围参数）'),
        params: z.record(z.unknown()).optional().describe('API 参数键值对，用于传递操作所需字段（如 title, severity 等）'),
        pick: z.string().optional().describe('摘取字段（逗号分隔）'),
        filter: z.array(z.string()).optional().describe('过滤条件（如 status:active, severity<=2）'),
        sort: z.string().optional().describe('排序（如 pri_asc, severity_desc）'),
        search: z.array(z.string()).optional().describe('搜索关键词'),
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

async function handleModuleTool(
    mod: ModuleDefinition,
    input: ToolInput,
    auth: AuthProvider,
): Promise<CallToolResult> {
    const client = await auth.getClient();
    const actionName = input.action;

    const opts: Record<string, unknown> = {
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

    const command = resolveModuleCommand(mod, actionName, opts as any, []);

    const result = await client.request(command.action.method, command.path, {
        query: command.query,
        body: command.data,
    });

    if (command.action.type === 'list') {
        let data = extractResult(command.action, result) as Record<string, unknown>[];
        const pager = extractPager(command.action, result);

        data = convertHtmlFieldsInArray(data);

        if (input.filter?.length) {
            data = filterData(data, input.filter);
        }
        if (input.search?.length) {
            data = searchData(data, input.search, input.searchFields?.split(','));
        }
        if (input.sort) {
            data = sortData(data, input.sort);
        }

        const fields = input.pick?.split(',');
        if (fields) {
            data = pickFields(data, fields);
        }

        const response: Record<string, unknown> = { data };
        if (pager) response.pager = pager;
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }

    if (command.action.type === 'get') {
        let data = (extractResult(command.action, result) ?? result) as Record<string, unknown>;
        data = convertHtmlFields(data);

        const fields = input.pick?.split(',');
        if (fields) {
            data = pickFieldsSingle(data, fields);
        }

        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    // create / update / delete / action
    const data = extractResult(command.action, result);
    return { content: [{ type: 'text', text: JSON.stringify(data ?? result, null, 2) }] };
}

function toolAnnotations(action: ModuleAction) {
    const readOnly = action.type === 'list' || action.type === 'get';
    return {
        readOnlyHint: readOnly,
        destructiveHint: action.type === 'delete',
        openWorldHint: true,
    };
}

export function registerModuleTools(server: McpServer, auth: AuthProvider): void {
    for (const mod of MODULES) {
        const name = `zentao_${mod.name}`;
        const description = buildToolDescription(mod);
        const inputSchema = buildInputSchema(mod);

        const representativeAction = mod.actions[0];
        const annotations = toolAnnotations(representativeAction);

        server.tool(name, description, inputSchema, annotations, async (input) => {
            try {
                return await handleModuleTool(mod, input as ToolInput, auth);
            } catch (error) {
                if (error instanceof ZentaoError) {
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `E${error.code}: ${error.message}` }],
                    };
                }
                return {
                    isError: true,
                    content: [{ type: 'text', text: (error as Error).message ?? String(error) }],
                };
            }
        });
    }
}
