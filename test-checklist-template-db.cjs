const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',src='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',dst='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema elite_private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table elite_works(id uuid primary key,user_id uuid not null references auth.users(id),name text,archived_at timestamptz,updated_at timestamptz default now(),workspace_layout jsonb,unique(id,user_id));
 alter table elite_works enable row level security;grant select,update on elite_works to authenticated;create policy own on elite_works for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
 create table elite_work_contractors(id uuid primary key,work_id uuid,user_id uuid);
 alter table elite_work_contractors enable row level security;grant select on elite_work_contractors to authenticated;create policy own on elite_work_contractors for select to authenticated using(auth.uid()=user_id);`);
 await db.exec(fs.readFileSync('checklist-schema.sql','utf8'));
 await db.exec("alter table elite_work_checklist_items add column cell_values jsonb;alter table elite_work_checklist_items drop constraint elite_work_checklist_items_section_check;alter table elite_work_checklist_items add check(section in ('prep','providers','execution','close') or section ~ '^custom_[a-f0-9-]{36}$');");
 await db.exec(fs.readFileSync('checklist-template.sql','utf8'));
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 const fmt={sheets:{prep:{columns:[{id:'title',label:'Control'}],widths:{title:190},private_value:'do not copy'},providers:{columns:[{id:'name',label:'Empresa'}]}}};
 await db.query("insert into elite_works(id,user_id,name,workspace_layout) values($1,$2,'A',$3),($4,$2,'Destino',null),($5,$6,'Ajena',null)",[src,a,JSON.stringify(fmt),dst,other,b]);
 await db.query("insert into elite_work_checklist_items(user_id,work_id,section,title,notes,due_date,completed_at,position,cell_values) values($1,$2,'prep','Segundo','privado','2026-11-26',now(),2,'{\"x\":\"privado\"}'),($1,$2,'prep','Primero','privado',null,null,1,null)",[a,src]);
 await db.query("insert into elite_work_contractors values(gen_random_uuid(),$1,$2)",[src,a]);
 await db.exec("set role authenticated;set request.jwt.claim.sub='"+a+"'");
 const stamp=async()=>(await db.query('select updated_at::text t from elite_works where id=$1',[dst])).rows[0].t;
 const call=async(s,ss,t,ts,expected)=>(await db.query('select tc_copy_checklist_template($1,$2,$3,$4,$5) result',[s,ss,t,ts,expected])).rows[0].result;
 const version=await stamp();
 await assert.rejects(call(other,'prep',dst,'prep',version),/Plantilla no disponible/);
 await assert.rejects(call(src,'prep',other,'prep',version),/destino cambió/);
 await assert.rejects(call(src,'prep',dst,'prep','2000-01-01'),/destino cambió/);
 const copy=await call(src,'prep',dst,'prep',version);
 assert.deepEqual(copy.rows.map(r=>r.title),['Primero','Segundo']);assert(copy.rows.every(r=>r.notes===''&&r.due_date===null&&r.completed_at===null&&r.cell_values===null&&r.work_id===dst));
 assert.equal(copy.work.workspace_layout.sheets.prep.columns[0].label,'Control');assert.equal(copy.work.workspace_layout.sheets.prep.private_value,undefined);
 await assert.rejects(call(src,'prep',dst,'prep',await stamp()),/ya contiene filas/);
 const another=await call(src,'prep',dst,null,await stamp());assert.match(another.section,/^custom_/);assert.equal(another.rows.length,2);
 const providers=await call(src,'providers',dst,'providers',await stamp());assert.equal(providers.rows.length,0);assert.equal(providers.work.workspace_layout.sheets.providers.columns[0].label,'Empresa');
 assert.equal((await db.query('select count(*)::int n from elite_work_contractors where work_id=$1',[dst])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from elite_work_checklist_items where work_id=$1",[src])).rows[0].n,2);
 await db.exec("set request.jwt.claim.sub='"+b+"'");await assert.rejects(call(src,'prep',other,'prep',version),/Plantilla no disponible/);
 await db.exec('reset role;set role anon');await assert.rejects(call(src,'prep',dst,'prep',version),/permission denied/);
 console.log('PASS: checklist template atomic copy, stripped operational values, independent destination, provider layout only, owner isolation');
 }finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
