const assert=require('node:assert/strict'),{create,readSession}=require('./auth-session.js');
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
const old={access_token:'fixture-old',refresh_token:'fixture-refresh',expires_at:1,user:{id:'a'}},fresh={access_token:'fixture-fresh',refresh_token:'fixture-rotated',expires_at:9999999999,user:{id:'a'}};
function lock(){let pending=Promise.resolve();return{request(_name,_options,fn){const result=pending.then(fn);pending=result.catch(()=>{});return result}}}
function tab(storage,locks,fetch){let session=readSession(storage),expired=0;const client=create({storage,locks,fetch,base:'https://qa.example.invalid',key:'fixture',getSession:()=>session,setSession:s=>session=s,onExpired:()=>expired++,delay:async()=>{}});return{client,get session(){return session},get expired(){return expired},clear:()=>session=null}}
(async()=>{
 const storage=memory();storage.setItem('elite_session',JSON.stringify(old));let calls=0;const locks=lock(),fetch=async()=>{calls++;await Promise.resolve();return{ok:true,status:200,json:async()=>fresh}};
 const a=tab(storage,locks,fetch),b=tab(storage,locks,fetch);await Promise.all([...Array.from({length:12},()=>a.client.refresh()),...Array.from({length:12},()=>b.client.refresh())]);assert.equal(calls,1);assert.equal(a.session.access_token,fresh.access_token);assert.equal(b.session.access_token,fresh.access_token);
 // Reuse error is recoverable if a newer pair was saved by another tab.
 storage.setItem('elite_session',JSON.stringify(old));const reuse=tab(storage,locks,async()=>{storage.setItem('elite_session',JSON.stringify(fresh));return{ok:false,status:400,json:async()=>({error_code:'refresh_token_already_used'})}});await reuse.client.refresh();assert.equal(reuse.expired,0);assert.equal(reuse.session.access_token,fresh.access_token);
 storage.setItem('elite_session',JSON.stringify(old));const invalid=tab(storage,locks,async()=>({ok:false,status:400,json:async()=>({error_code:'refresh_token_not_found'})}));await assert.rejects(invalid.client.refresh(),/caducó/);assert.equal(invalid.expired,1);assert.equal(storage.getItem('elite_session'),null);
 // Logout during an in-flight refresh must not restore the session.
 storage.setItem('elite_session',JSON.stringify(old));let release,started;const ready=new Promise(r=>started=r),inflight=tab(storage,locks,()=>{started();return new Promise(r=>release=r)}),pending=inflight.client.refresh();await ready;storage.removeItem('elite_session');release({ok:true,status:200,json:async()=>fresh});await assert.rejects(pending,/cerrada/);assert.equal(storage.getItem('elite_session'),null);assert.equal(inflight.session,null);
 // A connection failure keeps the pair available for retry and never exposes raw provider errors.
 storage.setItem('elite_session',JSON.stringify(old));const offline=tab(storage,locks,async()=>{throw Error('network fixture')});await assert.rejects(offline.client.refresh(),/conexión/);assert.equal(offline.expired,0);assert.equal(offline.session.access_token,old.access_token);
 storage.setItem('elite_session','{broken');assert.equal(readSession(storage),null);
 console.log('PASS: concurrent and cross-tab refresh serialization, rotation adoption, expired recovery, no session resurrection after logout, offline retry and malformed storage.');
})().catch(e=>{console.error(e);process.exitCode=1});
