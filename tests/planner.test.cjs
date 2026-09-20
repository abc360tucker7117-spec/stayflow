const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../planner.js'),H=require('../core.js');
test('monthly loan schedule clamps month ends and includes partial final installment',()=>{
 const l={id:'a',total:1000,installment:300,frequency:'monthly',firstDue:'2028-01-31'};
 const s=P.loanSummary(l,[], '2028-03-01');
 assert.deepEqual(s.schedule.map(x=>x.date),['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);assert.equal(s.schedule.at(-1).amount,100);assert.equal(s.due,600);
});
test('payments reduce outstanding, next unpaid installment and due amount using cents',()=>{
 const l={id:'a',total:100.30,installment:50.15,frequency:'yearly',firstDue:'2026-09-01'};
 const s=P.loanSummary(l,[{loanId:'a',amount:50.15},{loanId:'other',amount:99}],'2026-09-20');
 assert.equal(s.remaining,50.15);assert.equal(s.next,'2027-09-01');assert.equal(s.due,0);
 const paid=P.loanSummary(l,[{loanId:'a',amount:100.30}],'2028-01-01');assert.equal(paid.remaining,0);assert.equal(paid.next,null);
});
test('new tracker and loan arrays preserve old notes and merge independent records',()=>{
 const b=H.normalize({...H.defaults(),notes:'Keep me',financePersonal:[{id:'old',amount:90}]}),l=H.clone(b),r=H.clone(b);
 l.goals.push({id:'g',title:'Goal'});r.loans.push({id:'loan',total:200});r.loanPayments.push({id:'p',loanId:'loan',amount:20});
 const m=H.merge(b,l,r);assert.equal(m.conflicts.length,0);assert.equal(m.data.notes,'Keep me');assert.equal(m.data.goals.length,1);assert.equal(m.data.loanPayments.length,1);assert.equal(m.data.financePersonal[0].amount,90);
});
test('calendar uses Manila times, stable IDs, recurrence, escaped text and alarms',()=>{
 const ics=P.calendar([{id:'task',when:'2026-09-20T09:00',duration:30,title:'A, B; C\nD',recurrence:'FREQ=DAILY'}]);
 assert.match(ics,/DTSTART:20260920T010000Z/);assert.match(ics,/DTEND:20260920T013000Z/);assert.match(ics,/SUMMARY:A\\, B\\; C\\nD/);assert.match(ics,/RRULE:FREQ=DAILY/);assert.match(ics,/TRIGGER:-PT10M/);assert.match(ics,/UID:task@business-hub/);
});
