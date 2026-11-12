/* Database is teaching material only. Every prescription comes from calendar JSON. */
(() => {
 'use strict';
 const C=LeonCore, store=C.createStore(localStorage);
 let database=[],resourceError='';
 const el=(parent,tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;};
 const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
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
   const grid=el(parent,'div','','metrics');for(const [k,name]of [['protein','蛋白质'],['carbs','碳水'],['fat','脂肪']])if(parsed.macros[k]!==undefined){const m=el(grid,'div','','metric');el(m,'div',String(parsed.macros[k]),'num');el(m,'div',name+' g','unit');}
   for(const meal of parsed.meals.filter(m=>m.description.trim())){const row=el(parent,'div','','food');el(row,'div',/早餐/.test(meal.name)?'🍌':/午餐/.test(meal.name)?'🍚':/晚餐/.test(meal.name)?'🐟':'🥛','foodicon');const body=el(row,'div');el(body,'div',meal.name,'foodname');el(body,'div',meal.description,'fooddesc');}
  }else{
   try{store.migrate(event,date,database,parsed.type==='tennis'?'tennis':'fitness');}catch(e){el(parent,'p','旧记录迁移未完成，原始数据仍保留：'+e.message,'note');}
   for(const item of parsed.exercises)renderExercise(parent,event,date,parsed.type,item);
   if(!parsed.exercises.length)el(parent,'p','此事件的结构化动作列表为空。','muted');
  }
  for(const note of parsed.notes)el(parent,'div',note,'note');
  rawNotes(parent,event);return parsed;
 }
 function renderExercise(parent,event,date,type,item){
  const info=database.find(e=>e.exerciseId===item.exerciseId);
  const card=el(parent,'article','','exercise-card');card.dataset.exerciseId=item.exerciseId;card.dataset.slotId=item.slotId;
  el(card,'h3',info?info.nameZh+' / '+info.nameEn:(item.name||item.exerciseId));
  const figure=el(card,'figure');
  if(info?.image?.src?.startsWith('assets/exercises/')){const img=el(figure,'img');img.src='./'+info.image.src;img.alt=info.image.alt;img.width=640;img.height=360;img.loading='lazy';img.onerror=()=>{figure.replaceChildren();el(figure,'div','图片加载失败 · 教学资源待补充','resource-placeholder');};el(figure,'figcaption','自制动作示意 · 非完整教学');}
  else el(figure,'div','动作图片与教学资源待补充','resource-placeholder');
  const prescribed=[];
  if(item.sets.length)prescribed.push(item.sets.length+'组 × '+(new Set(item.sets.map(s=>s.reps)).size===1?(item.sets[0].reps||'次数未设置'):'各组次数见下方')+(item.sets[0].reps?'次':''));
  if(item.durationMinutes!==undefined)prescribed.push(item.durationMinutes+'分钟');
  if(!item.sets.length&&item.reps!==undefined)prescribed.push(item.reps+'次');
  el(card,'div',prescribed.join(' · ')||'日历未设置训练量','prescription');
  if(item.notes)el(card,'p',item.notes,'desc');
  const tips=info?.tips||[];
  if(tips.length){el(card,'div','动作要点','dname');const list=el(card,'ol','','exercise-tips');tips.slice(0,3).forEach(t=>el(list,'li',t));}
  else el(card,'p','动作要点待补充，请参考日历说明并向教练确认。','muted');
  const more=el(card,'details');el(more,'summary','常见错误与安全提示');
  if(info){el(more,'p','常见错误：'+(info.commonErrors||[]).join('；'));el(more,'p',(info.safety||[]).join('；'));tips.slice(3).forEach(t=>el(more,'p',t));}else el(more,'p','尚无核实的专项教学资料。');
  const resources=el(card,'div','','resources');
  const videos=(info?.resources||[]).filter(r=>r.kind==='video');
  for(const r of info?.resources||[]){if(!/^https:\/\//.test(r.url))continue;const link=el(resources,'a',(r.kind==='video'?'▶ 观看教学视频':'阅读动作教学')+' · '+r.source,'expert');link.href=r.url;link.target='_blank';link.rel='noopener noreferrer';link.title=r.title;link.onclick=e=>{if(!navigator.onLine){e.preventDefault();message.textContent='外部教学视频和文章需要联网打开。';}};}
  if(!videos.length)el(resources,'div','教学视频待补充','muted');
  el(resources,'small','外部教学需联网；部分网站视频可能要求同意 Cookie。','muted');
  const message=el(card,'div','','record-status');message.setAttribute('role','status');
  let ctx;try{ctx=store.context(event,date);}catch(e){el(card,'p',e.message+'；本卡暂不能保存记录。','note');return;}
  if(ctx.date!==date)el(card,'p','此事件已改期，继续关联原记录日期 '+ctx.date+'。','muted');
  const save=(setId,patch)=>{try{const r=store.write(ctx,item,setId,patch);message.textContent='已保存 '+new Date(r.updatedAt).toLocaleTimeString('zh-CN');return true;}catch(e){message.textContent='保存失败：'+e.message+'。请先导出备份或检查浏览器存储空间。';return false;}};
  const action=store.read(ctx,item),controls=el(card,'div','','action-controls');
  function check(parent,label,setId,value){const l=el(parent,'label','','record-check');const input=el(l,'input');input.type='checkbox';input.checked=!!value;input.onchange=()=>{if(!save(setId,{done:input.checked}))input.checked=!input.checked;};el(l,'span',label);return input;}
  function field(parent,label,field,setId,value,kind='number',extra){const l=el(parent,'label',label,'record-field'),input=el(l,kind==='textarea'?'textarea':'input');input.dataset.field=field;input.dataset.setId=setId;if(kind!=='textarea')input.type=kind;input.value=value??'';if(kind==='number'){input.min='0';input.max=field==='weight'?'1000':field==='duration'?'1440':'100000';input.step=['weight','duration'].includes(field)?'0.5':'1';input.inputMode='decimal';}else input.maxLength=5000;
   input.oninput=()=>{let value=input.value;if(kind==='number'&&value!==''){value=Number(value);if(!Number.isFinite(value)||value<0||value>Number(input.max)||(!['weight','duration'].includes(field)&&!Number.isInteger(value))){input.setCustomValidity('请输入有效的非负数值');input.reportValidity();return;}}input.setCustomValidity('');if(extra&&!extra(value,input))return;save(setId,{[field]:value});};return input;}
  check(controls,'整个动作完成','_action',action.done);
  if(action.legacyWeight!==undefined)el(card,'p','旧版动作重量：'+action.legacyWeight+' kg（未推测分配给每一组）','muted');
  const isStrength=type==='strength'&&item.recordType!=='duration'&&!(item.sets.length===0&&item.durationMinutes!==undefined);
  if(isStrength){
   const rows=el(card,'div','','set-records');
   for(const set of item.sets){const record=store.read(ctx,item,set.setId);const row=el(rows,'fieldset','','set-row');row.dataset.setId=set.setId;el(row,'legend',set.setId+' · 计划 '+(set.reps||'未设置')+'次');check(row,'本组完成',set.setId,record.done);field(row,'重量 kg','weight',set.setId,record.weight);field(row,'实际次数','reps',set.setId,record.reps);}
   if(!item.sets.length)el(card,'p','日历未设置组数，可记录动作完成与备注。','muted');
  }else{
   const fields=el(card,'div','','tennis-records');field(fields,'实际训练时长（分钟）','duration','_action',action.duration);
   if(type==='tennis'&&(item.recordType==='serve'||info?.recordType==='serve')){
    const rate=el(fields,'output','','success-rate');
    const update=()=>{const r=store.read(ctx,item);rate.textContent=r.attempts>0&&r.successes!==undefined&&r.successes!==''?'进球率：'+(100*r.successes/r.attempts).toFixed(1)+'%':'进球率：—';};
    const validate=(which)=>(value,input)=>{const r=store.read(ctx,item),attempts=which==='attempts'?value:r.attempts,successes=which==='successes'?value:r.successes;if(attempts!==''&&attempts!==undefined&&successes!==''&&successes!==undefined&&successes>attempts){input.setCustomValidity('进球数量不能大于发球数量');input.reportValidity();return false;}return true;};
    for(const [key,label]of [['attempts','发球数量'],['successes','进球数量']]){const input=field(fields,label,key,'_action',action[key],'number',validate(key));const handler=input.oninput;input.oninput=()=>{handler();update();};}update();
   }
  }
  field(card,'训练备注（可选）','notes','_action',action.notes,'textarea');
  if(action.updatedAt)message.textContent='上次保存 '+new Date(action.updatedAt).toLocaleString('zh-CN');
  const retired=store.all().filter(r=>r.value.eventIdentity===ctx.eventIdentity&&r.value.exerciseId===item.exerciseId&&r.value.slotId===item.slotId&&r.value.setId!=='_action'&&!item.sets.some(s=>s.setId===r.value.setId));
  if(retired.length){const d=el(card,'details');el(d,'summary','查看已移除组的历史记录（'+retired.length+'）');retired.forEach(r=>{el(d,'h4',r.value.setId);textRecord(d,r.value);});}
 }
 function download(payload,name){const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function setupRecords(){
  document.getElementById('exportBtn').onclick=()=>download(store.backup(),'Leon_训练备份_v3_'+chinaToday()+'.json');
  document.getElementById('importFile').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>30*1024*1024)throw Error('文件超过 30 MB');const payload=JSON.parse(await file.text());if(!confirm('将合并备份中的记录，同名记录会覆盖；导入前自动保留本机快照。是否继续？'))return;const n=store.restore(payload);document.getElementById('saveStatus').textContent='成功导入 '+n+' 条记录';render();}catch(error){alert('导入失败：'+error.message);}finally{e.target.value='';}};
  document.getElementById('historyBtn').onclick=()=>{const host=document.getElementById('historyPanel');host.hidden=!host.hidden;if(host.hidden)return;host.replaceChildren();el(host,'h2','本机训练历史');el(host,'p','计划删改不会自动删除训练记录。原始旧版记录仍可查看和导出。','muted');const rows=store.all().sort((a,b)=>(b.value.date||'').localeCompare(a.value.date||''));for(const r of rows){const d=el(host,'details');el(d,'summary',[r.value.date,r.value.title,r.value.exerciseId,r.value.setId].join(' · '));textRecord(d,r.value);}
   const old=store.backup().records;const keys=Object.keys(old).filter(k=>k.startsWith(C.OLD));const d=el(host,'details');el(d,'summary','V6.2 及更早的原始记录（'+keys.length+'）');for(const key of keys){el(d,'p',key);el(d,'pre',old[key]);}if(!rows.length&&!keys.length)el(host,'p','暂无本机训练记录。');};
 }
 window.LeonTraining={ready,renderEvent,setupRecords,store,get database(){return database;}};
 setupRecords();
})();
