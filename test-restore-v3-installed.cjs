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
 await db.exec(fs.readFileSync('restore-empty-owner-v3-installed.sql','utf8'));
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[A,'a@example.invalid',B,'b@example.invalid']);
 const wA=(await db.query("insert into elite_works(user_id,name) values($1,'Work A') returning id",[A])).rows[0].id;
 const wB=(await db.query("insert into elite_works(user_id,name) values($1,'Work B') returning id",[B])).rows[0].id;
 const tA=(await db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'Task A','work') returning id",[A,wA])).rows[0].id;
 await db.query("insert into elite_tasks(user_id,work_id,title,category) values($1,$2,'Task B','work')",[B,wB]);
 await db.query('insert into elite_work_plans(user_id,work_id,phases) values($1,$2,$3::jsonb)',[A,wA,JSON.stringify([{id:'phase-A',name:'Actividad',weight:100,start:'2026-11-01',end:'2026-12-01'}])]);
 // Realistic dependency: custom shared holidays must precede plans that inherit them.
 const calendarWork=(await db.query("insert into elite_works(user_id,name) values($1,'Calendario QA') returning id",[A])).rows[0].id;
 await db.query("insert into elite_holiday_calendars(user_id,revision,exceptions) values($1,3,$2::jsonb)",[A,JSON.stringify([{date:'2026-11-23',working:false,name:'Festivo ficticio'}])]);
 const inherited=(await db.query("select elite_private.shared_calendar('{}'::jsonb,'2026-11-20'::date,$1) as calendar",[A])).rows[0].calendar;
 assert.equal(inherited.holiday_revision,3);
 await db.query("insert into elite_work_plans(user_id,work_id,phases,working_calendar) values($1,$2,'[]'::jsonb,$3::jsonb)",[A,calendarWork,JSON.stringify(inherited)]);

 // A V2 daily report written through the normal RPC must survive restoration.
 const reportA='55555555-5555-4555-8555-555555555555';
 const reportRows=[{activity_id:null,activity_name:'Trabajo manual',progress_pct:25,observations:'Parte ficticio',workers:3,machines:1}];
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
 const planRevision=(await db.query('select revision from elite_work_plans where work_id=$1',[wA])).rows[0].revision;
 await db.query('select public.elite_save_daily_activities($1,$2,$3,$4::jsonb,null,$5)',[reportA,wA,'2026-11-20',JSON.stringify(reportRows),planRevision]);
 await db.exec('reset role');
 const eA=(await db.query("insert into elite_work_economic_entries(user_id,work_id,activity_id,kind,amount,source_name,source_line) values($1,$2,'phase-A','budget',1250,'Ficticio','1') returning id",[A,wA])).rows[0].id;
 const lA=(await db.query("insert into elite_ai_learnings(user_id,work_id,title) values($1,$2,'Learn A') returning id",[A,wA])).rows[0].id;
 await db.query("update elite_ai_learnings set status='approved' where id=$1",[lA]);
 const cA=(await db.query("insert into elite_ai_corrections(user_id,work_id,linked_learning_id) values($1,$2,$3) returning id",[A,wA,lA])).rows[0].id;
 await db.query("update elite_ai_corrections set status='confirmed' where id=$1",[cA]);
 await db.query("insert into elite_ai_agent_settings(user_id,agent_name) values($1,'AI agent A')",[A]);
 await db.query("insert into elite_ai_learnings(user_id,work_id,title) values($1,$2,'Private B')",[B,wB]);
 await db.query("update elite_works set workspace_layout=$2 where id=$1",[wA,JSON.stringify({calendar_name:'Calendario reutilizable',sheets:{prep:{columns:[{id:'col_test',label:'Control'}]}}})]);
 await db.query("insert into elite_work_checklist_items(user_id,work_id,section,title,cell_values) values($1,$2,'custom_11111111-1111-4111-8111-111111111111','Control restaurable',$3)",[A,wA,JSON.stringify({col_test:'Dato de prueba'})]);
 const beforeB=JSON.stringify((await db.query('select id,name from elite_works where user_id=$1',[B])).rows);
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
 const original=(await db.query('select public.tc_export_owner_v3() as snapshot')).rows[0].snapshot;
 const archive=(await Export.build({userId:A,read:async()=>original})).snapshot;
 assert.equal(archive.version,3);assert.equal(archive.tables.elite_ai_learnings[0].status,'approved');
 assert.equal(archive.tables.elite_ai_corrections[0].status,'confirmed');
 await db.exec('reset role');
 const clear=async()=>{for(const t of ['elite_ai_correction_history','elite_ai_learning_history','elite_ai_corrections','elite_ai_learnings','elite_ai_agent_settings','elite_work_economic_entries','elite_daily_reports','elite_work_checklist_items','elite_work_plans','elite_tasks','elite_history','elite_works','elite_holiday_calendars'])await db.query('delete from public."'+t+'" where user_id=$1',[A])};
 await clear();
 await db.exec(fs.readFileSync('restore-metadata-guard-v3-candidate.sql','utf8'));
 const restore=async snap=>db.query('select public.tc_restore_empty_owner_v3($1::jsonb) as result',[JSON.stringify(snap)]);
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
 const result=(await restore(archive)).rows[0].result;
 assert.equal(result.restored,true);assert.equal(result.records,Object.values(archive.counts).reduce((s,n)=>s+n,0));assert.equal(result.tables,22);assert.equal(result.verification,'exact_rows_except_generated_ids');
 assert.equal((await db.query('select id from elite_works where id=$1',[wA])).rows[0].id,wA);
 assert.deepEqual((await db.query('select working_calendar from elite_work_plans where work_id=$1',[calendarWork])).rows[0].working_calendar,inherited);
 assert.equal((await db.query('select id from elite_tasks')).rows[0].id,tA);
 assert.equal((await db.query('select id,amount from elite_work_economic_entries')).rows[0].id,eA);
 assert.equal((await db.query('select workspace_layout from elite_works where id=$1',[wA])).rows[0].workspace_layout.calendar_name,'Calendario reutilizable');
 assert.equal((await db.query('select cell_values from elite_work_checklist_items where work_id=$1',[wA])).rows[0].cell_values.col_test,'Dato de prueba');
 const restoredReport=(await db.query('select to_jsonb(r) as row from elite_daily_reports r where id=$1',[reportA])).rows[0].row;
 assert.deepEqual(restoredReport,archive.tables.elite_daily_reports[0],'V2 report must retain every original field');
 await assert.rejects(db.query("update elite_daily_reports set notes='directo' where id=$1",[reportA]),/operación conjunta/,'Normal direct edits must remain blocked');
 assert.equal((await db.query("select public.tc_restore_preserve_v3($1) as allowed",[A])).rows[0].allowed,false);

 const learn=(await db.query('select status,version from elite_ai_learnings')).rows[0];assert.equal(learn.status,'approved');assert.equal(learn.version,2);
 const correction=(await db.query('select status,version from elite_ai_corrections')).rows[0];assert.equal(correction.status,'confirmed');assert.equal(correction.version,2);
 assert.equal((await db.query('select count(*)::int n from elite_ai_learning_history')).rows[0].n,archive.tables.elite_ai_learning_history.length);
 assert.equal((await db.query('select count(*)::int n from elite_ai_correction_history')).rows[0].n,archive.tables.elite_ai_correction_history.length);
 await assert.rejects(db.query('select count(*) from elite_private.tc_restore_context_v3'),/permission denied/,'Private restore context must not be visible to customers');
 await assert.rejects(restore(archive),/ya tiene información/);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from elite_private.tc_restore_context_v3')).rows[0].n,0,'Restore transaction guard must be removed');
 assert.equal(JSON.stringify((await db.query('select id,name from elite_works where user_id=$1',[B])).rows),beforeB);
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+B+"';");
 await assert.rejects(restore(archive),/otra cuenta/);
 await db.exec('reset role');
 const bNormal=(await db.query("insert into elite_ai_learnings(user_id,work_id,status,version,title) values($1,$2,'approved',57,'Should reset') returning status,version",[B,wB])).rows[0];
 assert.equal(bNormal.status,'pending');assert.equal(bNormal.version,1,'Restoration context must not leak to other users');
 await clear();
 const bad=JSON.parse(JSON.stringify(archive));bad.tables.elite_ai_learnings[0].work_id=wB;
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
 await assert.rejects(restore(bad),/obra externa/);
 assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,0);
 const malformedReport=structuredClone(archive);malformedReport.tables.elite_daily_reports[0].activities[0].workers=2.5;
 await assert.rejects(restore(malformedReport),/Parte histórico no válido/);
 assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,0);
 const mismatch=JSON.parse(JSON.stringify(archive));mismatch.tables.elite_ai_learning_history[0].learning_id=cA;
 await assert.rejects(restore(mismatch),/historial de IA/);
 assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,0);
 // Regression: counts still match if an unexpected trigger changes a valid field.
 const noOwner=structuredClone(archive);delete noOwner.owner_id;
 await assert.rejects(restore(noOwner),/otra cuenta/);
 await db.exec('reset role');
 await db.exec("create function public.qa_corrupt_cost() returns trigger language plpgsql as $qa$begin new.amount=new.amount+1;return new;end$qa$;create trigger qa_corrupt_cost before insert on public.elite_work_economic_entries for each row execute function public.qa_corrupt_cost();");
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
 await assert.rejects(restore(archive),/contenido restaurado no coincide/);
 for(const [table] of Export.sources){
  const count=(await db.query('select count(*)::int n from public."'+table+'" where user_id=$1',[A])).rows[0].n;
  assert.equal(count,0,'Atomic rollback in '+table);
 }
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from elite_private.tc_restore_context_v3')).rows[0].n,0);
 await db.exec('set role anon');
 await assert.rejects(restore(archive),/permission denied/);
 await db.exec('reset role');
 assert.equal(JSON.stringify((await db.query('select id,name from elite_works where user_id=$1',[B])).rows),beforeB);
 console.log('PASS: V3 restores 22 tables atomically for A; exact costs and AI workflow state; blocks replay/B; rollback and unchanged ordinary triggers');
 }finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
