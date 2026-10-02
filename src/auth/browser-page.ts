import { getCliVersion } from '../utils/version.js';
import { browserMessages } from './browser-messages.js';

/** Render a self-contained login page without external assets. */
export function renderBrowserLoginPage(options: {
    nonce: string;
    server?: string;
    account?: string;
    message?: string;
    insecure?: boolean;
}): string {
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]!));
    const t = (key: keyof typeof browserMessages['zh-CN']) => escapeHtml(browserMessages['zh-CN'][key]);
    const darkColors = `
      color-scheme: dark;
      --page-start: #142746; --page-end: #0c1629; --surface: #1a2639;
      --ink: #eef3fc; --muted: #acb9cf; --accent: #80afff; --button: #2f6dd4; --button-hover: #245fc5;
      --border: #52617a; --input: #152135; --footer: #162133; --brand: #a6c8ff;
      --error: #ffb4b4; --error-bg: #432931; --notice: #f3d392; --notice-bg: #3a3223;
      --success: #9ddbbb; --success-bg: #193c32;
    `;

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="referrer" content="no-referrer">
  <title>${t('title')} · ZenTao CLI</title>
  <script nonce="${escapeHtml(options.nonce)}">
    try {
      const theme = localStorage.getItem('zentao-login-theme');
      if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    } catch {}
  </script>
  <style nonce="${escapeHtml(options.nonce)}">
    :root {
      color-scheme: light;
      --page-start: #3883fa; --page-end: #2b67e5; --surface: #fff;
      --ink: #30394a; --muted: #596780; --accent: #245fc5; --button: #2563d5; --button-hover: #1d54bd;
      --border: #bec8d9; --input: #fff; --footer: #f7f9fc; --brand: #0b3a59;
      --error: #a32024; --error-bg: #fff1f0; --notice: #76500e; --notice-bg: #fff7e5;
      --success: #176345; --success-bg: #edf8f1;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--ink); background: var(--page-end); font-size: 14px;
    }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${darkColors} } }
    :root[data-theme="dark"] { ${darkColors} }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body {
      margin: 0; min-height: 100svh; padding: 40px 24px; display: grid; place-items: center;
      background: linear-gradient(110deg, var(--page-start), var(--page-end));
    }
    main {
      width: 100%; max-width: 480px;
      background: var(--surface); border-radius: 4px; overflow: hidden;
      box-shadow: 0 16px 48px rgb(8 34 87 / 18%);
    }
    .page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 24px 32px 0; }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--brand); }
    .brand svg { width: 36px; height: 36px; flex-shrink: 0; }
    .brand-name { font-size: 20px; font-weight: 650; letter-spacing: -.02em; white-space: nowrap; }
    .content { padding: 24px 32px 28px; min-width: 0; }
    .preferences { display: flex; gap: 4px; }
    .preference { position: relative; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 3px; color: var(--muted); }
    .preference:hover { color: var(--accent); background: var(--footer); }
    .preference:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
    .preference svg { width: 20px; height: 20px; pointer-events: none; }
    .preference select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; color: var(--ink); background: var(--surface); font: inherit; }
    .theme-light, .theme-dark { display: none; }
    :root[data-theme="light"] .theme-system, :root[data-theme="dark"] .theme-system { display: none; }
    :root[data-theme="light"] .theme-light, :root[data-theme="dark"] .theme-dark { display: block; }
    h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.35; font-weight: 650; }
    p { margin: 0; line-height: 1.65; }
    .intro { color: var(--muted); margin-bottom: 26px; overflow-wrap: anywhere; }
    fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
    .field + .field { margin-top: 20px; }
    label { display: block; margin-bottom: 7px; font-size: 14px; font-weight: 500; }
    input {
      display: block; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--border);
      border-radius: 3px; background: var(--input); color: var(--ink); font: inherit; font-size: 16px; caret-color: var(--accent);
    }
    input::placeholder { color: var(--muted); opacity: 1; }
    input:hover:not(:disabled) { border-color: var(--accent); }
    :where(input, button, select, a):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    .hint { margin-top: 7px; font-size: 12px; color: var(--muted); }
    .notice { padding: 12px 14px; margin-top: 12px; border-radius: 3px; color: var(--notice); background: var(--notice-bg); font-size: 13px; }
    .notice.insecure { margin: 0 0 22px; }
    .actions { display: flex; gap: 12px; margin-top: 26px; }
    button { min-height: 44px; padding: 10px 18px; border: 1px solid transparent; border-radius: 3px; font: inherit; font-weight: 600; cursor: pointer; }
    .primary { flex: 1; color: #fff; background: var(--button); }
    .primary:hover:not(:disabled) { background: var(--button-hover); }
    .secondary { color: var(--ink); background: var(--surface); border-color: var(--border); }
    .secondary:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    button:disabled { opacity: .65; cursor: wait; }
    input:disabled { opacity: .7; }
    .feedback { margin-top: 20px; padding: 12px 14px; border-radius: 3px; font-size: 14px; overflow-wrap: anywhere; }
    .feedback.error { color: var(--error); background: var(--error-bg); }
    .feedback.success { color: var(--success); background: var(--success-bg); }
    .privacy { margin-top: 20px; color: var(--muted); font-size: 12px; }
    footer { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px 20px; padding: 16px 24px; background: var(--footer); color: var(--muted); font-size: 12px; }
    footer a { display: inline-flex; align-items: center; min-height: 28px; color: var(--accent); text-underline-offset: 3px; }
    ::selection { color: #fff; background: var(--button); }
    html { scrollbar-color: var(--border) var(--surface); }
    @media (max-width: 480px) {
      body { padding: 24px 16px; }
      .page-header { padding: 20px 20px 0; }
      .brand svg { width: 32px; height: 32px; }
      .brand-name { font-size: 18px; }
      .content { padding: 24px 20px; }
      footer { gap: 4px 16px; padding: 14px 20px; }
    }
    @media (pointer: coarse) { .preference { width: 44px; height: 44px; } }
    @media (prefers-reduced-motion: no-preference) {
      button, input, select { transition: border-color 120ms ease-out, background-color 120ms ease-out; }
    }
    @media (forced-colors: active) { main { border: 1px solid CanvasText; } }
  </style>
</head>
<body>
  <main>
    <header class="page-header">
      <div class="brand">
      <!-- Original Pixel Tao geometry from site/public/brand/pixel-tao-terminal-blue-flat.svg. -->
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" shape-rendering="crispEdges"><path d="M6 1h4v1H6z M4 2h8v1H4z M3 3h10v1H3z M2 4h2v1H2z M9 4h5v1H9z M2 5h1v1H2z M4 5h2v1H4z M10 5h4v1h-4z M1 6h5v1H1z M11 6h4v1h-4z M1 7h4v1H1z M6 7h4v1H6z M13 7h2v1h-2z M1 8h3v1H1z M5 8h3v1H5z M10 8h5v1h-5z M1 9h3v1H1z M5 9h2v1H5z M8 9h1v1H8z M11 9h4v1h-4z M2 10h2v1H2z M5 10h5v1H5z M11 10h3v1h-3z M2 11h2v1H2z M6 11h3v1H6z M11 11h3v1h-3z M3 12h2v1H3z M10 12h3v1h-3z M4 13h8v1H4z M6 14h4v1H6z"/></svg>
      <span class="brand-name">ZenTao CLI</span>
      </div>
      <div class="preferences">
        <div class="preference">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>
          <select id="language" data-i18n-label="language" aria-label="${t('language')}" title="${t('language')}"><option value="zh-CN" lang="zh-CN">简体中文</option><option value="zh-TW" lang="zh-TW">繁體中文</option><option value="en" lang="en">English</option></select>
        </div>
        <div class="preference">
          <svg class="theme-system" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/></svg>
          <svg class="theme-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
          <svg class="theme-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/></svg>
          <select id="theme" data-i18n-label="theme" aria-label="${t('theme')}" title="${t('theme')}"><option value="system" data-i18n="system">${t('system')}</option><option value="light" data-i18n="light">${t('light')}</option><option value="dark" data-i18n="dark">${t('dark')}</option></select>
        </div>
      </div>
    </header>
    <section class="content" aria-labelledby="title">
      <h1 id="title">${t('title')}</h1>
      <p class="intro" id="intro">${escapeHtml(options.message ?? browserMessages['zh-CN'].intro)}</p>
      ${options.insecure ? `<p class="notice insecure" data-i18n="insecureNotice">${t('insecureNotice')}</p>` : ''}
      <form id="login-form" method="post" action="/login">
        <fieldset id="fields" disabled>
          <div class="field">
            <label for="server" data-i18n="server">${t('server')}</label>
            <input id="server" name="server" type="url" autocomplete="url" inputmode="url" spellcheck="false" required placeholder="https://zentao.example.com" value="${escapeHtml(options.server ?? '')}" aria-describedby="server-hint http-notice">
            <p class="hint" id="server-hint" data-i18n="serverHint">${t('serverHint')}</p>
            <p class="notice" id="http-notice" data-i18n="httpNotice" hidden>${t('httpNotice')}</p>
          </div>
          <div class="field">
            <label for="account" data-i18n="account">${t('account')}</label>
            <input id="account" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(options.account ?? '')}">
          </div>
          <div class="field">
            <label for="password" data-i18n="password">${t('password')}</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <div class="actions">
            <button class="primary" id="submit" type="submit">${t('submit')}</button>
            <button class="secondary" id="cancel" type="button">${t('cancel')}</button>
          </div>
        </fieldset>
      </form>
      <noscript><p class="notice">${t('noScript')} / Please enable JavaScript and restart login from ZenTao CLI.</p></noscript>
      <p class="feedback" id="feedback" role="status" aria-live="polite" tabindex="-1" hidden></p>
      <p class="privacy" id="privacy" data-i18n="privacy">${t('privacy')}</p>
    </section>
    <footer>
      <span>ZenTao CLI v${escapeHtml(getCliVersion())}</span>
      <a href="https://www.zentao.net/" target="_blank" rel="noopener noreferrer" data-i18n="website" data-i18n-label="websiteLabel" aria-label="${t('websiteLabel')}">${t('website')}</a>
      <a href="https://github.com/easysoft/zentao-cli" target="_blank" rel="noopener noreferrer" data-i18n-label="githubLabel" aria-label="${t('githubLabel')}">GitHub</a>
    </footer>
  </main>
  <script nonce="${escapeHtml(options.nonce)}">
    (() => {
      const messages = ${JSON.stringify(browserMessages).replace(/</g, '\\u003c')};
      let sessionKey = location.hash.slice(1);
      history.replaceState(null, '', location.pathname);
      const form = document.getElementById('login-form');
      const fields = document.getElementById('fields');
      const server = document.getElementById('server');
      const account = document.getElementById('account');
      const password = document.getElementById('password');
      const submit = document.getElementById('submit');
      const cancel = document.getElementById('cancel');
      const feedback = document.getElementById('feedback');
      const language = document.getElementById('language');
      const theme = document.getElementById('theme');
      const intro = document.getElementById('intro');
      const customMessage = ${options.message !== undefined} ? intro.textContent : null;
      let locale;
      try { locale = localStorage.getItem('zentao-login-language'); } catch {}
      if (!Object.hasOwn(messages, locale)) {
        locale = (navigator.languages || [navigator.language]).map(value => {
          if (/^zh(?:-|$)/i.test(value)) return /^zh-(?:TW|HK|MO|Hant)(?:-|$)/i.test(value) ? 'zh-TW' : 'zh-CN';
          if (/^en(?:-|$)/i.test(value)) return 'en';
        }).find(Boolean) || 'en';
      }
      language.value = locale;
      theme.value = document.documentElement.dataset.theme || 'system';
      let stage = 'login';
      let pending = '';
      let feedbackState;
      const translate = (key, args = {}) => messages[locale][key].replace(/\{(account|server)\}/g, (_, name) => args[name] ?? '');

      function render() {
        document.documentElement.lang = locale;
        document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = translate(el.dataset.i18n); });
        document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', translate(el.dataset.i18nLabel)); });
        language.setAttribute('title', translate('language') + ': ' + locale);
        theme.setAttribute('title', translate('theme') + ': ' + translate(theme.value));
        const title = translate(stage === 'login' ? 'title' : stage === 'success' ? 'successTitle' : 'cancelTitle');
        document.getElementById('title').textContent = title;
        document.title = title + ' · ZenTao CLI';
        intro.textContent = stage === 'login' ? (customMessage ?? translate('intro')) : translate('finishedIntro');
        submit.textContent = translate(pending === 'submit' ? 'submitting' : 'submit');
        cancel.textContent = translate(pending === 'cancel' ? 'cancelling' : 'cancel');
        if (feedbackState) feedback.textContent = translate(feedbackState.key, feedbackState.args);
      }
      function savePreference(name, value) {
        try { localStorage.setItem('zentao-login-' + name, value); } catch {}
      }
      language.addEventListener('change', () => {
        if (!Object.hasOwn(messages, language.value)) return;
        locale = language.value;
        savePreference('language', locale);
        render();
      });
      theme.addEventListener('change', () => {
        document.documentElement.dataset.theme = theme.value;
        savePreference('theme', theme.value);
        render();
      });
      render();

      function showFeedback(key, state, args) {
        feedbackState = { key, args };
        feedback.className = 'feedback ' + state;
        feedback.hidden = false;
        render();
      }
      function finish(nextStage, messageKey, args) {
        stage = nextStage;
        password.value = '';
        sessionKey = '';
        form.hidden = true;
        document.getElementById('privacy').hidden = true;
        showFeedback(messageKey, 'success', args);
        feedback.focus();
      }
      async function request(path, body) {
        const response = await fetch(path, {
          method: 'POST', mode: 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-Zentao-Login': sessionKey },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(Object.hasOwn(messages[locale], result.errorCode) ? result.errorCode : 'requestFailed');
        }
        return result;
      }
      function updateHttpNotice() {
        document.getElementById('http-notice').hidden = !server.value.trim().toLowerCase().startsWith('http://');
      }
      server.addEventListener('input', updateHttpNotice);
      updateHttpNotice();
      if (!sessionKey) {
        showFeedback('expired', 'error');
        return;
      }
      fields.disabled = false;
      (server.value ? (account.value ? password : account) : server).focus();
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (fields.disabled) return;
        fields.disabled = true;
        form.setAttribute('aria-busy', 'true');
        pending = 'submit';
        feedback.hidden = true;
        render();
        try {
          const result = await request('/login', { server: server.value.trim(), account: account.value.trim(), password: password.value });
          finish('success', 'successMessage', { account: result.account, server: result.server });
        } catch (error) {
          password.value = '';
          showFeedback(Object.hasOwn(messages[locale], error.message) ? error.message : 'connectionFailed', 'error');
          fields.disabled = false;
          password.focus();
        } finally {
          pending = '';
          render();
          form.removeAttribute('aria-busy');
        }
      });
      cancel.addEventListener('click', async () => {
        if (fields.disabled) return;
        password.value = '';
        fields.disabled = true;
        pending = 'cancel';
        render();
        try {
          await request('/cancel', {});
          finish('cancel', 'cancelMessage');
        } catch {
          showFeedback('cancelFailed', 'error');
          fields.disabled = false;
        } finally {
          pending = '';
          render();
        }
      });
    })();
  </script>
</body>
</html>`;
}
