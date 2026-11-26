/* V4 recovery test against the deployed-function-based source in an isolated PG fixture.
   This test never contacts a customer Supabase database. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const V4=require('./client-backup-v4.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const WA='33333333-3333-4333-8333-333333333333',WB='44444444-4444-4444-8444-444444444444';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema elite_private;create table auth.users(id uuid primary key);");
  await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
  await db.query("insert into auth.users(id) values($1),($2)",[A,B]);
  await db.exec("create table elite_private.tc_restore_context_v3(txid bigint not null,backend_pid integer not null,user_id uuid not null,created_at timestamptz not null default now(),primary key(txid,backend_pid,user_id));revoke all on elite_private.tc_restore_context_v3 from public,anon,authenticated;");
  await db.exec("create table elite_works(id uuid primary key,user_id uuid not null references auth.users(id),name text,unique(id,user_id));create table elite_work_plans(work_id uuid primary key,user_id uuid not null references auth.users(id),phases jsonb not null,baseline jsonb not null,baseline_at timestamptz);");
  for(const name of ['elite_works','elite_work_plans'])await db.exec('alter table '+name+' enable row level security; grant select on '+name+' to authenticated;create policy owner_read on '+name+' for select to authenticated using(auth.uid()=user_id);');
  const ids=new Set(['elite_works','elite_work_plans','tc_cost_forecast_snapshots']);
  const numeric=new Set(['elite_history','elite_plan_versions','elite_ai_learning_history','elite_ai_correction_history']);
  for(const [table] of V4.sources){
   if(ids.has(table))continue;
   const id=numeric.has(table)?'id bigint generated always as identity primary key':'id text primary key';
   await db.exec('create table public."'+table+'"('+id+',user_id uuid not null references auth.users(id),work_id text,group_key text,name text,amount numeric);alter table public."'+table+'" enable row level security;grant select,insert,update,delete on public."'+table+'" to authenticated;create policy owner on public."'+table+'" to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);');
  }
  await db.exec(fs.readFileSync('tc-cost-forecast-schema.sql','utf8'));
  await db.exec(fs.readFileSync('tc-indirect-k-schema.sql','utf8'));
  await db.query("insert into elite_works(id,user_id,name) values($1,$2,'A'),($3,$4,'B')",[WA,A,WB,B]);
  const start=[{id:'p1',start:'2026-11-01',end:'2026-11-10',weight:40},{id:'p2',start:'2026-11-01',end:'2026-11-10',weight:60}];
  await db.query("insert into elite_work_plans(work_id,user_id,phases,baseline,baseline_at) values($1,$2,$3::jsonb,$3::jsonb,now()),($4,$5,$3::jsonb,$3::jsonb,now())",[WA,A,JSON.stringify(start),WB,B]);
  const add=async(work,owner,kind,amount,revenue,actual,remaining,lines,reference)=>db.query(
   'insert into tc_cost_forecast_snapshots(work_id,user_id,snapshot_type,as_of,total_cost,forecast_revenue,actual_cost,remaining_cost,activity_costs,approval_reference) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) returning id',
   [work,owner,kind,'2026-11-26',amount,revenue,actual,remaining,JSON.stringify(lines||[]),reference]);
  await add(WA,A,'offer',120000,150000,null,null,[],null);
  await add(WA,A,'pm_initial',125000,150000,null,null,[],null);
  await add(WA,A,'baseline',125000,null,null,null,[{activity_id:'p1',amount:50000},{activity_id:'p2',amount:75000}],'Acta');
  await add(WA,A,'forecast',127000,150000,54000,73000,[],null);
  await db.query("insert into tc_cost_forecast_snapshots(work_id,user_id,snapshot_type,as_of,total_cost,k_indirect_pct) values($1,$2,'k_setting','2026-11-26',0,7.5)",[WA,A]);
  await add(WB,B,'offer',90000,120000,null,null,[],null);
  // A historical BAC can refer to activities removed from the current Gantt.
  const changed=[{id:'p3',start:'2026-11-03',end:'2026-11-12',weight:50},{id:'p4',start:'2026-11-13',end:'2026-11-22',weight:50}];
  await db.query("update elite_work_plans set phases=$2::jsonb where work_id=$1",[WA,JSON.stringify(changed)]);
  await db.query("insert into elite_tasks(id,user_id,work_id,name) values('task-A',$1,$2,'Tarea A'),('task-B',$3,$4,'Tarea B')",[A,WA,B,WB]);
  const snapshot={format:'tu-controlas-structured-export',version:4,owner_id:A,counts:{},tables:{}};
  for(const [table] of V4.sources){const rows=(await db.query('select coalesce(jsonb_agg(to_jsonb(t)),\'[]\'::jsonb) items from public."'+table+'" t where t.user_id=$1',[A])).rows[0].items;snapshot.tables[table]=rows;snapshot.counts[table]=rows.length}
  assert.equal(V4.check(snapshot,A),8,'work+plan+task+5 economic versions');
  // Empty only customer A; keep B to prove isolation.
  for(const [table] of [...V4.sources].reverse())await db.query('delete from public."'+table+'" where user_id=$1',[A]);
  const otherBefore=(await db.query('select count(*)::int n from tc_cost_forecast_snapshots where user_id=$1',[B])).rows[0].n;
  // This is the deployed V3 function adapted only to V4, with explicit EXECUTE
  // granted exclusively in this isolated test database.
  const sql=fs.readFileSync('restore-empty-owner-v4-scoped.sql','utf8')+'\ngrant execute on function public.tc_restore_empty_owner_v4(jsonb) to authenticated;';
  await db.exec(sql);
  // Production compat patch includes source-definition hash guard. In this
  // isolated fixture the function has a different pg_get_functiondef format;
  // strip only the guard, keep the full replacement and exact value checks.
  const compat=fs.readFileSync('tc-indirect-k-restore-compat.sql','utf8').replace(/do \$tc_audit\$[\s\S]*?end \$tc_audit\$;/,'');
  await db.exec(compat);
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  const recover=data=>db.query('select public.tc_restore_empty_owner_v4($1::jsonb) result',[JSON.stringify(data)]);
  const result=(await recover(snapshot)).rows[0].result;
  assert.equal(result.restored,true);assert.equal(result.records,8);assert.equal(result.tables,23);
  const aRows=(await db.query("select snapshot_type,total_cost from tc_cost_forecast_snapshots where user_id=$1 order by snapshot_type",[A])).rows;
  assert.equal(aRows.length,5);assert.equal(aRows.find(r=>r.snapshot_type==='forecast').total_cost,'127000.00');
  assert.equal((await db.query("select k_indirect_pct from tc_cost_forecast_snapshots where snapshot_type='k_setting'")).rows[0].k_indirect_pct,'7.500');
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from tc_cost_forecast_snapshots where user_id=$1',[B])).rows[0].n,otherBefore,'Other client survives recovery');
  assert.equal((await db.query('select count(*)::int n from elite_private.tc_restore_context_v3')).rows[0].n,0,'Restore context was removed');
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  await assert.rejects(recover(snapshot),/ya tiene información/i,'Nonempty owners must not be overwritten');
  // A pre-K V4 backup lacks both optional columns and contains no K row.
  await db.exec('reset role');
  const legacy=structuredClone(snapshot);
  legacy.tables.tc_cost_forecast_snapshots=legacy.tables.tc_cost_forecast_snapshots.filter(x=>x.snapshot_type!=='k_setting').map(row=>{
   delete row.k_indirect_pct;delete row.cost_includes_indirect;return row
  });
  legacy.counts.tc_cost_forecast_snapshots=legacy.tables.tc_cost_forecast_snapshots.length;
  assert.equal(V4.check(legacy,A),7);
  for(const [table] of [...V4.sources].reverse())await db.query('delete from public."'+table+'" where user_id=$1',[A]);
  await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
  const oldRestored=(await recover(legacy)).rows[0].result;
  assert.equal(oldRestored.restored,true);assert.equal(oldRestored.records,7);
  const oldRows=(await db.query("select k_indirect_pct from tc_cost_forecast_snapshots where user_id=$1",[A])).rows;
  assert.equal(oldRows.length,4);assert(oldRows.every(x=>x.k_indirect_pct===null));
  await assert.rejects(recover(legacy),/ya tiene información/i);
  await db.exec("set request.jwt.claim.sub='"+B+"';");
  await assert.rejects(recover(snapshot),/otra cuenta/i,'Cannot import another owner');
  await db.exec('reset role;set role anon');
  await assert.rejects(recover(snapshot),/permission denied/i,'Anonymous role cannot invoke restore');
  await db.exec('reset role');
  console.log('PASS: V4 restores versioned K forecasts and pre-K V4 archives exactly, historical BAC, rollback, and tenant B remains intact');
 }finally{await db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
