// Service worker mínimo: permite instalar Vilink como app y siempre busca la versión más nueva.
const CACHE = 'vilink-shell-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo la propia app (no Supabase, no LiveKit)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (req.mode === 'navigate' || /\.(js|css|svg|png|woff2|webmanifest)$/.test(url.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./')))
  );
});

// ---------- Notificaciones (iPhone, Android Chrome y PC) ----------
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: 'Vilink', body: e.data && e.data.text() }; }
  const data = m.data || {};
  e.waitUntil((async () => {
    // Si Vilink está abierta y a la vista, no molestamos (salvo llamadas)
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.some((w) => w.visibilityState === 'visible' && w.focused);
    if (visible && data.open !== 'call' && !data.alert) return;
    await self.registration.showNotification(m.title || 'Vilink', {
      body: m.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      image: m.image || undefined,
      tag: m.tag || undefined,
      renotify: !!m.tag,
      requireInteraction: data.open === 'call' || !!data.alert,
      vibrate: data.alert ? [800, 300, 800, 300, 800, 300, 800] : data.open === 'call' ? [400, 200, 400, 200, 400] : [120],
      data,
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        await w.focus();
        w.postMessage({ type: 'vilink-open', data });
        return;
      }
    }
    const url = new URL('./', self.registration.scope);
    url.searchParams.set('open', JSON.stringify(data));
    await self.clients.openWindow(url.href);
  })());
});
