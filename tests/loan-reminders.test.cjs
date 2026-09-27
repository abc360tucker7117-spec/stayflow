const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../planner.js');
const loan=(id,date,total=1000,installment=100)=>({id,title:id,firstDue:date,total,installment,frequency:'monthly'});
test('reminders include the seventh day, today and overdue, sorted by urgency',()=>{
 const loans=[loan('later','2026-10-05'),loan('soon','2026-10-04'),loan('today','2026-09-27'),loan('old','2026-08-27')];
 const r=P.loanReminders(loans,[],'2026-09-27');
 assert.deepEqual(r.map(x=>[x.loanId,x.status,x.amount,x.days]),[['old','Overdue',200,-31],['today','Due today',100,0],['soon','Upcoming',100,7]]);
});
test('partial payments reduce reminders, prepayment advances them and payoff removes them',()=>{
 const l=loan('a','2026-09-30',250.25,100.10);
 assert.equal(P.loanReminders([l],[{loanId:'a',amount:25.05,date:'2026-09-27'}],'2026-09-27')[0].amount,75.05);
 assert.deepEqual(P.loanReminders([l],[{loanId:'a',amount:100.10,date:'2026-09-27'}],'2026-09-27'),[]);
 assert.deepEqual(P.loanReminders([l],[{loanId:'a',amount:250.25,date:'2026-09-27'}],'2026-09-27'),[]);
 assert.equal(P.loanReminders([l],[{loanId:'a',amount:200.20,date:'2026-10-30'}],'2026-11-24')[0].amount,50.05);
});
test('future payments and another loan cannot hide an upcoming reminder',()=>{
 const r=P.loanReminders([loan('a','2026-09-30')],[{loanId:'a',amount:1000,date:'2026-10-01'},{loanId:'b',amount:1000,date:'2026-09-20'}],'2026-09-27');
 assert.equal(r[0].amount,100);
});
test('yearly dates and month-end clamping use the existing schedule',()=>{
 const yearly={...loan('yearly','2024-02-29'),frequency:'yearly'};
 assert.equal(P.loanReminders([yearly],[{loanId:'yearly',amount:200,date:'2025-02-28'}],'2026-02-21')[0].date,'2026-02-28');
 assert.equal(P.loanReminders([loan('monthly','2026-01-31')],[{loanId:'monthly',amount:100,date:'2026-01-31'}],'2026-02-21')[0].date,'2026-02-28');
});
