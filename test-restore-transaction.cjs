// Prepared restore is tested ONLY in isolated PGlite with fictitious accounts.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const Export=require('./client-export.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
  const migrations=['tasks-schema.sql','native-schema.sql','checklist-schema.sql','subcontractor-controls.sql',
   'planning-schema.sql','gantt-v2-schema.sql','gantt-task-progress.sql','gantt-hierarchy-schema.sql',
   'gantt-remove-activity.sql','gantt-contract-schema.sql','gantt-working-calendar.sql','gantt-shared-holidays.sql',
   'gantt-dependencies.sql','followup-schema.sql','registry-schema.sql','incidents-schema.sql',
   'daily-report-activities.sql','gantt-client-dates.sql','gantt-reopen-progress.sql',
   'task-order.sql','delete-work.sql','tenant-reference-constraints.sql','economic-entries-schema.sql'];
  for(const file of migrations)await db.exec(fs.readFileSync(file,'utf8'));
  // Some operational tables were provisioned outside the historical migration fixtures.
  // Model their actual production columns without altering production itself.
  await db.exec("create table if not exists public.elite_capacity_reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),alert_key text not null,approved_at timestamptz not null default now());");
  await db.exec(fs.readFileSync('restore-empty-owner-v2.sql','utf8'));
  const src=fs.readFileSync('restore-empty-owner-v2.sql','utf8');
  assert.match(src,/security definer set search_path=''/i);
  assert.match(src,/pg_advisory_xact_lock/);
  assert.match(src,/Copia incompatible o de otra cuenta/);
  assert(!src.includes('truncate table')&&!src.includes('delete from public.'));
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[A,'a@qa.invalid',B,'b@qa.invalid']);
  const wA=(await db.query("insert into public.elite_works(user_id,name) values($1,'Prueba A') returning id",[A])).rows[0].id;
  const wB=(await db.query("insert into public.elite_works(user_id,name) values($1,'Prueba B') returning id",[B])).rows[0].id;
  const taskA=(await db.query("insert into public.elite_tasks(user_id,work_id,title,category) values($1,$2,'Tarea A','work') returning id",[A,wA])).rows[0].id;
  await db.query("insert into public.elite_tasks(user_id,work_id,title,category) values($1,$2,'Tarea B','work')",[B,wB]);
  const archive=await Export.build({userId:A,read:async(table)=>
   (await db.query('select * from public."'+table+'" where user_id=$1',[A])).rows});
  assert.equal(archive.snapshot.version,2);
  const sourceCounts={works:1,tasks:1};
  await db.query('delete from public.elite_tasks where user_id=$1',[A]);
  await db.query('delete from public.elite_works where user_id=$1',[A]);
  // Audit triggers retain their own per-account history, so reset that fixture too.
  // Only fictitious local rows are deleted; production never runs this test.
  await db.query('delete from public.elite_history where user_id=$1',[A]);
  const beforeB=JSON.stringify((await db.query('select id,name from public.elite_works where user_id=$1',[B])).rows);
  const beforeBT=JSON.stringify((await db.query('select id,title from public.elite_tasks where user_id=$1',[B])).rows);
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  const restore=async(snap)=>db.query('select public.tc_restore_empty_owner_v2($1::jsonb) as result',[JSON.stringify(snap)]);
  let result=(await restore(archive.snapshot)).rows[0].result;
  assert.equal(result.restored,true);assert.equal(result.records,2);assert.equal(result.tables,16);
  assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from elite_tasks')).rows[0].n,1);
  assert.equal((await db.query('select id from elite_works')).rows[0].id,wA);
  assert.equal((await db.query('select id from elite_tasks')).rows[0].id,taskA);
  await assert.rejects(restore(archive.snapshot),/ya contiene datos/);
  await db.exec('reset role');
  assert.equal(JSON.stringify((await db.query('select id,name from elite_works where user_id=$1',[B])).rows),beforeB);
  assert.equal(JSON.stringify((await db.query('select id,title from elite_tasks where user_id=$1',[B])).rows),beforeBT);
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+B+"';");
  await assert.rejects(restore(archive.snapshot),/otra cuenta/);
  await db.exec('reset role');
  // Rollback on cross-owner FK: fresh fictitious target A after removing A data.
  await db.query('delete from public.elite_tasks where user_id=$1',[A]);
  await db.query('delete from public.elite_works where user_id=$1',[A]);
  // Audit triggers retain their own per-account history, so reset that fixture too.
  // Only fictitious local rows are deleted; production never runs this test.
  await db.query('delete from public.elite_history where user_id=$1',[A]);
  const damaged=JSON.parse(JSON.stringify(archive.snapshot));
  damaged.tables.elite_tasks[0].work_id=wB;
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  await assert.rejects(restore(damaged),/foreign key|violates|no pertenece/i);
  assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,0,'Atomic rollback even after work insert');
  assert.equal((await db.query('select count(*)::int n from elite_tasks')).rows[0].n,0);
  const spoofed=JSON.parse(JSON.stringify(archive.snapshot));spoofed.tables.elite_tasks[0].user_id=B;
  await assert.rejects(restore(spoofed),/otra cuenta/);
  const missing=JSON.parse(JSON.stringify(archive.snapshot));delete missing.tables.elite_history;
  await assert.rejects(restore(missing),/tablas/);
  await assert.rejects(db.query('select public.tc_restore_empty_owner_v2(null::jsonb)'),/Copia incompatible/);
  await db.exec('reset role');
  await db.exec('set role anon');
  await assert.rejects(restore(archive.snapshot),/permission denied/i);
  await db.exec('reset role');
  assert.equal(JSON.stringify((await db.query('select id,name from public.elite_works where user_id=$1',[B])).rows),beforeB);
  console.log('PASS: draft restore v2 is atomic, A-only, empty-account-only, idempotently refuses replay, B unchanged, anon blocked');
 }finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
