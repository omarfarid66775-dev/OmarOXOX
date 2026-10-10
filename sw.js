/* Ultimate XO service worker: pages/scripts network-first (always fresh), icons cache-first, offline fallback. */
const VERSION = 'xo-v2';
const CACHE = VERSION;
const SHELL = [
  './', 'index.html', 'Bbb.html', 'Login.html', 'Levels.html', 'OnAi.html', 'AiGame.html', 'Tt.html', 'Tot.html',
  'mystery.html', 'Online.html', 'dev.html', 'howtoplay.html',
  'xo-splash.js', 'xo-vs.js', 'xo-shop.js', 'xo-earn.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;           // Firebase etc. go straight to the network
  if (/\.(png|jpg|jpeg|webp|svg|ico)$/i.test(u.pathname)) {
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); return res; })));
    return;
  }
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })
    .catch(() => caches.match(r).then(h => h || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
