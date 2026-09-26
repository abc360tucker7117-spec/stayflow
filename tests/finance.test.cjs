const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../core.js'),F=require('../finance.js');
test('cutoffs cover 15/16, leap February, and year rollover without overlap',()=>{
 assert.deepEqual(F.range('2028-02','second'),{from:'2028-02-16',to:'2028-02-29'});
 assert.deepEqual(F.range('2026-02','second'),{from:'2026-02-16',to:'2026-02-28'});
 assert.deepEqual(F.shift(F.range('2026-12','second'),'second',1),F.range('2027-01','first'));
 assert.deepEqual(F.previous(F.range('2027-01','first'),'first'),F.range('2026-12','second'));
 assert.throws(()=>F.range('2026-13','first')); assert.throws(()=>F.range('2026-09','custom','2026-09-16','2026-09-15'));
 assert.throws(()=>F.range('2026-02','custom','2026-02-30','2026-03-01'));
 const r={from:'2026-09-10',to:'2026-09-17'};assert.deepEqual(F.previous(r,'custom'),{from:'2026-09-02',to:'2026-09-09'});
});
test('separate accounts, inclusive cutoff dates, cents and categories agree without changing stored records',()=>{
 const d=H.defaults();d.notes='Keep all notes';d.goals=[{id:'g',custom:'keep'}];
 d.financeBusiness=[{id:'a',date:'2026-09-15',kind:'revenue',amount:'0.10',cat:'Sales',desc:'One'},{id:'b',date:'2026-09-15',kind:'revenue',amount:'0.20',cat:'Sales',desc:'Two'},{id:'c',date:'2026-09-16',kind:'expense',amount:'25.12',cat:'Bills',desc:'Power'}];
 d.financePersonal=[{id:'p',date:'2026-09-15',kind:'expense',amount:33,cat:'Food',desc:'Dinner'}];d.bookings=[{id:'b',in:'2026-09-01',status:'Confirmed',amount:9999}];
 const before=JSON.stringify(d),first=F.transactions(d,'business',F.range('2026-09','first')),second=F.transactions(d,'business',F.range('2026-09','second'));
 assert.equal(first.revenue,.3);assert.equal(first.rows.length,2);assert.equal(second.expenses,25.12);assert.equal(second.categories[0].amount,25.12);assert.equal(first.daily[0].revenue,.3);
 assert.equal(F.transactions(d,'personal',F.range('2026-09','first')).expenses,33);assert.equal(JSON.stringify(d),before);
 assert.equal(F.transactions(d,'business',F.range('2026-09','month'),{query:'power',kind:'expense',category:'Bills'}).rows.length,1);
});
test('historical loan balance includes prior payments, excludes later payments, and preserves records',()=>{
 const d=H.defaults();d.loans=[{id:'l',title:'Equipment',firstDue:'2026-08-01',total:1000,installment:100,frequency:'monthly'},{id:'future',title:'Later',firstDue:'2026-10-01',total:500,installment:100,frequency:'monthly'}];
 d.loanPayments=[{id:'p1',loanId:'l',date:'2026-08-01',amount:100},{id:'p2',loanId:'l',date:'2026-09-15',amount:100},{id:'p3',loanId:'l',date:'2026-09-16',amount:100}];const before=JSON.stringify(d);
 const first=F.loans(d,F.range('2026-09','first')),second=F.loans(d,F.range('2026-09','second'));
 assert.equal(first.remaining,800);assert.equal(first.paid,100);assert.equal(first.scheduled,100);assert.equal(first.items.length,1);
 assert.equal(second.remaining,700);assert.equal(second.paid,100);assert.equal(second.scheduled,0);assert.equal(JSON.stringify(d),before);
});
test('CSV quotes line breaks, quotes and formula-like descriptions',()=>{
 assert.equal(F.csv([['=SUM(A1)','a,"b"\nc',5]]),'\uFEFF"\'=SUM(A1)","a,""b""\nc","5"');
});
