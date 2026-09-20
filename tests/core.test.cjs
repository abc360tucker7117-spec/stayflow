const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../core.js');
const fixture = () => ({ ...H.defaults(), rooms: [{ id: 'room', name: 'Palm Studio', cap: 4, rate: 2500 }], bookings: [{ id: 'a', guest: 'Alex', unit: 'Palm Studio', in: '2026-09-21T14:00', out: '2026-09-23T12:00', status: 'Confirmed', payment: 'Deposit paid', paidAmount: 1000, amount: 5000, pax: 2 }] });
test('night count uses dates across months, years, and leap days', () => {
  assert.equal(H.nights('2026-09-24T14:00', '2026-09-27T12:00'), 3);
  assert.equal(H.nights('2026-12-31T14:00', '2027-01-02T12:00'), 2);
  assert.equal(H.nights('2028-02-28T14:00', '2028-03-01T12:00'), 2);
});
test('schedule time is fixed to Manila regardless of device timezone', () => {
  assert.equal(H.now(new Date('2026-09-18T20:30:00Z')), '2026-09-19T04:30');
  assert.equal(H.stamp('2026-09-19T04:30'), Date.parse('2026-09-18T20:30:00Z'));
  assert.equal(H.addDays('2026-12-31', 1), '2027-01-01');
});
test('reject impossible dates, reversed stays, missing rooms and capacity violations', () => {
  const d = fixture(), b = d.bookings[0];
  assert.equal(H.validateBooking(b, d), '');
  assert.match(H.validateBooking({ ...b, out: b.in }, d), /after/);
  assert.match(H.validateBooking({ ...b, out: '2026-02-30T12:00' }, d), /valid/);
  assert.match(H.validateBooking({ ...b, pax: 5 }, d), /between/);
  assert.match(H.validateBooking({ ...b, unit: 'Missing' }, d), /existing/);
});
test('overlap checks allow back-to-back bookings but block pending conflicts', () => {
  const d = fixture(), b = { ...d.bookings[0], id: 'b' };
  assert.match(H.validateBooking(b, d), /overlap/);
  assert.equal(H.validateBooking({ ...b, in: '2026-09-23T12:00', out: '2026-09-24T12:00' }, d), '');
  assert.match(H.validateBooking({ ...b, status: 'Pending' }, d), /overlap/);
  assert.equal(H.validateBooking({ ...b, status: 'Cancelled' }, d), '');
});
test('legacy deposits stay unknown until actual received amount is supplied', () => {
  const b = fixture().bookings[0];
  assert.equal(H.balance(b), 4000);
  assert.equal(H.balance({ ...b, paidAmount: undefined }), null);
  assert.equal(H.balance({ ...b, payment: 'Paid' }), 0);
  assert.equal(H.balance({ ...b, payment: 'Unpaid' }), 5000);
  assert.match(H.validateBooking({ ...b, paidAmount: 6000 }, fixture()), /deposit/);
});
test('agenda includes departures, routines and completion for the specific date', () => {
  const d = fixture(); d.routines = [{ id: 'r', title: 'Review', repeat: 'daily', time: '09:00', active: true }]; d.routineDone['2026-09-23:r'] = true;
  const a = H.agenda(d, '2026-09-23');
  assert.equal(a.length, 2); assert.equal(a[0].done, true); assert.equal(a[1].direction, 'departure');
  assert.equal(H.agenda(d, '2026-09-24')[0].done, false);
});
test('finance handles decimal/string legacy values and different report months', () => {
  const d = fixture(); d.financeBusiness = [{ id: 'f', desc: 'Cleaning', date: '2026-09-23', kind: 'expense', amount: '250.50' }, { id: 'g', date: '2026-10-01', kind: 'revenue', amount: 100 }];
  assert.equal(H.finance(d, 'business', '2026-09').net, 4749.5);
  assert.equal(H.finance(d, 'business', '2026-10').revenue, 100);
  assert.equal(H.finance(d, 'personal', '2026-09').revenue, 0);
});
test('normalization preserves existing IDs, custom fields, notes and does not resurrect deleted expenses', () => {
  const d = fixture(); d.notes = 'Keep me'; d.custom = { value: 2 }; d.expenses = [{ id: 1, amount: 9 }];
  const current = H.normalize(d); assert.equal(current.financeBusiness.length, 0); assert.equal(current.notes, 'Keep me'); assert.equal(current.custom.value, 2);
  delete d.financeBusiness; assert.equal(H.normalize(d).financeBusiness[0].id, '1');
  assert.throws(() => H.normalize({ bookings: 'bad' }), /Invalid/);
  assert.throws(() => H.normalize({ bookings: [{ id: 'x' }, { id: 'x' }] }), /Duplicate/);
});
test('independent multi-device edits merge, conflicting fields require review', () => {
  const base = fixture(), local = H.clone(base), remote = H.clone(base);
  local.notes = 'Local notes'; remote.quick = 'Remote quick'; remote.bookings[0].amount = 6000;
  let merged = H.merge(base, local, remote); assert.deepEqual(merged.conflicts, []); assert.equal(merged.data.notes, 'Local notes'); assert.equal(merged.data.bookings[0].amount, 6000);
  local.bookings[0].amount = 7000; merged = H.merge(base, local, remote); assert.deepEqual(merged.conflicts, ['bookings.a.amount']);
});
test('deletions merge without resurrecting records; edit-vs-delete is a conflict', () => {
  const base = fixture(), local = H.clone(base), remote = H.clone(base); local.bookings = [];
  assert.equal(H.merge(base, local, remote).data.bookings.length, 0);
  remote.bookings[0].notes = 'Important'; assert.deepEqual(H.merge(base, local, remote).conflicts, ['bookings.a']);
});
test('occupancy excludes pending bookings and respects exact checkout times', () => {
  const d = fixture(); assert.equal(H.roomState(d, d.rooms[0], '2026-09-23T11:59').label, 'Occupied'); assert.equal(H.roomState(d, d.rooms[0], '2026-09-23T12:00').label, 'Available');
  d.events.push({ id: 'e', type: 'cleaning', unit: 'Palm Studio', when: '2026-09-23T12:00', done: false });
  assert.equal(H.roomState(d, d.rooms[0], '2026-09-23T12:00').label, 'Cleaning');
});
