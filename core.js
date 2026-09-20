/* Business Hub data and calendar rules. No browser dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Hub = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ZONE = 'Asia/Manila';
  const arrays = ['bookings', 'rooms', 'events', 'routines', 'guests', 'checks', 'financeBusiness', 'financePersonal', 'goals', 'accomplishments', 'loans', 'loanPayments'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => globalThis.crypto?.randomUUID?.() || 'hub-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  function now(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  const day = value => String(value || '').slice(0, 10);
  function validDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  function validDateTime(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && validDay(day(value)) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60;
  }
  function addDays(value, count) {
    const d = new Date(day(value) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
  }
  function nights(start, end) {
    if (!validDay(day(start)) || !validDay(day(end))) return 0;
    return Math.max(0, Math.round((Date.parse(day(end) + 'T00:00Z') - Date.parse(day(start) + 'T00:00Z')) / 86400000));
  }
  const stamp = value => Date.parse(value.length === 10 ? value + 'T00:00:00+08:00' : /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + ':00+08:00');
  function dateLabel(value, options = {}) {
    const d = new Date(stamp(value));
    return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, month: 'short', day: 'numeric', ...options }).format(d) : 'Date needs review';
  }
  const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(num(value));
  function defaults() {
    return { schemaVersion: 13, settings: { name: "Andrei's Business Hub", in: '14:00', out: '12:00', notify: false, alarmSound: true }, bookings: [], rooms: [], events: [], routines: [], guests: [], checks: [], financeBusiness: [], financePersonal: [], expenses: [], goals: [], accomplishments: [], loans: [], loanPayments: [], notes: '', quick: '', routineDone: {} };
  }
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The backup must contain a planner object.');
    const d = { ...defaults(), ...clone(input) };
    d.settings = { ...defaults().settings, ...(input.settings && typeof input.settings === 'object' ? input.settings : {}) };
    if (["Andrei's Business Flow", 'StayFlow Pro', 'StayFlow'].includes(d.settings.name)) d.settings.name = "Andrei's Business Hub";
    arrays.forEach(k => {
      if (input[k] !== undefined && !Array.isArray(input[k])) throw new Error(`Invalid ${k} list in saved data.`);
      d[k] = (d[k] || []).map(x => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error(`Invalid entry in ${k}.`);
        return { ...x, id: String(x.id ?? id()) };
      });
      if (new Set(d[k].map(x => x.id)).size !== d[k].length) throw new Error(`Duplicate identifiers in ${k}; restore a valid backup.`);
    });
    if (!Array.isArray(input.financeBusiness) && Array.isArray(input.expenses)) d.financeBusiness = input.expenses.map(x => ({ ...x, id: String(x.id ?? id()), kind: 'expense' }));
    d.expenses = d.financeBusiness.filter(x => x.kind === 'expense');
    for (const k of ['notes', 'quick']) d[k] = typeof d[k] === 'string' ? d[k] : '';
    d.routineDone = d.routineDone && typeof d.routineDone === 'object' && !Array.isArray(d.routineDone) ? d.routineDone : {};
    d.schemaVersion = 13;
    return d;
  }
  function paid(booking) {
    if (booking.payment === 'Paid') return Math.max(0, num(booking.amount));
    if (booking.payment === 'Unpaid') return 0;
    if (booking.paidAmount === null || booking.paidAmount === undefined || booking.paidAmount === '') return null;
    return Math.min(Math.max(0, num(booking.paidAmount)), Math.max(0, num(booking.amount)));
  }
  const balance = b => paid(b) === null ? null : Math.max(0, num(b.amount) - paid(b));
  const overlaps = (a, b) => a.id !== b.id && a.unit === b.unit && a.status !== 'Cancelled' && b.status !== 'Cancelled' && a.in < b.out && a.out > b.in;
  function validateBooking(b, data) {
    if (!String(b.guest || '').trim()) return 'Enter the guest’s name.';
    const room = data.rooms.find(r => r.name === b.unit);
    if (!room) return 'Choose an existing property.';
    if (!validDateTime(b.in) || !validDateTime(b.out)) return 'Enter valid check-in and check-out dates.';
    if (b.out <= b.in) return 'Check-out must be after check-in.';
    if (!['Confirmed', 'Pending', 'Cancelled'].includes(b.status)) return 'Choose a valid booking status.';
    if (!Number.isFinite(Number(b.amount)) || Number(b.amount) < 0) return 'The total cannot be negative.';
    if (!Number.isInteger(Number(b.pax)) || Number(b.pax) < 1 || Number(b.pax) > Number(room.cap)) return `Guests must be between 1 and ${room.cap} for this property.`;
    if (!['Paid', 'Deposit paid', 'Unpaid'].includes(b.payment)) return 'Choose a valid payment status.';
    if (b.payment === 'Deposit paid' && (b.paidAmount === '' || b.paidAmount === null || b.paidAmount === undefined || !Number.isFinite(Number(b.paidAmount)) || Number(b.paidAmount) < 0 || Number(b.paidAmount) > Number(b.amount))) return 'Enter the actual deposit, between zero and the booking total.';
    if (data.bookings.some(other => overlaps(b, other))) return 'These dates overlap another reservation for this property.';
    return '';
  }
  function routineApplies(r, date) {
    if (!r.active || !validDay(day(date))) return false;
    const w = new Date(day(date) + 'T12:00:00Z').getUTCDay();
    return r.repeat === 'daily' || r.repeat === 'weekdays' && w > 0 && w < 6 || r.repeat === 'weekends' && (w === 0 || w === 6) || r.repeat === 'weekly' && w === Number(r.weekday);
  }
  function agenda(data, date) {
    const entries = data.events.filter(e => day(e.when) === date).map(e => ({ ...e, kind: 'event', subtitle: e.unit || e.notes || e.priority + ' priority' }));
    data.bookings.filter(b => b.status !== 'Cancelled').forEach(b => {
      if (day(b.in) === date) entries.push({ id: b.id, kind: 'booking', title: 'Check-in · ' + b.guest, when: b.in, subtitle: b.unit, status: b.status, direction: 'arrival' });
      if (day(b.out) === date) entries.push({ id: b.id, kind: 'booking', title: 'Check-out · ' + b.guest, when: b.out, subtitle: b.unit, status: b.status, direction: 'departure' });
    });
    data.routines.filter(r => routineApplies(r, date)).forEach(r => entries.push({ ...r, kind: 'routine', when: date + 'T' + r.time, subtitle: r.type || 'Daily routine', done: !!data.routineDone[date + ':' + r.id] }));
    return entries.sort((a, b) => a.when.localeCompare(b.when));
  }
  function roomState(data, room, at = now()) {
    const current = data.bookings.find(b => b.unit === room.name && b.status === 'Confirmed' && b.in <= at && b.out > at);
    if (current) return { label: 'Occupied', detail: 'Checkout ' + dateLabel(current.out), booking: current };
    const cleaning = data.events.find(e => e.unit === room.name && e.type === 'cleaning' && !e.done && e.when <= at);
    if (cleaning) return { label: 'Cleaning', detail: cleaning.assignee ? 'Assigned to ' + cleaning.assignee : 'Turnover needs completion' };
    return { label: 'Available', detail: 'Ready for a new stay' };
  }
  function attention(data, at = now()) {
    const out = [];
    const date = day(at);
    for (const b of data.bookings.filter(b => b.status !== 'Cancelled')) {
      const amount = balance(b);
      if (amount === null) out.push({ title: 'Confirm deposit amount', detail: b.guest + ' · ' + b.unit, booking: b.id });
      else if (amount > 0 && day(b.in) <= addDays(date, 7)) out.push({ title: 'Balance ' + money(amount), detail: b.guest + ' · ' + dateLabel(b.in), booking: b.id });
      if (b.status === 'Pending') out.push({ title: 'Review pending reservation', detail: b.guest + ' · ' + b.unit, booking: b.id });
      if (!validDateTime(b.in) || !validDateTime(b.out) || b.out <= b.in || !data.rooms.some(r => r.name === b.unit)) out.push({ title: 'Booking details need correction', detail: b.guest + ' · ' + b.unit, booking: b.id });
      if (data.bookings.some(other => overlaps(b, other))) out.push({ title: 'Reservation conflict', detail: b.guest + ' · ' + b.unit, booking: b.id });
      if (day(b.in) === date && data.events.some(e => e.type === 'cleaning' && e.unit === b.unit && !e.done && e.when <= b.in)) out.push({ title: 'Turnover before arrival', detail: b.unit + ' · ' + dateLabel(b.in, { hour: 'numeric', minute: '2-digit' }), booking: b.id });
    }
    data.events.filter(e => !e.done && e.when < at).forEach(e => out.push({ title: 'Overdue · ' + e.title, detail: dateLabel(e.when), event: e.id }));
    return out;
  }
  function finance(data, type, month) {
    const rows = (type === 'personal' ? data.financePersonal : data.financeBusiness).filter(x => day(x.date).slice(0, 7) === month);
    const bookings = type === 'business' ? data.bookings.filter(b => b.status === 'Confirmed' && day(b.in).slice(0, 7) === month) : [];
    const revenue = bookings.reduce((sum, b) => sum + num(b.amount), 0) + rows.filter(x => x.kind === 'revenue').reduce((sum, x) => sum + num(x.amount), 0);
    const expenses = rows.filter(x => x.kind === 'expense').reduce((sum, x) => sum + num(x.amount), 0);
    return { rows, bookings, revenue, expenses, net: revenue - expenses };
  }
  function meaningful(d) { return arrays.some(k => d[k]?.length) || !!d.notes || !!d.quick; }
  // Three-way merging keeps independent device edits and detects edits to the same field.
  function merge(base, local, remote) {
    const conflicts = [];
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function walk(b, l, r, path) {
      if (equal(l, r)) return l;
      if (equal(l, b)) return r;
      if (equal(r, b)) return l;
      if (Array.isArray(l) && Array.isArray(r) && Array.isArray(b) && arrays.includes(path)) {
        const bm = new Map(b.map(x => [String(x.id), x])), lm = new Map(l.map(x => [String(x.id), x])), rm = new Map(r.map(x => [String(x.id), x]));
        return [...new Set([...lm.keys(), ...rm.keys(), ...bm.keys()])].map(k => walk(bm.get(k), lm.get(k), rm.get(k), path + '.' + k)).filter(x => x !== undefined);
      }
      if (l && r && typeof l === 'object' && typeof r === 'object' && !Array.isArray(l) && !Array.isArray(r) && (b === undefined || b && typeof b === 'object')) {
        const result = {};
        new Set([...Object.keys(b || {}), ...Object.keys(l), ...Object.keys(r)]).forEach(k => { const value = walk(b?.[k], l[k], r[k], path ? path + '.' + k : k); if (value !== undefined) result[k] = value; });
        return result;
      }
      conflicts.push(path);
      return l;
    }
    const result = walk(base, local, remote, '');
    return { data: result, conflicts };
  }
  return { ZONE, arrays, clone, id, num, now, day, validDay, validDateTime, addDays, nights, stamp, dateLabel, money, defaults, normalize, paid, balance, overlaps, validateBooking, routineApplies, agenda, roomState, attention, finance, meaningful, merge };
});
