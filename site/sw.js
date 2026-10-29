/* Ekaya service worker: opens instantly and works offline at venues.
   Pages, scripts and styles: network first (fresh after every deploy), cached copy when offline.
   Fonts, icons, 3D library and uploaded mood photos: cache first. The data API is never cached. */
const V = 'ekaya-v12';
const SHELL = ['/', '/assets/app.css', '/assets/core.js', '/assets/art.js', '/assets/fx.js', '/assets/sync.js', '/assets/venue.js', '/assets/venue3d.js', '/assets/photos.js', '/assets/runsheet.js', '/assets/widgets.js', '/assets/app.js',
  '/assets/icons.svg', '/assets/brand.svg', '/assets/vendor/qrcode.js', '/assets/fonts/inter.woff2', '/assets/fonts/newsreader.woff2', '/assets/fonts/newsreader-italic.woff2', '/assets/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache:'reload'})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ekaya-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const LONG = /^\/(assets\/(fonts|vendor)\/|assets\/icon|assets\/favicon|api\/data\/img\/)/;
const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, x => { clearTimeout(t); rej(x); }); });

async function networkFirst(req, key){
  const c = await caches.open(V);
  const net = fetch(req).then(r => { if(r.ok) c.put(key || req, r.clone()).catch(() => {}); return r; });
  net.catch(() => {});
  try{ return await timeout(net, 5000); }
  catch(e){ const hit = await c.match(key || req); return hit || net; }  // slow venue network: cached copy now, else keep waiting
}
async function cacheFirst(req){
  const c = await caches.open(V), hit = await c.match(req);
  if(hit) return hit;
  const r = await fetch(req);
  if(r.ok) c.put(req, r.clone());
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;
  const p = url.pathname;
  if(LONG.test(p)) { e.respondWith(cacheFirst(req)); return; }
  if(p.startsWith('/api/') || p === '/sw.js') return;
  if(req.mode === 'navigate'){ e.respondWith(networkFirst(req, p.startsWith('/g/') ? '/g/' : '/')); return; }
  if(/^\/(assets\/|g\/|manifest)/.test(p)) e.respondWith(networkFirst(req));
});
