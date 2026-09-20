import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { mapSdkError, ZentaoError } from '../errors.js';
import type { ListPagerInfo } from '../types/index.js';

export const outputSchema = z.object({
    data: z.unknown(),
    error: z.object({
        code: z.string(),
        message: z.string(),
        module: z.string().optional(),
        action: z.string().optional(),
    }).optional(),
});

export const listOutputSchema = outputSchema.extend({
    pager: z.object({ pageID: z.number(), recPerPage: z.number(), recTotal: z.number() }).optional(),
    meta: z.object({
        processingScope: z.literal('page'),
        returnedCount: z.number().int().nonnegative(),
        totalScope: z.literal('serverBeforeLocalProcessing').optional(),
    }).optional(),
});

export function toolResult(data: unknown, list?: { pager?: ListPagerInfo; meta: { processingScope: 'page'; returnedCount: number; totalScope?: 'serverBeforeLocalProcessing' } }): CallToolResult {
    const structuredContent = { data: data ?? null, ...list };
    return {
        structuredContent,
        // Preserve existing text consumers: lists use an envelope, single results do not.
        content: [{ type: 'text', text: JSON.stringify(list ? structuredContent : data ?? null, null, 2) }],
    };
}

export function toolError(error: unknown, context?: { module: string; action: string }): CallToolResult {
    error = mapSdkError(error);
    const code = error instanceof ZentaoError ? `E${error.code}` : 'E_INTERNAL';
    const message = error instanceof Error ? error.message : String(error);
    return {
        isError: true,
        structuredContent: { data: null, error: { code, message, ...context } },
        content: [{ type: 'text', text: `${code}: ${message}` }],
    };
}
