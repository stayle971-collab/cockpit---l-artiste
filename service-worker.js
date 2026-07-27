const CACHE='lartiste-v2-1-avis';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./documents/permis_armement_lartiste.pdf','./assets/qr_registre_passagers.png','./assets/qr_avis_google.png','./assets/qr_avis_tripadvisor.png','./assets/bateau_lartiste.png','./assets/logo_alizes_evasion.png','./assets/signature_lartiste.jpg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
