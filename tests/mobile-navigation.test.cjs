const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function setup(phone=true){
 const handlers={},media={matches:phone,addEventListener(type,fn){this.change=fn;}};
 function node(){const classes=new Set();return {attrs:{},inert:false,isConnected:true,hidden:true,classList:{contains:k=>classes.has(k),toggle(k,on){on?classes.add(k):classes.delete(k);}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){document.activeElement=this;},getClientRects(){return [{}];}};}
 const close=node(),last=node(),trigger=node(),sidebar=node(),background=[node(),node(),node()];
 sidebar.querySelector=()=>close;sidebar.querySelectorAll=()=>[close,last];
 const nodes={'.sidebar':sidebar,'#sidebar-backdrop':node(),'#sidebar-toggle':trigger};
 const document={activeElement:trigger,body:node(),querySelectorAll:()=>background,addEventListener:(k,fn)=>handlers[k]=fn};
 const code=source.slice(source.indexOf('  let sidebarReturnFocus'),source.indexOf('  function navigate(view)'));
 const context={forcePhone:false,PHONE_QUERY:"phone",document,matchMedia:()=>media,$:s=>nodes[s]};vm.createContext(context);vm.runInContext(code,context);
 return {context,document,sidebar,close,last,trigger,background,handlers,media,nodes};
}
test('phone navigation isolates the drawer and restores focus when closed',()=>{
 const s=setup();s.context.setSidebar(true);assert.equal(s.document.activeElement,s.close);assert.ok(s.background.every(x=>x.inert));assert.equal(s.sidebar.attrs['aria-modal'],'true');
 s.context.setSidebar(false);assert.equal(s.document.activeElement,s.trigger);assert.ok(s.background.every(x=>!x.inert));assert.equal(s.nodes['#sidebar-backdrop'].hidden,true);
});
test('drawer traps keyboard focus and Escape closes it',()=>{
 const s=setup();s.context.setSidebar(true);let prevented=0;
 s.handlers.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(s.document.activeElement,s.last);
 s.handlers.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(s.document.activeElement,s.close);
 s.handlers.keydown({key:'Escape',preventDefault(){prevented++;}});assert.equal(prevented,3);assert.equal(s.sidebar.classList.contains('mobile-open'),false);
});
test('desktop does not open mobile overlay and orientation changes release background',()=>{
 const s=setup(false);s.context.setSidebar(true);assert.ok(s.background.every(x=>!x.inert));
 s.media.matches=true;s.context.setSidebar(true);s.media.matches=false;s.media.change();assert.ok(s.background.every(x=>!x.inert));
});

test('explicit phone layout opens the drawer even above automatic breakpoint',()=>{
 const s=setup(false);s.context.forcePhone=true;s.context.setSidebar(true);assert.equal(s.sidebar.attrs['aria-modal'],'true');s.context.setSidebar(false);assert.ok(s.background.every(x=>!x.inert));
});
