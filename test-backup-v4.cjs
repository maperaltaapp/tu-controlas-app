const assert=require('node:assert/strict');
const V3=require('./client-backup-v3.js'),V4=require('./client-backup-v4.js'),Preview=require('./client-backup-preview.js'),Preflight=require('./client-restore-preflight.js');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',work='33333333-3333-4333-8333-333333333333';
const mock=(api)=>{const payload={owner_id:A,exported_at:'2026-11-26T20:00:00.000Z',counts:{},tables:{}};for(const [table] of api.sources){payload.tables[table]=[];payload.counts[table]=0}
payload.tables.elite_works=[{id:work,user_id:A,name:'Obra de prueba'}];payload.counts.elite_works=1;
if(api===V4){payload.tables.tc_cost_forecast_snapshots=[
 {id:'44444444-4444-4444-8444-444444444444',user_id:A,work_id:work,snapshot_type:'offer',total_cost:120000,forecast_revenue:150000,as_of:'2026-11-01'},
 {id:'55555555-5555-4555-8555-555555555555',user_id:A,work_id:work,snapshot_type:'forecast',total_cost:127000,actual_cost:54000,remaining_cost:73000,forecast_revenue:150000,as_of:'2026-11-26'}
];payload.counts.tc_cost_forecast_snapshots=2}
return payload};
(async()=>{
 assert.equal(V3.sources.length,22);assert.equal(V4.sources.length,23);
 assert.equal(new Set(V4.sources.map(x=>x[0])).size,23);
 assert(V4.sources.some(x=>x[0]==='tc_cost_forecast_snapshots'));
 const file=await V4.build({userId:A,read:async()=>mock(V4)});
 assert.equal(file.snapshot.version,4);assert.equal(file.records,3);assert.equal(await V4.verify(file.snapshot,A),true);
 assert.equal(file.snapshot.tables.tc_cost_forecast_snapshots.length,2);
 const archiveFile={size:Buffer.byteLength(file.json),text:async()=>file.json};
 const preview=await Preview.inspect({file:archiveFile,userId:A,exportApi:V4});
 assert.equal(preview.table_count,23);assert.equal(preview.records,3);assert.equal(preview.references_consistent,true);
 const empty=await Preflight.inspect({file:archiveFile,userId:A,exportApi:V4,read:async()=>[]});
 assert.equal(empty.can_restore_now,true);assert.equal(empty.table_count,23);
 const pending=await Preflight.inspect({file:archiveFile,userId:A,exportApi:V4,read:async(table)=>table==='tc_cost_forecast_snapshots'?[{user_id:A}]:[]});
 assert.equal(pending.can_restore_now,false);assert.equal(pending.destination_empty,false);
 await assert.rejects(V4.verify(file.snapshot,B),/otra cuenta/);
 const tampered=JSON.parse(file.json);tampered.tables.tc_cost_forecast_snapshots[1].total_cost=200000;
 await assert.rejects(V4.verify(tampered,A),/dañado/);
 const fromB=JSON.parse(JSON.stringify(mock(V4)));fromB.tables.tc_cost_forecast_snapshots[0].user_id=B;
 await assert.rejects(V4.build({userId:A,read:async()=>fromB}),/otra cuenta/);
 const legacy=await V3.build({userId:A,read:async()=>mock(V3)});
 const oldFile={size:Buffer.byteLength(legacy.json),text:async()=>legacy.json};
 assert.equal((await Preflight.inspect({file:oldFile,userId:A,exportApi:V3,read:async()=>[]})).can_restore_now,true,'Existing V3 remains recoverable for an empty account');
 assert.equal((await Preflight.inspect({file:oldFile,userId:A,exportApi:V3,read:async(t)=>t==='tc_cost_forecast_snapshots'?[{user_id:A}]:[]})).can_restore_now,false,'V3 cannot accidentally overwrite new economic records');
 console.log('PASS: V4 exports 23 tables including PM forecasts, owner-bound SHA, tamper detection and V3 compatibility.');
})().catch(err=>{console.error(err);process.exitCode=1});
