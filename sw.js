const CACHE = 'business-hub-v15-1';
const SHELL = ['./', './index.html', './styles.css?v=15', './upgrade.css?v=15', './finance.js?v=15', './vendor/fredoka-latin.woff2', './vendor/nunito-latin.woff2', './core.js?v=15', './app.js?v=15', './planner.js?v=15', './cloud.js?v=15', './vendor/supabase.js', './supabase-config.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('stayflow-') || k.startsWith('business-hub-')) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Never cache account requests, third-party resources, or cloud API responses.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const permitted = SHELL.some(path => new URL(path, self.registration.scope).href === url.href);
  if (!permitted && request.mode !== 'navigate') return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
});
