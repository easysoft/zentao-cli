/**
 * Reads data/zentao-openapi.json and generates src/modules/registry.ts
 * containing the ModuleDefinition[] array used by the CLI.
 *
 * Usage:  bun run scripts/update-registry.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Types for the OpenAPI subset we care about
// ---------------------------------------------------------------------------

interface OpenAPIParam {
    name: string;
    in: string;
    description?: string;
    required?: boolean;
    schema?: { type?: string };
}

interface OpenAPIOperation {
    tags?: string[];
    summary?: string;
    description?: string;
    parameters?: OpenAPIParam[];
    requestBody?: {
        required?: boolean;
        content?: {
            'application/json'?: {
                schema?: Record<string, unknown>;
                example?: unknown;
            };
        };
    };
    responses?: Record<string, {
        description?: string;
        content?: {
            'application/json'?: {
                schema?: Record<string, unknown>;
                example?: unknown;
            };
        };
    }>;
}

interface OpenAPIDoc {
    tags: { name: string; description: string }[];
    paths: Record<string, Record<string, OpenAPIOperation>>;
}

// ---------------------------------------------------------------------------
// Chinese display name mapping for tags
// ---------------------------------------------------------------------------

const TAG_DISPLAY: Record<string, string> = {
    user: '用户',
    program: '项目集',
    product: '产品',
    project: '项目',
    execution: '执行',
    productplan: '产品计划',
    story: '需求',
    epic: '业务需求',
    requirement: '用户需求',
    bug: 'Bug',
    testcase: '测试用例',
    task: '任务',
    feedback: '反馈',
    ticket: '工单',
    system: '应用',
    build: '版本',
    testtask: '测试单',
    release: '发布',
    file: '附件',
};

const SCOPE_LABELS: Record<string, string> = {
    products: '产品',
    projects: '项目',
    executions: '执行',
    programs: '项目集',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert `:paramName` to `{paramName}` */
function colonToBrace(path: string): string {
    return path.replace(/:(\w+)/g, '{$1}');
}

/** Extract param names from a colon-style path */
function extractColonParams(path: string): string[] {
    const matches = path.matchAll(/:(\w+)/g);
    return [...matches].map(m => m[1]);
}

/** Determine the "resource name" (last non-param segment) for a path */
function resourceSegment(path: string): string {
    const segments = path.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
        if (!segments[i].startsWith(':')) return segments[i];
    }
    return segments[0] ?? '';
}

const PARAM_DESCRIPTION: Record<string, string> = {
    userID: '用户ID',
    programID: '项目集ID',
    productID: '产品ID',
    projectID: '项目ID',
    executionID: '执行ID',
    productplanID: '产品计划ID',
    planID: '产品计划ID',
    storyID: '需求ID',
    epicID: '业务需求ID',
    requirementID: '用户需求ID',
    bugID: 'Bug ID',
    caseID: '测试用例ID',
    testcasID: '测试用例ID',
    taskID: '任务ID',
    feedbackID: '反馈ID',
    ticketID: '工单ID',
    systemID: '应用ID',
    buildID: '版本ID',
    testtaskID: '测试单ID',
    releasID: '发布ID',
    fileID: '附件ID',
};

/** Get a Chinese description from a param name */
function paramDescription(paramName: string): string {
    return PARAM_DESCRIPTION[paramName] ?? paramName;
}

/**
 * Parse option/default-value hints from an OpenAPI description string.
 *
 * Patterns handled:
 *   "状态，默认是unclosed。(all 全部 | unclosed 未关闭 | ...)"
 *   "排序(id_asc | title_asc 标题 | ...)，倒序使用id_desc, ..."
 *   "内部用户 inside | 外部用户 outside"  (bare, label-first)
 *
 * Falls back gracefully: if no pattern matches, returns the raw string.
 */
function parseDescriptionOptions(raw: string): {
    description: string;
    defaultValue?: string;
    options?: { value: string; label: string }[];
} {
    try {
        let description = raw;
        let defaultValue: string | undefined;
        let options: { value: string; label: string }[] | undefined;

        // Extract default value: "默认是XXX" / "默认XXX"
        const defaultMatch = raw.match(/默认(?:是|为)?\s*(\S+?)(?:[。，,.)\uff09\s]|$)/);
        if (defaultMatch) {
            defaultValue = defaultMatch[1];
        }

        // Try parenthesized options: "(val1 label1 | val2 label2)"
        const parenMatch = raw.match(/[(\uff08]([^)\uff09]+)[)\uff09]/);
        if (parenMatch) {
            const parsed = parsePipeOptions(parenMatch[1]);
            if (parsed.length >= 2) {
                options = parsed;
                const idx = raw.indexOf(parenMatch[0]);
                description = raw.slice(0, idx).replace(/[,，。\s]+$/, '');
            }
        }

        // Bare pipe-delimited (no parens): "val label | val label" or "label val | label val"
        if (!options && raw.includes('|') && !raw.includes('(')) {
            const parsed = parsePipeOptions(raw);
            if (parsed.length >= 2) {
                options = parsed;
                description = '';
            }
        }

        // For orderBy: expand asc options with desc counterparts
        if (options) {
            const descMatch = raw.match(/倒序使用\s*([\w_]+(?:\s*,\s*[\w_]+)*)/);
            if (descMatch) {
                const descValues = descMatch[1].split(/\s*,\s*/);
                const expanded: { value: string; label: string }[] = [];
                for (const opt of options) {
                    const baseLabel = (opt.label === opt.value) ? opt.value.replace(/_asc$/, '').toUpperCase() : opt.label;
                    expanded.push({ value: opt.value, label: `${baseLabel} 升序` });
                    const descVal = descValues.find(d => d.replace('_desc', '') === opt.value.replace('_asc', ''));
                    if (descVal) {
                        expanded.push({ value: descVal, label: `${baseLabel} 降序` });
                    }
                }
                if (expanded.length > options.length) {
                    options = expanded;
                }
            }
        }

        const finalDesc = description.trim();
        return { description: finalDesc, defaultValue, options };
    } catch {
        return { description: raw };
    }
}

/** Parse "val1 label1 | val2 label2" or "label1 val1 | label2 val2" */
function parsePipeOptions(str: string): { value: string; label: string }[] {
    const parts = str.split('|').map(s => s.trim()).filter(Boolean);
    const parsed: { value: string; label: string }[] = [];

    for (const part of parts) {
        const m = part.match(/^(\S+)\s+(.+)$/);
        if (m) {
            const first = m[1];
            const second = m[2].trim();
            // Heuristic: if first looks like an identifier (ascii), it's the value
            if (/^[a-zA-Z_][\w]*$/.test(first)) {
                parsed.push({ value: first, label: second });
            } else if (/^[a-zA-Z_][\w]*$/.test(second)) {
                // Label-first pattern: "内部用户 inside"
                parsed.push({ value: second, label: first });
            } else {
                parsed.push({ value: first, label: second });
            }
        } else {
            // Single token, e.g. "id_asc" with no label
            const token = part.trim();
            if (token) {
                parsed.push({ value: token, label: token });
            }
        }
    }

    return parsed;
}

// ---------------------------------------------------------------------------
// Classify an OpenAPI operation into an action type
// ---------------------------------------------------------------------------

interface ClassifiedAction {
    name: string;
    type: 'list' | 'get' | 'create' | 'update' | 'delete' | 'action';
    method: 'get' | 'post' | 'put' | 'delete';
    resultType: 'text' | 'object' | 'list';
}

function classifyOperation(httpMethod: string, path: string, tag: string): ClassifiedAction {
    const method = httpMethod.toLowerCase() as ClassifiedAction['method'];
    const segments = path.split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    const secondLast = segments.length >= 2 ? segments[segments.length - 2] : '';

    // PUT /resources/:id/{verb} -> action
    if (method === 'put' && !lastSeg.startsWith(':') && secondLast.startsWith(':')) {
        return { name: lastSeg, type: 'action', method, resultType: 'text' };
    }

    // DELETE -> delete
    if (method === 'delete') {
        return { name: 'delete', type: 'delete', method, resultType: 'text' };
    }

    // POST -> create
    if (method === 'post') {
        return { name: 'create', type: 'create', method, resultType: 'object' };
    }

    // GET with last segment being a param -> get (detail)
    if (method === 'get' && lastSeg.startsWith(':')) {
        return { name: 'get', type: 'get', method, resultType: 'object' };
    }

    // GET collection (no trailing param) -> list
    if (method === 'get') {
        return { name: 'list', type: 'list', method, resultType: 'list' };
    }

    // PUT on item path -> update
    if (method === 'put') {
        return { name: 'update', type: 'update', method, resultType: 'object' };
    }

    return { name: httpMethod.toLowerCase(), type: 'action', method, resultType: 'text' };
}

// ---------------------------------------------------------------------------
// Infer resultGetter from the 200 response schema
// ---------------------------------------------------------------------------

function inferResultGetter(op: OpenAPIOperation, actionType: string): string | undefined {
    const schema = op.responses?.['200']?.content?.['application/json']?.schema as Record<string, unknown> | undefined;
    if (!schema) return undefined;
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) return undefined;

    if (actionType === 'list') {
        // Find the array property (excluding 'status')
        for (const [key, val] of Object.entries(props)) {
            if (key === 'status') continue;
            if (val?.type === 'array') return key;
        }
    }

    if (actionType === 'get') {
        // Find the first non-status object/non-primitive property
        for (const [key, val] of Object.entries(props)) {
            if (key === 'status' || key === 'id') continue;
            if (val?.type === 'object') return key;
        }
        // Fallback: any non-status key that is not 'id'
        for (const key of Object.keys(props)) {
            if (key !== 'status' && key !== 'id') return key;
        }
    }

    return undefined;
}

// ---------------------------------------------------------------------------
// Build params from OpenAPI parameters
// ---------------------------------------------------------------------------

interface RegistryParam {
    name: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean';
    description: string;
    defaultValue?: string;
    options?: { value: string; label: string }[];
}

function buildParams(parameters: OpenAPIParam[] | undefined): RegistryParam[] | undefined {
    if (!parameters || parameters.length === 0) return undefined;
    const queryParams = parameters.filter(p => p.in === 'query');
    if (queryParams.length === 0) return undefined;

    const PARAM_DESC_FALLBACK: Record<string, string> = {
        browseType: '浏览类型',
        orderBy: '排序',
        status: '状态',
        recPerPage: '每页数量',
        pageID: '页码',
    };

    return queryParams.map(p => {
        const parsed = parseDescriptionOptions(p.description ?? p.name);
        const desc = parsed.description || PARAM_DESC_FALLBACK[p.name] || p.name;
        const param: RegistryParam = {
            name: p.name,
            required: p.required ?? false,
            type: (p.name === 'recPerPage' || p.name === 'pageID') ? 'number' : 'string',
            description: desc,
        };
        if (parsed.defaultValue !== undefined) param.defaultValue = parsed.defaultValue;
        if (parsed.options && parsed.options.length > 0) param.options = parsed.options;
        return param;
    });
}

// ---------------------------------------------------------------------------
// Build requestBody
// ---------------------------------------------------------------------------

interface RegistryRequestBody {
    required?: boolean;
    type: 'object';
    schema: Record<string, unknown>;
}

function buildRequestBody(op: OpenAPIOperation): RegistryRequestBody | undefined {
    const rb = op.requestBody;
    if (!rb) return undefined;
    const jsonContent = rb.content?.['application/json'];
    if (!jsonContent?.schema) return undefined;

    const result: RegistryRequestBody = {
        type: 'object',
        schema: jsonContent.schema,
    };
    if (rb.required) result.required = true;
    return result;
}

// ---------------------------------------------------------------------------
// Scoped list detection and merging
// ---------------------------------------------------------------------------

interface ScopedListInfo {
    parentResource: string; // e.g. 'products'
    parentParam: string;    // e.g. 'productID'
    childResource: string;  // e.g. 'bugs'
    originalPath: string;
    operation: OpenAPIOperation;
}

function parseScopedListPath(path: string): ScopedListInfo | null {
    // Pattern: /:parentResource/:parentParam/:childResource
    const match = path.match(/^\/(\w+)\/:(\w+)\/(\w+)$/);
    if (!match) return null;
    return {
        parentResource: match[1],
        parentParam: match[2],
        childResource: match[3],
        originalPath: path,
        operation: {} as OpenAPIOperation, // filled later
    };
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

function main() {
    const openapiPath = resolve(ROOT, 'data/zentao-openapi.json');
    const outputPath = resolve(ROOT, 'src/modules/registry.ts');

    const doc: OpenAPIDoc = JSON.parse(readFileSync(openapiPath, 'utf-8'));

    // Group operations by tag
    type OpEntry = { path: string; method: string; op: OpenAPIOperation };
    const tagOps = new Map<string, OpEntry[]>();

    for (const [path, methods] of Object.entries(doc.paths)) {
        for (const [method, op] of Object.entries(methods)) {
            const tag = op.tags?.[0];
            if (!tag || tag === 'Token') continue;
            const tagLower = tag.toLowerCase();
            if (!tagOps.has(tagLower)) tagOps.set(tagLower, []);
            tagOps.get(tagLower)!.push({ path, method, op });
        }
    }

    // Preserve tag ordering from the spec
    const tagOrder = doc.tags
        .map(t => t.name.toLowerCase())
        .filter(t => t !== 'token' && tagOps.has(t));

    const modules: string[] = [];

    for (const tagName of tagOrder) {
        const ops = tagOps.get(tagName)!;
        const display = TAG_DISPLAY[tagName] ?? tagName;

        // Separate scoped lists from direct operations
        const scopedLists: ScopedListInfo[] = [];
        const directOps: OpEntry[] = [];
        let topLevelListOp: OpEntry | undefined;

        for (const entry of ops) {
            const classification = classifyOperation(entry.method, entry.path, tagName);

            if (classification.type === 'list') {
                const scoped = parseScopedListPath(entry.path);
                if (scoped) {
                    scoped.operation = entry.op;
                    scopedLists.push(scoped);
                } else {
                    topLevelListOp = entry;
                    directOps.push(entry);
                }
            } else {
                directOps.push(entry);
            }
        }

        // Build actions - each entry is the lines BETWEEN { and } (not including the braces)
        const actionBodies: string[] = [];
        const actionDisplayNames: string[] = [];

        // If there are scoped lists and NO top-level list, merge them into one
        if (scopedLists.length > 0 && !topLevelListOp) {
            const first = scopedLists[0];
            const scopeOptions = scopedLists.map(s => ({
                value: s.parentResource,
                label: SCOPE_LABELS[s.parentResource] ?? s.parentResource,
            }));
            const resultGetter = inferResultGetter(first.operation, 'list');
            const params = buildParams(first.operation.parameters);
            const summary = first.operation.summary ?? `获取${display}列表`;

            const scopeDisplayParts = scopeOptions.map(o => o.label).join('/');
            const listDisplay = `获取${display}列表，支持获取${scopeDisplayParts}下的${display}`;

            actionDisplayNames.push(listDisplay);

            let body = ``;
            body += `                name: 'list',\n`;
            body += `                display: '${listDisplay}',\n`;
            body += `                type: 'list',\n`;
            body += `                method: 'get',\n`;
            body += `                path: '/{scope}/{scopeID}/${first.childResource}',\n`;
            body += `                resultType: 'list',\n`;
            body += `                pagerGetter: 'pager',\n`;
            if (resultGetter) body += `                resultGetter: '${resultGetter}',\n`;
            body += `                pathParams: {\n`;
            body += `                    scope: {description: '${display}范围', options: [${scopeOptions.map(o => `{value: '${o.value}', label: '${o.label}'}`).join(', ')}]},\n`;
            body += `                    scopeID: '范围ID',\n`;
            body += `                },\n`;
            if (params) {
                body += `                params: [\n`;
                body += params.map(p => formatParam(p)).join('');
                body += `                ],\n`;
            }
            actionBodies.push(body);
        }

        // Process direct operations (including top-level list)
        // Sort: list, get, create, update, delete, then actions alphabetically
        const typeOrder: Record<string, number> = { list: 0, create: 1, get: 2, update: 3, delete: 4 };
        const sorted = [...directOps].sort((a, b) => {
            const ca = classifyOperation(a.method, a.path, tagName);
            const cb = classifyOperation(b.method, b.path, tagName);
            const oa = typeOrder[ca.type] ?? 5;
            const ob = typeOrder[cb.type] ?? 5;
            if (oa !== ob) return oa - ob;
            return ca.name.localeCompare(cb.name);
        });

        for (const entry of sorted) {
            const classification = classifyOperation(entry.method, entry.path, tagName);
            const { name: actionName, type: actionType, method: actionMethod, resultType } = classification;
            const summary = entry.op.summary ?? '';

            actionDisplayNames.push(summary);

            const bracePath = colonToBrace(entry.path);

            const pathParamNames = extractColonParams(entry.path);
            const relevantPathParams = pathParamNames.filter(() => actionType !== 'list');

            const resultGetter = (actionType === 'list' || actionType === 'get')
                ? inferResultGetter(entry.op, actionType) : undefined;

            const params = (actionType === 'list') ? buildParams(entry.op.parameters) : undefined;
            const requestBody = buildRequestBody(entry.op);
            const render = (actionType === 'delete' || actionType === 'action') ? 'action' : undefined;

            let body = ``;
            body += `                name: '${actionName}',\n`;
            body += `                display: '${escapeStr(summary)}',\n`;
            body += `                type: '${actionType}',\n`;
            body += `                method: '${actionMethod}',\n`;
            body += `                path: '${bracePath}',\n`;
            body += `                resultType: '${resultType}',\n`;

            if (actionType === 'list') {
                body += `                pagerGetter: 'pager',\n`;
            }
            if (resultGetter) {
                body += `                resultGetter: '${resultGetter}',\n`;
            }

            if (relevantPathParams.length > 0) {
                body += `                pathParams: {\n`;
                for (const pp of relevantPathParams) {
                    body += `                    ${pp}: '${paramDescription(pp)}',\n`;
                }
                body += `                },\n`;
            }

            if (params) {
                body += `                params: [\n`;
                body += params.map(p => formatParam(p)).join('');
                body += `                ],\n`;
            }

            if (requestBody) {
                body += `                requestBody: {\n`;
                if (requestBody.required) {
                    body += `                    required: true,\n`;
                }
                body += `                    type: 'object',\n`;
                body += `                    schema: ${indentJson(requestBody.schema, 20)},\n`;
                body += `                },\n`;
            }

            if (render) {
                body += `                render: '${render}',\n`;
            }

            actionBodies.push(body);
        }

        // Compose module description
        const moduleDesc = `${display}管理，支持${actionDisplayNames.join('、')}`;

        let moduleStr = `    /* ${display}模块 */\n`;
        moduleStr += `    {\n`;
        moduleStr += `        name: '${tagName}',\n`;
        moduleStr += `        display: '${display}',\n`;
        moduleStr += `        description: '${moduleDesc}',\n`;
        moduleStr += `        actions: [\n`;
        for (let i = 0; i < actionBodies.length; i++) {
            if (i === 0) {
                moduleStr += `            {\n`;
            } else {
                moduleStr += `            }, {\n`;
            }
            moduleStr += actionBodies[i];
        }
        if (actionBodies.length > 0) {
            moduleStr += `            }\n`;
        }
        moduleStr += `        ],\n`;
        moduleStr += `    }`;
        modules.push(moduleStr);
    }

    // Assemble final output
    let output = `import type { ModuleDefinition } from '../types/index.js';\n\n`;
    output += `/**\n`;
    output += ` * 内置模块注册表：key 为 CLI 子命令名（小写），value 为对应禅道 REST 资源元数据。\n`;
    output += ` * 新增模块时在此表中补充定义，并由 \`registerModuleCommands\` 动态注册命令。\n`;
    output += ` *\n`;
    output += ` * 此文件由 scripts/update-registry.ts 自动生成，请勿手动编辑。\n`;
    output += ` */\n`;
    output += `export const MODULES: ModuleDefinition[] = [\n`;
    output += modules.join(',\n\n');
    output += `\n];\n`;

    writeFileSync(outputPath, output, 'utf-8');
    console.log(`✅ Generated ${outputPath}`);
    console.log(`   ${tagOrder.length} modules, ${tagOrder.map(t => tagOps.get(t)!.length).reduce((a, b) => a + b, 0)} operations`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatParam(p: RegistryParam): string {
    let s = `                    {\n`;
    s += `                        name: '${p.name}',\n`;
    s += `                        required: ${p.required},\n`;
    s += `                        type: '${p.type}',\n`;
    s += `                        description: '${escapeStr(p.description)}',\n`;
    if (p.defaultValue !== undefined) {
        s += `                        defaultValue: '${escapeStr(p.defaultValue)}',\n`;
    }
    if (p.options && p.options.length > 0) {
        s += `                        options: [\n`;
        for (const opt of p.options) {
            s += `                            { value: '${escapeStr(String(opt.value))}', label: '${escapeStr(opt.label)}' },\n`;
        }
        s += `                        ],\n`;
    }
    s += `                    },\n`;
    return s;
}

function escapeStr(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function indentJson(obj: unknown, baseIndent: number): string {
    const json = JSON.stringify(obj, null, 4);
    const indent = ' '.repeat(baseIndent);
    const lines = json.split('\n');
    return lines.map((line, i) => i === 0 ? line : indent + line).join('\n');
}

main();
