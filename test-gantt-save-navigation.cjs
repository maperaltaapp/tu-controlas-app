const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const map=new Map();function el(id){if(!map.has(id))map.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,style:{},attributes:{},parentElement:{insertAdjacentHTML(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(name,value){this.attributes[name]=String(value)},getAttribute(name){return this.attributes[name]??null},querySelector(sel){return el(this.id+sel)},querySelectorAll(){return []},showModal(){},close(){},remove(){map.delete(this.id)},focus(){},addEventListener(){},append(){},appendChild(){},insertAdjacentHTML(){},getClientRects(){return [1]}});return map.get(id)}
const ctx=vm.createContext({console,Date,Map,URL,URLSearchParams,crypto,MutationObserver:class{observe(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},document:{getElementById:id=>id==='tcBell'&&!el('tcHead').innerHTML.includes('id="tcBell"')?null:el(id),querySelectorAll(){return []},querySelector(){return null},createElement(){return el('taskDialog')},body:{appendChild(){},append(){}}},window:{isSecureContext:true},navigator:{},location:{search:'',pathname:'/'},history:{replaceState(){}},setTimeout,clearTimeout});
ctx.window=ctx;vm.runInContext(fs.readFileSync(__dirname+'/work-calendar.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/shared-holidays.js','utf8'),ctx);ctx.structuredClone=structuredClone;vm.runInContext(fs.readFileSync(__dirname+'/planning-engine.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/planning-hierarchy.js','utf8'),ctx);vm.runInContext(script,ctx);const run=s=>vm.runInContext(s,ctx);const t=(id,patch={})=>({id,title:'Revisar planos de prueba',category:'work',work_id:'w1',work_name:'Obra prueba',due_at:'2026-10-12T08:00:00Z',start_at:null,status:'pending',completed:false,priority:'normal',stage:'Preparación',labels:[],checklists:[],recurrence:'none',updated_at:'2026-10-12T07:00:00Z',...patch});

run('savedCommit=gCommit');ctx.addEventListener=()=>{};ctx.document.addEventListener=()=>{};vm.runInContext(fs.readFileSync(__dirname+'/gantt-workbench.js','utf8'),ctx);
ctx.phase={id:'activity',task_id:'task',name:'Actividad',start:'2026-11-20',end:'2026-11-21',level:1,weight:100,depends_on:[],lag_days:0,observations:[],economic_observations:[],budget:null,activity_status:'pending'};
const setup=()=>run("sessionEpoch=0;session={access_token:'fixture',user:{id:'owner'}};mode='gantts';G2.work='w1';G2.busy=false;G2.saveToken=null;G2.draft=null;G2.undo=[];G2.message='';G2.error=false;NATIVE_WORKS=[{id:'w1',name:'Obra',execution_state:'execution',start_date:'2026-11-20',end_date:'2026-11-21'}];WORK_PLANS=[{work_id:'w1',revision:1,phases:[structuredClone(phase)]}];OWN_TASKS=[{id:'task',work_id:'w1',title:'Actividad',stage:'Gantt',status:'pending',start_at:'2026-11-20T12:00Z',due_at:'2026-11-21T12:00Z',updated_at:'2026-11-20T12:00Z'}];renderCount=0;readCount=0;gRender=()=>{renderCount++};readAll=async table=>{readCount++;if(table==='elite_work_plans')return [{work_id:'w1',revision:2,phases:[structuredClone(phase)]}];if(table==='elite_tasks')return OWN_TASKS;return NATIVE_WORKS}");
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
(async()=>{
 // Session ends while the write is in flight: no old reads or state resurrection.
 setup();let gate=deferred();ctx.gate=gate.promise;run('eliteRequest=()=>gate');let pending=run('savedCommit([phase],{reschedule:false})');assert.equal(run('G2.busy'),true);run("sessionViewEnded('cerrada')");gate.resolve({});assert.equal(await pending,false);assert.equal(run('readCount'),0);assert.equal(run('OWN_TASKS.length'),0);assert.equal(run('WORK_PLANS.length'),0);assert.equal(run('G2.busy'),false);assert.equal(run('mode'),'tasks');
 // Editing a Gantt-linked task from Tareas must not navigate to the Gantt while saving.
 setup();run("mode='tasks';eliteRequest=async()=>({})");
 assert.equal(await run('savedCommit([phase],{reschedule:false})'),true);
 assert.equal(run('mode'),'tasks','Un guardado iniciado en Tareas no debe cambiar de pantalla');
 assert.equal(run('renderCount'),0,'El guardado de Gantt en segundo plano no debe redibujar Gantt');
 assert.equal(run('planOf("w1").revision'),2);
 // A response from the previous account cannot clear the next account's busy save.
 setup();gate=deferred();ctx.gate=gate.promise;run('eliteRequest=()=>gate');pending=run('savedCommit([phase],{reschedule:false})');run("sessionEpoch++;G2.work='w2';G2.saveToken=Symbol('new-save');G2.busy=true;G2.draft=[{id:'new-draft'}];OWN_TASKS=[{id:'new-task'}];WORK_PLANS=[{work_id:'w2',revision:9}]");gate.resolve({});assert.equal(await pending,false);assert.equal(run('G2.busy'),true);assert.equal(run('OWN_TASKS[0].id'),'new-task');assert.equal(run('G2.draft[0].id'),'new-draft');assert.equal(run('readCount'),0);
 // Sign-out after the write succeeded, but before its three readbacks complete.
 setup();gate=deferred();ctx.gate=gate.promise;const started=deferred();ctx.notifyRead=started.resolve;run("eliteRequest=async()=>({});readAll=async table=>{readCount++;if(readCount===3)notifyRead();await gate;return table==='elite_work_plans'?[{work_id:'w1',revision:2,phases:[phase]}]:table==='elite_tasks'?[{id:'old-private-task'}]:[{id:'w1'}]}");pending=run('savedCommit([phase],{reschedule:false})');await started.promise;run("sessionViewEnded('cerrada')");gate.resolve();assert.equal(await pending,false);assert.equal(run('OWN_TASKS.length'),0);assert.equal(run('WORK_PLANS.length'),0);assert.equal(run('NATIVE_WORKS.length'),0);
 // Navigating to Tareas preserves that screen; the confirmed work cache still updates.
 setup();gate=deferred();ctx.gate=gate.promise;run('eliteRequest=()=>gate');pending=run('savedCommit([phase],{reschedule:false})');run("mode='tasks'");gate.resolve({});assert.equal(await pending,true);assert.equal(run('mode'),'tasks');assert.equal(run('renderCount'),1);assert.equal(run('planOf("w1").revision'),2);assert.equal(run('G2.busy'),false);assert.equal(run('G2.draft'),null);
 // Errors from a superseded save cannot paint a message into the next account.
 setup();gate=deferred();ctx.gate=gate.promise;run('eliteRequest=()=>gate');pending=run('savedCommit([phase],{reschedule:false})');run("sessionEpoch++;G2.work='w2';G2.message='Nueva cuenta';G2.error=false");gate.reject(Error('old account failure'));assert.equal(await pending,false);assert.equal(run('G2.message'),'Nueva cuenta');assert.equal(run('G2.error'),false);
 // A form opened for revision 1 cannot submit its old rows over revision 2.
 setup();run("tcCalendarForWork=()=>({anchor:'2026-11-20',weekdays:[1,2,3,4,5],exceptions:[]});tcDependencyFields=()=>'';CONTRACTORS=[];dialogForm=()=>{};gEdit('activity');WORK_PLANS[0].revision=2;writeCount=0;gCommit=async()=>{writeCount++;return true}");await el('gActivityForm').onsubmit({preventDefault(){}});assert.equal(run('writeCount'),0);assert(el('gaError').textContent.includes('La planificación cambió'));
 // V1 Step 2: existing legacy activities must never spawn linked tasks on a passive save.
 setup();run("WORK_PLANS[0].phases[0].task_id=null");
 let confirmations=[],writes=0;
 ctx.confirm=(message)=>{confirmations.push(message);return false};
 run("eliteRequest=async()=>{writeCounter++;return {}};writeCounter=0");
 const denied=await run("savedCommit([phase],{reschedule:false})");
 assert.equal(denied,false);assert.equal(run('writeCounter'),0,'No server write without explicit approval');
 assert.equal(run('G2.busy'),false);
 assert.equal(run('planOf("w1").revision'),1);
 assert.equal(run('planOf("w1").phases[0].task_id'),null);
 assert.equal(confirmations.length,1);
 assert.match(confirmations[0],/actividades antiguas sin tarea vinculada/);
 // An explicit user confirmation permits the normal transactional save.
 setup();run("WORK_PLANS[0].phases[0].task_id=null");
 confirmations=[];
 ctx.confirm=(message)=>{confirmations.push(message);return true};
 run("eliteRequest=async()=>{writeCounter++;return {}};writeCounter=0");
 assert.equal(await run("savedCommit([phase],{reschedule:false})"),true);
 assert.equal(confirmations.length,1);
 assert.equal(run('writeCounter'),1);
 assert.equal(run('planOf("w1").revision'),2);
 assert.equal(run('planOf("w1").phases[0].task_id'),'task');
 // If work dates verification fails, do not update either cache from a partial readback.
 setup();run("eliteRequest=async()=>({});readAll=async table=>{readCount++;if(table==='elite_work_plans')return [{work_id:'w1',revision:2,phases:[structuredClone(phase)]}];if(table==='elite_tasks')return OWN_TASKS;return [{id:'w1',start_date:'2026-01-01',end_date:'2026-01-02'}]}");
 assert.equal(await run("savedCommit([phase],{reschedule:false})"),false);
 assert.equal(run('planOf("w1").revision'),1,'Do not commit plans when work-card verification fails');
 assert.equal(run('OWN_TASKS[0].id'),'task');
 assert.equal(run('G2.busy'),false);

 console.log('PASS: Gantt saves handle session switches, explicit approval of legacy links, consistent caches and stale edits.');
})().catch(e=>{console.error(e);process.exitCode=1});
