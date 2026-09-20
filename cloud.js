/* Existing planner_data table, with conditional writes and three-way merging. */
(function () {
  'use strict';
  const A = window.App, H = window.Hub, CONFIG = 'stayflow-v4-cloud';
  if (!A || A.storageError) return;
  let client = null, user = null, channel = null, authListener = null, pendingConflict = null, timer = null, running = false, rerun = false, ready = false;
  function config() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(CONFIG) || '{}'); } catch {}
    return { url: stored.url || window.STAYFLOW_SUPABASE?.url || '', key: stored.key || window.STAYFLOW_SUPABASE?.key || '' };
  }
  function status(text, kind = '') { A.syncStatus(text, kind); }
  async function fetchWithTimeout(url, init = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    else init.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 20000);
    try { return await fetch(url, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timeout); init.signal?.removeEventListener('abort', abort); }
  }
  function snapshot(value) { const d = H.normalize(value); delete d.expenses; return d; }
  function equal(a, b) { return JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b)); }
  function saveMeta() { A.saveMeta(); }
  function schedule() { clearTimeout(timer); if (!user || pendingConflict) return; status(navigator.onLine ? 'Saved locally · syncing…' : 'Offline · saved on device', 'pending'); timer = setTimeout(sync, 900); }
  function setConflict(remote, row, message, merged = null, paths = []) {
    pendingConflict = { remote, row, message, merged, paths };
    status('Changes need review', 'conflict');
    A.notice(message + ' Both versions are preserved until you choose.', 'conflict');
  }
  function reviewConflict() {
    if (!pendingConflict) return;
    const c = pendingConflict;
    A.modal('Review workspace changes', `<p class="inline-help">${A.esc(c.message)}</p><p class="inline-help">${c.merged ? 'Independent edits can be combined. Choose which version to keep for the conflicting fields.' : 'Choose the workspace you want to continue with. Your current device copy and the cloud copy will both be saved as recovery backups.'}</p>${c.paths.length ? `<p class="detail-note">${c.paths.length} conflicting field${c.paths.length === 1 ? '' : 's'}. This can include deleted items, notes, or changes to a reservation.</p>` : ''}<div class="details-grid"><div><div class="detail-label">This device</div><div class="detail-value">${A.data.bookings.length} bookings · ${A.data.events.length} tasks</div></div><div><div class="detail-label">Cloud account</div><div class="detail-value">${c.remote.bookings.length} bookings · ${c.remote.events.length} tasks</div></div></div><div class="dialog-actions">${A.button('Download device backup', 'export', '', 'secondary')}${A.button(c.merged ? 'Keep my conflicting edits' : 'Use this device’s workspace', 'conflict-local', '', 'secondary')}${A.button(c.merged ? 'Keep cloud conflicting edits' : 'Use cloud workspace', 'conflict-remote', '', 'primary')}</div>`);
  }
  async function resolve(choice) {
    if (!pendingConflict || !user) return;
    if (!confirm(choice === 'local' ? 'Use your device version for the conflicting changes and sync it to this account? Both copies will be backed up first.' : 'Use the cloud version for the conflicting changes? Both copies will be backed up first.')) return;
    const c = pendingConflict;
    try {
      A.backup('Device copy before sync review', A.data); A.backup('Cloud copy before sync review', c.remote);
      let resolved;
      if (c.merged) resolved = choice === 'local' ? H.merge(snapshot(A.meta.base), snapshot(A.data), snapshot(c.remote)).data : H.merge(snapshot(A.meta.base), snapshot(c.remote), snapshot(A.data)).data;
      else resolved = choice === 'local' ? A.data : c.remote;
      A.data = resolved;
      A.meta.owner = user.id; A.meta.base = H.clone(c.remote); A.meta.version = c.row?.updated_at || null; A.meta.dirty = true;
      pendingConflict = null; ready = true;
      A.persist(); A.clearNotice(); document.querySelector('#dialog').close(); A.render(); await sync();
    } catch (e) { A.toast('Could not resolve changes: ' + e.message); }
  }
  function setUser(next) {
    const previous = user?.id;
    user = next;
    if (next?.id !== previous) { ready = false; pendingConflict = null; }
  }
  async function sync() {
    if (!client || !user) { status(navigator.onLine ? 'Saved on this device · sign in' : 'Offline · saved on device'); return; }
    if (!navigator.onLine) { status('Offline · saved on device', 'pending'); return; }
    if (pendingConflict) { status('Changes need review', 'conflict'); return; }
    if (running) { rerun = true; return; }
    clearTimeout(timer); running = true;
    const account = user.id, currentClient = client;
    status('Checking for changes…', 'pending');
    try {
      const { data: row, error } = await currentClient.from('planner_data').select('data,updated_at').eq('user_id', account).maybeSingle();
      if (error) throw error;
      if (user?.id !== account || client !== currentClient) return;
      const remote = row ? H.normalize(row.data) : H.defaults();
      if (!ready) {
        if (A.meta.owner && A.meta.owner !== account && H.meaningful(A.data)) {
          setConflict(remote, row, 'This device contains a workspace from a different account.'); return;
        }
        if (!A.meta.owner && row && H.meaningful(A.data) && !equal(A.data, remote)) {
          setConflict(remote, row, 'Your existing device workspace differs from the cloud workspace.'); return;
        }
        A.meta.owner = account;
        if (!A.meta.base) {
          if (row && !A.meta.dirty && !H.meaningful(A.data)) { A.data = remote; if (!A.persist(false)) throw new Error('The cloud copy could not be saved locally.'); }
          A.meta.base = H.clone(row ? remote : H.defaults());
          A.meta.version = row?.updated_at || null;
          if (!row && H.meaningful(A.data)) A.meta.dirty = true;
        }
        ready = true; saveMeta();
      }
      // Detect another device, including legacy clients which only change updated_at.
      if (row && (!A.meta.version || A.meta.version !== row.updated_at || !equal(A.meta.base || H.defaults(), remote))) {
        if (A.editing && !A.meta.dirty) { status('Cloud changes ready · finish editing', 'pending'); rerun = true; return; }
        if (A.meta.dirty) {
          const merged = H.merge(snapshot(A.meta.base || H.defaults()), snapshot(A.data), snapshot(remote));
          if (merged.conflicts.length) { setConflict(remote, row, 'This workspace was edited on another device too.', merged.data, merged.conflicts); return; }
          A.data = merged.data;
        } else A.data = remote;
        A.meta.base = H.clone(remote); A.meta.version = row.updated_at;
        if (!A.persist(false)) throw new Error('Another tab changed this workspace. Resolve the local changes before syncing.');
        if (!A.editing) A.render();
      }
      if (!row && A.meta.version) { setConflict(H.defaults(), null, 'The cloud workspace was removed or replaced. Review before recreating it.'); return; }
      if (A.meta.dirty || !row) {
        const local = H.clone(A.data), revision = A.meta.revision, updatedAt = new Date(Math.max(Date.now(), (Date.parse(row?.updated_at || '') || 0) + 1)).toISOString();
        status('Saving to cloud…', 'pending');
        const payload = { data: local, updated_at: updatedAt };
        const request = row ? currentClient.from('planner_data').update(payload).eq('user_id', account).eq('updated_at', row.updated_at).select('updated_at').maybeSingle() : currentClient.from('planner_data').insert({ ...payload, user_id: account }).select('updated_at').single();
        const result = await request;
        if (user?.id !== account || client !== currentClient) return;
        if (result.error?.code === '23505' || !result.error && !result.data) { rerun = true; status('Another device updated · checking…', 'pending'); return; }
        if (result.error) throw result.error;
        A.meta.base = local; A.meta.version = result.data.updated_at;
        A.meta.dirty = revision !== A.meta.revision;
        saveMeta();
        if (A.meta.dirty) rerun = true;
      }
      if (!A.meta.dirty) { const t = new Intl.DateTimeFormat('en-PH', { timeZone: H.ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date()); status('Synced · ' + t, 'synced'); A.clearNotice(); }
    } catch (e) {
      status('Could not sync · saved on device', 'error');
      A.notice('Cloud sync did not finish. Your device copy is safe. Open Settings to retry. ' + (e.message || ''), 'sync');
    } finally { running = false; if (rerun && !pendingConflict) { rerun = false; timer = setTimeout(sync, A.editing ? 3000 : 600); } }
  }
  async function attachRealtime() {
    if (!client || !user) return;
    if (channel) await client.removeChannel(channel);
    channel = client.channel('business-hub-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'planner_data', filter: 'user_id=eq.' + user.id }, () => { clearTimeout(timer); timer = setTimeout(sync, 500); }).subscribe();
  }
  async function init() {
    const c = config();
    if (!c.url || !c.key || !window.supabase) { status('Saved on this device · sign in'); return; }
    try {
      client = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: fetchWithTimeout } });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      setUser(data?.session?.user || null);
      authListener = client.auth.onAuthStateChange((event, session) => {
        // Leave the auth callback before making another SDK call to avoid deadlocks.
        setTimeout(async () => {
          const oldId = user?.id;
          setUser(session?.user || null);
          if (user) { if (oldId !== user.id) { await attachRealtime(); if (!A.editing) A.render(); } await sync(); }
          else { status('Saved on this device · sign in'); if (oldId && !A.editing) A.render(); }
        }, 0);
      }).data.subscription;
      if (user) { await attachRealtime(); await sync(); } else status('Saved on this device · sign in');
      if (A.state.view === 'settings' && !A.editing) A.render();
    } catch (e) { status('Cloud unavailable · saved on device', 'error'); A.notice('The cloud connection could not start. Your local workspace is still available. ' + e.message, 'sync'); }
  }
  async function auth(mode, email, password) {
    if (!client) throw new Error('Set up the cloud connection in Advanced connection settings first.');
    if (mode === 'signup') {
      const result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (result.error) throw result.error;
      A.toast(result.data.session ? 'Account ready' : 'Check your email to confirm your account, then sign in.');
    } else {
      const result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setUser(result.data.user); await attachRealtime(); await sync(); A.render(); A.toast(pendingConflict ? 'Signed in · review workspace changes' : 'Signed in');
    }
  }
  async function signout(skipConfirm = false) {
    if (!client || !user) return;
    if (!skipConfirm && A.meta.dirty && !confirm('Some changes have not synced. Sign out while keeping them safely on this device?')) return;
    if (running) throw new Error('Wait for the current sync to finish, then sign out.');
    clearTimeout(timer);
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    if (channel) { await client.removeChannel(channel); channel = null; }
    setUser(null); status('Saved on this device · sign in'); A.render();
  }
  async function setConfig(url, key) {
    url = url.trim().replace(/\/$/, ''); key = key.trim();
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/') throw new Error('Use your project’s HTTPS supabase.co URL.');
    if (key.startsWith('sb_secret_')) throw new Error('Use a publishable key, never a secret key.');
    if (key.startsWith('ey')) { try { const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (payload.role !== 'anon') throw new Error('Use an anonymous/public key only.'); } catch { throw new Error('This is not a valid public key.'); } }
    else if (!key.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key.');
    if (config().url === url && config().key === key) return A.toast('Connection is unchanged');
    if (!confirm('Change this device’s cloud project? Your local workspace is kept and you will need to sign in again.')) return;
    await signout(true); authListener?.unsubscribe();
    localStorage.setItem(CONFIG, JSON.stringify({ url, key })); client = null; ready = false;
    await init(); A.render(); A.toast('Connection saved');
  }
  window.Cloud = { config, schedule, sync, auth, signout, setConfig, reviewConflict, resolve, get user() { return user; }, get conflict() { return pendingConflict; } };
  window.addEventListener('online', sync);
  window.addEventListener('offline', () => status('Offline · saved on device', 'pending'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  setInterval(() => { if (user && !document.hidden) sync(); }, 60000);
  init();
})();
