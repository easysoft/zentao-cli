import { brand } from '../brand.js';
import { ZentaoError } from '../errors.js';
import { getCliVersion } from '../utils/version.js';

export type AssistantSource = 'cli' | 'stdio' | 'http';

// Resolve build identity once, including when running directly from source.
const identity = `${brand?.packageName ?? 'zentao-cli'} ${getCliVersion()}`;
const defaults: Record<AssistantSource, string> = {
    cli: `CLI <${identity}>`,
    stdio: `AI <${identity}, mcp: stdio>`,
    http: `AI <${identity}, mcp: http>`,
};

/** Match the SDK's native header validation before starting authentication. */
export function validateAssistant(value: string): string {
    try {
        if (typeof value !== 'string') throw new TypeError();
        new Headers({ 'ZenTao-Action-Assistant': value });
    } catch {
        throw new ZentaoError('E2009', { option: 'assistant', reason: '标记必须是有效的 HTTP 请求头字符串，不能包含换行或中文等非 Latin-1 字符' });
    }
    return value;
}

export function resolveAssistant(assistant?: string, autoAssistant = true, source: AssistantSource = 'cli'): string {
    return assistant !== undefined ? validateAssistant(assistant) : autoAssistant ? defaults[source] : '';
}
