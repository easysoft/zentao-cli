/** Kept as plain JavaScript so the nonce-protected page needs no browser build or runtime. */
export const mcpStartScript = String.raw`
(() => {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const placeholder = '<your-zentao-token>';
  const base = location.pathname.replace(/\/start\/?$/, '/');
  const endpoint = new URL(base + 'mcp', location.origin).href;
  const tokenEndpoint = new URL(base + 'start/token', location.origin).href;
  const secure = window.isSecureContext;
  const systemLanguage = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  let language = systemLanguage;
  try {
    const saved = localStorage.getItem('zentao-mcp-language');
    if (saved === 'zh' || saved === 'en') language = saved;
  } catch {}
  let theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  let step = 1;
  let setupDone = false;
  let setupMode = 'agent';
  let promptExpanded = false;
  let token = '';
  let pending;
  let copyVersion = 0;
  const statuses = {};
  const steps = [
    { button: 'zt-go-token', panel: 'zt-token-panel', focus: 'zt-account' },
    { button: 'zt-go-setup', panel: 'zt-setup-panel', focus: 'zt-copy-prompt' },
    { button: 'zt-go-verify', panel: 'zt-verify-panel', focus: 'zt-copy-verify' },
  ];
  const t = key => data.messages[language][key];
  const loginMode = () => document.querySelector('input[name="zt-method"]:checked').value === 'login';
  const validToken = value => /^[A-Za-z0-9\-._~+/]+=*$/.test(value);
  const selectedToken = () => $('zt-include').checked && token ? token : placeholder;
  const setupFocus = () => setupMode === 'manual' ? 'zt-client' : 'zt-copy-prompt';
  function savePreference(name, value) {
    try { localStorage.setItem('zentao-mcp-' + name, value); } catch {}
  }
  function feedback(id, key, tone = '') {
    statuses[id] = { key, tone };
    $(id).textContent = key ? t(key) : '';
    $(id).dataset.tone = tone;
  }
  function updateGuide() {
    const agent = data.guides.find(item => item.id === $('zt-client').value);
    $('zt-agent-steps').textContent = language === 'en' ? agent.stepsEn : agent.steps;
    $('zt-agent-docs').href = agent.docs;
    $('zt-config').textContent = makeConfig(agent.id, endpoint, placeholder, language);
  }
  function updateReveal() {
    document.querySelectorAll('[data-reveal]').forEach(button => {
      const input = $(button.dataset.reveal);
      const show = input.type === 'text';
      const label = t((show ? 'hide' : 'show') + (input.id === 'zt-password' ? 'Password' : 'Token'));
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }
  function maskSecrets() {
    document.querySelectorAll('[data-reveal]').forEach(button => { $(button.dataset.reveal).type = 'password'; });
    updateReveal();
  }
  function render() {
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    root.dataset.theme = theme;
    document.title = t('title') + ' · ZenTao';
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
    $('zt-language').value = language;
    $('zt-language').title = t('language');
    $('zt-theme-switch').setAttribute('aria-checked', String(theme === 'dark'));
    $('zt-theme-switch').setAttribute('aria-label', t('darkMode'));
    $('zt-theme-switch').title = t(theme === 'dark' ? 'switchLight' : 'switchDark');
    steps.forEach((item, index) => {
      $(item.panel).hidden = step !== index + 1;
      if (step === index + 1) $(item.button).setAttribute('aria-current', 'step');
      else $(item.button).removeAttribute('aria-current');
    });
    const login = loginMode();
    $('zt-login-fields').hidden = !login;
    $('zt-existing-token').hidden = login;
    $('zt-login-fields').disabled = !!pending || !login;
    $('zt-continue').disabled = !!pending;
    $('zt-login-form').setAttribute('aria-busy', String(!!pending));
    $('zt-continue').querySelector('span').textContent = t(pending ? 'submitting' : login ? 'getToken' : 'continue');
    $('zt-assisted-setup').hidden = setupMode !== 'agent';
    $('zt-manual').hidden = setupMode !== 'manual';
    $('zt-token-status').textContent = t(token ? 'tokenReady' : 'tokenEmpty');
    $('zt-token-status').dataset.empty = String(!token);
    $('zt-first-number').textContent = token ? '✓' : '1';
    $('zt-second-number').textContent = setupDone ? '✓' : '2';
    $('zt-token-filled').hidden = !token;
    $('zt-token-empty').hidden = !!token;
    $('zt-include').disabled = !token;
    $('zt-copy-token').disabled = !token;
    $('zt-clear-token').disabled = !token;
    $('zt-include-warning').hidden = !$('zt-include').checked;
    $('zt-preview-action').textContent = t(promptExpanded ? 'collapse' : 'expand');
    $('zt-preview-toggle').setAttribute('aria-expanded', String(promptExpanded));
    $('zt-preview-toggle').setAttribute('aria-label', t(promptExpanded ? 'collapseInstructions' : 'expandInstructions'));
    const prompt = makePrompt(data.site, endpoint, placeholder, language);
    $('zt-prompt-preview').textContent = prompt;
    $('zt-prompt-preview').hidden = !promptExpanded;
    $('zt-prompt-excerpt').textContent = prompt.split('\n').filter(Boolean).slice(0, 2).join('\n');
    $('zt-prompt-excerpt').hidden = promptExpanded;
    $('zt-permissions').textContent = t(data.readOnly ? 'readOnly' : 'readWrite') + ' · ' + (data.modules?.join(language === 'zh' ? '、' : ', ') || t('allModules')) + ' · ' + t('accountPermissions');
    $('zt-address-hint').textContent = t(['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? 'localOnly' : 'reachable');
    for (const [id, status] of Object.entries(statuses)) feedback(id, status.key, status.tone);
    updateReveal();
    updateGuide();
  }
  function setToken(value) {
    token = value;
    setupDone = false;
    $('zt-existing').value = value;
    $('zt-current-token').value = value;
    $('zt-include').checked = false;
    $('zt-existing').removeAttribute('aria-invalid');
    copyVersion++;
    for (const id of ['zt-copy-feedback', 'zt-config-feedback', 'zt-token-feedback']) feedback(id, '');
    maskSecrets();
  }
  function cancelLogin() {
    if (pending) { pending.abort(); pending = undefined; }
    $('zt-password').value = '';
    maskSecrets();
  }
  function showStep(next, focus) {
    cancelLogin();
    feedback('zt-login-feedback', loginMode() ? 'trust' : 'retention');
    step = next;
    render();
    if (focus) $(next === 2 ? setupFocus() : focus).focus();
  }
  async function copy(text, target, key, secret = false) {
    const version = ++copyVersion;
    try {
      await navigator.clipboard.writeText(text);
      if (version === copyVersion) feedback(target, secret ? 'copiedSecret' : key, 'success');
    } catch {
      if (version === copyVersion) feedback(target, 'copyFailed', 'error');
    }
  }
  $('zt-credentials').disabled = !secure;
  $('zt-insecure').hidden = secure;
  $('zt-mcp-url').textContent = endpoint;
  steps.forEach((item, index) => $(item.button).addEventListener('click', () => showStep(index + 1, index === 0 && !loginMode() ? 'zt-existing' : item.focus)));
  $('zt-theme-switch').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; savePreference('theme', theme); render(); });
  $('zt-language').addEventListener('change', () => { language = $('zt-language').value; savePreference('language', language); render(); });
  $('zt-skip').addEventListener('click', () => showStep(2, 'zt-copy-prompt'));
  $('zt-next-verify').addEventListener('click', () => { setupDone = true; showStep(3, 'zt-copy-verify'); });
  $('zt-back-setup').addEventListener('click', () => showStep(2, 'zt-copy-prompt'));
  document.querySelectorAll('input[name="zt-method"]').forEach(radio => radio.addEventListener('change', () => {
    cancelLogin();
    ['zt-account', 'zt-password', 'zt-existing'].forEach(id => $(id).removeAttribute('aria-invalid'));
    feedback('zt-login-feedback', loginMode() ? 'trust' : 'retention');
    render();
  }));
  document.querySelectorAll('input[name="zt-setup-method"]').forEach(radio => radio.addEventListener('change', () => {
    setupMode = radio.value;
    copyVersion++;
    feedback('zt-copy-feedback', ''); feedback('zt-config-feedback', '');
    maskSecrets(); render();
  }));
  document.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.reveal);
    input.type = input.type === 'password' ? 'text' : 'password';
    updateReveal();
  }));
  ['zt-account', 'zt-password', 'zt-existing'].forEach(id => $(id).addEventListener('input', () => {
    $(id).removeAttribute('aria-invalid');
    feedback('zt-login-feedback', loginMode() ? 'trust' : 'retention');
  }));
  for (const id of ['zt-add-token', 'zt-change-token']) $(id).addEventListener('click', () => showStep(1, loginMode() ? 'zt-account' : 'zt-existing'));
  $('zt-clear-token').addEventListener('click', () => {
    cancelLogin(); setToken(''); render();
    feedback('zt-token-feedback', 'clearedNotice');
    $('zt-add-token').focus();
  });
  $('zt-include').addEventListener('change', () => { copyVersion++; feedback('zt-copy-feedback', ''); feedback('zt-config-feedback', ''); render(); });
  $('zt-preview-toggle').addEventListener('click', () => { promptExpanded = !promptExpanded; render(); });
  $('zt-copy-token').addEventListener('click', () => copy(token, 'zt-token-feedback', 'copied', true));
  $('zt-copy-prompt').addEventListener('click', () => copy(makePrompt(data.site, endpoint, selectedToken(), language), 'zt-copy-feedback', 'copiedInstructions', $('zt-include').checked));
  $('zt-copy-config').addEventListener('click', () => copy(makeConfig($('zt-client').value, endpoint, selectedToken(), language), 'zt-config-feedback', 'copied', $('zt-include').checked));
  $('zt-copy-verify').addEventListener('click', () => copy(t('verifyPrompt'), 'zt-verify-feedback', 'copiedVerify'));
  $('zt-client').addEventListener('change', () => { copyVersion++; feedback('zt-config-feedback', ''); updateGuide(); });
  $('zt-login-form').addEventListener('keydown', event => { if (event.key === 'Enter' && event.isComposing) event.preventDefault(); });
  $('zt-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !secure) return;
    if (!loginMode()) {
      const value = $('zt-existing').value.trim();
      if (!validToken(value)) {
        $('zt-existing').setAttribute('aria-invalid', 'true');
        feedback('zt-login-feedback', value ? 'invalidToken' : 'tokenRequired', 'error');
        $('zt-existing').focus();
        return;
      }
      setToken(value); showStep(2, 'zt-copy-prompt'); return;
    }
    const missing = ['zt-account', 'zt-password'].filter(id => !$(id).value || (id === 'zt-account' && !$(id).value.trim()));
    for (const id of ['zt-account', 'zt-password']) $(id).setAttribute('aria-invalid', String(missing.includes(id)));
    if (missing.length) { feedback('zt-login-feedback', 'required', 'error'); $(missing[0]).focus(); return; }
    const body = JSON.stringify({ account: $('zt-account').value.trim(), password: $('zt-password').value });
    const controller = new AbortController();
    pending = controller;
    let focus = 'zt-continue';
    setToken('');
    feedback('zt-login-feedback', 'connecting'); render();
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST', mode: 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Zentao-Start': data.key }, body,
      });
      const result = await response.json();
      if (pending !== controller) return;
      if (!response.ok) {
        feedback('zt-login-feedback', Object.hasOwn(data.messages.zh, result.errorCode) ? result.errorCode : 'loginFailed', 'error');
        if (response.status === 401) { $('zt-password').setAttribute('aria-invalid', 'true'); focus = 'zt-password'; }
        return;
      }
      if (typeof result.token !== 'string' || !validToken(result.token)) { feedback('zt-login-feedback', 'invalidTokenResponse', 'error'); return; }
      setToken(result.token);
      step = 2; focus = setupFocus();
    } catch {
      if (pending === controller) feedback('zt-login-feedback', 'networkError', 'error');
    } finally {
      if (pending === controller) {
        pending = undefined; cancelLogin(); render(); $(focus).focus();
      }
    }
  });
  window.addEventListener('pagehide', () => {
    cancelLogin(); setToken(''); $('zt-account').value = ''; step = 1;
    for (const id of Object.keys(statuses)) feedback(id, '');
    feedback('zt-login-feedback', loginMode() ? 'trust' : 'retention'); render();
  });
  feedback('zt-login-feedback', 'trust');
  render();
})();
`;
