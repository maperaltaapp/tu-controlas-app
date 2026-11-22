const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./client-export.js'),P=require('./client-backup-preview.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const asFile=text=>({size:Buffer.byteLength(text),text:async()=>text});
(async()=>{
 const work='44444444-4444-4444-8444-444444444444';
 const out=await E.build({userId:A,time:()=>new Date('2026-11-22T15:00:00Z'),read:async name=>[
  {id:name==='elite_works'?work:'fixture-'+name,work_id:name==='elite_works'?null:work,user_id:A,group_key:'next'}
 ]});
 const before=out.json,read=asFile(before);
 const preview=await P.inspect({file:read,userId:A});
 assert.equal(preview.valid,true);
 assert.equal(preview.owner_id,A);
 assert.equal(preview.version,2);
 assert.equal(preview.table_count,16);
 assert.equal(preview.records,16);
 assert.deepEqual(preview.warnings,[]);
 assert.equal(preview.restoration_supported,false);
 assert.equal(out.json,before,'Inspect must not mutate file or archive');
 assert.match(preview.message,/No se han restaurado ni subido datos/);
 await assert.rejects(P.inspect({file:read,userId:B}),/otra cuenta/);
 await assert.rejects(P.inspect({file:asFile('not a JSON'),userId:A}),/JSON válido/);
 const corrupted=JSON.parse(before);corrupted.tables.elite_tasks[0].group_key='modified';
 await assert.rejects(P.inspect({file:asFile(JSON.stringify(corrupted)),userId:A}),/modificados o dañados/);
 await assert.rejects(P.inspect({file:{size:70*1024*1024,text:async()=>{throw Error('must not read')}},userId:A}),/demasiado grande/);
 await assert.rejects(P.inspect({file:{size:2,text:async()=>'{'},userId:A}),/JSON válido/);
 await assert.rejects(P.inspect({file:null,userId:A}),/Selecciona un archivo/);
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 assert.ok(html.includes('src="client-backup-preview.js"'));
 assert.ok(html.includes('id="backupCheckInput"'));
 assert.ok(html.includes('TCBackupPreview.inspect({file,userId:owner})'));
 assert.ok(!fs.readFileSync(__dirname+'/client-backup-preview.js','utf8').includes('/rest/v1/'));
 console.log('PASS: local-only archive inspect, integrity verification, foreign-account denial, malformed/oversized safety, no restore.');
})().catch(e=>{console.error(e);process.exitCode=1});
