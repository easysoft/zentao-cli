import { expect, test } from 'bun:test';
import { createContext, runInContext } from 'node:vm';
import { renderMcpStartPage } from '../src/mcp/start-page.js';

// Small DOM adapter, as in browser-page.test.ts; browser checks cover layout and native controls.
function page(options: { language?: string; saved?: Record<string, string>; blockedStorage?: boolean; secure?: boolean; copyFails?: boolean } = {}) {
    let focused = '';
    class Element {
        dataset: Record<string, string> = {};
        listeners: Record<string, Array<(event: { preventDefault(): void }) => unknown>> = {};
        value = ''; type = ''; textContent = ''; hidden = false; disabled = false; checked = false;
        constructor(readonly tag: string, readonly attrs: Record<string, string>) {
            this.value = attrs.value ?? '';
            this.type = attrs.type ?? '';
            this.hidden = 'hidden' in attrs; this.disabled = 'disabled' in attrs; this.checked = 'checked' in attrs;
            for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
        }
        get id() { return this.attrs.id; }
        setAttribute(key: string, value: string) { this.attrs[key] = value; }
        removeAttribute(key: string) { delete this.attrs[key]; }
        focus() { focused = this.id; }
        querySelector(tag: string) { return nodes.slice(nodes.indexOf(this) + 1).find(node => node.tag === tag)!; }
        addEventListener(name: string, fn: (event: { preventDefault(): void }) => unknown) { (this.listeners[name] ??= []).push(fn); }
        async fire(name: string) { await Promise.all((this.listeners[name] ?? []).map(fn => fn({ preventDefault() {} }))); }
    }
    const html = renderMcpStartPage({ url: 'https://zentao.example.com', nonce: 'test', key: 'page-key', modules: ['product'], readOnly: true });
    const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '');
    const nodes = [...markup.matchAll(/<([a-z][\w-]*)(\s[^>]*|)>/g)].map(([, tag, attrs]) => new Element(tag,
        Object.fromEntries([...attrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? '']))));
    const element = (id: string) => nodes.find(node => node.id === id)!;
    const radioGroup = (name: string) => nodes.filter(node => node.attrs.name === name);
    const queryRadios = (selector: string) => radioGroup(selector.match(/name="([^"]+)"/)![1]);
    element('zt-client').value = 'claude';
    const root = nodes.find(node => node.tag === 'html')! as Element & { lang: string };
    const document = {
        documentElement: root, title: '', getElementById: element,
        querySelector: (selector: string) => queryRadios(selector).find(node => node.checked),
        querySelectorAll: (selector: string) => selector.startsWith('input[') ? queryRadios(selector) : nodes.filter(node => selector.slice(1, -1) in node.attrs),
    };
    const storage = new Map(Object.entries(options.saved ?? {}));
    const clipboard: string[] = [];
    const requests: Array<{ url: string; init: RequestInit; reply(response: Response): void; fail(): void }> = [];
    const window = new Element('window', {}) as Element & { isSecureContext: boolean };
    window.isSecureContext = options.secure ?? true;
    const context = createContext({
        document, window, URL, AbortController,
        location: new URL('https://mcp.example.com/company/start/'),
        navigator: { languages: [options.language ?? 'en-US'], clipboard: { async writeText(text: string) {
            if (options.copyFails) throw new Error('Clipboard unavailable');
            clipboard.push(text);
        } } },
        localStorage: {
            getItem(key: string) { if (options.blockedStorage) throw new Error('Blocked'); return storage.get(key); },
            setItem(key: string, value: string) { if (options.blockedStorage) throw new Error('Blocked'); storage.set(key, value); },
        },
        fetch: (url: string, init: RequestInit) => new Promise<Response>((reply, reject) => requests.push({ url, init, reply, fail: () => reject(new Error('Offline')) })),
    });
    for (const [, script] of html.matchAll(/<script nonce="test">([\s\S]*?)<\/script>/g)) runInContext(script, context);
    async function change(id: string, value: string) { element(id).value = value; await element(id).fire('change'); }
    async function method(value: string, name = 'zt-method') {
        const radios = radioGroup(name);
        radios.forEach(node => node.checked = node.value === value);
        await radios.find(node => node.checked)!.fire('change');
    }
    return { element, root, document, storage, clipboard, requests, window, change, method, focused: () => focused };
}

test('MCP page follows primary browser language, remembers only preferences and tolerates blocked storage', async () => {
    for (const [language, expected] of [['zh-Hant', 'zh-CN'], ['en-GB', 'en'], ['fr-FR', 'en']]) {
        expect(page({ language }).root.lang).toBe(expected);
    }
    const p = page({ saved: { 'zentao-mcp-theme': 'dark', 'zentao-mcp-language': 'zh' } });
    expect(p.root.dataset.theme).toBe('dark');
    expect(p.root.lang).toBe('zh-CN');
    await p.element('zt-theme-switch').fire('click');
    await p.change('zt-language', 'en');
    expect([...p.storage]).toEqual([['zentao-mcp-theme', 'light'], ['zentao-mcp-language', 'en']]);
    expect(p.element('zt-theme-switch').attrs['aria-checked']).toBe('false');
    expect(p.document.title).toBe('Connect ZenTao MCP · ZenTao');
    const blocked = page({ language: 'zh-CN', blockedStorage: true });
    await blocked.change('zt-language', 'en');
    await blocked.element('zt-theme-switch').fire('click');
    expect(blocked.root.dataset.theme).toBe('dark');
});

test('manual token stays masked and ephemeral; copy requires explicit inclusion and previews stay redacted', async () => {
    const p = page({ language: 'zh-CN' });
    const secret = 'private-token_+/==';
    await p.method('token');
    p.element('zt-existing').value = 'token: wrong-format';
    await p.element('zt-login-form').fire('submit');
    expect(p.element('zt-existing').attrs['aria-invalid']).toBe('true');
    expect(p.element('zt-token-panel').hidden).toBe(false);
    p.element('zt-existing').value = secret;
    await p.element('zt-login-form').fire('submit');
    expect(p.element('zt-setup-panel').hidden).toBe(false);
    expect(p.element('zt-current-token').type).toBe('password');
    expect(p.element('zt-include').checked).toBe(false);
    expect(p.element('zt-include-warning').hidden).toBe(true);
    expect(p.element('zt-include').attrs['aria-describedby']).toBe('zt-include-warning');
    await p.element('zt-copy-prompt').fire('click');
    expect(p.clipboard.at(-1)).toContain('<your-zentao-token>');
    expect(p.clipboard.at(-1)).toContain('MCP 配置文件完整路径');
    expect(p.clipboard.at(-1)).toContain('设置 token 请求头的具体字段和方法');
    expect(p.clipboard.at(-1)).toContain('不要要求我在对话中提供禅道密码或 Token');
    expect(p.clipboard.at(-1)).not.toContain(secret);
    p.element('zt-include').checked = true;
    await p.element('zt-include').fire('change');
    expect(p.element('zt-include-warning').hidden).toBe(false);
    expect(p.element('zt-include-warning').textContent).toContain('对话记录或日志');
    await p.element('zt-copy-prompt').fire('click');
    expect(p.clipboard.at(-1)).toContain(secret);
    expect(p.element('zt-prompt-preview').textContent).not.toContain(secret);
    expect(p.element('zt-config').textContent).not.toContain(secret);
    expect(p.element('zt-copy-feedback').textContent).not.toContain(secret);
    await p.change('zt-language', 'en');
    expect(p.element('zt-include-warning').hidden).toBe(false);
    expect(p.element('zt-include-warning').textContent).toContain('AI provider');
    expect(p.element('zt-include-warning').textContent).toContain('chat history or logs');
    await p.element('zt-copy-prompt').fire('click');
    expect(p.clipboard.at(-1)).toContain(secret);
    await p.change('zt-client', 'codex');
    await p.element('zt-copy-config').fire('click');
    expect(p.clipboard.at(-1)).toContain('https://mcp.example.com/company/mcp');
    expect(p.clipboard.at(-1)).toContain(secret);
    p.element('zt-include').checked = false;
    await p.element('zt-include').fire('change');
    expect(p.element('zt-include-warning').hidden).toBe(true);
    await p.element('zt-copy-prompt').fire('click');
    expect(p.clipboard.at(-1)).toContain('full path of the MCP configuration file');
    expect(p.clipboard.at(-1)).toContain('the field for the token request header, and how to set it');
    expect(p.clipboard.at(-1)).toContain('Do not ask me to send my ZenTao password or token in this conversation');
    expect(p.clipboard.at(-1)).not.toContain(secret);
    await p.element('zt-copy-config').fire('click');
    expect(p.clipboard.at(-1)).not.toContain(secret);
    await p.window.fire('pagehide');
    expect(p.element('zt-existing').value).toBe('');
    expect(p.element('zt-current-token').value).toBe('');
    expect(p.element('zt-include').checked).toBe(false);
    expect(p.element('zt-token-panel').hidden).toBe(false);
    expect([...p.storage]).toEqual([['zentao-mcp-language', 'en']]);
});

test('login validates, prevents duplicate submit, translates in-flight errors and supports retry', async () => {
    const p = page();
    await p.element('zt-login-form').fire('submit');
    expect(p.focused()).toBe('zt-account');
    expect(p.element('zt-account').attrs['aria-invalid']).toBe('true');
    p.element('zt-account').value = 'alice'; p.element('zt-password').value = 'private-password';
    const submission = p.element('zt-login-form').fire('submit');
    await p.element('zt-login-form').fire('submit');
    await p.change('zt-language', 'zh');
    expect(p.requests).toHaveLength(1);
    expect(p.requests[0].url).toBe('https://mcp.example.com/company/start/token');
    expect(p.requests[0].init.redirect).toBe('error');
    expect(p.element('zt-continue').disabled).toBe(true);
    p.requests[0].reply(Response.json({ errorCode: 'invalidCredentials' }, { status: 401 }));
    await submission;
    expect(p.element('zt-login-feedback').textContent).toContain('用户名或密码不正确');
    expect(p.element('zt-password').value).toBe('');
    expect(p.focused()).toBe('zt-password');
    p.element('zt-password').value = 'retry-password';
    const retry = p.element('zt-login-form').fire('submit');
    p.requests[1].reply(Response.json({ token: 'new-private-token' }));
    await retry;
    expect(p.element('zt-setup-panel').hidden).toBe(false);
    expect(p.element('zt-current-token').value).toBe('new-private-token');
    expect([...p.storage]).toEqual([['zentao-mcp-language', 'zh']]);
});

test('switching steps cancels login and ignores stale responses without overwriting a pasted token', async () => {
    const p = page();
    p.element('zt-account').value = 'alice'; p.element('zt-password').value = 'private-password';
    const submission = p.element('zt-login-form').fire('submit');
    await p.element('zt-skip').fire('click');
    expect(p.requests[0].init.signal?.aborted).toBe(true);
    await p.element('zt-go-token').fire('click');
    await p.method('token');
    p.element('zt-existing').value = 'pasted-token';
    await p.element('zt-login-form').fire('submit');
    p.requests[0].reply(Response.json({ token: 'stale-token' }));
    await submission;
    expect(p.element('zt-current-token').value).toBe('pasted-token');
    expect(p.element('zt-password').value).toBe('');
    await p.element('zt-clear-token').fire('click');
    expect(p.element('zt-current-token').value).toBe('');
    expect(p.element('zt-include').disabled).toBe(true);
});

test('verification is a separate step with the exact product-list prompt; copy errors remain actionable', async () => {
    const p = page({ language: 'zh-CN' });
    await p.element('zt-skip').fire('click');
    expect(p.element('zt-verify-panel').hidden).toBe(true);
    await p.element('zt-next-verify').fire('click');
    expect(p.element('zt-second-number').textContent).toBe('✓');
    expect(p.element('zt-go-verify').attrs['aria-current']).toBe('step');
    await p.element('zt-copy-verify').fire('click');
    expect(p.clipboard.at(-1)).toBe('请通过 zentao-remote MCP 查询我有权访问的产品列表，只显示 ID 和名称。');
    await p.change('zt-language', 'en');
    await p.element('zt-copy-verify').fire('click');
    expect(p.clipboard.at(-1)).toBe('Use the zentao-remote MCP to query the products I can access. Show only their IDs and names.');
    const denied = page({ copyFails: true, secure: false });
    expect(denied.element('zt-credentials').disabled).toBe(true);
    expect(denied.element('zt-insecure').hidden).toBe(false);
    await denied.element('zt-skip').fire('click');
    await denied.element('zt-copy-prompt').fire('click');
    expect(denied.element('zt-copy-feedback').textContent).toContain('Allow clipboard access');
});

test('setup methods are exclusive and share token consent, client selection and return focus', async () => {
    const p = page();
    await p.element('zt-skip').fire('click');
    expect(p.element('zt-assisted-setup').hidden).toBe(false);
    expect(p.element('zt-manual').hidden).toBe(true);
    expect(p.element('zt-token-empty').hidden).toBe(false);
    await p.method('manual', 'zt-setup-method');
    await p.change('zt-client', 'codex');
    expect(p.element('zt-assisted-setup').hidden).toBe(true);
    expect(p.element('zt-manual').hidden).toBe(false);
    await p.element('zt-add-token').fire('click');
    await p.method('token');
    p.element('zt-existing').value = 'shared-private-token';
    await p.element('zt-login-form').fire('submit');
    expect(p.focused()).toBe('zt-client');
    expect(p.element('zt-token-filled').hidden).toBe(false);
    expect(p.element('zt-current-token').type).toBe('password');
    await p.element('zt-copy-token').fire('click');
    expect(p.clipboard.at(-1)).toBe('shared-private-token');
    expect(p.element('zt-token-feedback').textContent).toContain('Copied');
    expect(p.element('zt-copy-feedback').textContent).toBe('');
    p.element('zt-include').checked = true;
    await p.element('zt-include').fire('change');
    await p.method('agent', 'zt-setup-method');
    await p.element('zt-copy-prompt').fire('click');
    expect(p.clipboard.at(-1)).toContain('shared-private-token');
    await p.method('manual', 'zt-setup-method');
    await p.element('zt-copy-config').fire('click');
    expect(p.clipboard.at(-1)).toContain('[mcp_servers.zentao-remote]');
    expect(p.clipboard.at(-1)).toContain('shared-private-token');
    expect(p.element('zt-config-feedback').textContent).toContain('Copied');
    await p.element('zt-next-verify').fire('click');
    await p.element('zt-back-setup').fire('click');
    expect(p.focused()).toBe('zt-client');
    await p.element('zt-clear-token').fire('click');
    expect(p.element('zt-token-filled').hidden).toBe(true);
    expect(p.element('zt-token-empty').hidden).toBe(false);
    expect(p.element('zt-include').checked).toBe(false);
    expect(p.focused()).toBe('zt-add-token');
});

test('instructions show a two-line excerpt and expand without changing the full copied instructions', async () => {
    const p = page({ language: 'zh-CN' });
    await p.element('zt-skip').fire('click');
    expect(p.element('zt-prompt-excerpt').hidden).toBe(false);
    expect(p.element('zt-prompt-excerpt').textContent.split('\n')).toHaveLength(2);
    expect(p.element('zt-prompt-preview').hidden).toBe(true);
    expect(p.element('zt-preview-toggle').attrs['aria-expanded']).toBe('false');
    await p.element('zt-preview-toggle').fire('click');
    expect(p.element('zt-prompt-excerpt').hidden).toBe(true);
    expect(p.element('zt-prompt-preview').hidden).toBe(false);
    await p.change('zt-language', 'en');
    expect(p.element('zt-preview-toggle').attrs['aria-expanded']).toBe('true');
    expect(p.element('zt-prompt-preview').textContent).toContain('Help me configure');
    await p.element('zt-preview-toggle').fire('click');
    await p.element('zt-copy-prompt').fire('click');
    expect(p.clipboard.at(-1)).toContain('Finally, verify the connection:');
    expect(p.element('zt-prompt-excerpt').textContent).not.toContain('Finally,');
});
