import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { FileWarning } from 'zentao-api';
import { fileRecoveryDetails, mapSdkError, ZentaoError } from '../errors.js';
import type { ListPagerInfo } from '../types/index.js';

const fileWarningsSchema = z.array(z.object({
    stage: z.enum(['resolve', 'upload', 'cleanup']), code: z.string(), message: z.string(),
    field: z.string().optional(), path: z.string().optional(), name: z.string().optional(),
    fileID: z.number().optional(), uid: z.string().optional(),
    objectType: z.string().optional(), objectID: z.number().optional(),
}));

const errorSchema = z.object({
    code: z.string(), message: z.string(), module: z.string().optional(), action: z.string().optional(),
});

export const outputSchema = z.object({ data: z.unknown(), resultObjectType: z.string().optional(), error: errorSchema.optional() });
const listOutputSchema = outputSchema.extend({
    pager: z.object({ pageID: z.number(), recPerPage: z.number(), recTotal: z.number() }).optional(),
    meta: z.object({
        processingScope: z.literal('page'),
        returnedCount: z.number().int().nonnegative(),
        totalScope: z.literal('serverBeforeLocalProcessing').optional(),
    }).optional(),
});

const fileFields = {
    fileWarnings: fileWarningsSchema.optional(),
    error: errorSchema.extend({
        details: z.object({
            uid: z.string().optional(), fileIDs: z.array(z.number()).optional(), fileWarnings: fileWarningsSchema.optional(),
        }).optional(),
    }).optional(),
};
const fileOutputSchema = outputSchema.extend(fileFields);
const fileListOutputSchema = listOutputSchema.extend(fileFields);

export function moduleOutputSchema(hasList: boolean, hasHtmlBody: boolean) {
    if (hasHtmlBody) return hasList ? fileListOutputSchema : fileOutputSchema;
    return hasList ? listOutputSchema : outputSchema;
}

export function toolResult(data: unknown, extra?: {
    pager?: ListPagerInfo;
    meta?: { processingScope: 'page'; returnedCount: number; totalScope?: 'serverBeforeLocalProcessing' };
    fileWarnings?: FileWarning[];
    resultObjectType?: string;
}): CallToolResult {
    const structuredContent = { data: data ?? null, ...extra };
    const textData = extra?.meta || extra?.fileWarnings?.length ? structuredContent : data ?? null;
    return {
        structuredContent,
        content: [{ type: 'text', text: JSON.stringify(textData, null, 2) }],
    };
}

export function toolError(error: unknown, context?: { module: string; action: string }): CallToolResult {
    error = mapSdkError(error);
    const code = error instanceof ZentaoError ? `E${error.code}` : 'E_INTERNAL';
    const message = error instanceof Error ? error.message : String(error);
    const details = code !== 'E2009' && error instanceof Error && 'details' in error ? fileRecoveryDetails(error.details) : undefined;
    return {
        isError: true,
        structuredContent: { data: null, error: { code, message, ...context, ...(details && { details }) } },
        content: [{ type: 'text', text: `${code}: ${message}${details ? '\n' + JSON.stringify(details) : ''}` }],
    };
}
