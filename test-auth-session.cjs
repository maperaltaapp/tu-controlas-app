const assert=require('node:assert/strict'),{create,readSession,storageKey}=require('./auth-session.js');
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
const old={access_token:'fixture-old',refresh_token:'fixture-refresh',expires_at:1,user:{id:'a'}},fresh={access_token:'fixture-fresh',refresh_token:'fixture-rotated',expires_at:9999999999,user:{id:'a'}};
function lock(){let pending=Promise.resolve();return{request(_name,_options,fn){const result=pending.then(fn);pending=result.catch(()=>{});return result}}}
function tab(storage,locks,fetch){let session=readSession(storage),expired=0;const client=create({storage,locks,fetch,base:'https://qa.example.invalid',key:'fixture',getSession:()=>session,setSession:s=>session=s,onExpired:()=>expired++,delay:async()=>{}});return{client,get session(){return session},get expired(){return expired},clear:()=>session=null}}
(async()=>{
 // Never silently import a legacy application's token from the shared browser origin.
 const legacy=memory();legacy.setItem('elite_session',JSON.stringify(old));
 assert.equal(readSession(legacy),null,'Legacy credentials must not log in to TU CONTROLAS');
 legacy.setItem(storageKey,JSON.stringify(fresh));
 assert.equal(readSession(legacy).access_token,fresh.access_token);
 legacy.removeItem(storageKey);
 assert.equal(JSON.parse(legacy.getItem('elite_session')).access_token,old.access_token);
 
 const storage=memory();storage.setItem(storageKey,JSON.stringify(old));let calls=0;const locks=lock(),fetch=async()=>{calls++;await Promise.resolve();return{ok:true,status:200,json:async()=>fresh}};
 const a=tab(storage,locks,fetch),b=tab(storage,locks,fetch);await Promise.all([...Array.from({length:12},()=>a.client.refresh()),...Array.from({length:12},()=>b.client.refresh())]);assert.equal(calls,1);assert.equal(a.session.access_token,fresh.access_token);assert.equal(b.session.access_token,fresh.access_token);
 // Reuse error is recoverable if a newer pair was saved by another tab.
 storage.setItem(storageKey,JSON.stringify(old));const reuse=tab(storage,locks,async()=>{storage.setItem(storageKey,JSON.stringify(fresh));return{ok:false,status:400,json:async()=>({error_code:'refresh_token_already_used'})}});await reuse.client.refresh();assert.equal(reuse.expired,0);assert.equal(reuse.session.access_token,fresh.access_token);
 storage.setItem(storageKey,JSON.stringify(old));const invalid=tab(storage,locks,async()=>({ok:false,status:400,json:async()=>({error_code:'refresh_token_not_found'})}));await assert.rejects(invalid.client.refresh(),/caducó/);assert.equal(invalid.expired,1);assert.equal(storage.getItem(storageKey),null);
 // Logout during an in-flight refresh must not restore the session.
 storage.setItem(storageKey,JSON.stringify(old));let release,started;const ready=new Promise(r=>started=r),inflight=tab(storage,locks,()=>{started();return new Promise(r=>release=r)}),pending=inflight.client.refresh();await ready;storage.removeItem(storageKey);release({ok:true,status:200,json:async()=>fresh});await assert.rejects(pending,/cerrada/);assert.equal(storage.getItem(storageKey),null);assert.equal(inflight.session,null);
 // A connection failure keeps the pair available for retry and never exposes raw provider errors.
 storage.setItem(storageKey,JSON.stringify(old));const offline=tab(storage,locks,async()=>{throw Error('network fixture')});await assert.rejects(offline.client.refresh(),/conexión/);assert.equal(offline.expired,0);assert.equal(offline.session.access_token,old.access_token);
 // A different user in shared storage must never be adopted by a stale tab.
 const other={access_token:'fixture-other',refresh_token:'fixture-other-refresh',expires_at:9999999999,user:{id:'b'}};
 const switched=memory();switched.setItem(storageKey,JSON.stringify(old));
 const stale=tab(switched,lock(),async()=>{throw Error('No network request expected');});
 switched.setItem(storageKey,JSON.stringify(other));
 await assert.rejects(stale.client.refresh(),/cuenta cambió/);
 assert.equal(readSession(switched).user.id,'b');
 assert.equal(stale.session.user.id,'a','Stale user must not silently become another user');
 assert.throws(()=>stale.client.expire({access_token:old.access_token}),/cuenta cambió/);
 assert.equal(readSession(switched).user.id,'b','Expiry of A must not delete B');
 
 // A pending successful refresh after B signs in must not overwrite B.
 const switching=memory();switching.setItem(storageKey,JSON.stringify(old));
 let finishRefresh,beginRefresh;const refreshStarted=new Promise(r=>beginRefresh=r);
 const changing=tab(switching,lock(),()=>{beginRefresh();return new Promise(r=>finishRefresh=r)});
 const request=changing.client.refresh();await refreshStarted;
 switching.setItem(storageKey,JSON.stringify(other));
 finishRefresh({ok:true,status:200,json:async()=>fresh});
 await assert.rejects(request,/cuenta cambió/);
 assert.equal(readSession(switching).user.id,'b');
 assert.equal(changing.session.user.id,'a');
 
 // A 401 and refresh-token reuse after B signs in must not erase B either.
 const rejectedStorage=memory();rejectedStorage.setItem(storageKey,JSON.stringify(old));
 const rejected=tab(rejectedStorage,lock(),async()=>{
  rejectedStorage.setItem(storageKey,JSON.stringify(other));
  return {ok:false,status:401,json:async()=>({error_code:'refresh_token_not_found'})};
 });
 await assert.rejects(rejected.client.refresh(),/cuenta cambió/);
 assert.equal(readSession(rejectedStorage).user.id,'b');
 
 // Reject an unexpected server owner, even when the token is otherwise complete.
 const inconsistentStorage=memory();inconsistentStorage.setItem(storageKey,JSON.stringify(old));
 const inconsistent=tab(inconsistentStorage,lock(),async()=>({ok:true,status:200,json:async()=>other}));
 await assert.rejects(inconsistent.client.refresh(),/verificar/);
 assert.equal(readSession(inconsistentStorage).user.id,'a');
 assert.equal(inconsistent.session.user.id,'a');
 const malformedOwner=memory();malformedOwner.setItem(storageKey,JSON.stringify({access_token:'fixture',expires_at:9999999999}));
 assert.equal(readSession(malformedOwner),null,'A token without a verified owner must not be treated as an authenticated session');

 storage.setItem(storageKey,'{broken');assert.equal(readSession(storage),null);
 console.log('PASS: concurrent and cross-tab refresh serialization, rotation adoption, expired recovery, no session resurrection after logout, offline retry, cross-account rejection, no foreign-session deletion and malformed storage.');
})().catch(e=>{console.error(e);process.exitCode=1});
