const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../motion.js'),'utf8');
function setup(reduced=false){
 const calls=[],preference={matches:reduced,addEventListener(name,fn){this.change=fn;}};
 const animation={finished:new Promise(()=>{}),cancel(){this.cancelled=true;}};
 const bar={classList:{contains:()=>true},style:{width:'75%'},animate(frames){calls.push(frames);return animation;}};
 const window={matchMedia:()=>preference},document={querySelectorAll:()=>[bar],getElementById:()=>bar};
 vm.runInNewContext(source,{window,document});return {api:window.HubMotion,calls,preference,animation};
}
test('chart changes interpolate while unchanged reports stay still',()=>{
 const s=setup();s.api.render('finance');assert.equal(s.calls.length,1);
 s.api.render('finance',[{axis:'width',value:'25%'}]);assert.equal(s.calls[1][0].width,'25%');assert.equal(s.calls[1][1].width,'75%');
 s.api.render('finance',s.api.capture());assert.equal(s.calls.length,2);
});
test('reduced motion prevents movement and cancels motion when preference changes',()=>{
 const quiet=setup(true);quiet.api.render('today');assert.equal(quiet.calls.length,0);
 const s=setup();s.api.render('today');s.preference.matches=true;s.preference.change();assert.equal(s.animation.cancelled,true);
});
test('each navigation click replays motion, while ordinary same-page renders stay still',()=>{
 const s=setup();s.api.render('today');
 s.api.render('today',[],true);assert.equal(s.calls.length,3);assert.equal(s.animation.cancelled,true);
 s.api.render('today',[],true);assert.equal(s.calls.length,5);
 s.api.render('today');assert.equal(s.calls.length,5);
 const quiet=setup(true);quiet.api.render('today',[],true);assert.equal(quiet.calls.length,0);
});
