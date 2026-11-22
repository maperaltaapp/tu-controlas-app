// Exercise the real task-dialog completion handler with isolated fake data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const from=html.indexOf('async function completeNativeTask(t){'),to=html.indexOf('\nasync function changeOwnTask(',from);
assert.ok(from>0&&to>from,'Completion handler must be present');
const implementation=html.slice(from,to);
const state={locks:[],patches:[],requests:[],prompts:[],refresh:0,render:0,close:0,messages:[],errors:[],failure:null,answers:[]};
const feedback={textContent:''};
const sandbox={
 taskCompletionBusy:new Set(),
 WORK_PLANS:[],console,Number,Date,Error,
 lockOwnForm:value=>state.locks.push(value),
 gReopenProgress:phase=>phase.completion_restore_percent??null,
 prompt:()=>state.answers.shift(),
 patchNativeTask:async(task,patch)=>{
  state.patches.push({...patch});
  if(state.failure==='patch')throw Error('Conflicto de actualización');
  return {...task,...patch};
 },
 eliteRequest:async(path,options)=>{
  state.requests.push({path,options});
  if(state.failure==='rpc')throw Error('Guardado rechazado');
  return {};
 },
 fetchOwnTasks:async()=>{state.refresh++},
 closeTaskDialog:()=>{state.close++},
 render:()=>{state.render++},
 statusMessage:(message,error)=>state.messages.push([message,error]),
 $:()=>feedback
};
const handler=vm.runInNewContext(implementation+';completeNativeTask',sandbox);
function reset(){
 state.locks.length=0;state.patches.length=0;state.requests.length=0;state.refresh=0;state.render=0;state.close=0;state.messages.length=0;state.failure=null;state.answers.length=0;
 feedback.textContent='';sandbox.WORK_PLANS=[];sandbox.taskCompletionBusy.clear();
}
const task=(completed,stage='General')=>({id:'task-1',title:'Colocar anclajes',updated_at:'revision-5',stage,completed});
(async()=>{
 // Completing a task must invoke exactly one atomic server action, not a preliminary task PATCH.
 reset();await handler(task(false,'Gantt'));
 assert.equal(state.requests.length,1);
 assert.equal(state.requests[0].path,'/rest/v1/rpc/elite_complete_task');
 assert.deepEqual(JSON.parse(state.requests[0].options.body),{task_id:'task-1',expected_updated_at:'revision-5'});
 assert.equal(state.patches.length,0,'No debe haber cambios parciales previos a completar');
 assert.equal(state.refresh,1);assert.equal(state.render,1);assert.equal(state.close,1);
 assert.deepEqual(state.locks,[true,false]);
 // Reopening with a recorded Gantt percentage only changes the task status.
 reset();sandbox.WORK_PLANS=[{phases:[{task_id:'task-1',completion_restore_percent:37}]}];
 await handler(task(true,'Gantt'));
 assert.equal(state.requests.length,0);
 assert.deepEqual(state.patches[0],{completed:false,status:'pending'});
 assert.deepEqual(state.locks,[true,false]);
 // Unknown percentage and user cancellation: no writes, always unlock.
 reset();sandbox.WORK_PLANS=[{phases:[{task_id:'task-1',completion_restore_percent:null}]}];state.answers=[null];
 await handler(task(true,'Gantt'));
 assert.equal(state.patches.length,0);assert.equal(state.requests.length,0);assert.equal(state.refresh,0);assert.equal(state.close,0);
 assert.deepEqual(state.locks,[true,false]);assert.equal(sandbox.taskCompletionBusy.size,0);
 // Invalid value: preserve dialog with error message, never mutate.
 reset();sandbox.WORK_PLANS=[{phases:[{task_id:'task-1',completion_restore_percent:null}]}];state.answers=['100'];
 await handler(task(true,'Gantt'));
 assert.match(feedback.textContent,/porcentaje entre 0 y 99,99/);
 assert.equal(state.patches.length,0);assert.equal(state.render,0);assert.deepEqual(state.locks,[true,false]);
 // Known unmeasured completion requires explicit valid value before reopening.
 reset();sandbox.WORK_PLANS=[{phases:[{task_id:'task-1',completion_restore_percent:null}]}];state.answers=['42,5'];
 await handler(task(true,'Gantt'));
 assert.deepEqual(state.patches[0],{completed:false,status:'pending',progress_pct:42.5});
 assert.equal(state.refresh,1);assert.equal(state.close,1);
 // Failure of the server action: no preliminary mutation; unlock for retry.
 reset();state.failure='rpc';await handler(task(false));
 assert.equal(state.patches.length,0);assert.equal(state.refresh,0);assert.equal(state.close,0);
 assert.match(feedback.textContent,/rechazado/);assert.deepEqual(state.locks,[true,false]);
 assert.equal(sandbox.taskCompletionBusy.size,0);
 // No concurrent duplicate submission.
 reset();
 sandbox.taskCompletionBusy.add('task-1');await handler(task(false));
 assert.equal(state.requests.length,0);assert.equal(state.locks.length,0);
 console.log('PASS: task dialogs use one atomic completion RPC, preserve Gantt progress and always unlock on cancel/failure.');
})().catch(error=>{console.error(error);process.exitCode=1});
