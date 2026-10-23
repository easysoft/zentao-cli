import { ZentaoError } from '../errors.js';
import { readFile } from 'node:fs/promises';

let stdinContent: Promise<string | undefined> | undefined;

/** 在未被占用的非 TTY 标准输入上读取全部内容；交互终端或已有消费者时返回 `undefined` */
export async function readStdin(): Promise<string | undefined> {
    if (stdinContent) return stdinContent;
    if (process.stdin.isTTY || process.stdin.listenerCount('data') > 0) return undefined;

    stdinContent = (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
        const content = Buffer.concat(chunks).toString('utf-8').trim();
        return content || undefined;
    })();
    return stdinContent;
}

/** 解析 `--data` / 管道 JSON，失败时抛出 `E2007` */
export function parseDataParam(input: string): unknown {
    try {
        const value = JSON.parse(input);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ZentaoError('E2007');
        return value;
    } catch {
        throw new ZentaoError('E2007');
    }
}

/**
 * 解析请求体：`@-` 或未传且存在管道输入时从 stdin 读；否则将 `dataOption` 当作 JSON 字符串。
 * 显式 `@-` 且无 stdin 内容时抛出 `E2007`。
 */
export async function resolveData(dataOption?: string): Promise<unknown | undefined> {
    if (dataOption === undefined) return undefined;
    if (dataOption === '@-') {
        const stdin = await readStdin();
        if (stdin) return parseDataParam(stdin);
        if (dataOption === '@-') {
            throw new ZentaoError('E2007');
        }
        return undefined;
    }
    if (dataOption.startsWith('@')) {
        try {
            return parseDataParam(await readFile(dataOption.slice(1), 'utf8'));
        } catch (error) {
            if (error instanceof ZentaoError) throw error;
            throw new ZentaoError('E2009', { option: 'data', reason: '无法读取 JSON 文件' });
        }
    }
    return parseDataParam(dataOption);
}
