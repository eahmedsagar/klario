const C='klario-v3';
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(['./index.html','./manifest.json','./pdf.min.js','./pdf.worker.min.js'])));
  self.skipWaiting();
});
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{
  e.respondWith(fetch(e.request).then(r=>{
    if(e.request.method==='GET'&&r.ok){const cl=r.clone();caches.open(C).then(c=>c.put(e.request,cl));}
    return r;
  }).catch(()=>caches.match(e.request)));
});
