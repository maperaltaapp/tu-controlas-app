const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./client-export.js'),P=require('./client-backup-preview.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const asFile=text=>({size:Buffer.byteLength(text),text:async()=>text});
(async()=>{
 const work='44444444-4444-4444-8444-444444444444';
 const out=await E.build({userId:A,time:()=>new Date('2026-11-22T15:00:00Z'),read:async name=>[
  {id:name==='elite_works'?work:'fixture-'+name,work_id:name==='elite_works'?null:work,user_id:A,group_key:'next'}
 ]});
 const before=out.json,read=asFile(before);
 const preview=await P.inspect({file:read,userId:A});
 assert.equal(preview.valid,true);
 assert.equal(preview.owner_id,A);
 assert.equal(preview.version,2);
 assert.equal(preview.table_count,16);
 assert.equal(preview.records,16);
 assert.deepEqual(preview.warnings,[]);
 assert.equal(preview.restoration_supported,false);
 assert.equal(out.json,before,'Inspect must not mutate file or archive');
 assert.match(preview.message,/No se han restaurado ni subido datos/);
 await assert.rejects(P.inspect({file:read,userId:B}),/otra cuenta/);
 await assert.rejects(P.inspect({file:asFile('not a JSON'),userId:A}),/JSON válido/);
 const corrupted=JSON.parse(before);corrupted.tables.elite_tasks[0].group_key='modified';
 await assert.rejects(P.inspect({file:asFile(JSON.stringify(corrupted)),userId:A}),/modificados o dañados/);
 await assert.rejects(P.inspect({file:{size:70*1024*1024,text:async()=>{throw Error('must not read')}},userId:A}),/demasiado grande/);
 await assert.rejects(P.inspect({file:{size:2,text:async()=>'{'},userId:A}),/JSON válido/);
 await assert.rejects(P.inspect({file:null,userId:A}),/Selecciona un archivo/);
 const html=fs.readFileSync(__dirname+'/index.html','utf8')+fs.readFileSync(__dirname+'/final-package.js','utf8');
 assert.ok(html.includes('src="client-backup-preview.js"'));
 assert.ok(html.includes('id="backupCheckInput"'));
 assert.ok(html.includes('TCBackupPreview.inspect({file,userId:owner})'));
 assert.ok(!fs.readFileSync(__dirname+'/client-backup-preview.js','utf8').includes('/rest/v1/'));

 // SHA-256 alone does not prove that record references are restorable.
 const brokenRows={
  elite_works:[{id:work,user_id:A}],
  elite_tasks:[{id:'task-1',work_id:work,user_id:A,previous_task_id:'missing-task',control_id:'missing-control'}],
  elite_work_plans:[{work_id:work,user_id:A,phases:[{task_id:'missing-task'}]}],
  elite_work_contractors:[{id:'control-1',work_id:work,user_id:A,contractor_id:'missing-contractor'}],
  elite_incidents:[{id:'incident-1',work_id:work,user_id:A,report_id:'missing-report'}]
 };
 const brokenArchive=await E.build({userId:A,read:async table=>brokenRows[table]||[]});
 const inconsistent=await P.inspect({file:asFile(brokenArchive.json),userId:A});
 assert.equal(inconsistent.valid,true,'SHA-256 must still verify even with invalid relationships');
 assert.equal(inconsistent.references_consistent,false);
 assert.equal(inconsistent.issue_count,5,'All five broken references must be detected');
 assert.ok(inconsistent.warnings.some(s=>s.includes('predecesora')));
 assert.ok(inconsistent.warnings.some(s=>s.includes('empresa asignada ausente')));
 assert.ok(inconsistent.warnings.some(s=>s.includes('actividad Gantt')));
 assert.ok(inconsistent.warnings.some(s=>s.includes('parte vinculado')));
 assert.equal(inconsistent.restoration_supported,false);
 // Existing links to an entity of a different work must also be flagged.
 const otherWork='55555555-5555-4555-8555-555555555555';
 const mismatchedRows={
  elite_works:[{id:work,user_id:A},{id:otherWork,user_id:A}],
  elite_tasks:[{id:'task-2',work_id:work,user_id:A,control_id:'control-2'}],
  elite_work_contractors:[{id:'control-2',work_id:otherWork,user_id:A}],
  elite_daily_reports:[{id:'report-2',work_id:otherWork,user_id:A}],
  elite_incidents:[{id:'incident-2',work_id:work,report_id:'report-2',user_id:A}],
  elite_work_plans:[{work_id:otherWork,user_id:A,phases:[{task_id:'task-2'}]}]
 };
 const mismatched=await E.build({userId:A,read:async table=>mismatchedRows[table]||[]});
 const inspected=await P.inspect({file:asFile(mismatched.json),userId:A});
 assert.equal(inspected.issue_count,3,'Cross-work references must not be silently accepted');
 assert.equal(inspected.references_consistent,false);
 // Bound diagnostic output even if a corrupted but correctly hashed file contains many missing keys.
 const many=await E.build({userId:A,read:async table=>table==='elite_tasks'?Array.from({length:35},()=>({user_id:A,work_id:work})):table==='elite_works'?[{id:work,user_id:A}]:[]});
 const largeWarnings=await P.inspect({file:asFile(many.json),userId:A});
 assert.ok(largeWarnings.issue_count>=35);
 assert.ok(largeWarnings.warnings.length<=20);
 assert.equal(largeWarnings.warnings_truncated,true);

 // A snapshot can have valid SHA and intact tables but inconsistent Gantt hierarchy.
 const workTwo='66666666-6666-4666-8666-666666666666';
 const planIssues={
  elite_works:[{id:work,user_id:A},{id:workTwo,user_id:A}],
  elite_tasks:[
   {id:'task-work-1',work_id:work,user_id:A,previous_task_id:'task-work-2'},
   {id:'task-work-2',work_id:workTwo,user_id:A}
  ],
  elite_work_plans:[{
   work_id:work,user_id:A,phases:[
    {id:'phase-1',task_id:'task-work-1',parent_id:'removed-parent',contractor_id:'missing-subcontractor',depends_on:['removed-dependency','phase-1']},
    {id:'phase-2',task_id:'task-work-1'},
    {id:'phase-2'}
   ]
  }]
 };
 const inconsistentPlan=await E.build({userId:A,read:async table=>planIssues[table]||[]});
 const planPreview=await P.inspect({file:asFile(inconsistentPlan.json),userId:A});
 assert.equal(planPreview.valid,true,'SHA alone is not proof of safe restoration');
 assert.equal(planPreview.references_consistent,false);
 assert.equal(planPreview.issue_count,7,'Detect cross-work recurrence, missing parent and contractor, invalid dependencies, duplicated task and phase');
 for(const label of ['otra obra','fase principal','subcontrata','dependencia','varias actividades','duplicado']){
  assert.ok(planPreview.warnings.some(w=>w.includes(label)),'Missing diagnostic for '+label);
 }
 assert.equal(planPreview.restoration_supported,false);
 const safePlan={
  elite_works:[{id:work,user_id:A}],
  elite_tasks:[{id:'safe-task',work_id:work,user_id:A}],
  elite_contractors:[{id:'safe-contractor',user_id:A}],
  elite_work_plans:[{work_id:work,user_id:A,phases:[{id:'group-1',is_group:true},{id:'leaf-1',task_id:'safe-task',contractor_id:'safe-contractor',parent_id:'group-1',depends_on:[]}]}]
 };
 const safeArchive=await E.build({userId:A,read:async table=>safePlan[table]||[]});
 const safePreview=await P.inspect({file:asFile(safeArchive.json),userId:A});
 assert.equal(safePreview.issue_count,0,'Do not reject coherent hierarchy and valid contractor references');
 assert.equal(safePreview.references_consistent,true);

 console.log('PASS: local-only archive inspect, integrity verification, foreign-account denial, malformed/oversized safety, relation checks, bounded warnings, no restore.');
})().catch(e=>{console.error(e);process.exitCode=1});
