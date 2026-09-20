(function(root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.Planner = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const cents = n => Math.round(Number(n || 0) * 100);
  function dueDate(first, offset) {
    const [y,m,d] = first.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1 + offset, 1));
    dt.setUTCDate(Math.min(d, new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+1, 0)).getUTCDate()));
    return dt.toISOString().slice(0,10);
  }
  function loanSummary(loan, payments, today) {
    const total = cents(loan.total), installment = cents(loan.installment), rows = payments.filter(p=>p.loanId===loan.id);
    const paid = rows.reduce((s,p)=>s+cents(p.amount),0), remaining = Math.max(0,total-paid), count = installment > 0 ? Math.ceil(total/installment) : 0;
    const step = loan.frequency==='yearly' ? 12 : 1;
    const schedule = Array.from({length:Math.min(count,1200)},(_,i)=>({date:dueDate(loan.firstDue,i*step), amount:Math.min(installment,total-i*installment)/100}));
    const due = schedule.filter(x=>x.date<=today).reduce((s,x)=>s+cents(x.amount),0);
    const next = remaining && installment ? schedule[Math.min(Math.floor(paid/installment), schedule.length-1)]?.date : null;
    return {paid:paid/100,remaining:remaining/100,due:Math.max(0,due-paid)/100,next,end:schedule.at(-1)?.date,count,schedule};
  }
  const escape = s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const utc = s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  function calendar(items) {
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Business Hub Planner//EN','CALSCALE:GREGORIAN'];
    for(const e of items) {
      const start=Date.parse(e.when+':00+08:00');
      lines.push('BEGIN:VEVENT','UID:'+escape(e.id)+'@business-hub','DTSTAMP:'+utc(Date.now()),'DTSTART:'+utc(start),'DTEND:'+utc(start+(Number(e.duration)||30)*60000),'SUMMARY:'+escape(e.title),'DESCRIPTION:'+escape(e.notes));
      if(e.recurrence) lines.push('RRULE:'+e.recurrence);
      lines.push('BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY','DESCRIPTION:'+escape(e.title),'END:VALARM','END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // Fold on UTF-8 boundaries for calendar clients with strict RFC 5545 parsers.
    return lines.map(line=>{let result='',part='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>74){result+=part+'\r\n ';part='';bytes=1;}part+=ch;bytes+=size;}return result+part;}).join('\r\n')+'\r\n';
  }
  return {loanSummary,dueDate,calendar};
});
