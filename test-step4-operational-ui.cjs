// V1 paso 4. Real UI handlers, mocked browser/storage; no production data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const report=fs.readFileSync(__dirname+'/daily-report.js','utf8');
const incident=fs.readFileSync(__dirname+'/work-actions.js','utf8');
const history=fs.readFileSync(__dirname+'/report-history.js','utf8');
const start=report.indexOf('saveDailyReport=async function(event){'),end=report.lastIndexOf('\n})(window);');
assert(start>=0&&end>start);
const reportState={writes:0,reads:0,closed:0,opened:0,messages:[]};
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[]});return nodes.get(id)};
const task={activity_id:'gantt-a',activity_name:'Hormigonado',progress_pct:30,observations:'',workers:2,machines:1};
const reportCtx=vm.createContext({
 Date,Number,Error,Set,structuredClone,
 sessionEpoch:1,session:{user:{id:'owner-A'},access_token:'A'},navigation:0,
 busy:false,followBusy:false,original:null,
 draft:{id:'report-a',work_id:'work-a',report_date:'2026-11-24',activities:[{...task}]},
 plan:{revision:1,phases:[{id:'gantt-a',name:'Hormigonado',start:'2026-11-23',end:'2026-11-25'}]},
 NATIVE_WORKS:[{id:'work-a',name:'A',archived_at:null}],
 DAILY_REPORTS:[],OWN_TASKS:[],WORK_PLANS:[],followWork:'work-a',
 $:node,collect:()=>{},leaves:p=>p.phases,
 progress:()=>30,planningToday:()=> '2026-11-24',
 renderFollowEditor:()=>{},statusMessage:(m)=>reportState.messages.push(m),
 closeTaskDialog:()=>reportState.closed++,
 openFollowup:async()=>reportState.opened++,
 readAll:async()=>{reportState.reads++;return []},
 eliteRequest:async()=>{reportState.writes++;return {}}
});
vm.runInContext(report.slice(start,end),reportCtx,{filename:'saveDailyReport.js'});
const reset=()=>{
 reportCtx.sessionEpoch=1;reportCtx.session={user:{id:'owner-A'},access_token:'A'};reportCtx.navigation=0;
 reportCtx.busy=false;reportCtx.followBusy=false;reportCtx.original=null;
 reportCtx.draft={id:'report-a',work_id:'work-a',report_date:'2026-11-24',activities:[{...task}]};
 reportCtx.plan={revision:1,phases:[{id:'gantt-a',name:'Hormigonado',start:'2026-11-23',end:'2026-11-25'}]};
 reportCtx.DAILY_REPORTS=[];reportCtx.WORK_PLANS=[];reportCtx.OWN_TASKS=[];
 reportState.writes=0;reportState.reads=0;reportState.closed=0;reportState.opened=0;reportState.messages=[];
 node('dailyError').textContent='';
 reportCtx.eliteRequest=async()=>{reportState.writes++;return {}};
 reportCtx.readAll=async()=>{reportState.reads++;return []};
};
const save=()=>reportCtx.saveDailyReport({preventDefault(){}});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
const browserNodes=new Map(),browserNode=id=>{
 if(!browserNodes.has(id))browserNodes.set(id,{
 id,value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,
 append(){},setAttribute(){},querySelectorAll:()=>[],querySelector:()=>null,
 addEventListener(){},
 });
 return browserNodes.get(id);
};
let incidentReads=[],incidentWrites=0,incidentCloses=0;
const incidentCtx=vm.createContext({
 Date,Number,Error,Object,structuredClone,crypto:{randomUUID:()=> 'incident-new'},
 document:{createElement:()=>browserNode('created'),getElementById:browserNode,querySelector:browserNode,querySelectorAll:()=>[]},
 session:{access_token:'token-A',user:{id:'owner-A'}},sessionEpoch:1,nativeReady:true,
 selectedSection:'incidents',mode:'incidents',G2:{work:'work-a'},NATIVE_WORKS:[{id:'work-a',name:'A',archived_at:null},{id:'work-b',name:'B',archived_at:null}],
 taskWork:'all',checkWorkId:null,planningWork:null,followWork:null,workDetailId:null,DAILY_REPORTS:[],
 followDraft:null,CONTRACTORS:[],
 selectSection(name){incidentCtx.selectedSection=name},render(){},show(){},sessionViewEnded(){incidentCtx.sessionEpoch++},collectFollowRows:()=>[],renderFollowEditor:()=>{},
 dialogForm:()=>{browserNodes.delete('incForm');browserNode('incForm')},
 closeTaskDialog:()=>incidentCloses++,
 fieldOptions:()=>'<option></option>',esc:String,workDateLabel:String,planningToday:()=> '2026-11-24',
 statusMessage:()=>{},
 readAll:async(table)=>{incidentReads.push(table);return table==='elite_daily_reports'?[{id:'part-a',work_id:'work-a',report_date:'2026-11-23'},{id:'part-b',work_id:'work-b',report_date:'2026-11-24'}]:[]},
 eliteRequest:async()=>{incidentWrites++;return []}
});
incidentCtx.window=incidentCtx;
vm.runInContext(incident,incidentCtx,{filename:'work-actions.js'});
const setIncident=(reportId='')=>{
 for(const [id,value] of Object.entries({incFormWork:'work-a',incReport:reportId,incDate:'2026-11-24',incSeverity:'warning',incStatus:'open',incDescription:'Incidencia QA',incFollowup:'Revisar'})){
  browserNode(id).value=value;
 }
 browserNode('incSave').disabled=false;browserNode('incError').textContent='';
};
const incidentSubmit=()=>browserNode('incForm').onsubmit({preventDefault(){}});
(async()=>{
 reset();reportCtx.draft.report_date='2026-11-25';
 await save();assert.equal(reportState.writes,0);assert.match(node('dailyError').textContent,/fecha/);
 reset();reportCtx.draft.report_date='2026-02-31';
 await save();assert.equal(reportState.writes,0);assert.match(node('dailyError').textContent,/fecha/);
 reset();reportCtx.draft.activities.push({...task});
 await save();assert.equal(reportState.writes,0);assert.match(node('dailyError').textContent,/repitas/);
 reset();reportCtx.draft.activities=[{...task,activity_id:'other'}];
 await save();assert.equal(reportState.writes,0);assert.match(node('dailyError').textContent,/ya no existe/);
 reset();let pendingGate=deferred();
 reportCtx.eliteRequest=async()=>{reportState.writes++;return pendingGate.promise};
 const waiting=save();
 assert.equal(reportState.writes,1);
 reportCtx.session={user:{id:'owner-B'},access_token:'B'};pendingGate.resolve({report:{}});
 await waiting;
 assert.equal(reportState.reads,0);assert.equal(reportState.closed,0);assert.equal(reportState.opened,0);assert.equal(reportState.messages.length,0);
 assert.equal(reportCtx.DAILY_REPORTS.length,0);

 // Incidents can only reference a daily report belonging to the selected work.
 await incidentCtx.tcEditIncident(null,'work-a');setIncident('part-b');
 await incidentSubmit();
 assert.equal(incidentWrites,0);assert.match(browserNode('incError').textContent,/no pertenece a esta obra/);
 setIncident('part-a');let incGate=deferred();
 incidentCtx.eliteRequest=async()=>{incidentWrites++;return incGate.promise};
 incidentReads=[];const late=incidentSubmit();
 assert.equal(incidentWrites,1);
 incidentCtx.session={user:{id:'owner-B'},access_token:'token-B'};
 incGate.resolve([{id:'incident-new',work_id:'work-a'}]);await late;
 assert.equal(incidentReads.length,0);assert.equal(incidentCloses,0);

 // Same-owner history read guard is explicit even on a silent token/account swap.
 assert.match(history,/owner===session\?\.user\?\.id/);
 assert.match(incident,/owner===session\?\.user\?\.id/);
 assert.match(report,/owner===session\?\.user\?\.id/);
 console.log('PASS: part date, duplicate/obsolete activities, stale A/B response, incident cross-work link and owner checks');
})().catch(error=>{console.error(error);process.exitCode=1});
