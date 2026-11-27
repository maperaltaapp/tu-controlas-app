// V1 step 2: test the real task/Gantt cache refresh extracted from the published app.
// No network, real accounts, or Supabase writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const start=html.indexOf('let latestTaskGanttRefresh=null;'),end=html.indexOf('\nconst gRenderFullEditor=',start);
assert(start>0&&end>start,'Expected atomic refresh implementation');
const state={boards:0,reads:[],tasks:[],plans:[]};
const owner=(id)=>({user:{id},access_token:'test-'+id});
const ctx=vm.createContext({
 sessionEpoch:1,session:owner('account-A'),OWN_TASKS:[{id:'prior-A'}],
 WORK_PLANS:[{work_id:'prior-plan-A'}],DATA:[{id:'prior-board'}],ownLoadError:'prior problem',
 readAll:async()=>{throw Error('Read not configured')},
 nativeBoards:()=>{state.boards++;return [{ids:ctx.OWN_TASKS.map(x=>x.id),plans:ctx.WORK_PLANS.map(x=>x.work_id)}]},
 Error,Promise
});
vm.runInContext(html.slice(start,end),ctx,{filename:'index-refresh-excerpt.js'});
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
(async()=>{
 // Tasks and plans are both read before anything changes on screen.
 let taskGate=defer(),planGate=defer();
 ctx.readAll=async(table)=>table==='elite_tasks'?taskGate.promise:planGate.promise;
 const loading=ctx.fetchOwnTasks();
 taskGate.resolve([{id:'task-A',completed:true,status:'done'}]);
 await Promise.resolve();
 assert.equal(ctx.OWN_TASKS[0].id,'prior-A');
 assert.equal(ctx.WORK_PLANS[0].work_id,'prior-plan-A');
 assert.equal(state.boards,0);
 planGate.resolve([{work_id:'work-A',phases:[{task_id:'task-A',activity_status:'done'}]}]);
 await loading;
 assert.equal(ctx.OWN_TASKS[0].completed,true);
 assert.equal(ctx.WORK_PLANS[0].phases[0].activity_status,'done');
 assert.equal(state.boards,1,'One refresh of view data for synchronized caches');
 assert.equal(ctx.DATA[0].ids[0],'task-A');

 // If Gantt read fails, an already completed task read cannot partially replace cache.
 taskGate=defer();planGate=defer();
 ctx.readAll=async(table)=>table==='elite_tasks'?taskGate.promise:planGate.promise;
 const bad=ctx.fetchOwnTasks();
 taskGate.resolve([{id:'new-should-not-appear'}]);
 planGate.reject(Error('Gantt offline'));
 await assert.rejects(bad,/Gantt offline/);
 assert.equal(ctx.OWN_TASKS[0].id,'task-A');
 assert.equal(ctx.WORK_PLANS[0].work_id,'work-A');
 assert.equal(state.boards,1);

 // Switching account A -> B during both reads must discard all of A.
 taskGate=defer();planGate=defer();
 ctx.readAll=async(table)=>table==='elite_tasks'?taskGate.promise:planGate.promise;
 const obsolete=ctx.fetchOwnTasks();
 ctx.sessionEpoch=2;ctx.session=owner('account-B');
 ctx.OWN_TASKS=[{id:'private-B'}];ctx.WORK_PLANS=[{work_id:'work-B'}];ctx.DATA=[{id:'board-B'}];
 taskGate.resolve([{id:'private-A'}]);planGate.resolve([{work_id:'work-A'}]);
 await assert.rejects(obsolete,/sesión cambió/);
 assert.equal(ctx.OWN_TASKS[0].id,'private-B');assert.equal(ctx.WORK_PLANS[0].work_id,'work-B');
 assert.equal(ctx.DATA[0].id,'board-B');

 // Same-account parallel reloads: delayed earlier read must not override newer data.
 ctx.sessionEpoch=3;ctx.session=owner('account-A');
 ctx.OWN_TASKS=[{id:'original'}];ctx.WORK_PLANS=[{work_id:'original'}];
 let index=0;const oldTasks=defer(),oldPlans=defer();
 ctx.readAll=async(table)=>{
  const current=index;
  if(current===0)return table==='elite_tasks'?oldTasks.promise:oldPlans.promise;
  return table==='elite_tasks'?[{id:'new-version'}]:[{work_id:'plan-new-version'}];
 };
 const oldReload=ctx.fetchOwnTasks();
 index=1;await ctx.fetchOwnTasks();
 oldTasks.resolve([{id:'stale-version'}]);oldPlans.resolve([{work_id:'stale-plan'}]);
 await oldReload;
 assert.equal(ctx.OWN_TASKS[0].id,'new-version');
 assert.equal(ctx.WORK_PLANS[0].work_id,'plan-new-version');

 // Missing authenticated ownership cannot trigger a network read.
 const before=state.boards;ctx.session=null;ctx.readAll=async()=>{throw Error('Unwanted request')};
 await assert.rejects(ctx.fetchOwnTasks(),/Vuelve a entrar/);assert.equal(state.boards,before);
 console.log('PASS: client task/Gantt snapshots commit together and reject failures and owner switches, and share the newest snapshot after overlapping reloads');
})().catch(error=>{console.error(error);process.exitCode=1});
