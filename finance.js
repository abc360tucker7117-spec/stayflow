/* Read-only finance reports. Amounts aggregate in centavos; stored records are never rewritten. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./planner.js'));
  else root.Finance = factory(root.Hub, root.Planner);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (H, P) {
  'use strict';
  const cents = value => Math.round(H.num(value) * 100);
  const sum = rows => rows.reduce((total, row) => total + cents(row.amount), 0) / 100;
  function range(month, mode = 'first', from, to) {
    if (mode === 'custom') {
      if (!H.validDay(from) || !H.validDay(to) || from > to) throw Error('Choose valid dates with From on or before To.');
      return { from, to };
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !H.validDay(month + '-01')) throw Error('Choose a valid report month.');
    const first = month + '-01', last = new Date(first + 'T12:00:00Z');
    last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
    return { from: mode === 'second' ? month + '-16' : first, to: mode === 'first' ? month + '-15' : last.toISOString().slice(0, 10) };
  }
  const includes = (date, r) => H.validDay(H.day(date)) && H.day(date) >= r.from && H.day(date) <= r.to;
  function previous(r, mode) {
    if (mode === 'first') return range(H.addDays(r.from, -1).slice(0, 7), 'second');
    if (mode === 'second') return range(r.from.slice(0, 7), 'first');
    if (mode === 'month') return range(H.addDays(r.from, -1).slice(0, 7), 'month');
    const days = H.nights(r.from, r.to) + 1;
    return { from: H.addDays(r.from, -days), to: H.addDays(r.from, -1) };
  }
  function shift(r, mode, direction) {
    if (direction < 0) return previous(r, mode);
    if (mode === 'first') return range(r.from.slice(0, 7), 'second');
    if (mode === 'second') return range(H.addDays(r.to, 1).slice(0, 7), 'first');
    if (mode === 'month') return range(H.addDays(r.to, 1).slice(0, 7), 'month');
    const days = H.nights(r.from, r.to) + 1;
    return { from: H.addDays(r.to, 1), to: H.addDays(r.to, days) };
  }
  function transactions(data, type, r, filters = {}) {
    const source = type === 'personal' ? data.financePersonal : data.financeBusiness;
    const query = (filters.query || '').trim().toLowerCase();
    const rows = source.filter(x => includes(x.date, r) && (!filters.kind || x.kind === filters.kind) && (!filters.category || x.cat === filters.category) && (!query || ((x.desc || '') + ' ' + (x.cat || '')).toLowerCase().includes(query)));
    const revenue = sum(rows.filter(x => x.kind === 'revenue')), expenses = sum(rows.filter(x => x.kind === 'expense'));
    const categories = new Map(), daily = new Map();
    rows.forEach(x => {
      const date = H.day(x.date), point = daily.get(date) || { date, revenue: 0, expenses: 0 };
      if (x.kind === 'expense') { categories.set(x.cat || 'Uncategorized', (categories.get(x.cat || 'Uncategorized') || 0) + cents(x.amount)); point.expenses += cents(x.amount); }
      else if (x.kind === 'revenue') point.revenue += cents(x.amount);
      daily.set(date, point);
    });
    return { rows: rows.slice().sort((a, b) => b.date.localeCompare(a.date)), revenue, expenses, net: (cents(revenue) - cents(expenses)) / 100,
      categories: [...categories].map(([label, amount]) => ({ label, amount: amount / 100 })).sort((a, b) => b.amount - a.amount),
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map(x => ({ ...x, revenue: x.revenue / 100, expenses: x.expenses / 100 })) };
  }
  function loans(data, r) {
    const payments = data.loanPayments.filter(p => includes(p.date, r)).slice().sort((a, b) => b.date.localeCompare(a.date));
    const through = data.loanPayments.filter(p => H.validDay(p.date) && p.date <= r.to);
    // Loan creation dates were not stored by older versions. A first due date after the cutoff
    // cannot establish a historical liability, so exclude it from the historical balance.
    const items = data.loans.filter(l => l.firstDue <= r.to || through.some(p => p.loanId === l.id)).map(l => ({ loan: l, summary: P.loanSummary(l, through, r.to) }));
    const schedules = data.loans.flatMap(l => P.loanSummary(l, [], r.to).schedule.filter(p => includes(p.date, r)));
    return { payments, items, paid: sum(payments), scheduled: sum(schedules), remaining: sum(items.map(x => ({ amount: x.summary.remaining }))),
      byLoan: data.loans.map(l => ({ label: l.title, amount: sum(payments.filter(p => p.loanId === l.id)) })).filter(x => x.amount > 0) };
  }
  function csv(rows) {
    const cell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }
  return { range, includes, previous, shift, transactions, loans, csv };
});
