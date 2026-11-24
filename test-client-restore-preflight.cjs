const assert=require('node:assert/strict'),fs=require('node:fs');
const Export=require('./client-export.js'),Pre=require('./client-backup-preview.js'),Rest=require('./client-restore-preflight.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const W='33333333-3333-4333-8333-333333333333';
const fake=(json)=>({size:Buffer.byteLength(json),text:async()=>json});
(async()=>{
 const base={elite_works:[{id:W,user_id:A,name:'Ficticia'}],elite_tasks:[{id:'44444444-4444-4444-8444-444444444444',user_id:A,work_id:W,title:'Prueba'}]};
 const build=await Export.build({userId:A,read:async name=>base[name]||[]});
 const call=[];
 const read=async(table,q)=>{call.push([table,q]);return[]};
 const preview=await Rest.inspect({file:fake(build.json),userId:A,read});
 assert.equal(preview.valid_archive,true);
 assert.equal(preview.records,2);assert.equal(preview.table_count,16);
 assert.equal(preview.consistency_ok,true);assert.equal(preview.destination_empty,true);
 assert.equal(preview.restoration_supported,false);assert.equal(preview.can_restore_now,false);
 assert.equal(preview.blocked_reasons.length,1);
 assert.equal(call.length,19);
 assert(call.every(([t,q])=>q==='user_id=eq.'+A+'&select=user_id&limit=1'));
 assert.equal(call.filter(x=>x[0]==='elite_work_economic_entries').length,1);
 assert.deepEqual([...Rest.tableOrder].sort(),Export.sources.map(x=>x[0]).sort());
 const owned=await Rest.inspect({file:fake(build.json),userId:A,read:async(table,q)=>table==='elite_works'?[{user_id:A}]:[]});
 assert.equal(owned.destination_empty,false);assert.equal(owned.existing_table_count,1);
 assert(owned.blocked_reasons.some(x=>x.includes('ya contiene datos')));
 await assert.rejects(Rest.inspect({file:fake(build.json),userId:B,read:async()=>{throw Error('must not read')} }),/otra cuenta/);
 await assert.rejects(Rest.inspect({file:fake(build.json),userId:A,read:async()=>[{user_id:B}]}),/otro propietario/);
 await assert.rejects(Rest.inspect({file:{size:65*1024*1024,text:async()=>{throw Error('must not read')}},userId:A,read:async()=>[]}),/demasiado grande/);
 const corrupted=JSON.parse(build.json);corrupted.tables.elite_tasks[0].title='cambio';
 await assert.rejects(Rest.inspect({file:fake(JSON.stringify(corrupted)),userId:A,read:async()=>[]}),/modificados o dañados/);
 const damaged={elite_works:[{id:W,user_id:A}],elite_tasks:[{id:'55555555-5555-4555-8555-555555555555',work_id:'66666666-6666-4666-8666-666666666666',user_id:A}]};
 const invalid=await Export.build({userId:A,read:async t=>damaged[t]||[]});
 const bad=await Rest.inspect({file:fake(invalid.json),userId:A,read:async()=>[]});
 assert.equal(bad.consistency_ok,false);assert(bad.blocked_reasons.some(x=>x.includes('inconsistentes')));
 let checks=0;
 await assert.rejects(Rest.inspect({file:fake(build.json),userId:A,read:async()=>[],guard:()=>{if(++checks===4)throw Error('Cuenta cambiada')}}),/Cuenta cambiada/);
 // V3 supports guarded recovery ONLY if the owner has no server data.
 const V3=require('./client-backup-v3.js');
 const rows3={};
 for(const [name] of V3.sources)rows3[name]=[];
 rows3.elite_works=[{id:W,user_id:A,name:'Obra ficticia'}];
 const full=await V3.build({userId:A,read:async()=>({
   owner_id:A,exported_at:'2026-11-24T18:00:00Z',
   tables:rows3,counts:Object.fromEntries(Object.keys(rows3).map(k=>[k,rows3[k].length]))
 })});
 const valid3=await Rest.inspect({file:fake(full.json),userId:A,exportApi:V3,read:async()=>[]});
 assert.equal(valid3.can_restore_now,true);assert.equal(valid3.restoration_supported,true);
 assert.equal(valid3.table_count,22);
 assert.equal(valid3.blocked_reasons.length,0);
 const occupied3=await Rest.inspect({file:fake(full.json),userId:A,exportApi:V3,
  read:async table=>table==='elite_work_economic_entries'?[{user_id:A}]:[]});
 assert.equal(occupied3.can_restore_now,false);
 assert(occupied3.blocked_reasons.some(x=>x.includes('ya contiene datos')));
 const code=fs.readFileSync('client-restore-preflight.js','utf8');
 assert.doesNotMatch(code,/fetch\(|\.insert\(|\.update\(|\.delete\(|eliteRequest\(|\/rest\/v1\//);
 assert(!code.includes('service_role'));
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/src="client-restore-preflight.js"/);
 assert.match(html,/Simular recuperación/);
 assert.match(html,/TCRestorePreflight\.inspect/);
 assert.match(html,/No se han restaurado/);
 assert.match(html,/id="restoreApplyInput"/);
 assert.match(html,/function restoreOwnDataFile\(/);
 assert.match(html,/check\.can_restore_now/);
 assert.match(html,/TCBackupV3\.verify\(archive,owner\)/);
 assert.match(html,/tc_restore_empty_owner_v3/);
 assert.match(html,/window\.prompt\('Para recuperar la copia, escribí exactamente RESTAURAR/);
 assert.match(html,/response\.owner_id!==owner/);
 console.log('PASS: dry-run preflight requires owner-signed archive, SHA, consistent references and empty owner account; no mutations or tenant writes');
})().catch(e=>{console.error(e);process.exitCode=1});
