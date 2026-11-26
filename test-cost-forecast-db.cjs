/* Isolated PostgreSQL/PGlite fixture: no production project, no customer data. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema elite_private;create table auth.users(id uuid primary key);");
  await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
  await db.exec("create table public.elite_works(id uuid primary key,user_id uuid not null references auth.users(id),name text,unique(id,user_id));");
  await db.exec("create table public.elite_work_plans(work_id uuid primary key,user_id uuid not null,phases jsonb not null,baseline jsonb not null,baseline_at timestamptz);");
  await db.exec("alter table public.elite_work_plans enable row level security; grant select on public.elite_work_plans to authenticated; create policy fixture_owner_plan on public.elite_work_plans for select to authenticated using ((select auth.uid())=user_id);");
  await db.query("insert into auth.users(id) values($1),($2)",[A,B]);
  const wA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.query("insert into elite_works(id,user_id,name) values($1,$2,'A'),($3,$4,'B')",[wA,A,wB,B]);
  const baseline=[{id:'p1',start:'2026-11-01',end:'2026-11-10'},{id:'p2',start:'2026-11-01',end:'2026-11-10'}];
  const phases=baseline.map((p,i)=>({...p,is_group:false,milestone:false,weight:i?60:40}));
  await db.query("insert into elite_work_plans(work_id,user_id,phases,baseline,baseline_at) values($1,$2,$3::jsonb,$4::jsonb,now()),($5,$6,$3::jsonb,$4::jsonb,now())",[wA,A,JSON.stringify(phases),JSON.stringify(baseline),wB,B]);
  await db.exec(fs.readFileSync('tc-cost-forecast-schema.sql','utf8'));
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  const save=(work,kind,total,revenue,actual,remaining,lines,reference)=>db.query(
   "insert into tc_cost_forecast_snapshots(work_id,snapshot_type,as_of,total_cost,forecast_revenue,actual_cost,remaining_cost,activity_costs,approval_reference) values($1,$2,'2026-11-26',$3,$4,$5,$6,$7::jsonb,$8) returning id,total_cost",
   [work,kind,total,revenue,actual,remaining,JSON.stringify(lines||[]),reference]);
  await save(wA,'offer',120000,150000,null,null,[],null);
  await save(wA,'pm_initial',125000,150000,null,null,[],null);
  await save(wA,'forecast',127000,150000,54000,73000,[],null);
  const items=[{activity_id:'p1',amount:50000},{activity_id:'p2',amount:75000}];
  const accepted=(await save(wA,'baseline',125000,null,null,null,items,'Aprobación simulada')).rows[0];
  assert.equal(accepted.total_cost,'125000.00');
  await assert.rejects(save(wA,'forecast',127000,150000,54000,72000,[],null),/check constraint/i);
  await assert.rejects(save(wA,'baseline',125000,null,null,null,items.slice(0,1),'Acta'),/cubrir todas/i);
  await assert.rejects(save(wA,'baseline',125000,null,null,null,[{activity_id:'p1',amount:50000},{activity_id:'missing',amount:75000}],'Acta'),/Partida no incluida/i);
  await assert.rejects(save(wA,'baseline',125000,null,null,null,[{activity_id:'p1',amount:50000},{activity_id:'p1',amount:75000}],'Acta'),/duplicadas/i);
  await assert.rejects(save(wA,'baseline',125001,null,null,null,items,'Acta'),/total aprobado/i);
  await assert.rejects(save(wB,'offer',120000,150000,null,null,[],null),/row-level|foreign key/i);
  assert.equal((await db.query('select * from tc_cost_forecast_snapshots')).rows.length,4);
  await assert.rejects(db.query('delete from tc_cost_forecast_snapshots where id=$1',[accepted.id]),/permission denied/i);
  await assert.rejects(db.query("update tc_cost_forecast_snapshots set total_cost=1 where id=$1",[accepted.id]),/permission denied/i);
  await db.exec("set request.jwt.claim.sub='"+B+"';");
  assert.equal((await db.query('select * from tc_cost_forecast_snapshots')).rows.length,0);
  await save(wB,'offer',80000,100000,null,null,[],null);
  assert.equal((await db.query('select * from tc_cost_forecast_snapshots')).rows.length,1);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from tc_cost_forecast_snapshots'),/permission denied/i);
  console.log('PASS: immutable per-owner EAC, approved BAC with full activity allocation, RLS and invalid-entry guards');
 }finally{await db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
