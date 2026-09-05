import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

/** 交互式登录收集到的原始输入 */
export interface PromptResult {
    url: string;
    account: string;
    password: string;
    token: string;
}

/**
 * 在 TTY 上询问 URL、账号、认证方式与凭证，凭证输入不回显。
 */
export async function promptLogin(): Promise<PromptResult> {
    let muted = false;
    const output = new Writable({
        write(chunk, _encoding, callback) {
            if (!muted) process.stderr.write(chunk);
            callback();
        },
    });
    const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
    try {
        const url = await rl.question('禅道服务地址 (URL): ');
        if (!url) throw new Error('URL is required');

        const account = await rl.question('用户名 (Account): ');
        if (!account) throw new Error('Account is required');

        const method = (await rl.question('认证方式 (password/token) [password]: ')).trim().toLowerCase() || 'password';
        if (method !== 'password' && method !== 'token') {
            throw new Error('Auth method must be password or token');
        }

        process.stderr.write(method === 'token' ? 'Token: ' : '密码 (Password): ');
        muted = true;
        let secret: string;
        try {
            secret = await rl.question('');
        } finally {
            muted = false;
            process.stderr.write('\n');
        }
        if (!secret) throw new Error('Password or Token is required');

        const normalizedUrl = url.replace(/\/+$/, '');
        try {
            new URL(normalizedUrl);
        } catch {
            throw new Error(`Invalid URL: ${normalizedUrl}`);
        }

        return {
            url: normalizedUrl,
            account,
            password: method === 'password' ? secret : '',
            token: method === 'token' ? secret : '',
        };
    } finally {
        rl.close();
    }
}
