import { createInterface, type Interface } from "node:readline";

/** 交互式登录收集到的原始输入（密码与 Token 二选一由长度启发式区分） */
export interface PromptResult {
    url: string;
    account: string;
    password: string;
    token: string;
}

function ask(rl: Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer));
    });
}

/**
 * 在 TTY 上询问 URL、账号与密码/Token。
 * 若第三项长度为 40，则按禅道 Token 常见长度视为 Token，否则视为密码。
 */
export async function promptLogin(): Promise<PromptResult> {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
        const url = await ask(rl, '禅道服务地址 (URL): ');
        if (!url) throw new Error('URL is required');

        const account = await ask(rl, '用户名 (Account): ');
        if (!account) throw new Error('Account is required');

        const password = await ask(rl, '密码(Password) 或 Token : ');
        if (!password) throw new Error('Password or Token is required');

        const normalizedUrl = url.replace(/\/+$/, '');
        try {
            new URL(normalizedUrl);
        } catch {
            throw new Error(`Invalid URL: ${normalizedUrl}`);
        }

        const isToken = password.length === 40;
        return {
            url: normalizedUrl,
            account,
            password: isToken ? '' : password,
            token: isToken ? password : '',
        };
    } finally {
        rl.close();
    }
}
