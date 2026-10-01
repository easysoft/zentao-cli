import { getCliVersion } from '../utils/version.js';

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

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="referrer" content="no-referrer">
  <title>登录禅道 · ZenTao CLI</title>
  <style nonce="${escapeHtml(options.nonce)}">
    :root {
      color-scheme: light dark;
      --page: #f3f6f7; --surface: #fff; --ink: #0b2a43; --muted: #496374;
      --accent: #174d70; --button-ink: #fff; --border: #bccbd2;
      --error: #a32024; --error-bg: #fff1f0; --notice: #76500e; --notice-bg: #fff7e5;
      --success: #176345; --success-bg: #edf8f1;
      font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      color: var(--ink); background: var(--page); font-size: 16px;
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100svh; padding: 64px 24px 32px; }
    main { width: 100%; max-width: 480px; margin: 0 auto; }
    h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.3; letter-spacing: -.02em; }
    p { margin: 0; line-height: 1.7; }
    .intro { color: var(--muted); margin-bottom: 28px; }
    .panel { padding: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; }
    fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
    .field + .field { margin-top: 22px; }
    label { display: block; margin-bottom: 8px; font-size: 15px; font-weight: 600; }
    input {
      display: block; width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid var(--border);
      border-radius: 3px; background: var(--surface); color: var(--ink); font: inherit; caret-color: var(--accent);
    }
    input::placeholder { color: var(--muted); opacity: 1; }
    input:hover:not(:disabled) { border-color: var(--accent); }
    input:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    .hint { margin-top: 8px; font-size: 13px; color: var(--muted); }
    .notice { padding: 12px 14px; margin-top: 16px; border-radius: 3px; color: var(--notice); background: var(--notice-bg); font-size: 13px; }
    .notice.insecure { margin: 0 0 22px; }
    .actions { display: flex; gap: 12px; margin-top: 28px; }
    button { min-height: 46px; padding: 10px 18px; border: 1px solid var(--accent); border-radius: 3px; font: inherit; font-weight: 600; cursor: pointer; }
    .primary { flex: 1; color: var(--button-ink); background: var(--accent); }
    .secondary { color: var(--accent); background: var(--surface); }
    button:hover:not(:disabled) { filter: brightness(.9); }
    button:disabled { opacity: .6; cursor: wait; }
    input:disabled { opacity: .7; }
    .feedback { margin-top: 20px; padding: 12px 14px; border-radius: 3px; font-size: 14px; overflow-wrap: anywhere; }
    .feedback.error { color: var(--error); background: var(--error-bg); }
    .feedback.success { color: var(--success); background: var(--success-bg); }
    .privacy { margin: 20px 0 0; color: var(--muted); font-size: 13px; }
    footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 24px; color: var(--muted); font-size: 13px; }
    footer a { display: inline-flex; align-items: center; min-height: 24px; color: var(--accent); text-underline-offset: 3px; }
    footer a:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    ::selection { color: var(--button-ink); background: var(--accent); }
    html { scrollbar-color: var(--border) var(--page); }
    @media (prefers-color-scheme: dark) {
      :root {
        --page: #06111e; --surface: #0d2031; --ink: #e0ebef; --muted: #a6bcc8;
        --accent: #91b9cb; --button-ink: #06111e; --border: #496374;
        --error: #ffb3af; --error-bg: #432125; --notice: #edca85; --notice-bg: #342c1d;
        --success: #9ddbbb; --success-bg: #16352b;
      }
    }
    @media (max-width: 480px) {
      body { padding: 32px 20px 24px; }
      .panel { padding: 22px 18px; }
      h1 { font-size: 26px; }
    }
    @media (prefers-reduced-motion: no-preference) {
      button, input { transition: border-color 120ms ease-out, filter 120ms ease-out; }
    }
  </style>
</head>
<body>
  <main>
    <h1 id="title">登录禅道</h1>
    <p class="intro" id="intro">${escapeHtml(options.message ?? '完成登录后，回到 ZenTao CLI 即可继续使用禅道。')}</p>
    <div class="panel">
      ${options.insecure ? '<p class="notice insecure">当前已关闭 HTTPS 证书验证。请确认禅道地址属于你信任的服务器。</p>' : ''}
      <form id="login-form" method="post" action="/login">
        <fieldset id="fields" disabled>
          <div class="field">
            <label for="server">禅道地址</label>
            <input id="server" name="server" type="url" autocomplete="url" inputmode="url" spellcheck="false" required placeholder="https://zentao.example.com" value="${escapeHtml(options.server ?? '')}" aria-describedby="server-hint http-notice">
            <p class="hint" id="server-hint">填写平时访问禅道的完整地址，保留 /zentao 等子目录。</p>
            <p class="notice" id="http-notice" hidden>此地址使用 HTTP，账号和密码将通过未加密的连接发送。请确认网络环境可信。</p>
          </div>
          <div class="field">
            <label for="account">用户名</label>
            <input id="account" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(options.account ?? '')}">
          </div>
          <div class="field">
            <label for="password">密码</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <div class="actions">
            <button class="primary" id="submit" type="submit">登录并保存</button>
            <button class="secondary" id="cancel" type="button">取消</button>
          </div>
        </fieldset>
      </form>
      <noscript><p class="notice">请启用浏览器的 JavaScript，然后重新从 Agent 发起登录。</p></noscript>
      <p class="feedback" id="feedback" role="status" aria-live="polite" tabindex="-1" hidden></p>
      <p class="privacy" id="privacy">登录状态保存在本机。密码仅用于本次登录，不会保存到 CLI 配置。</p>
    </div>
    <footer>
      <span>ZenTao CLI v${escapeHtml(getCliVersion())}</span>
      <a href="https://www.zentao.net/" target="_blank" rel="noopener noreferrer" aria-label="禅道官网（新标签页打开）">禅道官网</a>
      <a href="https://github.com/easysoft/zentao-cli" target="_blank" rel="noopener noreferrer" aria-label="GitHub 项目（新标签页打开）">GitHub</a>
    </footer>
  </main>
  <script nonce="${escapeHtml(options.nonce)}">
    (() => {
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
      const expired = '此登录页面已失效，请回到 Agent 重新发起登录。';

      function showFeedback(message, state) {
        feedback.textContent = message;
        feedback.className = 'feedback ' + state;
        feedback.hidden = false;
      }

      function finish(title, message, state) {
        password.value = '';
        sessionKey = '';
        form.hidden = true;
        document.getElementById('privacy').hidden = true;
        document.getElementById('title').textContent = title;
        document.getElementById('intro').textContent = '你可以关闭此页面，回到 Agent 继续操作。';
        showFeedback(message, state);
        feedback.focus();
      }

      async function request(path, body) {
        const response = await fetch(path, {
          method: 'POST',
          mode: 'same-origin',
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'X-Zentao-Login': sessionKey },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || expired);
        return result;
      }

      function updateHttpNotice() {
        document.getElementById('http-notice').hidden = !server.value.trim().toLowerCase().startsWith('http://');
      }
      server.addEventListener('input', updateHttpNotice);
      updateHttpNotice();

      if (!sessionKey) {
        showFeedback(expired, 'error');
        return;
      }
      fields.disabled = false;
      (server.value ? (account.value ? password : account) : server).focus();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (fields.disabled) return;
        fields.disabled = true;
        form.setAttribute('aria-busy', 'true');
        submit.textContent = '正在登录…';
        feedback.hidden = true;
        try {
          const result = await request('/login', { server: server.value.trim(), account: account.value.trim(), password: password.value });
          finish('登录成功', '已登录账号 ' + result.account + '（' + result.server + '）。登录状态已保存，可以返回 Agent 继续操作。', 'success');
        } catch (error) {
          password.value = '';
          showFeedback(error instanceof TypeError ? '无法连接登录服务，页面可能已过期。请回到 Agent 重新发起登录。' : error.message, 'error');
          fields.disabled = false;
          password.focus();
        } finally {
          submit.textContent = '登录并保存';
          form.removeAttribute('aria-busy');
        }
      });

      cancel.addEventListener('click', async () => {
        password.value = '';
        fields.disabled = true;
        cancel.textContent = '正在取消…';
        try {
          await request('/cancel', {});
          finish('已取消登录', '本次登录已取消。需要使用禅道时，可让 Agent 重新发起登录。', 'success');
        } catch {
          showFeedback('无法连接登录服务，页面可能已过期。请关闭此页面，回到 Agent 查看登录状态。', 'error');
          fields.disabled = false;
        } finally {
          cancel.textContent = '取消';
        }
      });
    })();
  </script>
</body>
</html>`;
}
