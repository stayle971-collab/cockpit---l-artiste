const CACHE='lartiste-v1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./documents/permis_armement_lartiste.pdf','./assets/qr_registre_passagers.png','./assets/qr_avis_google.png','./assets/bateau_lartiste.png','./assets/logo_alizes_evasion.png','./assets/signature_lartiste.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});