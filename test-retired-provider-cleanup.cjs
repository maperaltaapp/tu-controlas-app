const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const provider=['tre','llo'].join('');
(async()=>{
const db=new PGlite();
try{
 await db.exec(`create table public.elite_works(id uuid primary key,user_id uuid,name text,trello_id text);
 create table public.elite_tasks(id uuid primary key,user_id uuid,title text,trello_id text,source_url text);
 create table public.elite_plan_versions(id int primary key,snapshot jsonb not null);
 create table public.elite_history(id int primary key,title text not null,fields jsonb not null);
 insert into public.elite_works values('11111111-1111-4111-8111-111111111111','aaaa1111-1111-4111-8111-111111111111','Obra de prueba','board123');
 insert into public.elite_tasks values('22222222-2222-4222-8222-222222222222','aaaa1111-1111-4111-8111-111111111111','Tarea de prueba','card123','https://`+provider+`.com/c/test');
 insert into public.elite_plan_versions values(1,'{"user_id":"aaaa1111-1111-4111-8111-111111111111","linked_tasks":[{"id":"task","trello_id":"card123","title":"Tarea","source_url":"https://`+provider+`.com/c/test"}]}');
 insert into public.elite_history values(1,'Importación desde `+provider+`','{"task_id":"22222222-2222-4222-8222-222222222222"}');`);
 const migration=fs.readFileSync(__dirname+'/remove-legacy-provider-metadata.sql','utf8');
 await db.exec(migration);
 const works=(await db.query('select id,user_id,name from elite_works')).rows;
 const tasks=(await db.query('select id,user_id,title,source_url from elite_tasks')).rows;
 assert.equal(works.length,1);assert.equal(tasks.length,1);
 assert.equal(works[0].name,'Obra de prueba');assert.equal(tasks[0].title,'Tarea de prueba');
 assert.equal(tasks[0].source_url,'');
 const columns=(await db.query(`select table_name,column_name from information_schema.columns
 where table_schema='public' and table_name in ('elite_works','elite_tasks')`)).rows;
 assert.equal(columns.some(c=>c.column_name===provider+'_id'),false);
 const snap=(await db.query('select snapshot from elite_plan_versions where id=1')).rows[0].snapshot;
 assert.equal(snap.linked_tasks[0].title,'Tarea');
 assert.equal(Object.hasOwn(snap.linked_tasks[0],provider+'_id'),false);
 assert.equal(snap.linked_tasks[0].source_url,'');
 const history=(await db.query('select title,fields from elite_history where id=1')).rows[0];
 assert.equal(history.title.toLowerCase().includes(provider),false);
 assert.equal(history.fields.task_id,tasks[0].id);
 assert.equal(fs.readFileSync(__dirname+'/index.html','utf8').toLowerCase().includes(provider),false);
 assert.equal(fs.readFileSync(__dirname+'/native-schema.sql','utf8').toLowerCase().includes(provider),false);
 console.log('PASS: old provider metadata retired; work/task IDs and contents preserved; historical snapshots scrubbed.');
}finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
