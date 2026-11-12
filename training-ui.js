/* Database is teaching material only. Every prescription comes from calendar JSON. */
(() => {
 'use strict';
 const C=LeonCore, store=C.createStore(localStorage);
 let database=[],resourceError='';
 const el=(parent,tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;};
 const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
 const short=(text,max)=>{const a=Array.from(String(text||''));return a.length>max?a.slice(0,max-1).join('')+'…':a.join('');};
 let advanced=readJSON('leon-ui-settings-v1',{}).advanced===true;
 const ready=(async()=>{try{const r=await fetch('./data/exercises.json',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.exercises))throw Error('格式错误');database=data.exercises;try{localStorage.setItem('leon-exercises-cache-v1',JSON.stringify(data));}catch{}}catch{database=readJSON('leon-exercises-cache-v1',{}).exercises||[];resourceError=database.length?'教学资料使用本机缓存。':'动作资料加载失败；训练参数和记录仍可使用，教学资源待补充。';}})();
 function rawNotes(card,event,open=false){const d=el(card,'details','','raw-notes');d.open=open;el(d,'summary','查看原始日历备注');el(d,'pre',C.plain(event.description)||'此事件没有备注。');}
 function textRecord(parent,record){const labels={done:'完成',weight:'重量 kg',reps:'实际次数',duration:'实际分钟',attempts:'发球数',successes:'进球数',notes:'备注',legacyWeight:'旧版动作重量 kg'};for(const [k,label]of Object.entries(labels))if(record[k]!==undefined&&record[k]!=='')el(parent,'div',label+'：'+String(record[k]));if(record.updatedAt)el(parent,'small','保存时间：'+record.updatedAt);}
 function renderEvent(parent,event,date){
  const parsed=C.resolve(event);
  if(parsed.source!=='structured'){
   for(const w of parsed.warnings)el(parent,'p',w,'note');rawNotes(parent,event,true);return parsed;
  }
  if(resourceError)el(parent,'p',resourceError,'muted');
  if(parsed.type==='nutrition'){
   const grid=el(parent,'div','','metrics');for(const [k,name]of [['protein','蛋白质'],['carbs','碳水'],['fat','脂肪']]){const m=el(grid,'div','','metric');el(m,'div',parsed.macros[k]===undefined?'—':String(parsed.macros[k]),'num');el(m,'div',name+' g','unit');}
   const meals=parsed.meals.filter(m=>m.description.trim());
   for(const meal of meals){const row=el(parent,'div','','food');el(row,'div',/早餐/.test(meal.name)?'☀':/午餐/.test(meal.name)?'♧':/晚餐/.test(meal.name)?'☾':'♨','foodicon');const body=el(row,'div');el(body,'div',meal.name,'foodname');el(body,'div',short(meal.description,44),'fooddesc');}
   const advice=el(parent,'details','','plan-notes');el(advice,'summary','详细建议');
   for(const meal of meals){el(advice,'h4',meal.name);el(advice,'p',meal.description,'desc');}
   for(const note of parsed.notes)el(advice,'p',note,'desc');
  }else{
   try{store.migrate(event,date,database,parsed.type==='tennis'?'tennis':'fitness');}catch(e){el(parent,'p','旧记录迁移未完成，原始数据仍保留：'+e.message,'note');}
   const overview=el(parent,'div','','workout-overview');
   const bar=el(parent,'progress','','workout-progress');bar.max=parsed.exercises.length||1;
   const list=el(parent,'div','','compact-list');
   const update=()=>{const n=list.querySelectorAll('input[type=checkbox]:checked').length;overview.textContent='共 '+parsed.exercises.length+(parsed.type==='tennis'?' 个阶段':' 个动作')+' · 已完成 '+n+' / '+parsed.exercises.length;bar.value=n;};
   let cursor=event.start?.dateTime?Date.parse(event.start.dateTime):NaN;
   for(const item of parsed.exercises){const clock=parsed.type==='tennis'&&Number.isFinite(cursor)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(cursor)):'';renderExercise(list,event,date,parsed.type,item,update,clock);cursor=item.durationMinutes!==undefined?cursor+item.durationMinutes*60000:NaN;}
   update();
   if(!parsed.exercises.length)el(parent,'p','此事件的结构化动作列表为空。','muted');
  }
  if(parsed.type!=='nutrition'&&parsed.notes.length){const extra=el(parent,'details','','plan-notes');el(extra,'summary','计划说明与注意事项');for(const note of parsed.notes)el(extra,'p',note,'desc');}
  rawNotes(parent,event);return parsed;
 }
 function renderExercise(parent,event,date,type,item,update,clock){
  const info=database.find(e=>e.exerciseId===item.exerciseId),name=item.name||info?.nameZh||item.exerciseId;
  const card=el(parent,'article','','exercise-card compact');card.dataset.exerciseId=item.exerciseId;
  const row=el(card,'div','','compact-row');if(clock)el(row,'span',clock,'stage-clock');
  const body=el(row,'button','','compact-body');body.type='button';body.setAttribute('aria-expanded','false');body.setAttribute('aria-label','查看'+name+'详情');
  const heading=el(body,'div','','compact-heading');el(heading,'h3',name);
  const volume=[];
  if(item.sets.length){const unique=[...new Set(item.sets.map(s=>s.reps))];volume.push(item.sets.length+'组 × '+(unique.length===1?unique[0]:unique.join(' / '))+'次');}
  if(item.durationMinutes!==undefined)volume.push(item.durationMinutes+'分钟');
  if(!item.sets.length&&item.reps!==undefined)volume.push(item.reps+'次');
  el(heading,'span',volume.join(' · ')||'训练量见日历说明','prescription');
  el(body,'p',short(item.notes||info?.tips?.[0]||'按日历安排完成',30),'compact-tip');
  const check=el(row,'label','','record-check');const input=el(check,'input');input.type='checkbox';input.setAttribute('aria-label',name+'完成');el(check,'span','完成');
  const message=el(card,'div','','compact-status');message.setAttribute('role','status');
  try{const ctx=store.context(event,date);input.checked=!!store.read(ctx,item).done;
   input.onchange=()=>{try{store.write(ctx,item,'_action',{done:input.checked});message.textContent='';card.classList.toggle('completed',input.checked);update();}catch(e){input.checked=!input.checked;message.textContent='保存失败，请先备份并检查存储空间。';}};
  }catch(e){input.disabled=true;message.textContent=e.message;}
  card.classList.toggle('completed',input.checked);
  const more=el(card,'div','','exercise-more');more.hidden=true;body.onclick=()=>{more.hidden=!more.hidden;body.setAttribute('aria-expanded',String(!more.hidden));};
  if(item.notes)el(more,'p',item.notes,'desc');
  if(info){el(more,'div',info.nameEn,'muted');const figure=el(more,'figure');
   if(info.image?.src?.startsWith('assets/exercises/')){const img=el(figure,'img');img.src='./'+info.image.src;img.alt=info.image.alt;img.width=640;img.height=360;img.loading='lazy';img.onerror=()=>{figure.replaceChildren();el(figure,'p','图片加载失败 · 教学资源待补充');};}
   el(more,'small','自制动作示意 · 非完整教学','muted');const tips=el(more,'ol');(info.tips||[]).slice(0,3).forEach(t=>el(tips,'li',t));
   el(more,'p','常见错误：'+(info.commonErrors||[]).join('；'),'desc');el(more,'p',(info.safety||[]).join('；'),'desc');
   for(const r of info.resources||[]){if(!/^https:\/\//.test(r.url))continue;const link=el(more,'a',(r.kind==='video'?'观看教学视频':'阅读教学')+' · '+r.source,'expert');link.href=r.url;link.target='_blank';link.rel='noopener noreferrer';link.onclick=e=>{if(!navigator.onLine){e.preventDefault();message.textContent='教学资源需要联网打开。';}};}
   if(!(info.resources||[]).some(r=>r.kind==='video'))el(more,'p','教学视频待补充','muted');
  }else el(more,'p','教学资源待补充','muted');
  if(advanced)renderAdvanced(more,event,date,type,item);
 }
 function renderAdvanced(host,event,date,type,item){
  const ctx=store.context(event,date);el(host,'h4','高级记录（可选）');
  const save=(setId,key,value)=>{try{store.write(ctx,item,setId,{[key]:value});status.textContent='已保存';}catch{status.textContent='保存失败，请备份后检查存储空间';}};
  function field(parent,label,key,setId,kind='number'){const l=el(parent,'label',label,'record-field'),input=el(l,kind==='textarea'?'textarea':'input');input.dataset.field=key;const old=store.read(ctx,item,setId);input.value=old[key]??'';
   if(kind==='number'){input.type='number';input.min='0';input.max='100000';input.step=key==='weight'?'0.5':'1';input.inputMode='decimal';}
   else input.maxLength=5000;
   input.oninput=()=>{if(!input.checkValidity())return;save(setId,key,kind==='number'&&input.value!==''?Number(input.value):input.value);};}
  if(type==='strength')for(const set of item.sets){const row=el(host,'fieldset','','set-row');el(row,'legend',set.setId+' · '+set.reps+'次');field(row,'重量 kg','weight',set.setId);field(row,'实际次数','reps',set.setId);}
  else field(host,'实际时长（分钟）','duration','_action');
  field(host,'训练备注','notes','_action','textarea');const status=el(host,'div','','muted');status.setAttribute('role','status');
 }
 function download(payload,name){const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function setupRecords(){
  const option=document.getElementById('advancedMode');option.checked=advanced;option.onchange=()=>{advanced=option.checked;try{localStorage.setItem('leon-ui-settings-v1',JSON.stringify({advanced}));}catch{}render();};
  document.getElementById('exportBtn').onclick=()=>download(store.backup(),'Leon_训练备份_v3_'+chinaToday()+'.json');
  document.getElementById('importFile').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>30*1024*1024)throw Error('文件超过 30 MB');const payload=JSON.parse(await file.text());if(!confirm('将合并备份中的记录，同名记录会覆盖；导入前自动保留本机快照。是否继续？'))return;const n=store.restore(payload);document.getElementById('saveStatus').textContent='成功导入 '+n+' 条记录';render();}catch(error){alert('导入失败：'+error.message);}finally{e.target.value='';}};
  document.getElementById('historyBtn').onclick=()=>{const host=document.getElementById('historyPanel');host.hidden=!host.hidden;if(host.hidden)return;host.replaceChildren();el(host,'h2','本机训练历史');el(host,'p','计划删改不会自动删除训练记录。原始旧版记录仍可查看和导出。','muted');const rows=store.all().sort((a,b)=>(b.value.date||'').localeCompare(a.value.date||''));for(const r of rows){const d=el(host,'details');el(d,'summary',[r.value.date,r.value.title,r.value.exerciseId,r.value.setId].join(' · '));textRecord(d,r.value);}
   const old=store.backup().records;const keys=Object.keys(old).filter(k=>k.startsWith(C.OLD));const d=el(host,'details');el(d,'summary','V6.2 及更早的原始记录（'+keys.length+'）');for(const key of keys){el(d,'p',key);el(d,'pre',old[key]);}if(!rows.length&&!keys.length)el(host,'p','暂无本机训练记录。');};
 }
 window.LeonTraining={ready,renderEvent,setupRecords,store,get database(){return database;}};
 setupRecords();
})();
