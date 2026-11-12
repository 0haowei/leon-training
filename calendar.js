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
  let pendingRender = false;
  let token = '', expires = 0, generation = 0, controller, busy = false;
  const section = document.createElement('section');
  section.className = 'card calendar-panel';
  section.innerHTML = `
    <details id="gc-settings"><summary>📅 日历连接与设置 · V6.4</summary>
    <div class="desc">计划仅来自 Google 日历。结构化 JSON 生成卡片；普通备注保留原文。离线时显示有时间标记的缓存。</div>
    <details><summary>连接设置</summary>
      <label>Google OAuth 客户端 ID<input id="gc-client" placeholder="…apps.googleusercontent.com" autocomplete="off"></label>
      <div class="status">每台设备首次使用都需填入同一个客户端 ID 并连接 Google。无需重新创建客户端，也无需填写客户端密钥。</div>
      <div class="tools"><button id="gc-save">保存设置</button></div>
    </details>
    <fieldset class="calendar-choices"><legend>选择日历（直接勾选，可多选）</legend><div id="gc-picker"></div></fieldset>
    <select id="gc-calendar" multiple hidden aria-hidden="true" tabindex="-1"><option value="primary">主日历</option></select>
    <div class="tools"><button id="gc-connect">连接 Google 日历</button><button id="gc-refresh">立即刷新</button><button id="gc-disconnect">断开连接</button></div>
    </details><div class="status" id="gc-status" role="status" aria-live="polite"></div>
    <div id="gc-events"></div>`;
  document.querySelector('#app').before(section);
  const $ = id => document.getElementById(id);
  $('gc-client').value = settings.clientId;
  $('gc-settings').open = !settings.clientId;
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
  function templateLabels() { drawCards(); }
  const originalRender = render;
  render = function () { originalRender(); restoreCache(); templateLabels(); refresh(); };
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
  function cacheKey(date=activeDate) { return 'leon-training-v3:cache:'+encodeURIComponent(JSON.stringify([settings.accountId||'unconnected',date,[...settings.calendarIds].sort()])); }
  function restoreCache() {
    try { const cached=JSON.parse(localStorage.getItem(cacheKey())); snapshot=cached&&cached.date===activeDate?{...cached,cached:true}:null; } catch { snapshot=null; }
  }
  function lastSyncText() { return snapshot?.syncedAt?'上次成功同步：'+new Date(snapshot.syncedAt).toLocaleString('zh-CN',{timeZone:TZ}):'该日期尚无成功同步缓存'; }
  function category(event) {
    const source=(event._calendarName||'');
    if(/饮食|飲食/.test(source))return 'food';if(/体能|體能/.test(source))return 'fitness';if(/网球|網球/.test(source))return 'tennis';
    const type=LeonCore.resolve(event).type;
    if(type==='nutrition')return 'food';if(type==='strength'||type==='recovery')return 'fitness';if(type==='tennis')return 'tennis';return 'other';
  }
  function showEvents(events,date) {
    const filtered=events.filter(e=>e.status!=='cancelled'&&!e.attendees?.some(a=>a.self&&a.responseStatus==='declined'));
    snapshot={date,events:filtered,syncedAt:new Date().toISOString(),cached:false};
    let stored=true;try {localStorage.setItem(cacheKey(date),JSON.stringify(snapshot));}catch{stored=false;}
    if(!document.activeElement?.matches?.('#app input,#app textarea'))drawCards();
    else pendingRender = true;
    return {count:filtered.length,stored};
  }
  function drawCards() {
    pendingRender = false;
    const app=$('app');app.replaceChildren();
    const summary=addText(app,'div','','summary');addText(summary,'div',activeDate+' · '+names[selected]+' · Google 日历','eyebrow');addText(summary,'div','今日训练与饮食','big');
    addText(summary,'div',snapshot?.cached?'本机缓存 · '+lastSyncText():'训练记录保存在本机，计划由日历决定。','muted');
    if(!snapshot||snapshot.date!==activeDate){addText(app,'p','尚无该日期的日历内容。请连接 Google 后同步；不会套用固定周计划。','muted');return;}
    const events=snapshot.events.filter(e=>tab==='all'||category(e)===tab);
    if(!events.length)addText(app,'p','此日期和分类没有日历安排。','muted');
    for(const event of events){
      const card=addText(app,'section','','card calendar-event');addText(card,'h2',event.summary||'未命名日程','title');
      const when=event.start?.date?'全天 · '+event.start.date:(event.start?.dateTime?time(event.start.dateTime)+' — '+time(event.end.dateTime)+' · 北京时间':'日历未提供时间');
      addText(card,'div',when,'desc');if(event._calendarName)addText(card,'div','来自 '+event._calendarName,'muted');if(event.location)addText(card,'div',event.location,'desc');
      LeonTraining.renderEvent(card,event,activeDate);
      if(event.htmlLink){try{const url=new URL(event.htmlLink);if(url.protocol==='https:'&&['calendar.google.com','www.google.com'].includes(url.hostname)){const a=addText(card,'a','在 Google 日历中查看 / 修改 ↗','expert');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}}catch{}}
    }
  }
  async function getAll(path, params, signal, accessToken) {
    const items = []; let pageToken;
    do {
      const query = new URLSearchParams(params);
      if (pageToken) query.set('pageToken', pageToken);
      const requestController=new AbortController();
      const abort=()=>requestController.abort();signal.addEventListener('abort',abort,{once:true});
      let timer;
      let response,data;
      try {
        const result=await Promise.race([
          (async()=>{const r=await fetch(`https://www.googleapis.com/calendar/v3/${path}?${query}`,{headers:{Authorization:`Bearer ${accessToken}`},signal:requestController.signal,cache:'no-store'});return {response:r,data:r.ok?await r.json():null};})(),
          new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error('读取 Google 日历超时，请检查网络后重试。');e.status='timeout';reject(e);requestController.abort();},20000);})
        ]); response=result.response;data=result.data;
      } finally {clearTimeout(timer);signal.removeEventListener('abort',abort);}
      if (!response.ok) {
        const error = new Error(response.status === 401 ? '授权已过期，请点击「连接 Google 日历」。' :
          response.status === 403 ? '无法读取日历：请检查 Calendar API 是否启用、只读授权是否完成，以及日历访问权限。' :
          response.status === 404 ? '所选日历不存在或无权访问，请重新连接并选择日历。' : `读取失败（HTTP ${response.status}），请稍后刷新。`);
        error.status = response.status; throw error;
      }
      items.push(...(data.items || [])); pageToken = data.nextPageToken;
    } while (pageToken);
    return items;
  }
  async function refresh(loadCalendars = false) {
    cancel();
    if (!settings.enabled) { restoreCache(); drawCards(); status('请连接 Google 以同步 · '+lastSyncText()); return; }
    if (!navigator.onLine) { restoreCache(); drawCards(); status('当前离线，显示缓存 · '+lastSyncText()); return; }
    if (!token || Date.now() >= expires) { token = ''; drawCalendarChoices(); restoreCache(); drawCards(); status('需要连接 Google 才能更新；当前仅显示缓存 · '+lastSyncText()); return; }
    const current = generation, date = activeDate, accessToken = token;
    controller = new AbortController(); const signal = controller.signal;
    busy = true; status('正在读取 Google 日历… · '+lastSyncText());
    try {
      // A visibility refresh may cancel the first list request after mobile OAuth.
      // Never skip discovery until a full list has actually loaded for this token.
      if (loadCalendars || !calendarsLoaded) {
        const calendars = await getAll('users/me/calendarList', { maxResults: '250', showHidden: 'true' }, signal, accessToken);
        if (current !== generation) return;
        settings.accountId=calendars.find(c=>c.primary)?.id||('calendar-account:'+calendars.map(c=>c.id).sort().join('|'));
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
      const result = showEvents(events, date);
      if(loadCalendars)$('gc-settings').open=false;
      status(`${date} · ${result.count} 项安排 · 更新于 ${new Date().toLocaleTimeString('zh-CN', { timeZone: TZ })} · 页面可见时每分钟刷新${result.stored?'':' · 本机缓存保存失败，请检查存储空间'}`);
    } catch (error) {
      if (current !== generation || error.name === 'AbortError') return;
      if (error.status === 401) { token = ''; drawCalendarChoices(); }
      restoreCache(); drawCards(); status((error.status?error.message:'无法连接 Google 日历，请检查网络。')+' 当前显示缓存，非实时数据 · '+lastSyncText());
    } finally { if (current === generation) busy = false; }
  }
  $('gc-save').onclick = () => {
    const id = $('gc-client').value.replace(/\s+/g,'');
    if (!id.endsWith('.apps.googleusercontent.com')) { status('请输入以 .apps.googleusercontent.com 结尾的 OAuth 客户端 ID。'); return; }
    if (id !== settings.clientId) { cancel(); token = ''; expires = 0; drawCalendarChoices(); clearEvents(); }
    settings.clientId = id; persist();
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
    restoreCache(); drawCards(); status('已断开连接，仅显示本机缓存 · '+lastSyncText());
  };
  setInterval(() => { if (!document.hidden && token && !busy) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token && !busy) refresh(); });
  window.addEventListener('online', () => { if (settings.enabled) refresh(); });
  window.addEventListener('offline', () => { if (settings.enabled) refresh(); });
  document.addEventListener('focusout', () => { setTimeout(() => {
    if (pendingRender && !document.activeElement?.matches?.('#app input,#app textarea')) drawCards();
  }, 0); });
  restoreCache(); templateLabels(); refresh();
  LeonTraining.ready.then(()=>drawCards());
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
  script.onerror = () => status('Google 登录组件加载失败；本机训练记录仍可使用。请检查 Google 网络连接后重新打开页面。');
  document.head.append(script);
})();
