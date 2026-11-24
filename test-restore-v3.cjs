const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const V3=require('./client-backup-v3.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
  await db.query('insert into auth.users(id) values ($1),($2)',[A,B]);
  const numeric=new Set(['elite_history','elite_plan_versions','elite_ai_learning_history','elite_ai_correction_history']);
  for(const [table] of V3.sources){
   const id=numeric.has(table)?'id bigint generated always as identity primary key':'id text primary key';
   await db.exec('create table public."'+table+'" ('+id+', user_id uuid not null references auth.users(id),work_id text, group_key text, name text, status text, amount numeric(14,2)); alter table public."'+table+'" enable row level security;grant select,insert,update,delete on public."'+table+'" to authenticated;create policy owner_access on public."'+table+'" to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());');
  }
  // Only in this isolated test, activate the draft RPC for authenticated users.
  let sql=fs.readFileSync('restore-empty-owner-v3.sql','utf8').replace(/^-- grant execute on function/m,'grant execute on function');
  await db.exec(sql);
  const add=async(t,id,user,name,status='pending')=>{
   if(numeric.has(t))await db.query('insert into public."'+t+'"(user_id,name,status) values($1,$2,$3)',[user,name,status]);
   else await db.query('insert into public."'+t+'"(id,user_id,name,status) values($1,$2,$3,$4)',[id,user,name,status]);
  };
  await add('elite_works','workA',A,'Trabajo ficticio A');await add('elite_works','workB',B,'Trabajo ficticio B');
  await add('elite_tasks','taskA',A,'Tarea A');await add('elite_tasks','taskB',B,'Tarea B');
  await add('elite_work_economic_entries','costA',A,'Coste presupuestado');await add('elite_work_economic_entries','costB',B,'Coste de B');
  await add('elite_ai_learnings','learnA',A,'Aprendizaje A','approved');await add('elite_ai_learnings','learnB',B,'Aprendizaje B');
  await add('elite_ai_agent_settings','settingsA',A,'Asistente de A');
  await add('elite_history',null,A,'Registro original A');
  await add('elite_plan_versions',null,A,'Versión original A');
  const archived={format:'tu-controlas-structured-export',version:3,owner_id:A,tables:{},counts:{}};
  for(const [t] of V3.sources){let rows=(await db.query('select * from public."'+t+'" where user_id=$1',[A])).rows;archived.tables[t]=rows;archived.counts[t]=rows.length}
  assert.equal(V3.check(archived,A),8);
  for(const [t] of [...V3.sources].reverse())await db.query('delete from public."'+t+'" where user_id=$1',[A]);
  const bWork=(await db.query("select name from elite_works where user_id=$1",[B])).rows[0].name;
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  const restore=async data=>db.query("select public.tc_restore_empty_owner_v3($1::jsonb) as result",[JSON.stringify(data)]);
  const restored=(await restore(archived)).rows[0].result;
  assert.equal(restored.restored,true);assert.equal(restored.records,8);assert.equal(restored.tables,22);assert.equal(restored.verification,'exact_rows');
  for(const [t] of V3.sources)assert.deepEqual((await db.query('select * from public."'+t+'" where user_id=$1',[A])).rows,archived.tables[t],'Mismatch '+t);
  await assert.rejects(restore(archived),/ya contiene datos/i);
  await db.exec("set request.jwt.claim.sub='"+B+"';");
  await assert.rejects(restore(archived),/otra cuenta/i);
  await db.exec('reset role');
  assert.equal((await db.query("select name from elite_works where user_id=$1",[B])).rows[0].name,bWork);
  // Repeat under a deliberately mutated AI BEFORE INSERT trigger: the RPC must
  // reject modified archive data and roll back all account A inserts.
  for(const [t] of [...V3.sources].reverse())await db.query('delete from public."'+t+'" where user_id=$1',[A]);
  await db.exec("create function public.qa_mutate_learning() returns trigger language plpgsql as $$begin new.status='pending';return new;end$$;create trigger qa_mutate_learning before insert on public.elite_ai_learnings for each row execute function public.qa_mutate_learning();");
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  await assert.rejects(restore(archived),/no coincide|deshecho|contenido restaurado/i);
  for(const [t] of V3.sources)assert.equal((await db.query('select count(*)::int n from public."'+t+'" where user_id=$1',[A])).rows[0].n,0,'Atomic rollback on '+t);
  const tampered=structuredClone(archived);tampered.tables.elite_tasks[0].user_id=B;
  await assert.rejects(restore(tampered),/otra cuenta/i);
  await db.exec('reset role;set role anon');
  await assert.rejects(restore(archived),/permission denied/i);
  await db.exec('reset role');
  assert.equal((await db.query("select name from public.elite_works where user_id=$1",[B])).rows[0].name,bWork);
  console.log('PASS: draft V3 restores 22 tables in isolation, exact content, rejects reruns/spoofed owners, fails closed on mutation and rolls back; other tenant intact.');
 }finally{await db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
