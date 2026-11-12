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
  settings.calendarIds = settings.calendarIds?.length ? settings.calendarIds : [settings.calendarId];
  let calendarNames = {};
  let calendarsLoaded = false;
  let snapshot = null;
  let token = '', expires = 0, generation = 0, controller, busy = false;
  const section = document.createElement('section');
  section.className = 'card calendar-panel';
  section.innerHTML = `
    <div class="title">📅 Google 日历 · 动态卡片 v6.1</div>
    <div class="desc">训练动作、饮食和营养目标均来自所选日历。修改或删除日历内容后，下方卡片随刷新更新。</div>
    <details><summary>连接设置</summary>
      <label>Google OAuth 客户端 ID<input id="gc-client" placeholder="…apps.googleusercontent.com" autocomplete="off"></label>
      <label>训练关键词（逗号分隔；留空显示全部事件）<input id="gc-keywords"></label>
      <div class="status">每台设备首次使用都需填入同一个客户端 ID 并连接 Google。无需重新创建客户端，也无需填写客户端密钥。</div>
      <div class="tools"><button id="gc-save">保存设置</button></div>
    </details>
    <fieldset class="calendar-choices"><legend>选择日历（直接勾选，可多选）</legend><div id="gc-picker"></div></fieldset>
    <select id="gc-calendar" multiple hidden aria-hidden="true" tabindex="-1"><option value="primary">主日历</option></select>
    <div class="tools"><button id="gc-connect">连接 Google 日历</button><button id="gc-refresh">立即刷新</button><button id="gc-disconnect">断开连接</button></div>
    <div class="status" id="gc-status" role="status" aria-live="polite"></div>
    <div id="gc-events"></div>`;
  document.querySelector('#app').before(section);
  const $ = id => document.getElementById(id);
  $('gc-client').value = settings.clientId;
  $('gc-keywords').value = settings.keywords;
  settings.calendarIds.filter(id => id !== 'primary').forEach(id => $('gc-calendar').add(new Option('上次选择的日历（连接后加载名称）', id)));
  [...$('gc-calendar').options].forEach(o => { o.selected = settings.calendarIds.includes(o.value); });
  function drawCalendarChoices() {
    const picker = $('gc-picker'); picker.replaceChildren();
    if (!token) {
      const hint = document.createElement('p'); hint.className = 'muted';
      hint.textContent = '连接 Google 后显示日历列表。手机和电脑需要分别连接。';
      picker.append(hint); return;
    }
    if (!calendarsLoaded) {
      const hint = document.createElement('p'); hint.className = 'muted';
      hint.textContent = '已连接 Google，正在加载日历列表；未显示时可点击立即刷新。';
      picker.append(hint); return;
    }
    for (const option of $('gc-calendar').options) {
      const label = document.createElement('label'); label.className = 'calendar-choice';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = option.selected;
      const name = document.createElement('span'); name.textContent = option.textContent;
      input.onchange = () => { option.selected = input.checked; $('gc-calendar').onchange(); };
      label.append(input); label.append(name); picker.append(label);
    }
  }
  drawCalendarChoices();
  const status = message => { $('gc-status').textContent = message; };
  const clearEvents = () => { snapshot = null; $('gc-events').replaceChildren(); if (settings.enabled) drawCards(); };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); }
    catch { status('设置仅在本次页面有效：浏览器不允许保存设置。'); }
  }
  function cancel() { generation++; controller?.abort(); busy = false; }
  function templateLabels() {
    if (settings.enabled) drawCards();
  }
  const originalRender = render;
  render = function () { originalRender(); templateLabels(); refresh(); };
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
    const keywords = settings.keywords.split(/[,，]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const filtered = events.filter(e => e.status !== 'cancelled' && !e.attendees?.some(a => a.self && a.responseStatus === 'declined') &&
      (sourceCategory(e._calendarName) !== 'other' || !keywords.length || keywords.some(k => `${e.summary || ''} ${e.description || ''}`.toLowerCase().includes(k))));
    snapshot = { date, events: filtered };
    // Do not interrupt an unfinished weight input during the automatic poll.
    if (!document.activeElement?.matches?.('#app input')) drawCards();
    return filtered.length;
  }
  function sourceCategory(title = '') {
    if (/饮食|飲食|营养|營養|早餐|午餐|晚餐|加餐|nutrition|meal/i.test(title)) return 'food';
    if (/力量|体能|體能|恢复|恢復|激活|核心|上肢|下肢|健身|strength|fitness/i.test(title)) return 'fitness';
    if (/网球|網球|tennis|发球|發球|对拉|對拉|教练|教練|击球|擊球/i.test(title)) return 'tennis';
    return 'other';
  }
  function category(event) {
    const source = sourceCategory(event._calendarName);
    return source !== 'other' ? source : sourceCategory(event.summary || '');
  }
  function foodParts(text) {
    const meals = [], notes = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim(); if (!line) continue;
      const m = line.match(/^(?:[🍌🍚🐟🥛💧🥪🍜\s•*\-]*)?(早餐|午餐|晚餐|加餐|训练前加餐|訓練前加餐|训练后加餐|訓練後加餐|运动补水|運動補水|补水|補水)[：:]\s*(.*)$/u);
      if (m) { if (m[2].trim()) meals.push({ name: m[1], text: m[2].trim() }); }
      else notes.push(line);
    }
    return { meals, notes };
  }
  function recordKey(event, line, occurrence, field) {
    // Full encoded identifiers avoid associating records with a different row after edits/reordering.
    const identity = [event._calendarId || settings.calendarId, event.id || event.summary,
      event.originalStartTime?.dateTime || event.originalStartTime?.date || '', line, occurrence];
    return STORE + activeDate + ':calendar:' + encodeURIComponent(JSON.stringify(identity)) + ':' + field;
  }
  function drawCards() {
    const app = $('app'); app.replaceChildren();
    const summary = addText(app, 'div', '', 'summary');
    addText(summary, 'div', `${activeDate} · ${names[selected]} · Google 日历`, 'eyebrow');
    addText(summary, 'div', '今日训练与饮食', 'big');
    addText(summary, 'div', '卡片来自日历；打卡和重量保存在本机。', 'muted');
    if (!snapshot || snapshot.date !== activeDate) {
      addText(app, 'p', '等待读取当天日历，请查看上方连接状态。', 'muted'); return;
    }
    const events = snapshot.events.filter(e => tab === 'all' || category(e) === tab);
    if (!events.length) addText(app, 'p', '当天没有符合当前分类的日历内容。可检查日期、所选日历与筛选关键词。', 'muted');
    for (const event of events) {
      const type = category(event);
      const card = addText(app, 'article', '', 'card');
      addText(card, 'div', event.summary || '未命名事件', 'title');
      const when = event.start?.date ? `全天 · ${event.start.date} 至 ${event.end?.date || event.start.date}（结束日期不含当天）` :
        `${time(event.start.dateTime)} — ${time(event.end.dateTime)} · 北京时间`;
      addText(card, 'div', when, 'desc');
      if (event._calendarName) addText(card, 'div', '来自 ' + event._calendarName, 'muted');
      if (event.location) addText(card, 'div', event.location, 'muted');
      const text = descriptionText(event.description);
      if (type === 'food') {
        const metrics = [['蛋白质', /(?:蛋白质|蛋白質|蛋白)\s*[：:]?\s*(\d+(?:\.\d+)?)\s*g/i], ['碳水', /碳水(?:化合物)?\s*[：:]?\s*(\d+(?:\.\d+)?)\s*g/i], ['脂肪', /脂肪\s*[：:]?\s*(\d+(?:\.\d+)?)\s*g/i]];
        const values = metrics.map(([name, re]) => [name, (text.match(re) || (event.summary || '').match(re))?.[1]]).filter(([, value]) => value !== undefined);
        if (values.length) {
          const grid = addText(card, 'div', '', 'metrics');
          for (const [name, value] of values) { const m = addText(grid, 'div', '', 'metric'); addText(m, 'div', value, 'num'); addText(m, 'div', name + ' g', 'unit'); }
        }
        const { meals, notes } = foodParts(text);
        for (const meal of meals) {
          const row = addText(card, 'div', '', 'food');
          const icon = /早餐/.test(meal.name) ? '🍌' : /午餐/.test(meal.name) ? '🍚' : /晚餐/.test(meal.name) ? '🐟' : /水/.test(meal.name) ? '💧' : '🥛';
          addText(row, 'div', icon, 'foodicon'); const content = addText(row, 'div', '');
          addText(content, 'div', meal.name, 'foodname'); addText(content, 'div', meal.text, 'fooddesc');
        }
        if (notes.length) { const note = addText(card, 'div', notes.join('\n'), 'desc'); note.style.whiteSpace = 'pre-wrap'; }
        if (!meals.length && !notes.length) addText(card, 'p', '日历中没有填写饮食内容。', 'muted');
      } else if (type === 'fitness' || type === 'tennis') {
        const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
        const duplicates = new Map();
        for (const line of lines) {
          const occurrence = duplicates.get(line) || 0; duplicates.set(line, occurrence + 1);
          const row = addText(card, 'div', '', 'drill');
          const art = addText(row, 'div', '', 'art');
          const kind = type === 'tennis' ? 'tennis' : /蹲/.test(line) ? 'squat' : /硬拉|臀桥/.test(line) ? 'hinge' : /提踵/.test(line) ? 'calf' : /划船|下拉/.test(line) ? 'row' : /推|外旋/.test(line) ? 'press' : 'lunge';
          art.innerHTML = svg(kind);
          const content = addText(row, 'div', '', 'dcontent');
          const parts = line.split(/[|｜]/).map(s => s.trim());
          addText(content, 'div', parts[0], 'dname');
          if (parts[1]) addText(content, 'div', parts[1], 'dmeta');
          if (parts.length > 2) addText(content, 'div', parts.slice(2).join(' · '), 'dhelp');
          const doneKey = recordKey(event, line, occurrence, 'done');
          const done = addText(row, 'input', '', 'tick'); done.type = 'checkbox'; done.checked = safeGet(doneKey) === '1';
          done.setAttribute('aria-label', '完成 ' + line);
          done.onchange = () => safeSet(doneKey, done.checked ? '1' : '0');
          if (type === 'fitness') {
            const weightKey = recordKey(event, line, occurrence, 'weight');
            const label = addText(content, 'label', '本次重量（kg，可选）', 'weightline');
            const input = addText(label, 'input', ''); input.type = 'number'; input.min = '0'; input.max = '1000'; input.step = '0.5'; input.value = safeGet(weightKey) || '';
            input.onchange = () => { if (input.value === '' || (Number(input.value) >= 0 && Number(input.value) <= 1000)) safeSet(weightKey, input.value); };
            input.onblur = () => setTimeout(() => { if (settings.enabled && !document.activeElement?.matches?.('#app input')) drawCards(); }, 0);
          }
        }
        if (!lines.length) addText(card, 'p', '日历中没有填写动作明细，可在事件描述中每行填写一项。', 'muted');
      } else { const note = addText(card, 'div', text || '此事件没有详细说明。', 'desc'); note.style.whiteSpace = 'pre-wrap'; }
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
    if (!navigator.onLine) { clearEvents(); status('当前离线，无法读取最新卡片。本机打卡记录仍保留。'); return; }
    if (!token || Date.now() >= expires) { token = ''; drawCalendarChoices(); clearEvents(); status('请点击「连接 Google 日历」读取最新安排。重新打开网页或授权到期后需要再次连接。'); return; }
    const current = generation, date = activeDate, accessToken = token;
    controller = new AbortController(); const signal = controller.signal;
    busy = true; status('正在读取 Google 日历…');
    try {
      // A visibility refresh may cancel the first list request after mobile OAuth.
      // Never skip discovery until a full list has actually loaded for this token.
      if (loadCalendars || !calendarsLoaded) {
        const calendars = await getAll('users/me/calendarList', { maxResults: '250' }, signal, accessToken);
        if (current !== generation) return;
        const select = $('gc-calendar'); select.replaceChildren(new Option('主日历', 'primary'));
        calendarNames = Object.fromEntries(calendars.map(c => [c.primary ? 'primary' : c.id, c.summaryOverride || c.summary || c.id]));
        calendars.filter(c => !c.primary).forEach(c => select.add(new Option(c.summaryOverride || c.summary || c.id, c.id)));
        if (!settings.dynamicCardsConfigured) {
          const training = calendars.filter(c => /饮食日历|飲食日曆|网球训练|網球訓練|体能训练|體能訓練/.test(c.summaryOverride || c.summary || '')).map(c => c.primary ? 'primary' : c.id);
          if (training.length) settings.calendarIds = training;
          settings.dynamicCardsConfigured = true;
        }
        settings.calendarIds = settings.calendarIds.filter(id => [...select.options].some(o => o.value === id));
        if (!settings.calendarIds.length) settings.calendarIds = ['primary'];
        [...select.options].forEach(o => { o.selected = settings.calendarIds.includes(o.value); });
        calendarsLoaded = true; persist(); drawCalendarChoices();
      }
      const next = new Date(`${date}T00:00:00+08:00`);
      next.setTime(next.getTime() + 86400000);
      if (!settings.calendarIds.length) { clearEvents(); status('请至少选择一个日历。'); return; }
      const groups = await Promise.all(settings.calendarIds.map(async id => (await getAll(`calendars/${encodeURIComponent(id)}/events`, {
        timeMin: `${date}T00:00:00+08:00`, timeMax: next.toISOString(), timeZone: TZ,
        singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false', maxResults: '250'
      }, signal, accessToken)).map(e => ({ ...e, _calendarId: id, _calendarName: calendarNames[id] || '' }))));
      const events = groups.flat().sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || ''));
      if (current !== generation || date !== activeDate) return;
      const count = showEvents(events, date);
      status(`${date} · ${count} 项安排 · 更新于 ${new Date().toLocaleTimeString('zh-CN', { timeZone: TZ })} · 页面可见时每分钟刷新`);
    } catch (error) {
      if (current !== generation || error.name === 'AbortError') return;
      if (error.status === 401) { token = ''; drawCalendarChoices(); }
      clearEvents(); status(error.status ? error.message : '无法连接 Google 日历。请检查网络后点击刷新；此时不能确认实际安排。');
    } finally { if (current === generation) busy = false; }
  }
  $('gc-save').onclick = () => {
    const id = $('gc-client').value.trim();
    if (!id.endsWith('.apps.googleusercontent.com')) { status('请输入以 .apps.googleusercontent.com 结尾的 OAuth 客户端 ID。'); return; }
    if (id !== settings.clientId) { cancel(); token = ''; expires = 0; drawCalendarChoices(); clearEvents(); }
    settings.clientId = id; settings.keywords = $('gc-keywords').value.trim(); persist();
    status('设置已保存。请连接 Google 日历，或点击立即刷新。');
  };
  $('gc-calendar').onchange = () => { settings.calendarIds = [...$('gc-calendar').selectedOptions].map(o => o.value); settings.calendarId = settings.calendarIds[0] || 'primary'; persist(); clearEvents(); refresh(); };
  $('gc-connect').onclick = () => {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') { status('请在 GitHub Pages 的 HTTPS 地址中打开，不能通过双击 HTML 连接 Google。'); return; }
    if (!settings.clientId) { section.querySelector('details').open = true; status('请先在连接设置中保存 Google OAuth 客户端 ID。'); return; }
    if (!window.google?.accounts?.oauth2) { status('Google 登录组件尚未加载。请检查能否访问 Google，再重新打开页面。'); return; }
    cancel(); token = ''; calendarsLoaded = false; drawCalendarChoices(); clearEvents();
    const attempt = generation;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: settings.clientId, scope: SCOPES,
      callback: response => {
        if (attempt !== generation) return;
        if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, ...SCOPES.split(' '))) {
          status('连接未完成，需要允许读取日历及日历列表。'); return;
        }
        token = response.access_token; expires = Date.now() + Math.max(0, Number(response.expires_in) - 60) * 1000;
        calendarsLoaded = false; drawCalendarChoices();
        settings.enabled = true; persist(); templateLabels(); refresh(true);
      },
      error_callback: () => { if (attempt === generation) status('登录窗口被关闭或拦截，请再次点击连接并允许弹出窗口。'); }
    });
    client.requestAccessToken({ prompt: 'select_account' });
  };
  $('gc-refresh').onclick = () => refresh(true);
  $('gc-disconnect').onclick = () => {
    cancel(); token = ''; expires = 0; calendarsLoaded = false; settings.enabled = false; persist(); drawCalendarChoices(); clearEvents(); originalRender();
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
