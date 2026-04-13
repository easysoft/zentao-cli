import { ZentaoError } from '../errors.js';

/** 在非 TTY 标准输入下读取全部内容；交互终端上返回 `undefined` */
export async function readStdin(): Promise<string | undefined> {
    if (process.stdin.isTTY) return undefined;

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        process.stdin.on('end', () => {
            const content = Buffer.concat(chunks).toString('utf-8').trim();
            resolve(content || undefined);
        });
        process.stdin.on('error', reject);
    });
}

/** 解析 `--data` / 管道 JSON，失败时抛出 `E2007` */
export function parseDataParam(input: string): unknown {
    try {
        return JSON.parse(input);
    } catch {
        throw new ZentaoError('E2007');
    }
}

/**
 * 解析请求体：`@-` 或未传且存在管道输入时从 stdin 读；否则将 `dataOption` 当作 JSON 字符串。
 * 显式 `@-` 且无 stdin 内容时抛出 `E2007`。
 */
export async function resolveData(dataOption?: string): Promise<unknown | undefined> {
    if (dataOption === '@-' || dataOption === undefined) {
        const stdin = await readStdin();
        if (stdin) return parseDataParam(stdin);
        if (dataOption === '@-') {
            throw new ZentaoError('E2007');
        }
        return undefined;
    }
    return parseDataParam(dataOption);
}
