// Pure in-memory fixtures: no real accounts, network access or database writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),TCExport=require('./client-export.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
(async()=>{
 assert.equal(TCExport.sources.length,21,'Export must include all 21 non-push owner-readable tables');
 assert.equal(new Set(TCExport.sources.map(([name])=>name)).size,21);
 assert.ok(TCExport.sources.every(([name])=>!name.includes('push')),'Push endpoints/auth must never enter export');
 let seen=[],reads=0,active=true;
 const reader=async(name,query)=>{seen.push([name,query]);reads++;return[{id:'fixture-'+name,user_id:A,work_id:'fixture',description:'Datos de prueba'}]};
 const result=await TCExport.build({userId:A,read:reader,guard:()=>{if(!active)throw Error('Sesión cambiada')},time:()=>new Date('2026-11-22T12:00:00.000Z')});
 assert.equal(result.filename,'tu-controlas-datos-2026-11-22.json');
 assert.equal(result.snapshot.owner_id,A);
 assert.equal(result.snapshot.restoration_supported,false);
 assert.equal(Object.values(result.snapshot.counts).reduce((sum,n)=>sum+n,0),21);
 assert.equal(seen.length,21);
 assert.ok(seen.every(([,query])=>query.startsWith('user_id=eq.'+A+'&order=')));
 assert.ok(seen.some(([name,query])=>name==='elite_task_orders'&&query.includes('user_id.asc,group_key.asc')));
 assert.equal(result.snapshot.tables.elite_works.length,1);
 assert.ok(!result.json.includes('refresh_token')&&!result.json.includes('access_token'),'Archive must not contain credentials');
 assert.ok(!result.json.includes('elite_push_subscriptions'));
 TCExport.check(result.snapshot,A);
 assert.throws(()=>TCExport.check(result.snapshot,B),/otra cuenta/);
 const tampered=JSON.parse(result.json);tampered.tables.elite_tasks[0].user_id=B;
 assert.throws(()=>TCExport.check(tampered,A),/otro propietario/);
 const missing=JSON.parse(result.json);delete missing.tables.elite_works;
 assert.throws(()=>TCExport.check(missing,A),/Faltan registros/);
 const mismatch=JSON.parse(result.json);mismatch.counts.elite_tasks=100;
 assert.throws(()=>TCExport.check(mismatch,A),/Faltan registros/);
 // Reject cross-tenant responses immediately; don't attempt any download.
 await assert.rejects(TCExport.build({userId:A,read:async name=>[{id:name,user_id:name==='elite_tasks'?B:A}],guard:()=>{}}),/otra cuenta/);
 // A logout before readback is finished prevents any further query or export.
 let guards=0;
 await assert.rejects(TCExport.build({userId:A,read:async()=>[],guard:()=>{guards++;if(guards===3)throw Error('Sesión cambiada')}}),/Sesión cambiada/);
 assert.equal(guards,3);
 const fixtures={blobs:[],links:[],revoked:[]};
 class FakeBlob{constructor(content,props){fixtures.blobs.push([content,props])}}
 const elem={style:{},remove(){},click(){this.clicked=true}};
 const doc={createElement(name){assert.equal(name,'a');fixtures.links.push(elem);return elem},body:{appendChild(el){assert.equal(el,elem)}}};
 const url={createObjectURL(){return 'blob:fixture-only'},revokeObjectURL(u){fixtures.revoked.push(u)}};
 TCExport.download(result,{doc,webUrl:url,BlobType:FakeBlob});
 assert.equal(elem.download,result.filename);assert.equal(elem.href,'blob:fixture-only');
 assert.equal(elem.clicked,true);
 assert.equal(fixtures.blobs[0][0][0],result.json);
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 assert.ok(html.includes('src="client-export.js"'));
 assert.ok(html.includes('id="exportClientData" onclick="exportOwnData()"'));
 assert.ok(html.includes('const owner=session.user.id,epoch=sessionEpoch'));
 assert.ok(html.includes('readAll(table,query)'));
 assert.ok(html.includes('guard();\n  TCExport.download(result);'));
 assert.ok(!html.includes('localStorage.setItem(\'elite_session\''),'Must not modify legacy sessions');
 console.log('PASS: 21 owner-scoped tables, no credentials/push, foreign-owner denial, logout guard, complete archive validation and browser download.');
})().catch(e=>{console.error(e);process.exitCode=1});
