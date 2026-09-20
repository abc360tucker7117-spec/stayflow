const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const H = require('../core.js');
const code = fs.readFileSync(require.resolve('../cloud.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); };
async function harness({ local = H.defaults(), remote = null, meta = {}, online = true, signedIn = true, readError = null, writeError = null, beforeWrite = null } = {}) {
  const status = [], notices = [], writes = [], backups = [], tasks = [], storage = new Map();
  let row = remote ? { data: H.clone(remote), updated_at: '2026-09-19T00:00:00Z' } : null;
  const app = { data: H.clone(local), meta: H.clone(meta), editing: false, state: { view: 'today' }, storageError: '', persist(dirty = true) { if (dirty) { this.meta.dirty = true; this.meta.revision = (this.meta.revision || 0) + 1; } return true; }, saveMeta() {}, render() {}, toast() {}, notice: (...x) => notices.push(x), clearNotice() {}, syncStatus: (...s) => status.push(s), backup: (label, value) => backups.push({ label, value: H.clone(value) }), modal() {}, button() { return ''; }, esc: String };
  const client = {
    auth: { async getSession() { return { data: { session: signedIn ? { user: { id: 'u', email: 'test@example.com' } } : null } }; }, onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, async signOut() { return { error: null }; } },
    channel() { return { on() { return this; }, subscribe() { return this; } }; }, async removeChannel() {},
    from() {
      let action = 'read', payload, conditions = {};
      const q = { select() { return q; }, eq(k, v) { conditions[k] = v; return q; }, update(p) { action = 'update'; payload = p; return q; }, insert(p) { action = 'insert'; payload = p; return q; }, single: execute, maybeSingle: execute };
      async function execute() {
        if (action === 'read') return { data: row && H.clone(row), error: readError };
        if (beforeWrite) await beforeWrite({ app, get row() { return row; }, set row(v) { row = v; } });
        if (writeError) return { error: writeError };
        if (action === 'update' && row?.updated_at !== conditions.updated_at) return { data: null };
        if (action === 'insert' && row) return { error: { code: '23505' } };
        row = { data: H.clone(payload.data), updated_at: payload.updated_at }; writes.push(H.clone(row));
        return { data: { updated_at: row.updated_at }, error: null };
      }
      return q;
    }
  };
  const window = { App: app, Hub: H, STAYFLOW_SUPABASE: { url: 'https://test.supabase.co', key: 'sb_publishable_test' }, supabase: { createClient: () => client }, addEventListener() {} };
  const context = { window, navigator: { onLine: online }, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, document: { hidden: false, addEventListener() {}, querySelector() { return { close() {} }; } }, setTimeout: fn => { tasks.push(fn); return tasks.length; }, clearTimeout() {}, setInterval() {}, URL, Date, Intl, console, confirm: () => true };
  vm.runInNewContext(code, context); await flush();
  return { app, cloud: window.Cloud, status, notices, writes, backups, tasks, get row() { return row; }, set row(v) { row = v; } };
}
const planner = note => ({ ...H.defaults(), notes: note });
test('signed-out and offline sessions never write or claim synced', async () => {
  for (const options of [{ signedIn: false }, { online: false }]) { const h = await harness(options); assert.equal(h.writes.length, 0); assert.ok(!h.status.some(s => s[1] === 'synced')); }
});
test('first sign-in on an empty device loads cloud without writing defaults', async () => {
  const h = await harness({ remote: planner('Cloud notes') }); assert.equal(h.app.data.notes, 'Cloud notes'); assert.equal(h.writes.length, 0); assert.equal(h.status.at(-1)[1], 'synced');
});
test('existing local and cloud workspaces require review on first association', async () => {
  const h = await harness({ local: planner('Local'), remote: planner('Cloud') }); assert.ok(h.cloud.conflict); assert.equal(h.app.data.notes, 'Local'); assert.equal(h.writes.length, 0);
});
test('new cloud row can be created from local data', async () => {
  const h = await harness({ local: planner('Local'), meta: { dirty: true, revision: 1 } }); assert.equal(h.writes.length, 1); assert.equal(h.row.data.notes, 'Local'); assert.equal(h.app.meta.dirty, false);
});
test('independent remote and local edits merge before conditional write', async () => {
  const base = planner('Base'), local = { ...base, notes: 'Local' }, remote = { ...base, quick: 'Remote' };
  const h = await harness({ local, remote, meta: { owner: 'u', base, version: 'old', dirty: true, revision: 1 } }); assert.equal(h.row.data.notes, 'Local'); assert.equal(h.row.data.quick, 'Remote'); assert.equal(h.writes.length, 1); assert.equal(h.cloud.conflict, null);
});
test('same-field cloud changes do not overwrite dirty device data', async () => {
  const h = await harness({ local: planner('Local'), remote: planner('Remote'), meta: { owner: 'u', base: planner('Base'), version: 'old', dirty: true } }); assert.ok(h.cloud.conflict); assert.equal(h.app.data.notes, 'Local'); assert.equal(h.writes.length, 0);
});
test('a conditional-write race retries without replacing the newer server row', async () => {
  const base = planner('Base'); let once = false;
  const h = await harness({ local: planner('Local'), remote: base, meta: { owner: 'u', base, version: '2026-09-19T00:00:00Z', dirty: true }, beforeWrite(h) { if (!once) { once = true; h.row = { data: planner('Concurrent'), updated_at: '2026-09-19T00:00:01Z' }; } } }); assert.equal(h.writes.length, 0); assert.equal(h.row.data.notes, 'Concurrent'); assert.ok(h.tasks.length);
});
test('cloud failure never reports a successful sync', async () => {
  const h = await harness({ local: planner('Local'), writeError: { message: 'Network unavailable' } }); assert.ok(!h.status.some(s => s[1] === 'synced')); assert.equal(h.status.at(-1)[1], 'error'); assert.equal(h.app.data.notes, 'Local');
});
test('typing during an in-flight write remains dirty for the next save', async () => {
  const h = await harness({ local: planner('Before'), meta: { dirty: true, revision: 1 }, beforeWrite({ app }) { app.data.notes = 'Typed during save'; app.meta.revision++; } }); assert.equal(h.row.data.notes, 'Before'); assert.equal(h.app.data.notes, 'Typed during save'); assert.equal(h.app.meta.dirty, true); assert.ok(!h.status.some(s => s[1] === 'synced'));
});
test('changing accounts requires review before publishing the prior account workspace', async () => {
  const h = await harness({ local: planner('Private to other account'), remote: planner('New account'), meta: { owner: 'someone-else' } }); assert.ok(h.cloud.conflict); assert.equal(h.writes.length, 0);
});
test('conflict resolution saves both recovery copies and retains independent edits', async () => {
  const base = planner('Base'), local = { ...base, notes: 'Local', quick: 'Local quick' }, remote = { ...base, notes: 'Remote' };
  const h = await harness({ local, remote, meta: { owner: 'u', base, version: 'old', dirty: true } }); await h.cloud.resolve('remote');
  assert.equal(h.backups.length, 2); assert.equal(h.row.data.notes, 'Remote'); assert.equal(h.row.data.quick, 'Local quick');
});
