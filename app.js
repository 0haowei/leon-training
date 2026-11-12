/* Existing date/navigation shell, without a competing fixed weekly plan. */
const names=['周日','周一','周二','周三','周四','周五','周六'];
const TZ='Asia/Shanghai',STORE='leon-training-v2:';
function chinaToday(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>p.find(x=>x.type===t).value;return get('year')+'-'+get('month')+'-'+get('day');}
function weekDay(iso){return new Date(iso+'T00:00:00Z').getUTCDay();}
let activeDate=chinaToday(),selected=weekDay(activeDate),tab='all';
function safeGet(k){try{return localStorage.getItem(k);}catch{return null;}}
function safeSet(k,v){try{localStorage.setItem(k,v);document.getElementById('saveStatus').textContent='已保存到本机';}catch{document.getElementById('saveStatus').textContent='保存失败，请检查浏览器存储空间';}}
function render(){
 document.getElementById('datePick').value=activeDate;
 const days=document.getElementById('days');days.replaceChildren();
 for(const d of [1,2,3,4,5,6,0]){const b=document.createElement('button');b.className='day'+(d===selected?' active':'');b.textContent=names[d].slice(1);b.onclick=()=>{const next=new Date(activeDate+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+(d-selected+7)%7);activeDate=next.toISOString().slice(0,10);selected=d;render();};days.append(b);}
 document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('sel',b.dataset.tab===tab));
 const app=document.getElementById('app');app.replaceChildren();const p=document.createElement('p');p.className='muted';p.textContent='正在准备日历视图…';app.append(p);
}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
document.getElementById('datePick').onchange=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;activeDate=e.target.value;selected=weekDay(activeDate);render();};
document.getElementById('todayBtn').onclick=()=>{activeDate=chinaToday();selected=weekDay(activeDate);render();};
if('serviceWorker'in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname)))navigator.serviceWorker.register('./sw.js').catch(()=>{document.getElementById('saveStatus').textContent='离线资源安装失败，请联网重试；已有记录保留。';});
render();
