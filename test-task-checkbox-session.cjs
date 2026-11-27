// V1/01 regression: checkbox actions must not mutate a different account's UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const from=html.indexOf('async function toggleTaskComplete(id,checkbox){');
const to=html.indexOf('\nfunction startWorkDrag(',from);
assert(from>0&&to>from,'Use the real checkbox handler from index.html');
const state={renders:0,details:0,reads:0,requests:[],patches:[],messages:[],scrolls:0};
const ctx=vm.createContext({
 Date,Number,Error,prompt:()=>null,
 sessionEpoch:1,session:{access_token:'fixture-a',user:{id:'owner-a'}},
 taskCompletionBusy:new Set(),
 CHECKLIST_ITEMS:[],OWN_TASKS:[],WORK_PLANS:[],workDetailId:null,mode:'tasks',
 window:{scrollY:42,scrollTo:()=>state.scrolls++},
 statusMessage:(...args)=>state.messages.push(args),
 render:()=>state.renders++,detail:()=>state.details++,
 fetchOwnTasks:async()=>state.reads++,
 eliteRequest:async(path,options)=>{state.requests.push({path,options});return []},
 patchNativeTask:async(task,data)=>{state.patches.push(data);return {...task,...data}},
 gReopenProgress:()=>0
});
vm.runInContext(html.slice(from,to),ctx);
const item={id:'checklist-a',title:'Revisar planos',due_date:'2026-11-20',updated_at:'revision-a',completed_at:null};
const task={id:'task-a',title:'Preparar losa',completed:false,updated_at:'revision-a',stage:'General'};
const reset=()=>{
 ctx.sessionEpoch=1;ctx.session={access_token:'fixture-a',user:{id:'owner-a'}};
 ctx.CHECKLIST_ITEMS=[{...item}];ctx.OWN_TASKS=[{...task}];ctx.WORK_PLANS=[];ctx.mode='tasks';ctx.workDetailId=null;
 ctx.taskCompletionBusy.clear();
 for(const key of ['renders','details','reads','scrolls'])state[key]=0;
 for(const key of ['requests','patches','messages'])state[key]=[];
 ctx.eliteRequest=async(path,options)=>{state.requests.push({path,options});return path.includes('elite_work_checklist_items')?[{...item,completed_at:'2026-11-23T12:00:00Z'}]:null};
 ctx.patchNativeTask=async(t,data)=>{state.patches.push(data);return {...t,...data}};
 ctx.fetchOwnTasks=async()=>{state.reads++};
};
const switched=()=>{ctx.sessionEpoch++;ctx.session={access_token:'fixture-b',user:{id:'owner-b'}}};
(async()=>{
 // A valid Checklist completion updates the active account.
 reset();
 const box={checked:true,disabled:false};
 await ctx.toggleTaskComplete(item.id,box);
 assert.equal(state.renders,1);
 assert.equal(ctx.CHECKLIST_ITEMS[0].completed_at,'2026-11-23T12:00:00Z');
 assert.equal(state.messages.length,0);

 // Late Checklist write from account A may not update account B's state.
 reset();
 let reply,signal;const started=new Promise(resolve=>signal=resolve);
 ctx.eliteRequest=async()=>{signal();return new Promise(resolve=>reply=resolve)};
 const oldList=ctx.CHECKLIST_ITEMS,staleBox={checked:true,disabled:false};
 const pending=ctx.toggleTaskComplete(item.id,staleBox);await started;
 switched();reply([{...item,completed_at:'2026-11-23T12:00:00Z'}]);await pending;
 assert.strictEqual(ctx.CHECKLIST_ITEMS,oldList);
 assert.equal(ctx.CHECKLIST_ITEMS[0].completed_at,null);
 assert.equal(state.renders,0);assert.equal(state.messages.length,0);assert.equal(ctx.taskCompletionBusy.size,0);

 // A late Checklist failure must not show an error on B's screen.
 reset();let reject,entered;const pendingStarted=new Promise(resolve=>entered=resolve);
 ctx.eliteRequest=async()=>{entered();return new Promise((_resolve,fail)=>reject=fail)};
 const failed=ctx.toggleTaskComplete(item.id,{checked:true,disabled:false});
 await pendingStarted;switched();reject(Error('Old customer 409'));await failed;
 assert.equal(state.messages.length,0);assert.equal(state.renders,0);

 // Ordinary completion uses one atomic action and one refresh.
 reset();await ctx.toggleTaskComplete(task.id,{checked:true,disabled:false});
 assert.equal(state.requests.length,1);
 assert.equal(state.requests[0].path,'/rest/v1/rpc/elite_complete_task');
 assert.equal(state.reads,1);assert.equal(state.renders,1);
 assert.equal(state.messages.length,1);

 // Completing a selected overdue row releases its selection before queuing the redraw.
 reset();
 ctx.OWN_TASKS[0].due_at='2026-11-01T12:00:00Z';
 let selected=true;
 ctx.window.tcClearTaskSelection=()=>{selected=false};
 ctx.window.tcAfterTaskInteraction=refresh=>{assert.equal(selected,false);refresh()};
 await ctx.toggleTaskComplete(task.id,{checked:true,disabled:false,closest:()=>selected});
 assert.equal(state.renders,1);
 delete ctx.window.tcClearTaskSelection;delete ctx.window.tcAfterTaskInteraction;

 // A successful write followed by a failed refresh keeps the saved check visible.
 reset();ctx.fetchOwnTasks=async()=>{throw Error('Sin conexión')};
 const completed={checked:true,disabled:false};
 await ctx.toggleTaskComplete(task.id,completed);
 assert.equal(completed.checked,true);
 assert.equal(completed.disabled,true);
 assert.match(state.messages[0][0],/El cambio se guardó/);

 // An account switch before the RPC returns must not refresh or rerender B.
 reset();let resolveRpc,signalRpc;const rpcStarted=new Promise(resolve=>signalRpc=resolve);
 ctx.eliteRequest=async()=>{signalRpc();return new Promise(resolve=>resolveRpc=resolve)};
 const pendingRpc=ctx.toggleTaskComplete(task.id,{checked:true,disabled:false});
 await rpcStarted;switched();resolveRpc(null);await pendingRpc;
 assert.equal(state.reads,0);assert.equal(state.renders,0);assert.equal(state.messages.length,0);
 assert.equal(ctx.taskCompletionBusy.size,0);

 // A delayed refresh after the RPC must not redraw the next account.
 reset();let finishRead,readStarted;const reading=new Promise(resolve=>readStarted=resolve);
 ctx.fetchOwnTasks=async()=>{state.reads++;readStarted();return new Promise(resolve=>finishRead=resolve)};
 const pendingRead=ctx.toggleTaskComplete(task.id,{checked:true,disabled:false});
 await reading;switched();finishRead();await pendingRead;
 assert.equal(state.reads,1);assert.equal(state.renders,0);assert.equal(state.messages.length,0);
 console.log('PASS: Checklist and ordinary task checkbox completion guard against stale A/B writes, errors and refresh');
})().catch(e=>{console.error(e);process.exitCode=1});
