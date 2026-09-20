const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const code = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
function worker({ offline = false } = {}) {
  const handlers = {}, removed = [], puts = [], pending = [];
  let responded = false;
  const response = { ok: true, type: 'basic', clone() { return { copy: true }; } };
  const cached = { cached: true };
  const caches = { async open() { return { async addAll(paths) { for (const p of paths) { const file = p === './' ? '../index.html' : '../' + p.slice(2).split('?')[0]; assert.ok(fs.existsSync(require.resolve(file))); } }, async put(...args) { puts.push(args); } }; }, async keys() { return ['stayflow-v8-cache-1', 'business-hub-v14-1', 'other-app-cache']; }, async delete(k) { removed.push(k); }, async match(request) { return typeof request === 'string' ? cached : undefined; } };
  vm.runInNewContext(code, { self: { addEventListener: (name, fn) => handlers[name] = fn, location: { origin: 'https://example.com' }, registration: { scope: 'https://example.com/stayflow/' }, skipWaiting() {}, clients: { claim() {} } }, caches, URL, Response, fetch: async () => { if (offline) throw new Error('offline'); return response; } });
  return { handlers, removed, puts, pending, cached, get responded() { return responded; }, event(request) { return { request, waitUntil: p => pending.push(p), respondWith: p => { responded = true; pending.push(p); } }; } };
}
test('every offline-shell asset exists', async () => { const w = worker(); w.handlers.install(w.event()); await Promise.all(w.pending); });
test('activation removes only Business Hub legacy caches', async () => { const w = worker(); w.handlers.activate(w.event()); await Promise.all(w.pending); assert.deepEqual(w.removed, ['stayflow-v8-cache-1']); });
test('cloud requests and third-party resources never enter the service worker cache', () => { const w = worker(); w.handlers.fetch(w.event({ method: 'GET', url: 'https://project.supabase.co/rest/v1/planner_data', mode: 'cors' })); assert.equal(w.responded, false); });
test('offline navigation serves the cached shell but a missing asset does not return HTML', async () => {
  const w = worker({ offline: true }); w.handlers.fetch(w.event({ method: 'GET', url: 'https://example.com/stayflow/', mode: 'navigate' })); assert.equal(await w.pending[0], w.cached);
  const asset = worker({ offline: true }); asset.handlers.fetch(asset.event({ method: 'GET', url: 'https://example.com/stayflow/app.js?v=14', mode: 'cors' })); assert.equal((await asset.pending[0]).type, 'error');
});
