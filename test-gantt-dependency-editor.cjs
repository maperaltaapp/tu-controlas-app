// V1 step 3: dependency editor may never commit an old work after the user switches
// to another work/account with an identical plan revision.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/gantt-dependencies.js','utf8');
const nodes=new Map(),events={},calls={commits:0,closes:0,schedules:0,calendars:[],dialogs:0};
const el=id=>{
 if(!nodes.has(id))nodes.set(id,{
  id,innerHTML:'',textContent:'',value:'',disabled:false,
  addEventListener(type,cb){events[id+':'+type]=cb},
  replaceChildren(){this.innerHTML=''}
 });
 return nodes.get(id);
};
const phases=[
 {id:'first',name:'Cimentación',start:'2026-11-24',end:'2026-11-26',level:1,depends_on:[]},
 {id:'second',name:'Hormigonado',start:'2026-11-27',end:'2026-11-29',level:1,depends_on:[]}
];
const plans={workA:{revision:1},workB:{revision:1}};
const ctx={
 Date,Number,Error,Map,Set,Promise,structuredClone,
 window:null,document:{getElementById:el,querySelectorAll:()=>[]},
 sessionEpoch:1,session:{user:{id:'owner-A'},access_token:'a'},
 mode:'gantts',G2:{work:'workA',busy:false,message:'',error:false},
 TCGantt:{leaves:rows=>rows,isGroup:()=>false},
 TCWorkCalendar:{
  links:p=>p.dependency_links||[],
  schedule:rows=>{calls.schedules++;return rows}
 },
 planOf:id=>plans[id],gRows:()=>phases,
 gHydrate:structuredClone,ElitePlanning:{},
 tcCalendarForWork:id=>{calls.calendars.push(id);return {}},
 esc:String,
 dialogForm:()=>{calls.dialogs++;nodes.delete('gdForm');for(const id of ['gdSave','gdPreview','gdImpact','gdError','gdReason']){el(id).disabled=id==='gdSave';el(id).textContent='';el(id).value='';}},
 gCommit:async()=>{calls.commits++;return true},
 closeTaskDialog:()=>{calls.closes++}
};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'gantt-dependencies.js'});
const submit=()=>el('gdForm').onsubmit({preventDefault(){}});
const preview=()=>el('gdPreview').onclick();
const open=()=>ctx.gDependencies('first');
const reset=()=>{
 ctx.sessionEpoch=1;ctx.session={user:{id:'owner-A'},access_token:'a'};
 ctx.G2.work='workA';ctx.G2.busy=false;ctx.mode='gantts';
 for(const k of ['commits','closes','schedules','dialogs'])calls[k]=0;
 calls.calendars.length=0;
 for(const key of Object.keys(events))delete events[key];
};
const delay=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()}}
;(async()=>{
 reset();open();assert.equal(calls.dialogs,1);assert.equal(el('gdSave').disabled,true);
 // A form opened under work A cannot preview anything for work B.
 ctx.G2.work='workB';preview();await submit();
 assert.equal(calls.schedules,0);assert.equal(calls.calendars.length,0);
 assert.equal(calls.commits,0,'Old work must not save in new work, even if same revision');

 reset();open();preview();assert.equal(el('gdSave').disabled,false);
 assert.deepEqual(calls.calendars,['workA']);
 ctx.G2.work='workB';await submit();
 assert.equal(calls.commits,0);

 reset();open();preview();ctx.session={user:{id:'owner-B'},access_token:'b'};
 await submit();assert.equal(calls.commits,0,'Old account cannot save under B even if sessionEpoch was not bumped');

 reset();open();preview();ctx.sessionEpoch=2;
 await submit();assert.equal(calls.commits,0);

 reset();open();preview();ctx.mode='tasks';
 await submit();assert.equal(calls.commits,0,'Leaving Gantt invalidates the editor');

 reset();open();preview();plans.workA.revision=2;
 await submit();assert.equal(calls.commits,0);assert.match(el('gdError').textContent,/cambió/);
 plans.workA.revision=1;

 // A write returning after B takes over cannot close B's editor.
 reset();open();preview();let release;
 ctx.gCommit=async()=>{calls.commits++;await new Promise(r=>release=r);return true};
 const pending=submit();assert.equal(calls.commits,1);
 ctx.G2.work='workB';release();await pending;
 assert.equal(calls.closes,0);
 ctx.gCommit=async()=>{calls.commits++;return true};

 reset();open();preview();await submit();
 assert.equal(calls.commits,1);assert.equal(calls.closes,1);

 // A historical missing predecessor must produce a warning, not a runtime crash.
 const broken=[
  {id:'current',name:'Muro',start:'2026-11-24',end:'2026-11-25',
   dependency_links:[{id:'removed',type:'SS',lag:0}]}
 ];
 const warnings=ctx.tcDependencyWarnings(broken,{});
 assert.equal(warnings.length,1);
 assert.match(warnings[0],/actividad inexistente/);
 const mismatched=[
  {id:'source',name:'Anterior',start:'2026-11-23',end:'2026-11-24',dependency_links:[]},
  {id:'current',name:'Posterior',start:'2026-11-25',end:'2026-11-26',dependency_links:[{id:'source',type:'SS',lag:0}]}
 ];
 assert.match(ctx.tcDependencyWarnings(mismatched,{})[0],/no empieza junto/);
 mismatched[1].start='2026-11-23';
 assert.equal(ctx.tcDependencyWarnings(mismatched,{}).length,0);

 console.log('PASS: Gantt dependency editor rejects stale work/account, revision, route, late save and missing predecessor');
})().catch(err=>{console.error(err);process.exitCode=1});
