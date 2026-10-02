import { describe, expect, test } from 'bun:test';
import { createContext, runInContext } from 'node:vm';
import { renderBrowserLoginPage } from '../src/auth/browser-page.js';

const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity: string) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
}[entity]!));

// Only the element APIs used by this static page; elements and text come from its real HTML.
class PageElement {
    dataset: Record<string, string> = {};
    listeners = new Map<string, Array<(event: { preventDefault(): void }) => unknown>>();
    value: string;
    disabled: boolean;
    hidden: boolean;
    className: string;

    constructor(readonly tag: string, readonly attributes: Map<string, string>, public textContent: string) {
        this.value = attributes.get('value') ?? '';
        this.disabled = attributes.has('disabled');
        this.hidden = attributes.has('hidden');
        this.className = attributes.get('class') ?? '';
        for (const [name, value] of attributes) {
            if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
        }
    }

    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    focus() {}
    addEventListener(name: string, callback: (event: { preventDefault(): void }) => unknown) {
        this.listeners.set(name, [...this.listeners.get(name) ?? [], callback]);
    }
    async fire(name: string) {
        await Promise.all((this.listeners.get(name) ?? []).map(callback => callback({ preventDefault() {} })));
    }
}

function loadPage(options: {
    languages?: string[];
    saved?: Record<string, string>;
    blockedStorage?: boolean;
    message?: string;
} = {}) {
    const html = renderBrowserLoginPage({ nonce: 'test-nonce', message: options.message });
    const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '');
    const nodes = [...markup.matchAll(/<([a-z][\w-]*)(\s[^>]*|)>([^<]*)/g)].map(([, tag, rawAttributes, text]) => {
        const attributes = new Map([...rawAttributes.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)]
            .map(([, name, value]) => [name, decode(value ?? '')]));
        return new PageElement(tag, attributes, decode(text));
    });
    const element = (id: string) => {
        const node = nodes.find(node => node.attributes.get('id') === id);
        if (!node) throw new Error(`Missing page element: ${id}`);
        return node;
    };
    const document = {
        documentElement: nodes.find(node => node.tag === 'html')! as PageElement & { lang: string },
        title: nodes.find(node => node.tag === 'title')!.textContent,
        getElementById: element,
        querySelectorAll: (selector: string) => nodes.filter(node => node.attributes.has(selector.slice(1, -1))),
    };
    const storage = new Map(Object.entries(options.saved ?? {}));
    const writes: Array<[string, string]> = [];
    const requests: Array<{ path: string; init: RequestInit; reply: (response: Response) => void }> = [];
    const context = createContext({
        document,
        navigator: { languages: options.languages ?? ['en-US'] },
        location: { hash: '#test-session', pathname: '/' },
        history: { replaceState() {} },
        localStorage: {
            getItem(name: string) {
                if (options.blockedStorage) throw new Error('Storage blocked');
                return storage.get(name) ?? null;
            },
            setItem(name: string, value: string) {
                if (options.blockedStorage) throw new Error('Storage blocked');
                writes.push([name, value]);
                storage.set(name, value);
            },
        },
        fetch: (path: string, init: RequestInit) => new Promise<Response>(reply => requests.push({ path, init, reply })),
    });
    const scripts = [...html.matchAll(/<script nonce="test-nonce">([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(2);
    runInContext(scripts[0][1], context);
    const bootstrapTheme = document.documentElement.dataset.theme;
    runInContext(scripts[1][1], context);
    const change = async (id: string, value: string) => {
        element(id).value = value;
        await element(id).fire('change');
    };
    return { nodes, document, element, storage, writes, requests, change, bootstrapTheme };
}

describe('browser login page client behavior', () => {
    test.each([
        [['zh-Hant'], 'zh-TW', '登入禪道'],
        [['zh-HK'], 'zh-TW', '登入禪道'],
        [['fr-FR', 'zh-CN'], 'zh-CN', '登录禅道'],
        [['fr-FR'], 'en', 'Log in to ZenTao'],
    ] as const)('chooses a supported language from %j', (languages, locale, title) => {
        const page = loadPage({ languages: [...languages] });
        expect(page.document.documentElement.lang).toBe(locale);
        expect(page.element('title').textContent).toBe(title);
        expect(page.document.title).toBe(`${title} · ZenTao CLI`);
        expect(page.element('fields').disabled).toBe(false);
    });

    test('restores explicit theme before the body and can return to native system colors', async () => {
        const page = loadPage({ saved: { 'zentao-login-theme': 'dark', 'zentao-login-language': 'zh-TW' } });
        expect(page.bootstrapTheme).toBe('dark');
        expect(page.element('theme').value).toBe('dark');
        expect(page.document.documentElement.lang).toBe('zh-TW');
        expect(page.element('language').tag).toBe('select');
        expect(page.element('theme').tag).toBe('select');
        expect(page.element('language').attributes.get('aria-label')).toBe('語言');
        expect(page.element('theme').attributes.get('aria-label')).toBe('外觀');
        expect(page.element('language').attributes.get('title')).toBe('語言: zh-TW');
        for (const [theme, label] of [['light', '淺色'], ['dark', '深色'], ['system', '跟隨系統']]) {
            await page.change('theme', theme);
            expect(page.document.documentElement.dataset.theme).toBe(theme);
            expect(page.storage.get('zentao-login-theme')).toBe(theme);
            expect(page.element('theme').attributes.get('title')).toBe(`外觀: ${label}`);
        }
        const system = loadPage({ saved: { 'zentao-login-theme': 'system' } });
        expect(system.bootstrapTheme).toBeUndefined();
        expect(system.element('theme').value).toBe('system');
    });

    test('switches text and status during login without changing credentials or duplicating a pending request', async () => {
        const customMessage = 'Return to Codex <keep & "this"> 原文';
        const page = loadPage({ message: customMessage });
        const { element } = page;
        element('server').value = 'https://zentao.example.com/zentao';
        element('account').value = 'test-account';
        element('password').value = 'private-password';
        const submission = element('login-form').fire('submit');
        expect(element('submit').textContent).toBe('Logging in…');
        await page.change('language', 'zh-TW');
        await page.change('theme', 'dark');
        await element('login-form').fire('submit');
        expect(page.requests).toHaveLength(1);
        expect(element('fields').disabled).toBe(true);
        expect(element('login-form').attributes.get('aria-busy')).toBe('true');
        expect(element('submit').textContent).toBe('正在登入…');
        expect(element('intro').textContent).toBe(customMessage);
        expect(element('password').value).toBe('private-password');
        expect(JSON.parse(page.requests[0].init.body as string)).toEqual({
            server: element('server').value, account: 'test-account', password: 'private-password',
        });
        expect(page.nodes.find(node => node.attributes.get('for') === 'account')!.textContent).toBe('使用者名稱');
        expect(page.nodes.find(node => node.dataset.i18nLabel === 'websiteLabel')!.attributes.get('aria-label')).toBe('禪道官網（在新分頁開啟）');

        page.requests[0].reply(Response.json({ errorCode: 'invalidCredentials' }, { status: 401 }));
        await submission;
        expect(element('password').value).toBe('');
        expect(element('fields').disabled).toBe(false);
        expect(element('feedback').textContent).toBe('使用者名稱或密碼不正確，請檢查後重試。');
        await page.change('language', 'en');
        expect(element('language').attributes.get('aria-label')).toBe('Language');
        expect(element('theme').attributes.get('aria-label')).toBe('Appearance');
        expect(element('language').attributes.get('title')).toBe('Language: en');
        expect(element('theme').attributes.get('title')).toBe('Appearance: Dark');
        expect(element('feedback').textContent).toContain('The username or password is incorrect.');
        expect(element('intro').textContent).toBe(customMessage);
        expect(element('server').value).toBe('https://zentao.example.com/zentao');
        expect(element('account').value).toBe('test-account');

        element('password').value = 'new-private-password';
        const retry = element('login-form').fire('submit');
        page.requests[1].reply(Response.json({ ok: true, account: 'test-account', server: element('server').value, token: 'never-render-token' }));
        await retry;
        expect(element('password').value).toBe('');
        expect(element('login-form').hidden).toBe(true);
        expect(element('title').textContent).toBe('Login successful');
        await page.change('language', 'zh-CN');
        expect(page.document.title).toBe('登录成功 · ZenTao CLI');
        expect(element('feedback').textContent).toContain('已登录账号 test-account（https://zentao.example.com/zentao）');
        expect(page.nodes.map(node => node.textContent).join('')).not.toContain('never-render-token');
        expect(page.writes).toEqual([
            ['zentao-login-language', 'zh-TW'], ['zentao-login-theme', 'dark'],
            ['zentao-login-language', 'en'], ['zentao-login-language', 'zh-CN'],
        ]);
    });

    test('works with blocked storage and hides unrecognized upstream errors', async () => {
        const page = loadPage({ blockedStorage: true, message: 'Keep this message exactly.' });
        await page.change('language', 'zh-TW');
        await page.change('theme', 'light');
        expect(page.element('intro').textContent).toBe('Keep this message exactly.');
        expect(page.document.documentElement.dataset.theme).toBe('light');
        page.element('password').value = 'private-password';
        const submission = page.element('login-form').fire('submit');
        page.requests[0].reply(Response.json({ errorCode: '__proto__', error: '<img onerror="private-password">' }, { status: 500 }));
        await submission;
        expect(page.element('feedback').textContent).toBe('請求處理失敗，請重試。');
        expect(page.element('password').value).toBe('');
        expect(page.nodes.map(node => node.textContent).join('')).not.toContain('private-password');
        expect(page.writes).toEqual([]);
    });
});
