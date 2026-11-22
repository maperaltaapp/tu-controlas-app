const assert=require('node:assert/strict'),fs=require('node:fs'),TCExport=require('./client-export.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const fixedTime=new Date('2026-11-22T12:00:00.000Z');
(async()=>{
 assert.equal(TCExport.sources.length,16,'Only core work-related owner tables may be exported');
 const sources=TCExport.sources.map(([name])=>name);
 assert.equal(new Set(sources).size,16);
 assert.ok(sources.every(t=>!t.includes('push')&&!t.startsWith('elite_ai_')));
 const readLog=[];
 const read=async(name,query)=>{readLog.push([name,query]);return[{id:'fixture-'+name,user_id:A,work_id:'fixture',description:'Información técnica privada 🔒'}]};
 const result=await TCExport.build({userId:A,read,time:()=>fixedTime});
 assert.equal(result.filename,'tu-controlas-datos-2026-11-22.json');
 assert.equal(result.snapshot.version,2);
 assert.equal(result.snapshot.restoration_supported,false);
 assert.equal(result.snapshot.owner_id,A);
 assert.equal(result.snapshot.integrity.algorithm,'SHA-256');
 assert.match(result.snapshot.integrity.sha256,/^[0-9a-f]{64}$/);
 assert.equal(Object.values(result.snapshot.counts).reduce((a,b)=>a+b,0),16);
 assert.deepEqual(readLog.map(x=>x[0]),sources);
 assert.ok(readLog.every(([,q])=>q.startsWith('user_id=eq.'+A+'&order=')));
 assert.ok(readLog.some(([name,q])=>name==='elite_task_orders'&&q.includes('user_id.asc,group_key.asc')));
 assert.ok(!result.json.includes('"access_token"')&&!result.json.includes('"refresh_token"'));
 assert.ok(!result.json.includes('elite_ai_learnings')&&!result.json.includes('elite_push_subscriptions'));
 assert.equal(await TCExport.verify(result.snapshot,A),true);
 const invalidOwner=JSON.parse(result.json);invalidOwner.tables.elite_tasks[0].user_id=B;
 assert.throws(()=>TCExport.check(invalidOwner,A),/otro propietario/);
 const invalidCount=JSON.parse(result.json);invalidCount.counts.elite_tasks=5;
 assert.throws(()=>TCExport.check(invalidCount,A),/Faltan registros/);
 const hiddenExtra=JSON.parse(result.json);hiddenExtra.tables.elite_ai_learnings=[];
 assert.throws(()=>TCExport.check(hiddenExtra,A),/tablas/);
 const corrupt=JSON.parse(result.json);corrupt.tables.elite_works[0].description='Modificado';
 await assert.rejects(TCExport.verify(corrupt,A),/modificados o dañados/);
 const removedDigest=JSON.parse(result.json);delete removedDigest.integrity;
 await assert.rejects(TCExport.verify(removedDigest,A),/huella/);
 // A regular SHA digest detects accidental alteration; it is not an authenticity signature.
 await assert.rejects(TCExport.build({userId:A,read:async name=>[{id:name,user_id:name==='elite_works'?B:A}]}),/otra cuenta/);
 await assert.rejects(TCExport.build({userId:A,read:async()=>[{user_id:A,metadata:{refresh_token:'secret-fixture'}}]}),/confidencial/);
 for(const field of ['smtp_password','oauth_refresh_token','client_secret','api_key_backup','authorization_header','private_key','jwt_token']){
  await assert.rejects(TCExport.build({userId:A,read:async()=>[{user_id:A,metadata:{[field]:'test-only'}}]}),/confidencial/);
 }
 let guards=0;
 await assert.rejects(TCExport.build({userId:A,read:async()=>[],guard:()=>{if(++guards===3)throw Error('Sesión cerrada')}}),/Sesión cerrada/);
 assert.equal(guards,3);
 const mocks={created:[],urls:[],revoked:[]};
 class FakeBlob{constructor(parts,opts){mocks.created.push({parts,opts})}}
 const link={style:{},remove(){},click(){this.clicked=true}};
 const doc={createElement(tag){assert.equal(tag,'a');return link},body:{appendChild(target){assert.equal(target,link)}}};
 const url={createObjectURL(){return 'blob:test-export'},revokeObjectURL(u){mocks.revoked.push(u)}};
 TCExport.download(result,{doc,webUrl:url,BlobType:FakeBlob});
 assert.equal(link.download,result.filename);
 assert.equal(link.href,'blob:test-export');
 assert.equal(link.clicked,true);
 assert.equal(mocks.created[0].parts[0],result.json);
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 assert.ok(html.includes('src="client-export.js"'));
 assert.ok(html.includes('id="exportClientData" onclick="exportOwnData()"'));
 const exportHandler=html.slice(html.indexOf('async function exportOwnData()'),html.indexOf('async function inspectBackupFile('));
 assert.ok(exportHandler.includes('window.confirm'),'Sensitive backup must require explicit acknowledgement');
 assert.ok(exportHandler.includes('SIN CIFRAR'),'User must be told the export is not encrypted');
 assert.ok(exportHandler.indexOf('window.confirm')<exportHandler.indexOf('TCExport.build'),'Do not read data if the user cancels');
 assert.ok(html.includes('elimina la copia de Descargas'),'Shared-phone export warning must explain deletion');

 assert.ok(html.includes('const owner=session.user.id,epoch=sessionEpoch'));
 assert.ok(html.includes('readAll(table,query)'));
 assert.ok(html.includes('await TCExport.verify(result.snapshot,owner)'));
 assert.ok(html.includes('active?.user?.id!==owner'));
 assert.ok(!html.includes("localStorage.setItem('elite_session'"));
 console.log('PASS: 16 owner-scoped core tables, SHA-256 integrity, no historical AI/password/push data, session change, download');
})().catch(error=>{console.error(error);process.exitCode=1});
