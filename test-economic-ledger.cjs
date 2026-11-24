// RLS and economic ledger: fictitious accounts in isolated local PostgreSQL/PGlite.
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',phase='33333333-3333-4333-8333-333333333333',foreign='44444444-4444-4444-8444-444444444444';
(async()=>{
 const db=new PGlite();
 try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const name of ['tasks-schema.sql','native-schema.sql','subcontractor-controls.sql','planning-schema.sql','gantt-v2-schema.sql','gantt-task-progress.sql','gantt-hierarchy-schema.sql','gantt-remove-activity.sql','gantt-contract-schema.sql','gantt-working-calendar.sql','gantt-shared-holidays.sql','gantt-dependencies.sql','followup-schema.sql'])await db.exec(fs.readFileSync(name,'utf8'));
 await db.exec(fs.readFileSync('economic-entries-schema.sql','utf8'));
 await db.exec(fs.readFileSync('economic-entries-schema.sql','utf8'));
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[A,'a@example.invalid',B,'b@example.invalid']);
 const wA=(await db.query("insert into elite_works(user_id,name) values($1,'Obra A de prueba') returning id",[A])).rows[0].id;
 const wB=(await db.query("insert into elite_works(user_id,name) values($1,'Obra B de prueba') returning id",[B])).rows[0].id;
 const leaf=(id)=>[{id,name:'Partida ficticia',level:1,start:'2026-11-01',end:'2026-12-01',weight:100,depends_on:[],observations:[],economic_observations:[],budget:null,activity_status:'pending'}];
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+A+"';");
 await db.query("select * from elite_save_gantt($1,$2,0,false,false,'')",[wA,JSON.stringify(leaf(phase))]);
 await db.exec("set request.jwt.claim.sub='"+B+"';");
 await db.query("select * from elite_save_gantt($1,$2,0,false,false,'')",[wB,JSON.stringify(leaf(foreign))]);
 await db.exec("set request.jwt.claim.sub='"+A+"';");
 const insert=(work,activity,kind,amount,name,line,owner)=>db.query("insert into elite_work_economic_entries(work_id,activity_id,kind,amount,entry_date,source_name,source_line"+(owner?',user_id':'')+") values($1,$2,$3,$4,'2026-11-24',$5,$6"+(owner?',$7':'')+") returning *",[work,activity,kind,amount,name,line,...(owner?[owner]:[])]);
 const cost=(await insert(wA,phase,'budget',36000,'Presupuesto.xlsx','2')).rows[0];
 assert.equal(cost.user_id,A);assert.equal(cost.amount,'36000.00');
 const actual=(await insert(wA,phase,'actual',28000,'Facturas.csv','2')).rows[0];
 assert.equal(actual.amount,'28000.00');
 await assert.rejects(insert(wA,phase,'budget',36000,'Presupuesto.xlsx','2'),/duplicate|unique/i,'Reimport should not duplicate the same row');
 await assert.rejects(insert(wA,foreign,'actual',100,'Ajena.pdf','3'),/no pertenece|partida económica/i);
 await assert.rejects(insert(wB,foreign,'budget',100,'Ajena.pdf','4'),/foreign key|row-level/i);
 await assert.rejects(insert(wA,phase,'actual',50,'Suplantación','5',B),/row-level|foreign key/i);
 await assert.rejects(insert(wA,null,'actual',50,'Sin partida','6'),/check constraint/i);
 await assert.rejects(insert(wA,phase,'actual',-100,'Negativo','7'),/check constraint/i);
 const contract=(await insert(wA,null,'contract',85000,'Contrato','1')).rows[0];
 assert.equal(contract.activity_id,null);
 const before=(await db.query('select count(*)::int n from elite_work_economic_entries')).rows[0].n;assert.equal(before,3);
 await db.exec("set request.jwt.claim.sub='"+B+"';");
 assert.equal((await db.query('select * from elite_work_economic_entries')).rows.length,0);
 assert.equal((await db.query('update elite_work_economic_entries set amount=1 where id=$1 returning id',[actual.id])).rows.length,0);
 await assert.rejects(db.query('delete from elite_work_economic_entries where id=$1',[actual.id]),/permission denied/i);
 await db.exec("reset role");
 assert.equal((await db.query('select count(*)::int n from elite_work_economic_entries')).rows[0].n,before);
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.elite_work_economic_entries'::regclass")).rows[0].relrowsecurity,true);
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from elite_work_economic_entries'),/permission denied/i);
 console.log('PASS: isolated economic ledger, duplicate import rejection, phase-work validation, RLS and no record deletion');
 }finally{await db.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
