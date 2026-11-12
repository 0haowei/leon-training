/* Google Calendar → Leon. All API calls are read-only; tokens live in memory. */
(() => {
  'use strict';
  const KEY = 'leon-calendar-settings-v1';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly';
  let settings;
  try { settings = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { settings = {}; }
  const oldKeywords = '网球,tennis,体能,力量,恢复,发球,对拉,教练,激活';
  settings = { clientId: '', calendarId: 'primary', keywords: oldKeywords + ',饮食,飲食,营养,營養', enabled: false, ...settings };
  if (settings.keywords === oldKeywords) settings.keywords += ',饮食,飲食,营养,營養';
  let token = '', expires = 0, generation = 0, controller, busy = false;
  const section = document.createElement('section');
  section.className = 'card calendar-panel';
  section.innerHTML = `
    <div class="title">📅 Google 日历 · 训练安排</div>
    <div class="desc">以日历为准显示所选日期的安排和详细内容，包括饮食说明。下方动作卡片仅作训练模板参考；连接后不再显示固定饮食模板。</div>
    <details><summary>连接设置</summary>
      <label>Google OAuth 客户端 ID<input id="gc-client" placeholder="…apps.googleusercontent.com" autocomplete="off"></label>
      <label>训练关键词（逗号分隔；留空显示全部事件）<input id="gc-keywords"></label>
      <div class="status">首次使用请按随附的「Google日历配置.md」完成 Google 配置，无需客户端密钥。</div>
      <div class="tools"><button id="gc-save">保存设置</button></div>
    </details>
    <label>选择日历<select id="gc-calendar"><option value="primary">主日历（连接后可选择其他日历）</option></select></label>
    <div class="tools"><button id="gc-connect">连接 Google 日历</button><button id="gc-refresh">立即刷新</button><button id="gc-disconnect">断开连接</button></div>
    <div class="status" id="gc-status" role="status" aria-live="polite"></div>
    <div id="gc-events"></div>`;
  document.querySelector('#app').before(section);
  const $ = id => document.getElementById(id);
  $('gc-client').value = settings.clientId;
  $('gc-keywords').value = settings.keywords;
  if (settings.calendarId !== 'primary') $('gc-calendar').add(new Option('上次选择的日历（连接后加载名称）', settings.calendarId));
  $('gc-calendar').value = settings.calendarId;
  const status = message => { $('gc-status').textContent = message; };
  const clearEvents = () => $('gc-events').replaceChildren();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); }
    catch { status('设置仅在本次页面有效：浏览器不允许保存设置。'); }
  }
  function cancel() { generation++; controller?.abort(); busy = false; }
  function templateLabels() {
    if (!settings.enabled) return;
    document.querySelectorAll('#app .cardhead .time').forEach(el => { el.textContent = '动作模板 · 非日历安排'; });
    const eyebrow = document.querySelector('#app .eyebrow');
    if (eyebrow) eyebrow.textContent = `${activeDate} · ${names[selected]} · 每周动作模板（实际安排见上方日历）`;
    document.querySelectorAll('#app .section').forEach(heading => {
      if (heading.textContent.includes('今日营养目标')) {
        heading.textContent = '🍜 饮食以日历详细内容为准';
        const card = heading.nextElementSibling;
        if (card) card.hidden = true;
      }
    });
  }
  const originalRender = render;
  render = function () { originalRender(); templateLabels(); clearEvents(); refresh(); };
  const addText = (parent, tag, text, className) => {
    const el = document.createElement(tag); el.textContent = text;
    if (className) el.className = className;
    parent.append(el); return el;
  };
  const time = value => new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
  // Produce text only. Never insert calendar-supplied HTML into the live DOM.
  function descriptionText(value) {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return String(value || '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<br\b[^>]*>/gi, '\n')
      .replace(/<\/(?:div|p|li|ul|ol|h[1-6]|tr)\s*>/gi, '\n')
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, code) => {
        if (code[0] !== '#') return entities[code.toLowerCase()] || whole;
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
      }).replace(/\n{3,}/g, '\n\n').trim();
  }
  function showEvents(events, date) {
    clearEvents();
    const keywords = settings.keywords.split(/[,，]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const filtered = events.filter(e => e.status !== 'cancelled' && !e.attendees?.some(a => a.self && a.responseStatus === 'declined') &&
      (!keywords.length || keywords.some(k => `${e.summary || ''} ${e.description || ''}`.toLowerCase().includes(k))));
    if (!filtered.length) addText($('gc-events'), 'p', `${date} 没有符合筛选条件的日历安排。可检查日历选择或调整关键词。`, 'muted');
    for (const event of filtered) {
      const card = addText($('gc-events'), 'article', '', 'card');
      addText(card, 'div', event.summary || '未命名事件', 'title');
      const when = event.start?.date ? `全天 · ${event.start.date} 至 ${event.end?.date || event.start.date}（结束日期不含当天）` :
        `${time(event.start.dateTime)} — ${time(event.end.dateTime)} · 北京时间`;
      addText(card, 'div', when, 'desc');
      if (event.location) addText(card, 'div', event.location, 'muted');
      const description = addText(card, 'div', descriptionText(event.description) || '此事件没有详细说明。', 'desc');
      description.style.whiteSpace = 'pre-wrap';
      if (event.htmlLink) {
        try {
          const url = new URL(event.htmlLink);
          if (url.protocol === 'https:' && (url.hostname === 'calendar.google.com' || url.hostname === 'www.google.com')) {
            const link = addText(card, 'a', '在 Google 日历中查看 / 改期 ↗', 'expert');
            link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
          }
        } catch { /* Ignore invalid external links. */ }
      }
    }
    return filtered.length;
  }
  async function getAll(path, params, signal, accessToken) {
    const items = []; let pageToken;
    do {
      const query = new URLSearchParams(params);
      if (pageToken) query.set('pageToken', pageToken);
      const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal, cache: 'no-store'
      });
      if (!response.ok) {
        const error = new Error(response.status === 401 ? '授权已过期，请点击「连接 Google 日历」。' :
          response.status === 403 ? '无法读取日历：请检查 Calendar API 是否启用、只读授权是否完成，以及日历访问权限。' :
          response.status === 404 ? '所选日历不存在或无权访问，请重新连接并选择日历。' : `读取失败（HTTP ${response.status}），请稍后刷新。`);
        error.status = response.status; throw error;
      }
      const data = await response.json(); items.push(...(data.items || [])); pageToken = data.nextPageToken;
    } while (pageToken);
    return items;
  }
  async function refresh(loadCalendars = false) {
    cancel();
    if (!settings.enabled) { status('尚未连接 · 当前使用本机每周计划'); return; }
    if (!navigator.onLine) { clearEvents(); status('当前离线，无法确认日历安排；下方动作模板仍可使用。'); return; }
    if (!token || Date.now() >= expires) { token = ''; clearEvents(); status('请点击「连接 Google 日历」读取最新安排。重新打开网页或授权到期后需要再次连接。'); return; }
    const current = generation, date = activeDate, accessToken = token;
    controller = new AbortController(); const signal = controller.signal;
    busy = true; status('正在读取 Google 日历…');
    try {
      if (loadCalendars) {
        const calendars = await getAll('users/me/calendarList', { maxResults: '250' }, signal, accessToken);
        if (current !== generation) return;
        const select = $('gc-calendar'); select.replaceChildren(new Option('主日历', 'primary'));
        calendars.forEach(c => select.add(new Option(c.summaryOverride || c.summary || c.id, c.id)));
        if (![...select.options].some(o => o.value === settings.calendarId)) settings.calendarId = 'primary';
        select.value = settings.calendarId; persist();
      }
      const next = new Date(`${date}T00:00:00+08:00`);
      next.setTime(next.getTime() + 86400000);
      const events = await getAll(`calendars/${encodeURIComponent(settings.calendarId)}/events`, {
        timeMin: `${date}T00:00:00+08:00`, timeMax: next.toISOString(), timeZone: TZ,
        singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false', maxResults: '250'
      }, signal, accessToken);
      if (current !== generation || date !== activeDate) return;
      const count = showEvents(events, date);
      status(`${date} · ${count} 项安排 · 更新于 ${new Date().toLocaleTimeString('zh-CN', { timeZone: TZ })} · 页面可见时每分钟刷新`);
    } catch (error) {
      if (current !== generation || error.name === 'AbortError') return;
      if (error.status === 401) token = '';
      clearEvents(); status(error.status ? error.message : '无法连接 Google 日历。请检查网络后点击刷新；此时不能确认实际安排。');
    } finally { if (current === generation) busy = false; }
  }
  $('gc-save').onclick = () => {
    const id = $('gc-client').value.trim();
    if (!id.endsWith('.apps.googleusercontent.com')) { status('请输入以 .apps.googleusercontent.com 结尾的 OAuth 客户端 ID。'); return; }
    if (id !== settings.clientId) { cancel(); token = ''; expires = 0; clearEvents(); }
    settings.clientId = id; settings.keywords = $('gc-keywords').value.trim(); persist();
    status('设置已保存。请连接 Google 日历，或点击立即刷新。');
  };
  $('gc-calendar').onchange = () => { settings.calendarId = $('gc-calendar').value; persist(); clearEvents(); refresh(); };
  $('gc-connect').onclick = () => {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') { status('请在 GitHub Pages 的 HTTPS 地址中打开，不能通过双击 HTML 连接 Google。'); return; }
    if (!settings.clientId) { section.querySelector('details').open = true; status('请先在连接设置中保存 Google OAuth 客户端 ID。'); return; }
    if (!window.google?.accounts?.oauth2) { status('Google 登录组件尚未加载。请检查能否访问 Google，再重新打开页面。'); return; }
    cancel(); token = ''; clearEvents();
    const attempt = generation;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: settings.clientId, scope: SCOPES,
      callback: response => {
        if (attempt !== generation) return;
        if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, ...SCOPES.split(' '))) {
          status('连接未完成，需要允许读取日历及日历列表。'); return;
        }
        token = response.access_token; expires = Date.now() + Math.max(0, Number(response.expires_in) - 60) * 1000;
        settings.enabled = true; persist(); templateLabels(); refresh(true);
      },
      error_callback: () => { if (attempt === generation) status('登录窗口被关闭或拦截，请再次点击连接并允许弹出窗口。'); }
    });
    client.requestAccessToken({ prompt: 'select_account' });
  };
  $('gc-refresh').onclick = () => refresh();
  $('gc-disconnect').onclick = () => {
    cancel(); token = ''; expires = 0; settings.enabled = false; persist(); clearEvents(); originalRender();
    status('已断开本页连接，恢复本机每周计划。可在 Google 账号的第三方应用设置中撤销授权。');
  };
  setInterval(() => { if (!document.hidden && token && !busy) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token) refresh(); });
  window.addEventListener('online', () => { if (settings.enabled) refresh(); });
  window.addEventListener('offline', () => { if (settings.enabled) refresh(); });
  templateLabels(); refresh();
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
  script.onerror = () => status('Google 登录组件加载失败；本机训练记录仍可使用。请检查 Google 网络连接后重新打开页面。');
  document.head.append(script);
})();
