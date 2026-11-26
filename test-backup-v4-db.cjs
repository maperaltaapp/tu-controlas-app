const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const V4=require('./client-backup-v4.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
  await db.query('insert into auth.users(id) values ($1),($2)',[A,B]);
  for(const [table] of V4.sources){
   await db.exec('create table public."'+table+'" (id text primary key,user_id uuid not null,work_id text,group_key text,name text,amount numeric);alter table public."'+table+'" enable row level security;grant select on public."'+table+'" to authenticated;create policy owner_read on public."'+table+'" for select to authenticated using (auth.uid()=user_id);');
  }
  await db.exec(fs.readFileSync('client-snapshot-v4.sql','utf8'));
  await db.query("insert into elite_works(id,user_id,name) values('wA',$1,'Obra ficticia A'),('wB',$2,'Obra ficticia B')",[A,B]);
  await db.query("insert into elite_tasks(id,user_id,work_id) values('task-A',$1,'wA'),('task-B',$2,'wB')",[A,B]);
  await db.query("insert into elite_work_economic_entries(id,user_id,work_id,amount) values('cost-A',$1,'wA',1234.56),('cost-B',$2,'wB',9876.54)",[A,B]);
  await db.query("insert into elite_ai_learnings(id,user_id,name) values('learning-A',$1,'Conocimiento A'),('learning-B',$2,'Conocimiento B')",[A,B]);
  await db.query("insert into tc_cost_forecast_snapshots(id,user_id,work_id,name,amount) values('margin-A',$1,'wA','Oferta original',120000),('margin-B',$2,'wB','Oferta ajena',90000)",[A,B]);
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  const payload=(await db.query("select public.tc_export_owner_v4() as snapshot")).rows[0].snapshot;
  assert.equal(payload.owner_id,A);assert.equal(payload.version,4);
  assert.equal(Object.keys(payload.tables).length,23);
  assert.equal(payload.tables.elite_works.length,1);
  assert.equal(payload.tables.elite_works[0].name,'Obra ficticia A');
  assert.equal(payload.tables.elite_work_economic_entries[0].amount,1234.56);
  assert.equal(payload.tables.elite_ai_learnings[0].name,'Conocimiento A');
  assert.equal(payload.tables.tc_cost_forecast_snapshots[0].amount,120000);
  const archived=await V4.build({userId:A,read:async()=>payload});
  assert.equal(archived.records,5);assert.equal(await V4.verify(archived.snapshot,A),true);
  await db.exec("set request.jwt.claim.sub='"+B+"';");
  const b=(await db.query('select public.tc_export_owner_v4() as snapshot')).rows[0].snapshot;
  assert.equal(b.owner_id,B);assert.equal(b.tables.elite_works.length,1);
  assert.equal(b.tables.elite_works[0].name,'Obra ficticia B');
  assert(!JSON.stringify(b).includes('Obra ficticia A'));
  assert(!JSON.stringify(b).includes('margin-A'));
  await db.exec("set request.jwt.claim.sub='';");
  await assert.rejects(db.query('select public.tc_export_owner_v4()'),/Sesión requerida/);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select public.tc_export_owner_v4()'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from elite_works')).rows[0].n,2);
  console.log('PASS: V4 single-transaction security-invoker export has 23 tables including PM forecasts; A/B isolated');
 }finally{await db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
