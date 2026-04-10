import { ZentaoError } from '../errors.js';

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

export function parseDataParam(input: string): unknown {
    try {
        return JSON.parse(input);
    } catch {
        throw new ZentaoError('E2007');
    }
}

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
