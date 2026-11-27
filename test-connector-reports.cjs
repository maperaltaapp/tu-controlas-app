// Exercise the actual connector methods against owner-scoped Postgres.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const {ReportTools}=await import('./connector/report-tools.mjs'),db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const file of ['tasks-schema.sql','native-schema.sql','subcontractor-controls.sql','planning-schema.sql','gantt-v2-schema.sql','gantt-task-progress.sql','gantt-hierarchy-schema.sql','gantt-remove-activity.sql','gantt-contract-schema.sql','gantt-working-calendar.sql','gantt-shared-holidays.sql','gantt-dependencies.sql','followup-schema.sql','daily-report-activities.sql','incidents-schema.sql','connector-report-details.sql'])await db.exec(fs.readFileSync(file,'utf8'));
 const A=randomUUID(),B=randomUUID(),work=randomUUID(),other=randomUUID(),workB=randomUUID();
 await db.query('insert into auth.users values($1,$2),($3,$4)',[A,'a@qa.invalid',B,'b@qa.invalid']);
 await db.query("insert into elite_works(id,user_id,name) values($1,$2,'A'),($3,$2,'A2'),($4,$5,'B')",[work,A,other,workB,B]);
 await db.exec("set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const normalize=row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,['report_date','incident_date'].includes(k)?(v instanceof Date?v.toISOString():String(v)).slice(0,10):v instanceof Date?v.toISOString():v]));
 class Query {
  constructor(table){assert(['elite_works','elite_daily_reports','elite_incidents'].includes(table));this.table=table;this.filters=[];this.orders=[];this.values=[];this.fields='*';this.action='select'}
  select(columns){this.fields=columns;return this}
  eq(key,value){this.values.push(value);this.filters.push(key+'=$'+this.values.length);return this}
  gte(key,value){this.values.push(value);this.filters.push(key+'>=$'+this.values.length);return this}
  lte(key,value){this.values.push(value);this.filters.push(key+'<=$'+this.values.length);return this}
  order(key,{ascending}){this.orders.push(key+(ascending?' asc':' desc'));return this}
  range(start,end){this.bounds=[start,end];return this}
  maybeSingle(){this.one=true;return this}
  single(){this.one=true;return this}
  insert(data){this.action='insert';this.data=data;return this}
  update(data){this.action='update';this.data=data;return this}
  async then(resolve,reject){
   try{
    let sql='select '+this.fields+' from '+this.table;
    if(this.action!=='select'){
     const keys=Object.keys(this.data),args=keys.map(key=>{this.values.push(typeof this.data[key]==='object'&&this.data[key]!==null?JSON.stringify(this.data[key]):this.data[key]);return '$'+this.values.length});
     sql=this.action==='insert'?'insert into '+this.table+'('+keys.join(',')+') values('+args.join(',')+')':'update '+this.table+' set '+keys.map((key,i)=>key+'='+args[i]).join(',');
    }
    if(this.filters.length)sql+=' where '+this.filters.join(' and ');
    if(this.action==='select'){if(this.orders.length)sql+=' order by '+this.orders.join(',');if(this.bounds)sql+=' limit '+(this.bounds[1]-this.bounds[0]+1)+' offset '+this.bounds[0]}
    else sql+=' returning '+this.fields;
    const rows=(await db.query(sql,this.values)).rows.map(normalize);
    resolve({data:this.one?(rows[0]||null):rows,error:null});
   }catch(error){resolve({data:null,error})}
  }
 }
 const client={from:table=>new Query(table),rpc:async(name,a)=>{
  assert.equal(name,'tc_update_report_details');
  try{return {data:(await db.query('select * from tc_update_report_details($1,$2,$3)',[a.target_report,a.expected_updated_at,JSON.stringify(a.changes)])).rows.map(normalize)}}
  catch(error){return {error}}
 }};
 const api=new ReportTools(client),operation_id=randomUUID(),data={operation_id,work_id:work,report_date:'2026-11-27',notes:'Puesta a tierra y aislamiento. 2 operarios.'};
 const first=await api.createReport(data);assert(first.created);assert.equal(first.report.progress_pct,null);assert.deepEqual(first.report.labor,[]);
 assert(!(await api.createReport(data)).created);await assert.rejects(api.createReport({...data,notes:'Otro dato'}),/otros datos/);
 await assert.rejects(api.createReport({...data,operation_id:randomUUID()}),/Ya existe/);
 const edited=await api.updateReport({report_id:operation_id,expected_updated_at:first.report.updated_at,notes:'Notas ampliadas'});
 assert.equal(edited.report.notes,'Notas ampliadas');await assert.rejects(api.updateReport({report_id:operation_id,expected_updated_at:first.report.updated_at,notes:'Obsoleto'}),/cambió/);
 const incident={operation_id:randomUUID(),work_id:work,report_id:operation_id,incident_date:'2026-11-27',description:'Rotura de taladro de piquetas'};
 const saved=await api.createIncident(incident);assert(saved.created);assert(!(await api.createIncident(incident)).created);
 await assert.rejects(api.createIncident({...incident,operation_id:randomUUID(),work_id:other}),/otra obra/);
 const changed=await api.updateIncident({incident_id:incident.operation_id,expected_updated_at:saved.incident.updated_at,status:'doing',followup:'Pieza fabricada'});
 assert.equal(changed.incident.followup,'Pieza fabricada');
 assert.equal((await api.listReports({work_id:work})).reports.length,1);assert.equal((await api.listIncidents({work_id:work,status:'doing'})).incidents.length,1);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
 await assert.rejects(api.getReport({report_id:operation_id}),/no encontrado/);await assert.rejects(api.createReport({...data,operation_id:randomUUID()}),/Obra no encontrada/);
 await assert.rejects(api.getIncident({incident_id:incident.operation_id}),/no encontrado/);
 assert.deepEqual((await api.listReports({})).reports,[]);assert.deepEqual((await api.listIncidents({})).incidents,[]);
 await db.exec('reset role');
 // A version 2 report keeps all its physical activities when notes are changed.
 await db.query("update elite_daily_reports set activities='[]',format_version=1 where id=$1",[operation_id]);
 await db.query("select set_config('elite.daily_report_sync','on',false)");
 const physical=[{activity_id:null,activity_name:'Ensayo',progress_pct:30,workers:2,machines:0,observations:'Medido'}];
 await db.query('update elite_daily_reports set activities=$1,format_version=2 where id=$2',[JSON.stringify(physical),operation_id]);
 await db.query("select set_config('elite.daily_report_sync','',false)");
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const measured=(await api.getReport({report_id:operation_id})).report;
 const update=await api.updateReport({report_id:operation_id,expected_updated_at:measured.updated_at,notes:'Nueva nota'});
 assert.deepEqual(update.report.activities,physical);assert.equal(update.report.format_version,2);
 const setting=(await db.query("select current_setting('elite.daily_report_sync',true) value")).rows[0].value;assert.notEqual(setting,'on');
 await assert.rejects(db.query('select * from tc_update_report_details($1,$2,$3)',[operation_id,update.report.updated_at,JSON.stringify({activities:[]})]),/permitidos/);
 await db.close();console.log('PASS: connector creates, reads and updates daily reports and incidents; idempotent retries, stale revisions, real RLS isolation, report linkage, nullable measurements and preserved version-2 activities.');
})().catch(error=>{console.error(error);process.exitCode=1});
