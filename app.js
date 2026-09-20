(function () {
  'use strict';
  const H = window.Hub;
  const KEY = 'stayflow-v4', META = 'business-hub-sync-v13';
  const $ = s => document.querySelector(s);
  const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const icons = {
    home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>', booking: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>', property: '<path d="M4 21V8l8-5 8 5v13zM8 11h1m6 0h1M8 15h1m6 0h1m-6 6v-3h6v3"/>', task: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>', routine: '<path d="M20 7a9 9 0 0 0-15-1L2 9m0-6v6h6m-4 8a9 9 0 0 0 15 1l3-3m0 6v-6h-6"/>', guests: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 5a5 5 0 0 1 2 4v2"/>', finance: '<rect x="3" y="13" width="4" height="8"/><rect x="10" y="8" width="4" height="13"/><rect x="17" y="3" width="4" height="18"/>', notes: '<path d="M5 3h14v18H5zM9 8h6m-6 4h6m-6 4h4"/>', settings: '<path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>', arrival: '<path d="M14 3h7v18h-7M3 12h13m-5-5 5 5-5 5"/>', departure: '<path d="M10 3H3v18h7m-2-9h13m-5-5 5 5-5 5"/>', bed: '<path d="M3 18V7m18 11V9M3 14h18M3 18v3m18-3v3M7 9h5v5M3 9h18"/>', wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-7 5h7"/>', alert: '<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>', check: '<path d="m5 12 4 4L19 6"/>', arrow: '<path d="m9 5 7 7-7 7"/>', plus: '<path d="M12 4v16M4 12h16"/>', more: '<circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="20" cy="12" r="1"/>', leaf: '<path d="M20 3C8 2 2 8 5 16s15 6 15-13ZM5 20 16 8"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', edit: '<path d="m4 16 12-12 4 4L8 20H4zm10-10 4 4"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.task}</svg>`;
  const nav = [['WORKSPACE', [['today', 'Today', 'home'], ['calendar', 'Calendar', 'calendar'], ['bookings', 'Bookings', 'booking'], ['properties', 'Properties', 'property']]], ['ORGANIZE', [['tasks', 'Tasks & meetings', 'task'], ['routines', 'Daily routines', 'routine'], ['guests', 'Guests', 'guests'], ['notes', 'Notes', 'notes']]], ['BUSINESS', [['finance', 'Finance', 'finance'], ['settings', 'Settings', 'settings']]]];
  const labels = Object.fromEntries(nav.flatMap(g => g[1].map(v => [v[0], v[1]])));
  const state = { view: 'today', calendarMode: matchMedia('(max-width:700px)').matches ? 'agenda' : 'week', calendarDate: H.day(H.now()), property: '', source: '', query: '', bookingStatus: 'All', taskFilter: 'open', financeTab: 'business', financeMonth: H.now().slice(0, 7), agendaMode: 'today' };
  let data, meta = {}, storageError = '', toastTimer, formDirty = false, dialogReturnFocus, formBaseline = null, lastStoredRaw = null;
  function readJSON(key, fallback) { const text = localStorage.getItem(key); return text ? JSON.parse(text) : fallback; }
  function backup(label, value = data) {
    const key = 'business-hub-backup:' + Date.now() + ':' + H.id().slice(0, 5);
    localStorage.setItem(key, JSON.stringify({ label, savedAt: new Date().toISOString(), data: value }));
    return key;
  }
  try {
    const raw = readJSON(KEY, null) || readJSON('stayflow-v3', null);
    if (raw && raw.schemaVersion !== 13) backup('Before Business Hub redesign', raw);
    data = H.normalize(raw || H.defaults());
    meta = readJSON(META, {}) || {};
    lastStoredRaw = localStorage.getItem(KEY);
  } catch (error) { storageError = error.message; data = H.defaults(); }
  function saveMeta() { try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) { notice('Storage is full or unavailable. Export a backup before closing this page.', 'export'); } }
  function persist(dirty = true) {
    if (storageError) { toast('Saved data needs recovery. Export the original data in Settings before making changes.'); return false; }
    try {
      const latestRaw = localStorage.getItem(KEY);
      if (latestRaw && latestRaw !== lastStoredRaw) {
        const base = H.normalize(lastStoredRaw ? JSON.parse(lastStoredRaw) : H.defaults()), remote = H.normalize(JSON.parse(latestRaw));
        const current = H.clone(data); delete base.expenses; delete remote.expenses; delete current.expenses;
        const merged = H.merge(base, current, remote);
        if (merged.conflicts.length) {
          notice('Another tab changed the same record. Export your current copy, then refresh to review the latest workspace.', 'export', true);
          return false;
        }
        data = H.normalize(merged.data);
        meta = { ...meta, ...readJSON(META, {}), dirty: true };
        dirty = true;
      }
      data.expenses = data.financeBusiness.filter(x => x.kind === 'expense');
      if (dirty) { meta.dirty = true; meta.revision = (meta.revision || 0) + 1; }
      lastStoredRaw = JSON.stringify(data);
      localStorage.setItem(KEY, lastStoredRaw);
      localStorage.setItem(META, JSON.stringify(meta));
      if (dirty) { syncStatus(navigator.onLine ? 'Saved on this device' : 'Offline · saved on device', 'pending'); window.Cloud?.schedule(); }
      return true;
    } catch (e) { notice('Your latest edits could not be saved on this device. Export a backup now and free browser storage.', 'export', true); syncStatus('Could not save · export backup', 'error'); return false; }
  }
  function change(fn, message = 'Saved') {
    if (storageError) return toast('Your existing data needs recovery first.');
    const before = H.clone(data);
    fn(data);
    if (!persist()) { data = before; return; }
    formDirty = false;
    $('#dialog').close();
    render();
    toast(message);
  }
  function syncStatus(label, status = '') { $('#sync-label').textContent = label; $('#sync-status').dataset.state = status; const x = $('#settings-sync'); if (x) x.textContent = label; }
  function notice(text, action = '', error = false) { const x = $('#system-notice'); x.className = 'notice' + (error ? ' error' : ''); x.innerHTML = `<span>${esc(text)}</span>${action ? `<button class="button secondary small" data-action="${esc(action)}">${action === 'export' ? 'Export backup' : action === 'conflict' ? 'Review changes' : 'Review'}</button>` : ''}`; }
  function clearNotice() { if (!storageError) $('#system-notice').classList.add('hidden'); }
  function toast(text) { const x = $('#toast'); x.textContent = text; x.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => x.classList.add('hidden'), 4500); }
  const button = (text, action, extra = '', cls = 'secondary small') => `<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${text}</button>`;
  const idAttr = id => `data-id="${esc(id)}"`;
  function badge(text) { const cls = ['Confirmed', 'Paid', 'Available', 'Done', 'Active'].includes(text) ? 'green' : ['Pending', 'Deposit paid', 'Cleaning'].includes(text) ? 'amber' : ['Cancelled', 'Unpaid', 'High'].includes(text) ? 'red' : ''; return `<span class="badge ${cls}">${esc(text)}</span>`; }
  function empty(title, description, action = '', label = '') { return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(description)}</p>${action ? button(label, action, '', 'primary') : ''}</div>`; }
  const time = value => H.dateLabel(value, { hour: 'numeric', minute: '2-digit', month: undefined, day: undefined });
  const dateTime = value => H.dateLabel(value, { hour: 'numeric', minute: '2-digit' });
  function navigation() {
    $('#navigation').innerHTML = nav.map(([group, items]) => `<p class="nav-label">${group}</p>${items.map(([view, label, name]) => `<button class="nav-item ${state.view === view ? 'active' : ''}" data-action="navigate" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(name)}${label}${view === 'tasks' && data.events.some(e => !e.done) ? `<span class="nav-count">${data.events.filter(e => !e.done).length}</span>` : ''}</button>`).join('')}`).join('');
    $('#mobile-navigation').innerHTML = [['today', 'Today', 'home'], ['calendar', 'Calendar', 'calendar'], ['bookings', 'Bookings', 'booking'], ['more', 'More', 'more']].map(([v, label, name]) => `<button data-action="${v === 'more' ? 'navigation-menu' : 'navigate'}" data-view="${v}" class="${state.view === v || v === 'more' && !['today', 'calendar', 'bookings'].includes(state.view) ? 'active' : ''}">${icon(name)}${label}</button>`).join('');
  }
  function navigate(view) {
    if (!labels[view]) view = 'today';
    if ($('#dialog').open && formDirty && !confirm('Discard the unsaved form?')) return;
    formDirty = false; $('#dialog').close();
    state.view = view;
    history.replaceState(null, '', '#' + view);
    render(); window.scrollTo({ top: 0 });
    $('#main').focus({ preventScroll: true });
  }
  function render() {
    navigation();
    const titles = { today: ['YOUR DAILY OVERVIEW', `${Number(H.now().slice(11, 13)) < 12 ? 'Good morning' : Number(H.now().slice(11, 13)) < 18 ? 'Good afternoon' : 'Good evening'}, Andrei`, H.dateLabel(H.day(H.now()), { weekday: 'long', year: 'numeric' })], calendar: ['MAKE ROOM FOR WHAT’S NEXT', 'Reservation calendar', 'See availability, plan turnovers, and keep your week in view.'], bookings: ['EVERY STAY, TAKEN CARE OF', 'Your bookings', 'Guest details, stay dates, and payments in one place.'], properties: ['YOUR COLLECTION', 'Properties & units', 'A clear view of every space you manage.'], tasks: ['A LITTLE MORE FOCUS', 'Tasks & meetings', 'Make time for the work that matters.'], routines: ['GOOD DAYS START HERE', 'Daily routines', 'Small, recurring actions that keep your business moving.'], guests: ['A PERSONAL WELCOME', 'Your guests', 'Keep the details that make every stay feel thoughtful.'], finance: ['KNOW YOUR NUMBERS', 'Finance', 'Separate business and personal money. Review one month at a time.'], notes: ['SPACE TO THINK', 'Notes & ideas', 'Your plans, guest templates, and everyday reminders.'], settings: ['MAKE IT YOURS', 'Workspace settings', 'Your preferences, account, and safe copies of your work.'] };
    const [eyebrow, title, subtitle] = titles[state.view];
    if (state.view === 'today') $('#page-description').textContent = subtitle + ' · ' + time(H.now()) + ' · Manila';
    const brandText = document.querySelector('.brand > span:last-child'); if (brandText && data.settings.name !== "Andrei's Business Hub") brandText.textContent = data.settings.name;
    $('#page-eyebrow').textContent = eyebrow; $('#page-title').textContent = title; $('#page-description').textContent = state.view === 'today' ? subtitle + ' · ' + time(H.now()) + ' · Manila' : subtitle; $('#crumb').textContent = labels[state.view];
    document.title = labels[state.view] + " · Andrei's Business Hub";
    const views = { today: renderToday, calendar: renderCalendar, bookings: renderBookings, properties: renderProperties, tasks: renderTasks, routines: renderRoutines, guests: renderGuests, finance: renderFinance, notes: renderNotes, settings: renderSettings };
    $('#view').innerHTML = views[state.view]();
    if (storageError) notice('Your saved data could not be read: ' + storageError + ' The original copy is untouched. Download it in Settings to recover it.', 'raw-export', true);
  }
  function agendaRow(item, date) {
    const isBooking = item.kind === 'booking';
    return `<div class="agenda-row ${item.done ? 'done' : ''}"><span class="agenda-time">${time(item.when)}</span><span class="agenda-dot ${esc(item.type)}"></span><div><div class="agenda-title">${esc(item.title)}</div><div class="agenda-sub">${esc(item.subtitle)}</div></div><div class="agenda-actions">${isBooking ? badge(item.status) + `<button class="icon-button" data-action="booking-detail" ${idAttr(item.id)} aria-label="View booking for ${esc(item.title)}">${icon('arrow')}</button>` : `<button class="check-button ${item.done ? 'checked' : ''}" data-action="${item.kind === 'routine' ? 'routine-done' : 'event-done'}" data-date="${date}" ${idAttr(item.id)} aria-label="${item.done ? 'Undo' : 'Complete'} ${esc(item.title)}" aria-pressed="${!!item.done}">${item.done ? icon('check') : ''}</button>`}</div></div>`;
  }
  function renderToday() {
    const now = H.now(), date = H.day(now), active = data.bookings.filter(b => b.status !== 'Cancelled');
    const arrivals = active.filter(b => H.day(b.in) === date), departures = active.filter(b => H.day(b.out) === date);
    const occupied = data.rooms.filter(r => data.bookings.some(b => b.unit === r.name && b.status === 'Confirmed' && b.in <= now && b.out > now)).length;
    const due = active.filter(b => H.balance(b) > 0), unknown = active.filter(b => H.balance(b) === null).length;
    const stats = [['Arrivals today', arrivals.length, arrivals.length ? 'Upcoming welcomes' : 'A quiet arrival day', 'arrival'], ['Departures today', departures.length, departures.length ? 'Make room for the next stay' : 'No departures scheduled', 'departure'], ['Occupancy now', data.rooms.length ? Math.round(occupied / data.rooms.length * 100) + '%' : '—', `${occupied} of ${data.rooms.length} units occupied`, 'bed'], ['Outstanding balances', H.money(due.reduce((s, b) => s + H.balance(b), 0)), `${due.length} unpaid balance${due.length === 1 ? '' : 's'}${unknown ? ` · ${unknown} deposit${unknown === 1 ? '' : 's'} to review` : ''}`, 'wallet']];
    const alerts = H.attention(data, now);
    const dates = Array.from({ length: state.agendaMode === 'week' ? 7 : 1 }, (_, i) => H.addDays(date, i));
    const agenda = dates.map(d => { const items = H.agenda(data, d); return items.length ? `${dates.length > 1 ? `<div class="agenda-date">${H.dateLabel(d, { weekday: 'long' })}</div>` : ''}${items.map(x => agendaRow(x, d)).join('')}` : ''; }).join('');
    const workload = Array.from({ length: 7 }, (_, i) => { const d = H.addDays(date, i); const count = H.agenda(data, d).filter(x => !x.done).length; return `<div class="workload-day ${i === 0 ? 'today' : ''}" title="${H.dateLabel(d)}: ${count} items"><div class="workload-bar" style="--height:${Math.min(45, 4 + count * 7)}px"></div>${H.dateLabel(d, { weekday: 'short', month: undefined, day: undefined })}</div>`; }).join('');
    return `<div class="stats">${stats.map(([label, value, detail, name], i) => `<div class="stat ${i === 3 ? 'warm' : ''}"><div class="stat-label">${label}</div><span class="stat-icon">${icon(name)}</span><div class="stat-number">${value}</div><div class="stat-detail">${detail}</div></div>`).join('')}</div><div class="dashboard-grid"><div class="stack"><section class="panel"><div class="panel-header"><h2>Today’s agenda</h2><div class="segments" aria-label="Agenda range">${['today', 'week'].map(v => `<button data-action="agenda-mode" data-value="${v}" class="${state.agendaMode === v ? 'active' : ''}" aria-pressed="${state.agendaMode === v}">${v === 'today' ? 'Today' : '7 days'}</button>`).join('')}</div></div>${agenda || empty('A little breathing room', 'Your bookings, meetings, tasks, and daily routines will appear here.', 'event-new', 'Schedule something')}<div style="border-top:1px solid var(--line);padding-top:10px">${button('＋ Add to schedule', 'event-new', '', 'ghost small')}</div></section><section class="panel"><div class="panel-header"><h2>Your properties</h2><button class="text-link" data-action="navigate" data-view="properties">View all →</button></div>${data.rooms.length ? data.rooms.slice(0, 5).map(roomRow).join('') : empty('Your first property awaits', 'Add a unit to start organizing reservations and availability.', 'property-new', 'Add a property')}</section></div><div class="stack"><section class="panel"><div class="panel-header"><h2>Needs attention</h2><span class="badge ${alerts.length ? 'amber' : 'green'}">${alerts.length} ${alerts.length === 1 ? 'item' : 'items'}</span></div>${alerts.length ? alerts.slice(0, 4).map(a => `<div class="attention-item">${icon('alert')}<div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div><button class="text-link" data-action="${a.booking ? 'booking-detail' : 'event-edit'}" ${idAttr(a.booking || a.event)}>Review</button></div>`).join('') + (alerts.length > 4 ? button('View all ' + alerts.length + ' items', 'attention-all', '', 'ghost small') : '') : `<div class="calm-state">${icon('leaf')}<strong>All clear for now</strong><p class="muted">We’ll keep the important things here.</p></div>`}</section><section class="panel"><div class="panel-header"><h2>Quick note</h2>${icon('notes')}</div><label class="sr-only" for="quick-note">Quick note</label><textarea id="quick-note" class="quick-note" data-note="quick" placeholder="An idea, a guest request, something for later…">${esc(data.quick)}</textarea><div class="note-footer">${icon('check')}<span id="note-save-label">Saved on this device as you type</span></div></section><section class="panel"><div class="panel-header"><h2>The week ahead</h2><span class="muted">Open items</span></div><div class="workload-days">${workload}</div><p class="muted">Plan a little space between busy days.</p></section></div></div>`;
  }
  function roomRow(r) { const s = H.roomState(data, r); return `<div class="room-row"><span class="room-mark">${esc(r.name?.slice(0, 1) || 'U')}</span><div class="room-info"><strong>${esc(r.name)}</strong><small>${esc(r.property || 'Your property')} · ${esc(r.cap)} guests</small></div><div class="room-detail">${badge(s.label)}<small>${esc(s.detail)}</small></div></div>`; }
  function renderBookings() {
    const rows = data.bookings.filter(b => (state.bookingStatus === 'All' || b.status === state.bookingStatus) && `${b.guest} ${b.unit} ${b.source || ''}`.toLowerCase().includes(state.query.toLowerCase())).sort((a, b) => b.in.localeCompare(a.in));
    return `<section class="panel"><div class="toolbar"><input type="search" class="grow" id="booking-search" aria-label="Search bookings" placeholder="Search guest, property, or source…" value="${esc(state.query)}"><select id="booking-status" aria-label="Booking status">${options(['All', 'Confirmed', 'Pending', 'Cancelled'], state.bookingStatus)}</select><span class="muted">${rows.length} reservations</span></div><div class="table-wrap"><table><thead><tr><th>Guest / property</th><th>Stay</th><th>Status</th><th>Payment</th><th>Total</th><th>Balance</th><th></th></tr></thead><tbody>${rows.map(b => `<tr><td><button class="row-action" data-action="booking-detail" ${idAttr(b.id)}>${esc(b.guest)}</button><span class="subline">${esc(b.unit)} · ${esc(b.source || 'Direct')}</span></td><td class="nowrap">${H.dateLabel(b.in)} – ${H.dateLabel(b.out)}<span class="subline">${H.nights(b.in, b.out)} nights · ${esc(b.pax)} guests</span></td><td>${badge(b.status)}</td><td>${badge(b.payment)}</td><td class="nowrap">${H.money(b.amount)}</td><td class="nowrap">${H.balance(b) === null ? 'Review deposit' : H.money(H.balance(b))}</td><td><button class="icon-button" data-action="booking-detail" ${idAttr(b.id)} aria-label="View ${esc(b.guest)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>${rows.length ? '' : empty(data.bookings.length ? 'No matching reservations' : 'Make the first stay a great one', data.bookings.length ? 'Try a different guest name or status filter.' : 'Add a reservation to start planning arrivals, payments, and turnovers.', 'booking-new', 'New booking')}</section>`;
  }
  function renderProperties() { return data.rooms.length ? `<div class="toolbar"><span class="muted grow">${data.rooms.length} properties in your collection</span>${button('＋ Add property', 'property-new', '', 'secondary')}</div><div class="property-grid">${data.rooms.map(r => { const s = H.roomState(data, r); return `<section class="panel property-card"><div class="room-mark">${esc(r.name?.slice(0, 1))}</div><h2>${esc(r.name)}</h2><p class="muted">${esc(r.property || 'Your staycation property')}</p><div class="property-meta"><span>${esc(r.cap)} guests</span><span>${H.money(r.rate)} / night</span></div><div class="property-status">${badge(s.label)}<span class="muted">${esc(s.detail)}</span></div><div class="actions-row">${button('View availability', 'room-calendar', idAttr(r.id))}${button('Edit', 'property-edit', idAttr(r.id), 'ghost small')}</div></section>`; }).join('')}</div>` : `<section class="panel">${empty('Make space for your first stay', 'Add a property name, capacity, and nightly rate. Your reservations will connect to it.', 'property-new', 'Add a property')}</section>`; }
  function renderTasks() {
    const events = data.events.filter(e => state.taskFilter === 'all' || state.taskFilter === 'open' && !e.done || state.taskFilter === 'done' && e.done || state.taskFilter === 'high' && e.priority === 'High' && !e.done).sort((a, b) => a.when.localeCompare(b.when));
    return `<section class="panel"><div class="toolbar"><div class="segments grow">${[['open', 'To do'], ['done', 'Completed'], ['high', 'High priority'], ['all', 'All']].map(([v, label]) => `<button data-action="task-filter" data-value="${v}" class="${state.taskFilter === v ? 'active' : ''}">${label}</button>`).join('')}</div>${button('＋ New task or meeting', 'event-new', '', 'primary')}</div>${events.map(e => `<div class="task-row ${e.done ? 'done' : ''}"><button class="check-button ${e.done ? 'checked' : ''}" data-action="event-done" ${idAttr(e.id)} aria-label="${e.done ? 'Undo' : 'Complete'} ${esc(e.title)}">${e.done ? icon('check') : ''}</button><div class="grow"><strong>${esc(e.title)}</strong><p>${dateTime(e.when)} · ${esc(e.type)}${e.unit ? ' · ' + esc(e.unit) : ''}${e.assignee ? ' · ' + esc(e.assignee) : ''}</p></div>${badge(e.priority)}<div class="actions-row">${button('Edit', 'event-edit', idAttr(e.id), 'ghost small')}${button('Calendar', 'event-ics', idAttr(e.id), 'ghost small')}</div></div>`).join('') || empty('Nothing on this list', 'Plan a meeting, prepare a turnover, or add your next task.', 'event-new', 'Add to schedule')}</section>`;
  }
  function renderRoutines() { const today = H.day(H.now()); return `<section class="panel"><div class="panel-header"><div><h2>A steady rhythm</h2><p class="muted">Completion resets for each scheduled day.</p></div>${button('＋ New routine', 'routine-new', '', 'primary')}</div>${data.routines.map(r => `<div class="task-row"><span class="room-mark">${icon('routine')}</span><div class="grow"><strong>${esc(r.title)}</strong><p>${esc(r.time)} · ${esc(r.repeat)}${r.repeat === 'weekly' ? ' · ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][r.weekday] : ''} · ${esc(r.type)}</p></div>${badge(r.active ? 'Active' : 'Paused')}<div class="actions-row">${H.routineApplies(r, today) ? button(data.routineDone[today + ':' + r.id] ? 'Undo today' : 'Done today', 'routine-done', `${idAttr(r.id)} data-date="${today}"`) : ''}${button('Edit', 'routine-edit', idAttr(r.id), 'ghost small')}${button('Calendar', 'routine-ics', idAttr(r.id), 'ghost small')}</div></div>`).join('') || empty('Build your daily rhythm', 'Add a recurring guest check, website review, or reminder.', 'routine-new', 'Add a routine')}</section>`; }
  function renderGuests() { return `<section class="panel"><div class="panel-header"><h2>Your guest book</h2>${button('＋ Add guest', 'guest-new', '', 'primary')}</div>${data.guests.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Preferred contact</th><th>Notes</th><th></th></tr></thead><tbody>${data.guests.map(g => `<tr><td><strong>${esc(g.name)}</strong></td><td>${esc(g.phone || '—')}</td><td>${esc(g.contact)}</td><td>${esc(g.notes || '—')}</td><td>${button('Edit', 'guest-edit', idAttr(g.id), 'ghost small')}</td></tr>`).join('')}</tbody></table></div>` : empty('Remember the little details', 'Keep guest preferences and contact information handy for their next stay.', 'guest-new', 'Add a guest')}</section>`; }
  function renderFinance() {
    const f = H.finance(data, state.financeTab, state.financeMonth);
    return `<div class="toolbar"><div class="segments grow">${['business', 'personal'].map(v => `<button data-action="finance-tab" data-value="${v}" class="${state.financeTab === v ? 'active' : ''}">${v === 'business' ? 'Business' : 'Personal'}</button>`).join('')}</div><label for="finance-month">Report month</label><input id="finance-month" type="month" value="${state.financeMonth}" required>${button('＋ Add transaction', 'finance-new', '', 'primary')}</div><section class="panel" style="margin-bottom:22px"><div class="metric-summary"><div><span class="muted">${state.financeTab === 'business' ? 'Booked revenue' : 'Income'}</span><strong>${H.money(f.revenue)}</strong></div><div><span class="muted">Expenses</span><strong>${H.money(f.expenses)}</strong></div><div><span class="muted">Net</span><strong>${H.money(f.net)}</strong></div></div><p class="finance-help">${state.financeTab === 'business' ? 'Confirmed booking totals are included in the check-in month, plus manually recorded revenue. This is not a cash-collected report. Do not record booking payments again as revenue.' : 'Personal income and expenses are kept separate from your business.'}</p></section><section class="panel"><div class="panel-header"><h2>${state.financeTab === 'business' ? 'Business' : 'Personal'} transactions</h2><span class="muted">${state.financeMonth}</span></div>${f.rows.length || f.bookings.length ? `<div class="table-wrap"><table><thead><tr><th>Description</th><th>Date</th><th>Type</th><th>Amount</th><th></th></tr></thead><tbody>${f.bookings.map(b => `<tr><td>${esc(b.guest)} · ${esc(b.unit)}<span class="subline">Confirmed booking · included automatically</span></td><td>${H.dateLabel(b.in)}</td><td>Booked revenue</td><td>${H.money(b.amount)}</td><td>${button('View', 'booking-detail', idAttr(b.id), 'ghost small')}</td></tr>`).join('')}${f.rows.sort((a, b) => b.date.localeCompare(a.date)).map(x => `<tr><td>${esc(x.desc)}<span class="subline">${esc(x.cat)}</span></td><td>${H.dateLabel(x.date)}</td><td>${x.kind === 'expense' ? 'Expense' : 'Revenue'}</td><td>${H.money(x.amount)}</td><td>${button('Edit', 'finance-edit', idAttr(x.id), 'ghost small')}</td></tr>`).join('')}</tbody></table></div>` : empty('A fresh page for this month', 'Record an expense or income, or select another report month.', 'finance-new', 'Add transaction')}</section>`;
  }
  function renderNotes() { return `<div class="split"><section class="panel"><div class="panel-header"><h2>Business notebook</h2><span class="muted">Saved as you type</span></div><label class="sr-only" for="business-notes">Business notebook</label><textarea id="business-notes" class="note-area" data-note="notes" placeholder="Guest templates, ideas, pricing, plans…">${esc(data.notes)}</textarea><p class="note-footer">Saved on this device. Check the top bar for cloud sync status.</p></section><section class="panel"><div class="panel-header"><h2>Operating checklist</h2>${button('＋ Add', 'check-new')}</div>${data.checks.map(c => `<label class="checklist-item ${c.done ? 'done' : ''}"><input type="checkbox" data-action="check-toggle" ${idAttr(c.id)} ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span><button type="button" data-action="check-delete" ${idAttr(c.id)} aria-label="Remove ${esc(c.text)}">×</button></label>`).join('') || empty('Keep the essentials close', 'Add reusable checklist items for the work you repeat.')}</section></div>`; }
  function renderCalendar() {
    const start = state.calendarDate, end = H.addDays(start, 7), mode = state.calendarMode;
    const sources = [...new Set(data.bookings.map(b => b.source || 'Direct'))];
    const rangeLabel = mode === 'month' ? H.dateLabel(start, { month: 'long', year: 'numeric', day: undefined }) : H.dateLabel(start) + ' – ' + H.dateLabel(H.addDays(start, 6), { year: 'numeric' });
    const controls = `<div class="toolbar"><select id="calendar-property" aria-label="Filter property"><option value="">All properties</option>${options(data.rooms.map(r => r.name), state.property)}</select><select id="calendar-source" aria-label="Filter booking source"><option value="">All sources</option>${options(sources, state.source)}</select><span class="grow"></span><div class="segments">${['week', 'month', 'agenda'].map(v => `<button data-action="calendar-mode" data-value="${v}" class="${mode === v ? 'active' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>`;
    const bookingList = data.bookings.filter(b => b.status !== 'Cancelled' && (!state.property || b.unit === state.property) && (!state.source || (b.source || 'Direct') === state.source));
    let content = '';
    if (mode === 'week') {
      const rooms = data.rooms.filter(r => !state.property || r.name === state.property);
      const weekStart = H.stamp(start), weekEnd = H.stamp(end), span = weekEnd - weekStart;
      content = rooms.length ? `<div class="calendar-scroll" tabindex="0" role="region" aria-label="Reservation timeline, scroll horizontally"><div class="timeline"><div class="timeline-head" style="text-align:left;padding-left:16px">PROPERTY</div>${Array.from({ length: 7 }, (_, i) => { const d = H.addDays(start, i); return `<div class="timeline-head ${d === H.day(H.now()) ? 'today' : ''}">${H.dateLabel(d, { weekday: 'short', month: undefined, day: undefined })}<strong>${H.dateLabel(d)}</strong></div>`; }).join('')}${rooms.map(r => {
        const list = bookingList.filter(b => b.unit === r.name && H.stamp(b.in) < weekEnd && H.stamp(b.out) > weekStart).sort((a, b) => a.in.localeCompare(b.in));
        const lanes = [];
        const bars = list.map(b => { let lane = lanes.findIndex(end => end <= b.in); if (lane === -1) lane = lanes.length; lanes[lane] = b.out; const left = Math.max(0, (H.stamp(b.in) - weekStart) / span * 100), width = Math.min(100, (H.stamp(b.out) - weekStart) / span * 100) - left; return `<button class="timeline-booking ${b.status === 'Pending' ? 'pending' : ''}" style="--left:${left}%;--width:${width}%;--top:${16 + lane * 56}px" data-action="booking-detail" ${idAttr(b.id)} title="${esc(b.guest)} · ${dateTime(b.in)} to ${dateTime(b.out)} · ${H.nights(b.in, b.out)} nights"><strong>${esc(b.guest)}</strong><small>${H.dateLabel(b.in)} – ${H.dateLabel(b.out)} · ${H.nights(b.in, b.out)} nights</small></button>`; }).join('');
        const cleaning = data.events.filter(e => e.unit === r.name && e.type === "cleaning" && H.stamp(e.when) >= weekStart && H.stamp(e.when) < weekEnd).map(e => `<button class="timeline-cleaning" style="--left:${Math.max(2, Math.min(98, (H.stamp(e.when) - weekStart) / span * 100))}%" data-action="event-edit" ${idAttr(e.id)} aria-label="${esc(e.title)} · ${dateTime(e.when)}${e.done ? " · Completed" : ""}" title="${esc(e.title)} · ${dateTime(e.when)}">${icon(e.done ? "check" : "task")}</button>`).join("");
        return `<div class="timeline-unit">${esc(r.name)}</div><div class="timeline-track" style="min-height:${Math.max(95, lanes.length * 56 + 32)}px"><div class="timeline-free">${Array.from({ length: 7 }, (_, i) => { const d = H.addDays(start, i); const busy = data.bookings.some(b => b.unit === r.name && b.status !== 'Cancelled' && b.in < H.addDays(d, 1) + 'T00:00' && b.out > d + 'T00:00'); return `<button data-action="booking-new" data-unit="${esc(r.name)}" data-date="${d}" aria-label="New booking for ${esc(r.name)} on ${d}">${busy ? '' : 'Available'}</button>`; }).join('')}</div>${bars}${cleaning}</div>`;
      }).join('')}</div></div>` : empty('Add a property to see availability', 'Your units will appear as rows, with reservations lined up by date.', 'property-new', 'Add a property');
    } else if (mode === 'month') {
      const first = start.slice(0, 7) + '-01', weekday = (new Date(first + 'T12:00Z').getUTCDay() + 6) % 7, begin = H.addDays(first, -weekday);
      content = `<div class="calendar-scroll" tabindex="0" role="region" aria-label="Monthly calendar, scroll horizontally"><div class="month-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="month-dow">${d}</div>`).join('')}${Array.from({ length: 42 }, (_, i) => {
        const d = H.addDays(begin, i), stays = bookingList.filter(b => H.day(b.in) <= d && H.day(b.out) >= d), events = H.agenda(data, d).filter(x => x.kind !== 'booking' && (!state.property || x.unit === state.property));
        const items = [...stays.map(b => `<button class="month-event" data-action="booking-detail" ${idAttr(b.id)}>${H.day(b.in) === d ? 'In · ' : H.day(b.out) === d ? 'Out · ' : ''}${esc(b.guest)}</button>`), ...events.map(e => `<button class="month-event task" data-action="${e.kind === 'routine' ? 'routine-edit' : 'event-edit'}" ${idAttr(e.id)}>${esc(e.when.slice(11))} ${esc(e.title)}</button>`)];
        return `<div class="month-day ${d.slice(0, 7) !== start.slice(0, 7) ? 'outside' : ''} ${d === H.day(H.now()) ? 'today' : ''}"><button class="day-number" data-action="calendar-day" data-date="${d}" aria-label="Agenda for ${d}">${Number(d.slice(8))}</button>${items.slice(0, 3).join('')}${items.length > 3 ? `<button class="text-link" data-action="calendar-day" data-date="${d}">+${items.length - 3} more</button>` : ''}</div>`;
      }).join('')}</div></div>`;
    } else {
      content = `<div style="padding:0 23px 20px">${Array.from({ length: 7 }, (_, i) => { const d = H.addDays(start, i), items = H.agenda(data, d).filter(e => e.kind === 'booking' ? bookingList.some(b => b.id === e.id) : !state.property || e.unit === state.property); return `<div class="agenda-date">${H.dateLabel(d, { weekday: 'long', year: 'numeric' })}</div>${items.map(e => agendaRow(e, d)).join('') || '<p class="muted" style="padding:12px 0">No scheduled items. A little breathing room.</p>'}`; }).join('')}</div>`;
    }
    return `${controls}<section class="panel calendar-panel"><div class="calendar-controls"><h2>${rangeLabel}</h2><div class="actions-row">${button('Today', 'calendar-today')}${button('←', 'calendar-prev', 'aria-label="Previous period"')}${button('→', 'calendar-next', 'aria-label="Next period"')}</div></div>${content}<div class="calendar-legend"><span><span class="legend-dot"></span>Confirmed</span><span><span class="legend-dot pending"></span>Pending</span><span>Dashed marker · turnover task</span><span>All times · Manila</span></div><p class="calendar-hint">${mode === 'week' ? 'Bars use exact arrival and departure times. Open a stay to see or schedule its turnover.' : 'Open any item for details. Use Agenda for a comfortable mobile view.'}</p></section>`;
  }
  function options(values, selected) { return values.map(v => { const [value, label] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`; }).join(''); }
  let fieldSequence = 0;
  function field(name, label, value = '', type = 'text', attrs = '') { const fieldId = 'field-' + name + '-' + (++fieldSequence); return `<div class="field"><label for="${fieldId}">${label}</label><input id="${fieldId}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`; }
  function select(name, label, values, value, attrs = '') { return `<div class="field"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}" ${attrs}>${options(values, value)}</select></div>`; }
  function area(name, label, value = '') { return `<div class="field span-2"><label for="field-${name}">${label}</label><textarea id="field-${name}" name="${name}">${esc(value)}</textarea></div>`; }
  function modal(title, html, drawer = false) {
    const d = $('#dialog');
    if (!d.open) dialogReturnFocus = document.activeElement;
    d.classList.toggle('drawer', drawer); $('#dialog-title').textContent = title; $('#dialog-body').innerHTML = html;
    formDirty = false;
    if (!d.open) d.showModal();
    d.scrollTop = 0;
  }
  function closeDialog() { if (formDirty && !confirm('Discard the unsaved form?')) return; formDirty = false; $('#dialog').close(); }
  function form(type, content, editId = '', deletable = true) {
    const key = { booking: 'bookings', event: 'events', routine: 'routines', property: 'rooms', guest: 'guests', finance: state.financeTab === 'personal' ? 'financePersonal' : 'financeBusiness' }[type];
    formBaseline = editId ? JSON.stringify(data[key]?.find(x => x.id === editId)) : null;
    return `<form data-form="${type}" data-id="${esc(editId)}"><div class="form-grid">${content}</div><p class="form-error" role="alert"></p><div class="dialog-actions">${editId && deletable ? button('Delete', 'delete-record', `data-type="${type}" ${idAttr(editId)}`, 'danger') : ''}${button('Cancel', 'dialog-close', '', 'secondary')}<button class="button primary" type="submit">Save ${type === 'event' ? 'schedule' : type === 'property' ? 'property' : type === 'finance' ? 'transaction' : type}</button></div></form>`;
  }
  function bookingForm(editId = '', unit = '', date = H.day(H.now())) {
    if (!data.rooms.length) { modal('Add your first property', `<p class="muted">A booking needs a property. Add a unit and its capacity, then create the reservation.</p><div class="dialog-actions">${button('Add a property', 'property-new', '', 'primary')}</div>`); return; }
    const b = data.bookings.find(b => b.id === editId) || { guest: '', unit: unit || data.rooms[0].name, in: date + 'T' + data.settings.in, out: H.addDays(date, 1) + 'T' + data.settings.out, status: 'Confirmed', payment: 'Unpaid', amount: '', paidAmount: '', pax: 2, source: 'Direct', notes: '' };
    const units = [...new Set([...data.rooms.map(r => r.name), ...(b.unit ? [b.unit] : [])])];
    modal(editId ? 'Edit reservation' : 'A new stay begins here', form('booking', field('guest', 'Guest name', b.guest, 'text', 'required maxlength="200" autocomplete="name"') + select('unit', 'Property / unit', units, b.unit, 'required') + field('in', 'Check-in · Manila time', b.in, 'datetime-local', 'required') + field('out', 'Check-out · Manila time', b.out, 'datetime-local', 'required') + select('status', 'Booking status', ['Confirmed', 'Pending', 'Cancelled'], b.status) + select('source', 'Booking source', [...new Set(['Direct', 'Airbnb', 'Booking.com', 'Facebook', 'Other', b.source || 'Direct'])], b.source || 'Direct') + field('pax', 'Number of guests', b.pax, 'number', 'required min="1" step="1"') + field('amount', 'Booking total · PHP', b.amount, 'number', 'required min="0" step="0.01"') + select('payment', 'Payment status', ['Unpaid', 'Deposit paid', 'Paid'], b.payment) + field('paidAmount', 'Deposit received · PHP', b.payment === 'Deposit paid' ? b.paidAmount ?? '' : '', 'number', 'min="0" step="0.01"') + '<p class="form-help span-2">For a partial payment, enter the actual deposit. Paid means the entire booking total has been received. Dates are checked for overlaps.</p>' + area('notes', 'Notes & special requests', b.notes), editId));
  }
  function bookingDetail(id) {
    const b = data.bookings.find(b => b.id === id); if (!b) return;
    const related = data.events.filter(e => e.bookingId === id);
    const details = [['Property', b.unit], ['Guests', b.pax], ['Check-in', dateTime(b.in)], ['Check-out', dateTime(b.out)], ['Length of stay', H.nights(b.in, b.out) + ' nights'], ['Source', b.source || 'Direct'], ['Booking total', H.money(b.amount)], ['Remaining balance', H.balance(b) === null ? 'Confirm deposit amount' : H.money(H.balance(b))]];
    modal('Reservation details', `<div class="detail-hero"><h3>${esc(b.guest)}</h3><div class="actions-row">${badge(b.status)}${badge(b.payment)}</div></div><div class="details-grid">${details.map(([label, value]) => `<div><div class="detail-label">${label}</div><div class="detail-value">${esc(value)}</div></div>`).join('')}</div>${b.notes ? `<div class="detail-note">${esc(b.notes)}</div>` : ''}<div class="panel-header" style="margin-top:25px"><h2>Tasks for this stay</h2></div>${related.map(e => `<div class="task-row"><div class="grow"><strong>${esc(e.title)}</strong><p>${dateTime(e.when)}${e.assignee ? ' · ' + esc(e.assignee) : ''}</p></div>${badge(e.done ? 'Done' : 'To do')}${button('Edit', 'event-edit', idAttr(e.id), 'ghost small')}</div>`).join('') || '<p class="muted">No tasks linked yet. Add cleaning or a guest follow-up.</p>'}<div class="actions-row" style="margin-top:16px">${button('＋ Add task', 'booking-task', idAttr(id))}${button('Plan turnover', 'booking-turnover', idAttr(id))}</div><div class="dialog-actions">${button('Edit reservation', 'booking-edit', idAttr(id), 'primary')}${button('Close', 'dialog-close')}</div>`, true);
  }
  function eventForm(editId = '', preset = {}) {
    const e = data.events.find(e => e.id === editId) || { title: '', type: 'task', priority: 'Normal', when: H.now(), duration: 30, unit: '', assignee: '', notes: '', ...preset };
    modal(editId ? 'Edit schedule' : 'Make a little time', form('event', field('title', 'Title', e.title, 'text', 'required maxlength="250"') + select('type', 'Type', [['task', 'Task'], ['meeting', 'Meeting'], ['cleaning', 'Cleaning'], ['maintenance', 'Maintenance'], ['followup', 'Guest follow-up']], e.type) + field('when', 'Date & time · Manila', e.when, 'datetime-local', 'required') + field('duration', 'Duration · minutes', e.duration, 'number', 'required min="5" max="1440" step="5"') + select('priority', 'Priority', ['Low', 'Normal', 'High'], e.priority) + select('unit', 'Property (optional)', [['', 'No property'], ...data.rooms.map(r => r.name)], e.unit || '') + field('assignee', 'Assigned to (optional)', e.assignee || '', 'text', 'maxlength="150"') + `<input type="hidden" name="bookingId" value="${esc(e.bookingId || '')}">` + area('notes', 'Notes', e.notes), editId));
  }
  function routineForm(editId = '') {
    const r = data.routines.find(r => r.id === editId) || { title: '', repeat: 'daily', time: '09:00', weekday: 1, type: 'Daily reminder', active: true, notes: '' };
    modal(editId ? 'Edit routine' : 'Build a good habit', form('routine', field('title', 'Routine title', r.title, 'text', 'required maxlength="250"') + field('time', 'Time · Manila', r.time, 'time', 'required') + select('repeat', 'Repeat', [['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['weekly', 'Weekly']], r.repeat) + select('weekday', 'Day (weekly routines only)', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => [i, d]), r.weekday) + select('type', 'Category', ['Daily reminder', 'Guest follow-up', 'Cleaning', 'Website', 'Finance', 'Operations'], r.type) + `<label class="checkbox-field"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Active routine</label>` + area('notes', 'Notes', r.notes), editId));
  }
  function propertyForm(editId = '') {
    const r = data.rooms.find(r => r.id === editId) || { name: '', property: '', cap: 4, rate: '' };
    modal(editId ? 'Edit property' : 'Add to your collection', form('property', field('name', 'Unit name', r.name, 'text', 'required maxlength="120"') + field('property', 'Building / property', r.property, 'text', 'maxlength="200"') + field('cap', 'Maximum guests', r.cap, 'number', 'required min="1" max="100" step="1"') + field('rate', 'Nightly rate · PHP', r.rate, 'number', 'required min="0" step="0.01"') + '<p class="form-help span-2">Give each unit a unique name. Renaming a unit also updates its existing reservations and tasks.</p>', editId));
  }
  function guestForm(editId = '') { const g = data.guests.find(g => g.id === editId) || {}; modal(editId ? 'Edit guest' : 'A personal welcome', form('guest', field('name', 'Guest name', g.name, 'text', 'required maxlength="200"') + field('phone', 'Phone', g.phone, 'tel', 'maxlength="40" autocomplete="tel"') + select('contact', 'Preferred contact', ['Messenger', 'SMS', 'Call', 'Email'], g.contact || 'Messenger') + area('notes', 'Preferences & notes', g.notes), editId)); }
  function financeForm(editId = '') { const rows = state.financeTab === 'personal' ? data.financePersonal : data.financeBusiness, x = rows.find(x => x.id === editId) || { desc: '', date: H.day(H.now()), kind: 'expense', amount: '', cat: '' }; modal(editId ? 'Edit transaction' : 'Record a transaction', `<p class="inline-help">${state.financeTab === 'personal' ? 'Personal' : 'Business'} account${state.financeTab === 'business' ? ' · Booking revenue is already included automatically.' : ''}</p>` + form('finance', field('desc', 'Description', x.desc, 'text', 'required maxlength="250"') + field('amount', 'Amount · PHP', x.amount, 'number', 'required min="0.01" step="0.01"') + field('date', 'Date', x.date, 'date', 'required') + select('kind', 'Type', [['expense', 'Expense'], ['revenue', 'Revenue']], x.kind) + field('cat', 'Category', x.cat, 'text', 'required maxlength="120"'), editId)); }
  function renderSettings() {
    const c = window.Cloud?.config() || {}, user = window.Cloud?.user;
    return `<div class="split"><div class="stack"><section class="panel settings-group"><h2>Your business</h2><p class="muted">Set the defaults for new reservations.</p><form data-form="settings"><div class="form-grid">${field('name', 'Business name', data.settings.name, 'text', 'required maxlength="100"')}${field('in', 'Default check-in · Manila', data.settings.in, 'time', 'required')}${field('out', 'Default check-out · Manila', data.settings.out, 'time', 'required')}<label class="checkbox-field"><input type="checkbox" name="notify" ${data.settings.notify ? 'checked' : ''}> Browser reminders</label><label class="checkbox-field"><input type="checkbox" name="alarmSound" ${data.settings.alarmSound ? 'checked' : ''}> Play reminder sound</label></div><p class="inline-help">Reminders work while the app is open. Export a routine or task to your device calendar for a system alarm.</p><p class="form-error" role="alert"></p><button class="button primary">Save preferences</button></form></section><section class="panel settings-group"><h2>Account & sync</h2><p class="muted" id="settings-sync">${esc($('#sync-label').textContent)}</p><p class="inline-help">${user ? 'Signed in as ' + esc(user.email || 'your account') : 'Sign in to see the same workspace on your other devices.'}</p>${user ? `<div class="actions-row">${button('Sync now', 'sync-now', '', 'primary')}${button('Sign out on this device', 'signout')}</div>` : `<form data-form="auth"><div class="form-grid">${field('email', 'Email address', '', 'email', 'required autocomplete="email"')}${field('password', 'Password', '', 'password', 'required minlength="6" autocomplete="current-password"')}</div><p class="form-error" role="alert"></p><div class="actions-row" style="margin-top:15px"><button type="submit" class="button primary" name="mode" value="signin">Sign in</button><button type="submit" class="button secondary" name="mode" value="signup">Create account</button></div></form>`}<details><summary>Advanced connection settings</summary><p class="inline-help">Your existing cloud connection is preserved. Change this only if you are moving to another project.</p><form data-form="cloud-config"><div class="form-grid">${field('url', 'Project URL', c.url || '', 'url', 'required')}${field('key', 'Publishable key', c.key || '', 'password', 'required autocomplete="off"')}</div><p class="form-error" role="alert"></p><button class="button secondary">Save connection</button></form></details></section></div><div class="stack"><section class="panel settings-group"><h2>Backups & recovery</h2><p class="muted">Keep a portable copy of your workspace. A recovery copy is saved before imports and conflict resolutions.</p><div class="actions-row">${button(icon('download') + ' Export backup', 'export', '', 'primary')}${button('Import backup', 'import-pick')}${button('Recovery copies', 'backup-list')}</div><input id="import-file" aria-label="Import workspace backup" type="file" accept=".json,application/json" class="hidden"><p class="inline-help">An import replaces your current workspace and syncs to your account after confirmation.</p>${storageError ? button('Download original saved data', 'raw-export', '', 'danger') : ''}</section><section class="panel settings-group"><h2>Device privacy lock</h2><p class="muted">An optional lock screen for this browser. This is a convenience lock; cloud account security remains separate.</p><form data-form="lock"><div class="form-grid">${field('password', 'New device lock password', '', 'password', 'required minlength="6" autocomplete="new-password"')}${field('confirm', 'Repeat password', '', 'password', 'required autocomplete="new-password"')}</div><p class="form-error" role="alert"></p><div class="actions-row"><button class="button secondary">Set device lock</button>${button('Lock now', 'lock-now')}${button('Remove lock', 'lock-remove', '', 'ghost small')}</div></form></section><section class="panel settings-group"><h2>A calmer way to work</h2><p class="muted">Andrei’s Business Hub · Version 13</p><p class="inline-help">Bookings, routines, notes, and financial records stay in your existing workspace. All schedule times use Manila time. Your browser keeps an offline copy.</p>${button('Check for app update', 'app-update')}${button('Clear this device’s copy', 'local-reset', '', 'ghost small')}<p class="inline-help">Clearing a device copy requires a backup first and does not delete cloud records.</p></section></div></div>`;
  }
  function getFormData(formEl) { return Object.fromEntries(new FormData(formEl).entries()); }
  function saveRecord(formEl) {
    const type = formEl.dataset.form, editId = formEl.dataset.id, f = getFormData(formEl);
    const error = text => { formEl.querySelector('.form-error').textContent = text; };
    const mapping = { booking: 'bookings', event: 'events', routine: 'routines', property: 'rooms', guest: 'guests', finance: state.financeTab === 'personal' ? 'financePersonal' : 'financeBusiness' };
    const list = data[mapping[type]], old = list?.find(x => x.id === editId), id = editId || H.id();
    if (editId && formBaseline !== JSON.stringify(old)) return error('This record changed while you were editing. Copy your changes, close this form, and reopen the latest version before saving.');
    let item;
    if (type === 'booking') {
      item = { ...old, ...f, id, guest: f.guest.trim(), amount: Number(f.amount), pax: Number(f.pax), paidAmount: f.payment === 'Paid' ? Number(f.amount) : f.payment === 'Unpaid' ? 0 : f.paidAmount === '' ? null : Number(f.paidAmount) };
      const message = H.validateBooking(item, data); if (message) return error(message);
    } else if (type === 'event') {
      if (!f.title.trim() || !H.validDateTime(f.when)) return error('Enter a title and valid date and time.');
      item = { ...old, ...f, title: f.title.trim(), id, duration: Number(f.duration), done: old?.done || false };
    } else if (type === 'routine') {
      if (!f.title.trim()) return error('Enter a routine title.');
      item = { ...old, ...f, title: f.title.trim(), id, weekday: Number(f.weekday), active: f.active === 'on' };
    } else if (type === 'property') {
      if (!f.name.trim()) return error('Enter a property name.');
      if (data.rooms.some(r => r.id !== editId && r.name.trim().toLowerCase() === f.name.trim().toLowerCase())) return error('A unit with that name already exists. Use a unique name.');
      item = { ...old, ...f, id, name: f.name.trim(), cap: Number(f.cap), rate: Number(f.rate) };
    } else if (type === 'guest') { if (!f.name.trim()) return error('Enter a guest name.'); item = { ...old, ...f, id, name: f.name.trim() }; }
    else if (type === 'finance') { if (!f.desc.trim() || !f.cat.trim() || !H.validDay(f.date) || !(Number(f.amount) > 0)) return error('Enter a description, category, valid date, and positive amount.'); item = { ...old, ...f, id, amount: Number(f.amount), desc: f.desc.trim(), cat: f.cat.trim() }; }
    if (!item) return;
    change(d => {
      if (type === 'property' && old && old.name !== item.name) { d.bookings.forEach(b => { if (b.unit === old.name) b.unit = item.name; }); d.events.forEach(e => { if (e.unit === old.name) e.unit = item.name; }); }
      if (old) d[mapping[type]] = list.map(x => x.id === editId ? item : x); else d[mapping[type]].push(item);
    }, editId ? 'Changes saved' : 'Added to your workspace');
  }
  function deleteRecord(type, id) {
    const mapping = { booking: 'bookings', event: 'events', routine: 'routines', property: 'rooms', guest: 'guests', finance: state.financeTab === 'personal' ? 'financePersonal' : 'financeBusiness' }, key = mapping[type];
    const record = data[key]?.find(x => x.id === id); if (!record) return;
    if (type === 'property' && (data.bookings.some(b => b.unit === record.name) || data.events.some(e => e.unit === record.name))) { toast('This property has bookings or tasks. Keep it to preserve their history.'); return; }
    if (!confirm('Delete this ' + (type === 'finance' ? 'transaction' : type) + '? A recovery copy will be saved first.')) return;
    try { backup('Before deleting ' + type); } catch { return toast('Could not save a recovery copy. Export a backup and free browser storage first.'); }
    change(d => { d[key] = d[key].filter(x => x.id !== id); }, 'Removed · recovery copy saved');
  }
  function download(name, text, mime = 'application/json') { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: mime })); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportData() { download('business-hub-backup-' + H.day(H.now()) + '.json', JSON.stringify(data, null, 2)); }
  const icsText = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const icsDate = value => new Date(typeof value === 'number' ? value : H.stamp(value)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  function calendarExport(item, routine = false) {
    let start = item.when;
    if (routine) { let d = H.day(H.now()); for (let i = 0; i < 8; i++) { if (H.routineApplies({ ...item, active: true }, d) && d + 'T' + item.time >= H.now()) break; d = H.addDays(d, 1); } start = d + 'T' + item.time; }
    const recurrence = !routine ? '' : item.repeat === 'daily' ? 'FREQ=DAILY' : 'FREQ=WEEKLY;BYDAY=' + (item.repeat === 'weekdays' ? 'MO,TU,WE,TH,FR' : item.repeat === 'weekends' ? 'SA,SU' : ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][item.weekday]);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Business Hub//EN', 'BEGIN:VEVENT', 'UID:' + item.id + '@business-hub', 'DTSTAMP:' + icsDate(Date.now()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(H.stamp(start) + (item.duration || 15) * 60000), 'SUMMARY:' + icsText(item.title), 'DESCRIPTION:' + icsText(item.notes), ...(recurrence ? ['RRULE:' + recurrence] : []), 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(item.title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    download('business-hub-event.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
  }
  function quickMenu(navigationOnly = false) {
    const items = navigationOnly ? nav.flatMap(g => g[1]).filter(v => !['today', 'calendar', 'bookings'].includes(v[0])).map(([v, label, i]) => [label, '', i, 'navigate', `data-view="${v}"`]) : [['Task or meeting', 'Give your work a time', 'task', 'event-new', ''], ['Daily routine', 'Build a steady rhythm', 'routine', 'routine-new', ''], ['Property', 'Add a space to manage', 'property', 'property-new', ''], ['Transaction', 'Record income or an expense', 'finance', 'finance-new', ''], ['Guest', 'Remember the details', 'guests', 'guest-new', ''], ['Notes & ideas', 'Capture something for later', 'notes', 'navigate', 'data-view="notes"']];
    modal(navigationOnly ? 'Your workspace' : 'What’s next?', `<div class="quick-grid">${items.map(([label, sub, i, action, attrs]) => `<button class="quick-choice" data-action="${action}" ${attrs}>${icon(i)}<strong>${label}</strong><small>${sub}</small></button>`).join('')}</div>`);
  }
  async function hash(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
  async function removeLock() {
    if (!localStorage.getItem('stayflow-app-lock')) return toast('There is no device lock set.');
    const password = prompt('Enter the current device lock password to remove it.');
    if (password === null) return;
    if (await hash(password) !== localStorage.getItem('stayflow-app-lock')) return toast('The password did not match.');
    localStorage.removeItem('stayflow-app-lock'); sessionStorage.removeItem('stayflow-unlocked'); toast('Device lock removed');
  }
  function lockNow() { if (!localStorage.getItem('stayflow-app-lock')) return toast('Set a device lock password in Settings first.'); sessionStorage.removeItem('stayflow-unlocked'); $('#lock-dialog').showModal(); $('#unlock-password').value = ''; }
  async function handleAction(el) {
    const a = el.dataset.action, id = el.dataset.id, value = el.dataset.value;
    switch (a) {
      case 'navigate': return navigate(el.dataset.view);
      case 'dialog-close': return closeDialog();
      case 'quick-menu': return quickMenu();
      case 'navigation-menu': return quickMenu(true);
      case 'booking-new': return bookingForm('', el.dataset.unit, el.dataset.date || H.day(H.now()));
      case 'booking-edit': return bookingForm(id);
      case 'booking-detail': return bookingDetail(id);
      case 'booking-task': case 'booking-turnover': { const b = data.bookings.find(b => b.id === id); if (!b) return; return eventForm('', { bookingId: id, unit: b.unit, type: a === 'booking-turnover' ? 'cleaning' : 'followup', title: a === 'booking-turnover' ? 'Turnover · ' + b.unit : 'Follow up · ' + b.guest, when: a === 'booking-turnover' ? b.out : b.in, duration: a === 'booking-turnover' ? 60 : 15 }); }
      case 'event-new': return eventForm(); case 'event-edit': return eventForm(id);
      case 'routine-new': return routineForm(); case 'routine-edit': return routineForm(id);
      case 'property-new': return propertyForm(); case 'property-edit': return propertyForm(id);
      case 'guest-new': return guestForm(); case 'guest-edit': return guestForm(id);
      case 'finance-new': return financeForm(); case 'finance-edit': return financeForm(id);
      case 'event-done': return change(d => { const e = d.events.find(e => e.id === id); if (e) e.done = !e.done; }, 'Schedule updated');
      case 'routine-done': return change(d => { const k = (el.dataset.date || H.day(H.now())) + ':' + id; d.routineDone[k] = !d.routineDone[k]; }, 'Routine updated for this day');
      case 'delete-record': return deleteRecord(el.dataset.type, id);
      case 'task-filter': state.taskFilter = value; return render();
      case 'finance-tab': state.financeTab = value; return render();
      case 'agenda-mode': state.agendaMode = value; return render();
      case 'room-calendar': state.property = data.rooms.find(r => r.id === id)?.name || ''; state.calendarMode = 'week'; return navigate('calendar');
      case 'calendar-mode': state.calendarMode = value; return render();
      case 'calendar-today': state.calendarDate = H.day(H.now()); return render();
      case 'calendar-day': state.calendarDate = el.dataset.date; state.calendarMode = 'agenda'; return render();
      case 'calendar-prev': case 'calendar-next': { const n = a === 'calendar-prev' ? -1 : 1; if (state.calendarMode === 'month') { const d = new Date(state.calendarDate.slice(0, 7) + '-01T12:00Z'); d.setUTCMonth(d.getUTCMonth() + n); state.calendarDate = d.toISOString().slice(0, 10); } else state.calendarDate = H.addDays(state.calendarDate, n * 7); return render(); }
      case 'check-new': { const text = prompt('What would you like to remember?'); if (text?.trim()) change(d => d.checks.push({ id: H.id(), text: text.trim(), done: false }), 'Checklist item added'); return; }
      case 'check-toggle': return change(d => { const c = d.checks.find(c => c.id === id); if (c) c.done = !c.done; }, 'Checklist updated');
      case 'check-delete': if (confirm('Remove this checklist item?')) change(d => { d.checks = d.checks.filter(c => c.id !== id); }); return;
      case 'export': return exportData();
      case 'raw-export': return download('business-hub-original-data.txt', localStorage.getItem(KEY) || localStorage.getItem('stayflow-v3') || 'No saved data');
      case 'import-pick': return $('#import-file')?.click();
      case 'backup-list': { const keys = Object.keys(localStorage).filter(k => k.startsWith('business-hub-backup:')).sort().reverse(); modal('Recovery copies', `<p class="inline-help">Download a copy, inspect it, then use Import backup to restore it. Copies stay on this device.</p><div class="backup-list">${keys.map(k => { try { const b = readJSON(k, {}); return `<div class="backup-item"><div>${esc(b.label)}<br><span class="muted">${esc(new Date(b.savedAt).toLocaleString())}</span></div>${button('Download', 'backup-download', `data-key="${esc(k)}"`)}</div>`; } catch { return ''; } }).join('') || '<p class="muted">No recovery copies yet.</p>'}</div>`); return; }
      case 'backup-download': { const b = readJSON(el.dataset.key, null); if (b) download('business-hub-recovery.json', JSON.stringify(b.data, null, 2)); return; }
      case 'event-ics': { const e = data.events.find(e => e.id === id); if (e) calendarExport(e); return; }
      case 'routine-ics': { const r = data.routines.find(r => r.id === id); if (r) calendarExport(r, true); return; }
      case 'attention-all': { const alerts = H.attention(data); modal('Needs attention', alerts.map(a => `<div class="attention-item">${icon('alert')}<div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div>${button('Review', a.booking ? 'booking-detail' : 'event-edit', idAttr(a.booking || a.event))}</div>`).join('')); return; }
      case 'sync': if (window.Cloud?.conflict) return window.Cloud.reviewConflict(); return navigate('settings');
      case 'sync-now': return window.Cloud?.sync();
      case 'conflict': return window.Cloud?.reviewConflict();
      case 'conflict-local': return window.Cloud?.resolve('local');
      case 'conflict-remote': return window.Cloud?.resolve('remote');
      case 'signout': return window.Cloud?.signout();
      case 'lock-now': return lockNow(); case 'lock-remove': return removeLock();
      case 'app-update': { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs || []).map(r => r.update())); toast('Update check complete. Refresh this page to load the latest version.'); return; }
      case 'local-reset': {
        if (!confirm('Export a backup, sign out, and clear only this device’s workspace? Your cloud data and recovery copies will remain.')) return;
        exportData(); await window.Cloud?.signout(true); if (window.Cloud?.user) return toast('Sign-out failed. Your local copy was kept.');
        localStorage.removeItem(KEY); localStorage.removeItem('stayflow-v3'); localStorage.removeItem(META); location.reload(); return;
      }
    }
  }
  document.addEventListener('click', event => { const el = event.target.closest('[data-action]'); if (!el) return; event.preventDefault(); Promise.resolve(handleAction(el)).catch(e => toast(e.message || 'The action could not be completed.')); });
  document.addEventListener('input', event => {
    const el = event.target;
    if (el.closest('#dialog form')) formDirty = true;
    if (el.dataset.note) { data[el.dataset.note] = el.value; persist(); }
    if (el.id === 'booking-search') { const cursor = el.selectionStart; state.query = el.value; $('#view').innerHTML = renderBookings(); const input = $('#booking-search'); input.focus(); input.setSelectionRange(cursor, cursor); }
  });
  document.addEventListener('change', async event => {
    const el = event.target;
    if (el.id === 'booking-status') { state.bookingStatus = el.value; render(); }
    if (el.id === 'calendar-property') { state.property = el.value; render(); }
    if (el.id === 'calendar-source') { state.source = el.value; render(); }
    if (el.id === 'finance-month' && /^\d{4}-\d{2}$/.test(el.value)) { state.financeMonth = el.value; render(); }
    if (el.id === 'import-file' && el.files[0]) {
      try {
        if (el.files[0].size > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.');
        const raw = JSON.parse(await el.files[0].text());
        if (!raw || !['bookings', 'events', 'rooms', 'notes'].some(k => k in raw)) throw new Error('This does not look like a Business Hub backup.');
        const incoming = H.normalize(raw);
        if (!confirm(`Replace this workspace with ${incoming.bookings.length} bookings, ${incoming.rooms.length} properties, and ${incoming.events.length} tasks? Your current workspace will be kept as a recovery copy.`)) return;
        backup('Before importing backup'); data = incoming; storageError = ''; persist(); clearNotice(); render(); toast('Backup imported');
      } catch (e) { toast('Import failed: ' + e.message); } finally { el.value = ''; }
    }
  });
  document.addEventListener('submit', async event => {
    const el = event.target;
    event.preventDefault();
    try {
      if (el.id === 'unlock-form') { if (await hash($('#unlock-password').value) === localStorage.getItem('stayflow-app-lock')) { sessionStorage.setItem('stayflow-unlocked', '1'); $('#lock-dialog').close(); $('#unlock-password').value = ''; } else $('#lock-error').textContent = 'That password did not match. Try again.'; return; }
      const type = el.dataset.form, f = getFormData(el);
      if (type === 'settings') { change(d => { d.settings = { ...d.settings, ...f, name: f.name.trim() || "Andrei's Business Hub", notify: f.notify === 'on', alarmSound: f.alarmSound === 'on' }; }, 'Preferences saved'); if (f.notify && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); return; }
      if (type === 'auth') { const submit = event.submitter; submit.disabled = true; try { await window.Cloud.auth(event.submitter.value, f.email, f.password); } finally { submit.disabled = false; } return; }
      if (type === 'cloud-config') return await window.Cloud.setConfig(f.url, f.key);
      if (type === 'lock') { if (f.password !== f.confirm) throw new Error('The passwords do not match.'); localStorage.setItem('stayflow-app-lock', await hash(f.password)); sessionStorage.setItem('stayflow-unlocked', '1'); el.reset(); toast('Device lock saved'); return; }
      saveRecord(el);
    } catch (e) { const error = el.querySelector('.form-error'); if (error) error.textContent = e.message; else toast(e.message); }
  });
  $('#dialog').addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  $('#dialog').addEventListener('close', () => { formDirty = false; if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus({ preventScroll: true }); });
  $('#lock-dialog').addEventListener('cancel', e => e.preventDefault());
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  window.addEventListener('beforeunload', event => { if (formDirty) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => {
    if (event.key !== KEY || !event.newValue) return;
    if (formDirty || document.activeElement?.matches('textarea,input,select')) { notice('This workspace changed in another tab. Finish or cancel your current edit, then review the latest copy in Settings.', 'sync'); return; }
    try { data = H.normalize(JSON.parse(event.newValue)); lastStoredRaw = event.newValue; meta = readJSON(META, meta); render(); } catch { notice('Another tab saved unreadable data. Your open copy is still available to export.', 'export', true); }
  });
  let lastDay = H.day(H.now());
  function reminders() {
    if (storageError) return;
    const now = H.now(), date = H.day(now);
    if (date !== lastDay && !formDirty && !document.activeElement?.matches('input,textarea,select')) { lastDay = date; render(); }
    for (const r of data.routines.filter(r => H.routineApplies(r, date) && r.time === now.slice(11) && !data.routineDone[date + ':' + r.id])) {
      const stamp = date + ' ' + r.time;
      if (localStorage.getItem('reminded:' + r.id) === stamp) continue;
      localStorage.setItem('reminded:' + r.id, stamp);
      toast('Reminder · ' + r.title);
      if (data.settings.notify && 'Notification' in window && Notification.permission === 'granted') { try { new Notification("Andrei's Business Hub", { body: r.title }); } catch {} }
      if (data.settings.alarmSound) { try { const C = window.AudioContext || window.webkitAudioContext, c = new C(), o = c.createOscillator(), gain = c.createGain(); gain.gain.value = .08; o.frequency.value = 700; o.connect(gain); gain.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 450); } catch {} }
    }
  }
  window.App = { get data() { return data; }, set data(value) { data = H.normalize(value); }, get meta() { return meta; }, set meta(value) { meta = value; }, get storageError() { return storageError; }, get editing() { return formDirty || !!document.activeElement?.matches('textarea,input,select'); }, state, persist, saveMeta, backup, render, toast, notice, clearNotice, syncStatus, modal, button, esc, exportData, clone: H.clone };
  state.view = labels[location.hash.slice(1)] ? location.hash.slice(1) : 'today';
  render();
  if (localStorage.getItem('stayflow-app-lock') && !sessionStorage.getItem('stayflow-unlocked')) $('#lock-dialog').showModal();
  setInterval(reminders, 30000);
  setInterval(() => { if (state.view === 'today') $('#page-description').textContent = H.dateLabel(H.day(H.now()), { weekday: 'long', year: 'numeric' }) + ' · ' + time(H.now()) + ' · Manila'; }, 60000);
  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) navigator.serviceWorker.register('./sw.js').catch(() => toast('Offline caching is unavailable in this browser.'));
})();
