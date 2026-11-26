const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const Export=require('./client-backup-v3.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{
 const db=new PGlite();
 try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 const migrations=['tasks-schema.sql','native-schema.sql','checklist-schema.sql','subcontractor-controls.sql','planning-schema.sql','gantt-v2-schema.sql','gantt-task-progress.sql','gantt-hierarchy-schema.sql','gantt-remove-activity.sql','gantt-contract-schema.sql','gantt-working-calendar.sql','gantt-shared-holidays.sql','gantt-dependencies.sql','followup-schema.sql','registry-schema.sql','incidents-schema.sql','daily-report-activities.sql','gantt-client-dates.sql','gantt-reopen-progress.sql','task-order.sql','delete-work.sql','tenant-reference-constraints.sql','economic-entries-schema.sql','final-package-schema.sql'];
 for(const file of migrations)await db.exec(fs.readFileSync(file,'utf8'));
 await db.exec("create table if not exists public.elite_capacity_reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),alert_key text not null,approved_at timestamptz not null default now());");
 await db.exec("create table public.elite_ai_learnings(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),work_id uuid references elite_works(id),title text,status text not null default 'pending',version int not null default 1,created_at timestamptz default now(),updated_at timestamptz default now(),reviewed_at timestamptz);");
 await db.exec("create table public.elite_ai_corrections(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),work_id uuid references elite_works(id),linked_learning_id uuid references elite_ai_learnings(id),status text not null default 'awaiting_confirmation',version int not null default 1,created_at timestamptz default now(),updated_at timestamptz default now(),confirmed_at timestamptz);");
 await db.exec("create table public.elite_ai_learning_history(id bigint generated always as identity primary key,learning_id uuid not null references elite_ai_learnings(id),user_id uuid not null,version int,old_status text,new_status text,snapshot jsonb,created_at timestamptz default now());");
 await db.exec("create table public.elite_ai_correction_history(id bigint generated always as identity primary key,correction_id uuid not null references elite_ai_corrections(id),user_id uuid not null,version int,old_status text,new_status text,snapshot jsonb,created_at timestamptz default now());");
 await db.exec("create table public.elite_ai_agent_settings(user_id uuid primary key references auth.users(id),agent_name text,updated_at timestamptz default now());");
 await db.exec("create function elite_private.record_ai_learning() returns trigger language plpgsql security definer set search_path='pg_catalog','public','elite_private' as $$ begin insert into public.elite_ai_learning_history(learning_id,user_id,version,old_status,new_status,snapshot) values(new.id,new.user_id,new.version,case when TG_OP='UPDATE' then old.status else null end,new.status,to_jsonb(new));return null;end $$;");
 await db.exec("create function elite_private.audit_ai_correction() returns trigger language plpgsql security definer set search_path='pg_catalog','public','elite_private' as $$ begin insert into public.elite_ai_correction_history(correction_id,user_id,version,old_status,new_status,snapshot) values(new.id,new.user_id,new.version,case when TG_OP='UPDATE' then old.status else null end,new.status,to_jsonb(new));return null;end $$;");
 await db.exec(fs.readFileSync('restore-ai-context-v3.sql','utf8'));
 await db.exec('create trigger learn_before before insert or update on public.elite_ai_learnings for each row execute function elite_private.track_ai_learning();create trigger learn_after after insert or update on public.elite_ai_learnings for each row execute function elite_private.record_ai_learning();');
 await db.exec('create trigger corr_before before insert or update on public.elite_ai_corrections for each row execute function elite_private.stamp_ai_correction();create trigger corr_after after insert or update on public.elite_ai_corrections for each row execute function elite_private.audit_ai_correction();');
 for(const [table] of Export.sources){
  if(!table.startsWith('elite_ai_'))continue;
  await db.exec('alter table public."'+table+'" enable row level security;grant select,insert,update on public."'+table+'" to authenticated;create policy own on public."'+table+'" for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);');
 }
 await db.exec('grant select on public.elite_capacity_reviews to authenticated;alter table public.elite_capacity_reviews enable row level security;create policy own on public.elite_capacity_reviews for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);');
 await db.exec(fs.readFileSync('client-snapshot-v3.sql','utf8'));
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[A,'a@example.invalid',B,'b@example.invalid']);
 const wA=(await db.query("insert into elite_works(user_id,name) values($1,'Work A') returning id",[A])).rows[0].id;
 const wB=(await db.query("insert into elite_works(user_id,name) values($1,'Work B') returning id",[B])).rows[0].id;
 const tA=(await db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'Task A','work') returning id",[A,wA])).rows[0].id;
 const tB=(await db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'Task B','work') returning id",[B,wB])).rows[0].id;
 await db.query('insert into elite_work_plans(user_id,work_id,phases) values($1,$2,$3::jsonb)',[A,wA,JSON.stringify([{id:'phase-A',name:'Actividad',weight:100,start:'2026-11-01',end:'2026-12-01'}])]);
 const eA=(await db.query("insert into elite_work_economic_entries(user_id,work_id,activity_id,kind,amount,source_name,source_line) values($1,$2,'phase-A','budget',1250,'Ficticio','1') returning id",[A,wA])).rows[0].id;
 const lA=(await db.query("insert into elite_ai_learnings(user_id,work_id,title) values($1,$2,'Learn A') returning id",[A,wA])).rows[0].id;
 await db.query("update elite_ai_learnings set status='approved' where id=$1",[lA]);
 const cA=(await db.query("insert into elite_ai_corrections(user_id,work_id,linked_learning_id) values($1,$2,$3) returning id",[A,wA,lA])).rows[0].id;
 await db.query("update elite_ai_corrections set status='confirmed' where id=$1",[cA]);
 await db.query("insert into elite_ai_agent_settings(user_id,agent_name) values($1,'AI agent A')",[A]);
 await db.query("insert into elite_ai_learnings(user_id,work_id,title) values($1,$2,'Private B')",[B,wB]);
 await db.query("update elite_works set workspace_layout=$2 where id=$1",[wA,JSON.stringify({calendar_name:'Calendario reutilizable',sheets:{prep:{columns:[{id:'col_test',label:'Control'}]}}})]);
 await db.query("insert into elite_work_checklist_items(user_id,work_id,section,title,cell_values) values($1,$2,'custom_11111111-1111-4111-8111-111111111111','Control restaurable',$3)",[A,wA,JSON.stringify({col_test:'Dato de prueba'})]);

 // Fictitious records covering the deletion dependencies, including immutable approvals and push.
 await db.query("insert into elite_contract_plan_versions(user_id,work_id,revision,execution_revision,title,approved_date,approval_reason,items) values($1,$2,1,1,'Aprobado QA','2026-11-20','Prueba','[{}]'::jsonb)",[A,wA]);
 await db.query("insert into elite_contract_plan_versions(user_id,work_id,revision,execution_revision,title,approved_date,approval_reason,items) values($1,$2,1,1,'Aprobado B','2026-11-20','Prueba','[{}]'::jsonb)",[B,wB]);
 const subA=(await db.query("insert into elite_push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://qa.invalid/a','ficticio','ficticio') returning id",[A])).rows[0].id;
 const subB=(await db.query("insert into elite_push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://qa.invalid/b','ficticio','ficticio') returning id",[B])).rows[0].id;
 await db.query("insert into elite_push_deliveries(task_id,revision,subscription_id) values($1,1,$2),($3,1,$4)",[tA,subA,tB,subB]);
 const ownerTables=[...Export.sources.map(([t])=>t),'elite_push_subscriptions'].sort();
 assert.equal(ownerTables.length,23);
 const observed=(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by c.relname")).rows.map(r=>r.relname);
 assert.deepEqual(observed,[...ownerTables,'elite_push_deliveries'].sort(),'Unexpected table requires review of deletion inventory');
 const snapshot=async owner=>{
  const data={};
  for(const t of ownerTables)data[t]=(await db.query('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),\'[]\'::jsonb) rows from public."'+t+'" r where user_id=$1',[owner])).rows[0].rows;
  data.elite_push_deliveries=(await db.query("select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) rows from elite_push_deliveries d join elite_push_subscriptions s on s.id=d.subscription_id where s.user_id=$1",[owner])).rows[0].rows;
  return data;
 };
 // This routine is local to PGlite QA. It is not a server endpoint, production
 // migration, credential-bearing script or substitute for Auth/Storage deletion.
 async function purgeFixture(owner,confirmation,{forceFailure=false}={}){
  if(owner!==A||confirmation!==A)throw Error('Solo se admite el UUID ficticio A confirmado');
  await db.exec('begin');
  try{
   // Refuse orphaned cross-owner links before any delete that could cascade.
   const bad=(await db.query(`select (
    exists(select 1 from elite_ai_learnings l join elite_works w on w.id=l.work_id where l.user_id<>w.user_id and $1 in (l.user_id,w.user_id)) or
    exists(select 1 from elite_ai_corrections c join elite_works w on w.id=c.work_id where c.user_id<>w.user_id and $1 in (c.user_id,w.user_id)) or
    exists(select 1 from elite_ai_corrections c join elite_ai_learnings l on l.id=c.linked_learning_id where c.user_id<>l.user_id and $1 in (c.user_id,l.user_id)) or
    exists(select 1 from elite_ai_learning_history h join elite_ai_learnings l on l.id=h.learning_id where h.user_id<>l.user_id and $1 in (h.user_id,l.user_id)) or
    exists(select 1 from elite_ai_correction_history h join elite_ai_corrections c on c.id=h.correction_id where h.user_id<>c.user_id and $1 in (h.user_id,c.user_id)) or
    exists(select 1 from elite_push_deliveries d join elite_tasks t on t.id=d.task_id join elite_push_subscriptions s on s.id=d.subscription_id where t.user_id<>s.user_id and $1 in (t.user_id,s.user_id))
   ) as cross_owner`,[owner])).rows[0].cross_owner;
   if(bad)throw Error('Referencia cruzada: borrar bloqueado');
   // Approved contracts delete by the owning work's FK cascade, never by direct deletion.
   for(const t of ['elite_ai_correction_history','elite_ai_learning_history','elite_ai_corrections','elite_ai_learnings','elite_ai_agent_settings','elite_push_subscriptions','elite_incidents','elite_daily_reports','elite_work_economic_entries','elite_plan_exceptions','elite_plan_versions','elite_work_plans','elite_task_orders','elite_tasks','elite_work_checklist_items','elite_work_contractors','elite_contract_plan_drafts','elite_capacity_reviews','elite_holiday_calendars','elite_works','elite_contractors','elite_history']){
    await db.query('delete from public."'+t+'" where user_id=$1',[owner]);
    if(forceFailure&&t==='elite_tasks')throw Error('Fallo deliberado QA');
   }
   const after=await snapshot(owner);
   for(const [table,rows] of Object.entries(after))assert.equal(rows.length,0,'Residual in '+table);
   await db.exec('commit');
  }catch(e){await db.exec('rollback');throw e}
 }
 const beforeA=await snapshot(A),beforeB=await snapshot(B);
 assert.equal(beforeA.elite_contract_plan_versions.length,1);
 assert.equal(beforeA.elite_push_deliveries.length,1);
 assert(beforeA.elite_ai_learning_history.length>0);
 await assert.rejects(purgeFixture(B,B),/ficticio/);
 await assert.rejects(purgeFixture(A,B),/ficticio/);
 await assert.rejects(purgeFixture(A,A,{forceFailure:true}),/Fallo deliberado/);
 assert.deepEqual(await snapshot(A),beforeA,'Whole owner restored after failure');
 assert.deepEqual(await snapshot(B),beforeB,'Other account unchanged after failure');
 // A deliberately malformed cross-owner push reference must fail closed.
 const wrong=(await db.query("insert into elite_push_deliveries(task_id,revision,subscription_id) values($1,2,$2) returning id",[tA,subB])).rows[0].id;
 await assert.rejects(purgeFixture(A,A),/Referencia cruzada/);
 await db.query('delete from elite_push_deliveries where id=$1',[wrong]);
 await purgeFixture(A,A);
 assert.deepEqual(await snapshot(B),beforeB,'Every owner-scoped row of B remains exact');
 // Auth is deliberately left to the supported administrator API, never a client SQL operation.
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,2);
 await purgeFixture(A,A); // idempotent local retry
 console.log('PASS: local account-purge rehearsal covers 24 tables, immutable revisions, push cascade, cross-owner rejection, rollback and exact preservation of B; Auth/Storage not executed.');
 }finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
