import { createInterface } from "node:readline";

/** 交互式登录收集到的原始输入（密码与 Token 二选一由长度启发式区分） */
export interface PromptResult {
    url: string;
    account: string;
    password: string;
    token: string;
}

/**
 * 在 TTY 上询问 URL、账号与密码/Token。
 * 若第三项长度为 40，则按禅道 Token 常见长度视为 Token，否则视为密码。
 */
export async function promptLogin(): Promise<PromptResult> {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const url = await new Promise<string>((resolve) => {
        rl.question('禅道服务地址 (URL): ', (answer) => {
            resolve(answer);
        });
    });
    if (!url) throw new Error('URL is required');

    const account: string = await new Promise((resolve) => {
        rl.question('用户名 (Account): ', (answer) => {
            resolve(answer);
        });
    });
    if (!account) throw new Error('Account is required');

    const password: string = await new Promise((resolve) => {
        rl.question('密码(Password) 或 Token : ', (answer) => {
            resolve(answer);
        });
    });
    if (!password) throw new Error('Password or Token is required');

    const normalizedUrl = url.replace(/\/+$/, '');
    try {
        new URL(normalizedUrl);
    } catch {
        throw new Error(`Invalid URL: ${normalizedUrl}`);
    }

    return { url: normalizedUrl, account, password: password.length === 40 ? '' : password, token: password.length === 40 ? password : '' };
}
