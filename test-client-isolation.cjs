// Cross-tenant security regression: completely fictitious identities and local PGlite.
// Never connects to a live Supabase project or writes to real works.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const activity='33333333-3333-4333-8333-333333333333';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated;
   grant execute on function auth.uid() to authenticated;`);
  const migrations=[
   'tasks-schema.sql','native-schema.sql','checklist-schema.sql','subcontractor-controls.sql',
   'planning-schema.sql','gantt-v2-schema.sql','gantt-task-progress.sql',
   'gantt-hierarchy-schema.sql','gantt-remove-activity.sql','gantt-contract-schema.sql',
   'gantt-working-calendar.sql','gantt-shared-holidays.sql','gantt-dependencies.sql',
   'followup-schema.sql','registry-schema.sql','incidents-schema.sql',
   'daily-report-activities.sql','gantt-client-dates.sql','gantt-reopen-progress.sql',
   'task-order.sql','delete-work.sql','tenant-reference-constraints.sql'];
  for(const f of migrations)await db.exec(fs.readFileSync(path.join(__dirname,f),'utf8'));
  // Global invariants: client-exposed tables require RLS; private SQL APIs are not public.
  const tables=(await db.query(`select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')`)).rows;
  for(const name of ['elite_works','elite_tasks','elite_work_plans','elite_daily_reports'])
   assert.ok(tables.some(t=>t.relname===name),'Security fixture lacks '+name);
  assert.deepEqual(tables.filter(t=>!t.relrowsecurity),[],'A public table is missing RLS');
  const definer=(await db.query(`select p.proname,p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') as anonymous,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as signed_in,
    pg_get_functiondef(p.oid) as source
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef`)).rows;
  assert.ok(definer.length>=11,'Privileged SQL functions not loaded');
  for(const f of definer){
   assert.equal(f.anonymous,false,'Anonymous role can call SECURITY DEFINER: '+f.proname);
   assert.ok((f.proconfig||[]).some(s=>s.startsWith('search_path=')),
    'SECURITY DEFINER has no fixed search_path: '+f.proname);
   if(f.signed_in){
    assert.ok(f.source.includes('auth.uid()'),'Missing auth.uid() in '+f.proname);
    assert.match(f.source,/user_id/,'Missing owner check in '+f.proname);
   }
  }
  await db.query('insert into auth.users values($1,$2),($3,$4)',[A,'qa-a@example.invalid',B,'qa-b@example.invalid']);
  const wA=(await db.query("insert into elite_works(user_id,name) values($1,'A - ficticia') returning id",[A])).rows[0].id;
  const wB=(await db.query("insert into elite_works(user_id,name) values($1,'B - ficticia') returning id",[B])).rows[0].id;
  const tB=(await db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'Solo B','work') returning id",[B,wB])).rows[0].id;

  // Composite foreign keys must reject cross-tenant relationships even when a row's user_id is forged.
  await assert.rejects(
   db.query('insert into elite_plan_versions(work_id,user_id,revision,snapshot) values($1,$2,999,\'{}\'::jsonb)',[wB,A]),
   /foreign key|violates/i,'A cannot attach its plan snapshot to B work');
  const tA=(await db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'Solo A','work') returning id",[A,wA])).rows[0].id;
  const tB2=(await db.query("insert into elite_tasks(user_id,work_id,title,category,previous_task_id) values($1,$2,'Otra B','work',$3) returning id",[B,wB,tB])).rows[0].id;
  assert.ok(tB2,'Same-owner task predecessor must remain valid');

  const phase=[{id:activity,name:'Solo B - planificación',start:'2026-11-23',end:'2026-11-24',
   level:1,weight:100,depends_on:[],observations:[],economic_observations:[],budget:null,activity_status:'pending'}];
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${B}';`);
  await db.query("select elite_save_gantt($1,$2,0,false,false,'')",[wB,JSON.stringify(phase)]);
  await db.exec('reset role');
  const bSnapshot=()=>db.query(`select
   (select to_jsonb(p) from public.elite_work_plans p where p.work_id=$1) as plan,
   (select jsonb_agg(to_jsonb(t) order by t.id) from public.elite_tasks t where t.user_id=$2) as tasks,
   (select to_jsonb(w) from public.elite_works w where w.id=$1) as work`,[wB,B]);
  const before=JSON.stringify((await bSnapshot()).rows[0]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);
  for(const table of ['elite_works','elite_tasks','elite_work_plans','elite_contractors','elite_daily_reports']){
   const rows=(await db.query('select user_id from public.'+table)).rows;
   assert.ok(rows.every(r=>r.user_id===A),'Cross-account read from '+table);
  }
  assert.equal((await db.query('select * from elite_works where id=$1',[wB])).rows.length,0);
  assert.equal((await db.query('select * from elite_tasks where id=$1',[tB])).rows.length,0);

  await assert.rejects(
   db.query('update elite_tasks set previous_task_id=$1 where id=$2',[tB,tA]),
   /foreign key|violates/i,'A cannot link a task to B predecessor');

  assert.equal((await db.query('select * from elite_work_plans where work_id=$1',[wB])).rows.length,0);
  assert.equal((await db.query("update elite_works set name='NO' where id=$1 returning id",[wB])).rows.length,0);
  await assert.rejects(db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'NO','work')",[B,wB]),/row-level security/i);
  // Every work-scoped privileged RPC must reject a foreign work before touching its data.
  const foreign=[
   ["elite_save_plan",()=>db.query("select elite_save_plan($1,'[]'::jsonb,0,false,false,'')",[wB])],
   ["elite_save_gantt",()=>db.query("select elite_save_gantt($1,'[]'::jsonb,1,false,false,'')",[wB])],
   ["elite_remove_gantt_activity",()=>db.query("select elite_remove_gantt_activity($1,'[]'::jsonb,1,$2,false,false,'')",[wB,activity])],
   ["elite_save_contract_draft",()=>db.query("select elite_save_contract_draft($1,1,0,'QA','[]'::jsonb)",[wB])],
   ["elite_approve_contract_plan",()=>db.query("select elite_approve_contract_plan($1,1,0,'QA','2026-11-20','QA','[]'::jsonb)",[wB])],
   ["elite_save_daily_activities",()=>db.query("select elite_save_daily_activities($1,$2,'2026-11-20','[]'::jsonb,null,1)",[activity,wB])],
   ["elite_save_work_calendar",()=>db.query("select elite_save_work_calendar($1,1,'{}'::jsonb,'[]'::jsonb,'')",[wB])],
   ["elite_delete_work",()=>db.query("select elite_delete_work($1,null)",[wB])]
  ];
  for(const [name,call] of foreign){
   await assert.rejects(call(),e=>/Obra no encontrada|Obra no disponible/i.test(String(e)),
    name+' must deny a foreign work before input validation');
  }
  await assert.rejects(db.query("select elite_save_task_order('undated',$1,0)",[JSON.stringify(['task:'+tB])]),
   /disponible|grupo|pertenece|no encontrada/i,'Foreign task ordering must be denied');
  const preview=(await db.query("select elite_save_shared_holidays('[]'::jsonb,0,null,true,'') as result")).rows[0].result;
  assert.ok(!JSON.stringify(preview).includes(wB),'Calendar preview disclosed foreign work');
  const reconciliation=(await db.query("select elite_reconcile_gantt(true) as result")).rows[0].result;
  assert.ok(!JSON.stringify(reconciliation).includes(wB),'Gantt reconciliation disclosed foreign work');
  const committed=(await db.query("select elite_reconcile_gantt(false) as result")).rows[0].result;
  assert.ok(!JSON.stringify(committed).includes(wB),'Gantt reconciliation altered foreign work');
  await db.exec('reset role');
  assert.equal(JSON.stringify((await bSnapshot()).rows[0]),before,'Foreign work/task/plan changed');
  assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,2);
  console.log('PASS: public RLS, privileged API grants, 8 foreign-work RPCs, task ordering, shared calendar, Gantt reconciliation, cross-owner FK rejection, no cross-client reads or writes');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
