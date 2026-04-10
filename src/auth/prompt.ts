import { createInterface } from 'node:readline';

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

export interface PromptResult {
    url: string;
    account: string;
    password: string;
}

export async function promptLogin(): Promise<PromptResult> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
    });

    try {
        const url = await ask(rl, '禅道服务地址 (URL): ');
        if (!url) throw new Error('URL is required');

        const account = await ask(rl, '用户名 (Account): ');
        if (!account) throw new Error('Account is required');

        const password = await ask(rl, '密码 (Password): ');
        if (!password) throw new Error('Password is required');

        const normalizedUrl = url.replace(/\/+$/, '');
        try {
            new URL(normalizedUrl);
        } catch {
            throw new Error(`Invalid URL: ${normalizedUrl}`);
        }

        return { url: normalizedUrl, account, password };
    } finally {
        rl.close();
    }
}
