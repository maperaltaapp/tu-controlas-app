const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
for(const f of ['tasks-schema.sql','native-schema.sql','subcontractor-controls.sql','planning-schema.sql','gantt-v2-schema.sql','gantt-task-progress.sql','gantt-hierarchy-schema.sql','gantt-remove-activity.sql','gantt-contract-schema.sql'])await db.exec(fs.readFileSync(__dirname+'/'+f,'utf8'));
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',a='33333333-3333-4333-8333-333333333333',b='44444444-4444-4444-8444-444444444444',g='55555555-5555-4555-8555-555555555555';
await db.query('insert into auth.users values($1,$2),($3,$4)',[uid,'a@test.example',other,'b@test.example']);const w=(await db.query("insert into elite_works(user_id,name) values($1,'QA') returning id",[uid])).rows[0].id;
await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}'`);
const plan=async()=>(await db.query('select * from elite_work_plans where work_id=$1',[w])).rows[0];
const task=async id=>(await db.query('select * from elite_tasks where id=$1',[id])).rows[0];
const save=async(p,rev)=>(await db.query('select * from elite_save_gantt($1,$2,$3,false,false,\'\')',[w,JSON.stringify(p),rev])).rows[0];
const leaf=(id,name,start,end,weight,deps=[])=>({id,name,start,end,weight,level:2,parent_id:g,depends_on:deps,lag_days:0,observations:[],economic_observations:[],budget:null,activity_status:'pending'});
let rows=[{id:g,name:'Fase',level:1,is_group:true,start:'2026-10-01',end:'2026-10-06',weight:0,depends_on:[],observations:[],economic_observations:[],budget:null},leaf(a,'A','2026-10-01','2026-10-03',40),leaf(b,'B','2026-10-04','2026-10-06',60,[a])];
let p=await save(rows,0);assert.equal(p.phases.filter(x=>x.task_id).length,2);assert.equal((await db.query('select * from elite_tasks')).rows.length,2);const aid=p.phases.find(x=>x.id===a).task_id,bid=p.phases.find(x=>x.id===b).task_id;assert.equal((await task(aid)).stage,'Gantt');
p=await save(p.phases,p.revision);assert.equal((await db.query('select * from elite_tasks')).rows.length,2);assert.equal(p.phases.find(x=>x.id===a).task_id,aid);
// Complete and reopen through actual public task paths: executes scheduler and nested parent rollup.
let t=await task(aid);await db.query('select elite_complete_task($1,$2)',[aid,t.updated_at]);p=await plan();assert.equal(p.phases.find(x=>x.id===a).activity_status,'done');assert.equal((await task(aid)).progress_pct,'100.00');
await db.query('update elite_tasks set completed=false where id=$1',[aid]);p=await plan();assert.equal(p.phases.find(x=>x.id===a).activity_status,'pending');assert.equal((await task(aid)).progress_pct,'0.00');assert.equal((await task(aid)).completed,false);
// Failed linked edit rolls back title/date/task creation and revision together.
const before=await plan(),count=(await db.query('select count(*)::int n from elite_tasks')).rows[0].n;const bad=structuredClone(before.phases);bad.find(x=>x.id===a).weight=10;await assert.rejects(save(bad,before.revision),/sumar/);assert.deepEqual(await plan(),before);assert.equal((await db.query('select count(*)::int n from elite_tasks')).rows[0].n,count);
// Task-origin schedule move updates successor task and container dates atomically.
await db.query("update elite_tasks set start_at='2026-10-02T07:00Z',due_at='2026-10-04T16:00Z' where id=$1",[aid]);p=await plan();assert.equal(p.phases.find(x=>x.id===b).start,'2026-10-05');assert.equal(p.phases.find(x=>x.id===g).end,'2026-10-07');assert.equal(new Date((await task(bid)).due_at).toISOString().slice(0,10),'2026-10-07');
// Contract revision expands parent to fixed leaf ids, never counts parent + leaves twice.
const item={name:'Fase',start:'2026-10-02',end:'2026-10-07',activity_ids:[g]};
const approve=async(expected=0,items=[item])=>(await db.query('select * from elite_approve_contract_plan($1,$2,$3,$4,$5,$6,$7)',[w,p.revision,expected,'Cliente','2026-10-01','Aprobación QA',JSON.stringify(items)])).rows[0];
const contract=await approve();assert.deepEqual(contract.items[0].activity_ids,[a,b]);await assert.rejects(approve(),/contractual cambió/);await assert.rejects(approve(1,[item,{name:'B',start:'2026-10-05',end:'2026-10-07',activity_ids:[b]}]),/solapadas/);
await assert.rejects(db.query("update elite_contract_plan_versions set title='fraude'"),/permission denied/);
// A single deletion archives only its task and preserves approved versions and prior snapshot.
rows=structuredClone(p.phases).filter(x=>x.id!==a);rows.find(x=>x.id===b).depends_on=[];rows.find(x=>x.id===b).weight=100;rows[0].start='2026-10-05';
p=(await db.query('select * from elite_remove_gantt_activity($1,$2,$3,$4,false,false,\'\')',[w,JSON.stringify(rows),p.revision,a])).rows[0];assert((await task(aid)).deleted_at);assert.equal((await task(bid)).deleted_at,null);assert.deepEqual((await db.query('select * from elite_contract_plan_versions')).rows[0].items,contract.items);assert((await db.query('select * from elite_plan_versions')).rows.length>0);
await db.exec(`set request.jwt.claim.sub='${other}'`);assert.equal((await db.query('select * from elite_contract_plan_versions')).rows.length,0);await assert.rejects(save(p.phases,p.revision),/no encontrada/);await assert.rejects(approve(1),/no encontrada/);
await db.exec('reset role');await assert.rejects(db.query("update elite_contract_plan_versions set title='mutación'"),/inmutables/);await db.close();console.log('PASS: atomic canonical links, idempotent saves, completion/reopening, hierarchy schedule, rollback, task archive, immutable customer versions, overlap guard and cross-owner isolation.');
})().catch(e=>{console.error(e);process.exitCode=1});
