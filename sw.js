/* ============================================================
   sw.js — オフラインでも あそべるように するための サービスワーカー
   ★ 中身を なおしたら CACHE の 番号を 必ず 上げる ★
   ============================================================ */

const CACHE = 'ishiarai-v4';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/state.js',
  './js/stones.js',
  './js/pixel.js',
  './js/field.js',
  './js/wash.js',
  './js/light.js',
  './js/collection.js',
  './js/shelf.js',
  './js/workshop.js',
  './js/weather.js',
  './js/audio.js',
  './js/ui.js',
  './icons/icon-64.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });

    // ページを ひらくときは ネット優先（更新を すぐ ひろえる）
    if (req.mode === 'navigate'){
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || caches.match('./index.html');
      }
    }

    // それ以外は キャッシュ優先（うらで こっそり 更新）
    if (cached){
      fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res));
      }).catch(() => {});
      return cached;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic'){
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch {
      return new Response('offline', { status: 503, statusText: 'offline' });
    }
  })());
});
