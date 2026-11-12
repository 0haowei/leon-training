/* Static assets only. Google API responses/tokens never enter the service worker cache. */
const CACHE='leon-training-v6.3-20261113-calendar-protocol';
const CORE=["./", "./index.html", "./app.js?v=6.3", "./training-core.js?v=6.3", "./training-ui.js?v=6.3", "./calendar.js?v=6.3", "./calendar.css?v=6.3", "./manifest.webmanifest"], OPTIONAL=["./data/exercises.json", "./assets/exercises/barbell-squat.svg", "./assets/exercises/bounce-reading.svg", "./assets/exercises/dynamic-warmup.svg", "./assets/exercises/first-serve.svg", "./assets/exercises/forehand.svg", "./assets/exercises/leg-curl.svg", "./assets/exercises/pallof-press.svg", "./assets/exercises/recover.svg", "./assets/exercises/romanian-deadlift.svg", "./assets/exercises/second-serve.svg", "./assets/exercises/serve-toss.svg", "./assets/exercises/serve-warmup.svg", "./assets/exercises/split-step.svg", "./assets/exercises/standing-calf-raise.svg", "./assets/exercises/video-review.svg", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await Promise.allSettled(OPTIONAL.map(url=>c.add(url)));await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(k=>k.startsWith('leon-training-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const network=fetch(e.request).then(async r=>{if(r.ok)await cache.put(e.request,r.clone());return r;});
  e.waitUntil(network.catch(()=>{}));
  let timer;try{return await Promise.race([network,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('network timeout')),4000);})]);}
  catch{const cached=await cache.match(e.request);if(cached)return cached;if(e.request.mode==='navigate'){const index=await cache.match('./index.html');if(index)return index;}return Response.error();}
  finally{clearTimeout(timer);}
 })());
});
