const cp=require('node:child_process');
if(!process.argv.includes('--zone')){for(const zone of ['UTC','Europe/Madrid','America/Los_Angeles','Asia/Tokyo']){const result=cp.spawnSync(process.execPath,[__filename,'--zone'],{env:{...process.env,TZ:zone},encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stdout+result.stderr);process.exit(result.status||1)}process.stdout.write(result.stdout)}process.exit(0)}
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const map=new Map();function el(id){if(!map.has(id))map.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,style:{},attributes:{},parentElement:{insertAdjacentHTML(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(name,value){this.attributes[name]=String(value)},getAttribute(name){return this.attributes[name]??null},querySelector(sel){return el(this.id+sel)},querySelectorAll(){return []},showModal(){},close(){},remove(){map.delete(this.id)},focus(){},addEventListener(){},append(){},appendChild(){},insertAdjacentHTML(){},getClientRects(){return [1]}});return map.get(id)}
const ctx=vm.createContext({console,Date,Map,URL,URLSearchParams,crypto,MutationObserver:class{observe(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},document:{getElementById:el,querySelectorAll(){return []},querySelector(){return null},createElement(){return el('taskDialog')},body:{appendChild(){},append(){}}},window:{isSecureContext:true},navigator:{},location:{search:'',pathname:'/'},history:{replaceState(){}},setTimeout,clearTimeout});
ctx.window=ctx;vm.runInContext(fs.readFileSync(__dirname+'/work-calendar.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/shared-holidays.js','utf8'),ctx);ctx.structuredClone=structuredClone;vm.runInContext(fs.readFileSync(__dirname+'/planning-engine.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/planning-hierarchy.js','utf8'),ctx);vm.runInContext(script,ctx);const run=s=>vm.runInContext(s,ctx);const t=(id,patch={})=>({id,title:'Revisar planos de prueba',category:'work',work_id:'w1',work_name:'Obra prueba',due_at:'2026-10-12T08:00:00Z',start_at:null,status:'pending',completed:false,priority:'normal',stage:'Preparación',labels:[],checklists:[],recurrence:'none',updated_at:'2026-10-12T07:00:00Z',...patch});

run("NATIVE_WORKS=[];OWN_TASKS=[];CHECKLIST_ITEMS=[]");
const cases=[['2026-11-21T23:30:00Z','2026-11-22','00:30'],['2026-06-01T22:30:00Z','2026-06-02','00:30'],['2026-03-28T23:30:00Z','2026-03-29','00:30'],['2026-10-24T22:30:00Z','2026-10-25','00:30'],['2026-11-30T23:30:00Z','2026-12-01','00:30'],['2026-12-31T23:30:00Z','2027-01-01','00:30']];
const cell=(html,key)=>html.split('aria-label="Crear tarea el '+key+'"')[1]?.split('aria-label="Crear tarea el ')[0];
for(const [instant,expected,time] of cases){const [year,month,day]=expected.split('-').map(Number),card={id:'midnight',name:'Tarea nocturna',own:true,category:'work',due_at:instant,board:{id:'w',name:'Obra'}};ctx.card=card;ctx.cursor=new Date(year,month-1,day,12);assert.equal(run('calendarTaskDay(card)'),expected);assert.equal(run('taskDayKey(calendarToday(new Date(card.due_at)))'),expected);run('calCursor=cursor');const before=JSON.stringify(card),monthHtml=run('monthView([card])'),weekHtml=run('weekView([card])');assert(cell(monthHtml,expected)?.includes('data-hold-id="midnight"'));assert(cell(weekHtml,expected)?.includes('data-hold-id="midnight"'));assert(weekHtml.includes('>'+time+'</span>'));assert(monthHtml.includes('1 tareas'));assert.equal(JSON.stringify(card),before)}
// A saved preference from an older release cannot change the current grid.
assert(!html.includes('tc_calendar_zoom'));
assert(!run('monthView([])+weekView([])').includes('--cal-zoom'));
const listeners=new Map();el('content').addEventListener=(type,handler)=>listeners.set(type,handler);
vm.runInContext(fs.readFileSync(__dirname+'/interaction-refinement.js','utf8'),ctx);
const grid={scrollLeft:0},touch=(x,y)=>({clientX:x,clientY:y});
const gesture=(x,y=30,n=1)=>({target:{closest:selector=>selector==='.tc-calendar-grid'?grid:null},touches:Array.from({length:n},()=>touch(x,y)),changedTouches:[touch(x,y)],cancelable:true,preventDefault(){}});
const swipe=(a,b,y=30)=>{listeners.get('touchstart')(gesture(a));listeners.get('touchend')(gesture(b,y,0))};
run("calMode='month';calCursor=new Date(2026,11,15,12)");
swipe(170,30);assert.equal(run('taskDayKey(calCursor)'),'2027-01-01');
swipe(30,170);assert.equal(run('taskDayKey(calCursor)'),'2026-12-01');
swipe(180,100,170);swipe(40,53);assert.equal(run('calCursor.getMonth()'),11);
listeners.get('touchstart')(gesture(180));listeners.get('touchstart')(gesture(130,30,2));listeners.get('touchend')(gesture(30,30,0));assert.equal(run('calCursor.getMonth()'),11);
listeners.get('touchstart')(gesture(180));listeners.get('touchcancel')();listeners.get('touchend')(gesture(30,30,0));assert.equal(run('calCursor.getMonth()'),11);
run("calMode='week';calCursor=new Date(2026,10,25,12)");
listeners.get('touchstart')(gesture(180));grid.scrollLeft=90;listeners.get('touchend')(gesture(30,30,0));assert.equal(run('taskDayKey(calCursor)'),'2026-11-25');
swipe(180,30);assert.equal(run('taskDayKey(calCursor)'),'2026-12-02');
assert.equal(run('OWN_TASKS.length'),0);
console.log('PASS: Madrid calendar dates, fixed scale, left swipe advances, vertical scroll and multitouch ignored in '+process.env.TZ);
