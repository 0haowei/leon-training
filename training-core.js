/* Leon 6.3: pure plan resolution + append-preserving local records. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.LeonCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PREFIX='leon-training-v3:', OLD='leon-training-v2:';
 const parse=(s,f=null)=>{try{return JSON.parse(s)??f;}catch{return f;}};
 const norm=s=>String(s||'').toLowerCase().replace(/[\s·、:：()（）_-]/g,'');
 const safeId=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(s);
 function plain(value){return String(value||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<br\b[^>]*>/gi,'\n').replace(/<\/(?:p|div|li|h[1-6])\s*>/gi,'\n').replace(/<\/?[a-z][^>]*>/gi,'').replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[e]).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).trim();}
 function identify(name,db,type){
  const needle=norm(name);
  return db.find(e=>(!type||(type==='tennis'?e.category==='tennis':e.category!=='tennis'))&&[e.nameZh,e.nameEn,...(e.aliases||[])].some(a=>norm(a)===needle));
 }
 function legacy(text,db,type){
  const exercises=[],notes=[];
  for(const chunk of plain(text).split(/[\n；;]/)){
   for(const part of (/[|｜]/.test(chunk)?[chunk]:chunk.split('。'))){
    const raw=part.trim();if(!raw)continue;
    const pieces=raw.split(/[|｜]/).map(x=>x.trim());let name=pieces[0],volume=pieces[1]||'',clock='';
    const tm=name.match(/^(\d{1,2}[:：]\d{2})\s*/);if(tm){clock=tm[1];name=name.slice(tm[0].length);}
    if(!volume){const m=name.match(/\s*(\d+(?:\.\d+)?(?:\s*[–—~～-]\s*\d+)?\s*(?:分钟|分鐘|秒|小时|小時)|\d+\s*(?:组|組)?\s*[×xX*]\s*\d+(?:\s*[–—~～-]\s*\d+)?\s*次?(?:\s*[\/／]\s*[侧側边邊])?)\s*$/);if(m){volume=m[1];name=name.slice(0,m.index).trim();}}
    const exercise=identify(name,db,type);
    if(!exercise){notes.push(raw);continue;}
    const ordinal=exercises.filter(e=>e.exerciseId===exercise.exerciseId).length+1;
    const setsMatch=volume.match(/^(\d+)\s*(?:组|組)?\s*[×xX*]\s*(.+)$/);
    const duration=volume.match(/^(\d+(?:\.\d+)?)\s*(分钟|分鐘|秒|小时|小時)$/);
    const item={exerciseId:exercise.exerciseId,slotId:exercise.exerciseId+(ordinal>1?'-'+ordinal:''),raw,volume,clock,notes:pieces.slice(2).join(' · '),sets:[]};
    if(setsMatch)item.sets=Array.from({length:Math.min(30,+setsMatch[1])},(_,i)=>({setId:'set-'+(i+1),reps:setsMatch[2]}));
    if(duration)item.durationMinutes=+duration[1]*(duration[2]==='秒'?1/60:/小时|小時/.test(duration[2])?60:1);
    exercises.push(item);
   }
  }
  return {source:'legacy',exercises,notes,warnings:notes.length?['未识别的文字保留在备注中，未自动当作动作。']:[]};
 }
 function validatePlan(plan){
  if(!plan||plan.schema!=='leon-training/v1'||!['strength','tennis','recovery','nutrition'].includes(plan.type))throw Error('schema 或 type 不符合 Leon 协议');
  if(plan.type==='nutrition'){
   const macros=plan.macros||{};for(const k of ['protein','carbs','fat'])if(macros[k]!==undefined&&(!Number.isFinite(macros[k])||macros[k]<0||macros[k]>10000))throw Error('营养目标无效');
   if(!Array.isArray(plan.meals)||plan.meals.length>30)throw Error('meals 必须是数组');
   const meals=plan.meals.map(m=>{if(!m||typeof m.name!=='string'||typeof m.description!=='string'||m.name.length>100||m.description.length>10000)throw Error('餐次格式无效');return {name:m.name,description:m.description};});
   return {source:'structured',type:plan.type,exercises:[],macros,meals,notes:typeof plan.notes==='string'?[plan.notes]:[],warnings:[]};
  }
  if(!Array.isArray(plan.exercises)||plan.exercises.length>100)throw Error('exercises 必须为最多 100 项的数组');
  const seen=new Set();
  const exercises=plan.exercises.map(item=>{
   if(!item||!safeId(item.id))throw Error('动作 id 无效');
   const slotId=item.slotId||item.id;if(!safeId(slotId)||seen.has(slotId))throw Error('重复动作必须提供稳定且唯一的 slotId');seen.add(slotId);
   let sets=item.sets;
   if(sets===undefined)sets=[];
   if(Number.isInteger(sets)&&sets>=0&&sets<=30)sets=Array.from({length:sets},(_,i)=>({setId:'set-'+(i+1),reps:item.reps===undefined?'':String(item.reps)}));
   if(!Array.isArray(sets)||sets.length>30)throw Error('sets 必须为最多 30 组的数组');
   const ids=new Set();sets=sets.map(s=>{if(!s||!safeId(s.setId)||ids.has(s.setId))throw Error('setId 必须稳定且唯一');ids.add(s.setId);if(String(s.reps||'').length>80)throw Error('次数描述过长');return {setId:s.setId,reps:String(s.reps||'')};});
   if(item.durationMinutes!==undefined&&(!Number.isFinite(item.durationMinutes)||item.durationMinutes<0||item.durationMinutes>1440))throw Error('训练时长无效');
   for(const field of ['notes','name','reps'])if(item[field]!==undefined&&((typeof item[field]!=='string'&&typeof item[field]!=='number')||String(item[field]).length>5000))throw Error(field+' 无效');
   if(item.recordType!==undefined&&!['strength','duration','serve'].includes(item.recordType))throw Error('recordType 无效');
   return {...item,exerciseId:item.id,slotId,sets};
  });
  return {source:'structured',type:plan.type,exercises,notes:typeof plan.notes==='string'?[plan.notes]:[],warnings:[]};
 }
 function resolve(event){
  const raw=event.description||'',text=plain(raw);
  const start='[LEON_DATA_START]',end='[LEON_DATA_END]';
  const a=text.indexOf(start),b=text.indexOf(end);
  try{
   if(a<0&&b<0)return {source:'unstructured',exercises:[],notes:[],warnings:['此事件尚无 LEON_DATA 数据块，保留日历原文。'],raw};
   if(a<0||b<a||text.indexOf(start,a+start.length)>=0||text.indexOf(end,b+end.length)>=0)throw Error('数据块标记缺失、顺序错误或重复');
   const data=JSON.parse(text.slice(a+start.length,b));
   return {...validatePlan(data),raw,summary:(text.slice(0,a)+text.slice(b+end.length)).trim()};
  }catch(e){return {source:'invalid',exercises:[],notes:[],warnings:[e.message+'；请查看原始日历备注。'],raw};}
 }
 function identity(event){if(!event.id)throw Error('缺少日历事件 ID，不能安全保存记录');return JSON.stringify([event._calendarId||'primary',event.recurringEventId||event.id,event.recurringEventId?(event.originalStartTime?.dateTime||event.originalStartTime?.date||event.id):'single']);}
 function keys(storage){return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(Boolean);}
 function createStore(storage){
  function all(){return keys(storage).filter(k=>k.startsWith(PREFIX+'record:')).map(k=>({key:k,value:parse(storage.getItem(k))})).filter(x=>x.value);}
  function context(event,date){const eventIdentity=identity(event);const prior=all().find(x=>x.value.eventIdentity===eventIdentity);return {eventIdentity,date:prior?.value.date||date,scheduledDate:date,eventId:event.id,calendarId:event._calendarId||'primary',title:event.summary||''};}
  function key(c,item,setId){return PREFIX+'record:'+c.date+':'+encodeURIComponent(c.eventIdentity)+':'+item.exerciseId+':'+item.slotId+':'+setId;}
  function read(c,item,setId='_action'){return parse(storage.getItem(key(c,item,setId)),{});}
  function write(c,item,setId,patch){const k=key(c,item,setId),previous=read(c,item,setId);const record={...previous,...patch,...c,exerciseId:item.exerciseId,slotId:item.slotId,setId,updatedAt:new Date().toISOString()};storage.setItem(k,JSON.stringify(record));return record;}
  function backup(){const records={};for(const k of keys(storage))if(k.startsWith(OLD)||k.startsWith(PREFIX))records[k]=storage.getItem(k);return {app:'Leon Training',schema:3,exportedAt:new Date().toISOString(),records};}
  function checkpoint(label){const content=JSON.stringify(backup());storage.setItem(PREFIX+label+':'+new Date().toISOString(),JSON.stringify({app:'Leon Training',schema:3,records:Object.fromEntries(Object.entries(parse(content).records).filter(([k])=>!k.startsWith(PREFIX+'before-')))}));}
  function ensureMigrationBackup(){if(!storage.getItem(PREFIX+'migration-v62-backup')){const records={};for(const k of keys(storage))if(k.startsWith(OLD))records[k]=storage.getItem(k);storage.setItem(PREFIX+'migration-v62-backup',JSON.stringify({app:'Leon Training',schema:2,records}));}}
  function migrate(event,date,db,type){
   const candidates=[];
   for(const k of keys(storage).filter(k=>k.startsWith(OLD)&&k.includes(':calendar:'))){
    const m=k.match(/^leon-training-v2:(\d{4}-\d{2}-\d{2}):calendar:(.*):(done|weight)$/);if(!m)continue;
    let parts;try{parts=JSON.parse(decodeURIComponent(m[2]));}catch{continue;}
    if(!Array.isArray(parts)||parts[0]!==event._calendarId||parts[1]!==event.id)continue;
    const p=legacy(parts[3],db,type);
    // One-to-one only. A historical whole-paragraph tick never marks every new action complete.
    if(p.exercises.length!==1)continue;
    const item=p.exercises[0];if(parts[4]>0)item.slotId=item.exerciseId+'-'+(parts[4]+1);
    candidates.push({key:k,date:m[1],field:m[3],item,value:storage.getItem(k)});
   }
   if(!candidates.length)return;
   ensureMigrationBackup();
   for(const old of candidates){
    const c=context(event,old.date),existing=read(c,old.item);const migrated=existing.legacyKeys||[];if(migrated.includes(old.key))continue;
    const patch={legacyKeys:[...migrated,old.key]};
    if(old.field==='done'&&existing.done===undefined)patch.done=old.value==='1';
    if(old.field==='weight'&&existing.legacyWeight===undefined)patch.legacyWeight=old.value;
    write(c,old.item,'_action',patch);
   }
  }
  function restore(payload){
   if(!payload||payload.app!=='Leon Training'||![2,3].includes(payload.schema)||!payload.records||Array.isArray(payload.records)||typeof payload.records!=='object')throw Error('不兼容的备份文件');
   const entries=Object.entries(payload.records);if(entries.length>100000)throw Error('记录数量超限');
   for(const [k,v] of entries){if(!(k.startsWith(OLD)||k.startsWith(PREFIX))||typeof v!=='string'||v.length>20000000||k.length>20000)throw Error('备份键或值无效');}
   checkpoint('before-import');
   const previous=entries.map(([k])=>[k,storage.getItem(k)]);
   try{entries.forEach(([k,v])=>storage.setItem(k,v));}catch(e){previous.forEach(([k])=>storage.removeItem(k));previous.forEach(([k,v])=>{if(v!==null)storage.setItem(k,v);});throw Error('空间不足，导入已回滚：'+e.message);}
   return entries.length;
  }
  return {all,context,key,read,write,backup,restore,migrate,ensureMigrationBackup};
 }
 return {PREFIX,OLD,plain,identify,legacy,resolve,validatePlan,identity,createStore};
});
