/* Coordinates rotating sessions without logging credentials. */
(function(root){
'use strict';
const SESSION='elite_session';
function readSession(storage){try{const value=JSON.parse(storage.getItem(SESSION)||'null');return value&&typeof value.access_token==='string'?value:null}catch{return null}}
function create({storage,fetch,base,key,getSession,setSession,onExpired,locks,now=Date.now,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 let pending=null;
 const valid=s=>!!s?.access_token&&(!s.expires_at||s.expires_at*1000>now()+30000);
 const adopt=s=>{setSession(s);return s};
 function expire(original){const shared=readSession(storage);if(shared&&shared.access_token!==original?.access_token)return adopt(shared);storage.removeItem(SESSION);setSession(null);onExpired();return null}
 async function work(force,original){
  const shared=readSession(storage);if(!shared){expire(original);throw Error('Tu sesión caducó. Vuelve a entrar.');}if(shared.access_token!==original?.access_token)return adopt(shared);
  if(!getSession()||getSession().access_token!==original?.access_token)throw Error('La sesión cambió. Vuelve a intentarlo.');
  const current=shared||getSession();if(!force&&valid(current))return adopt(current);
  if(!current?.refresh_token){expire(original);throw Error('Tu sesión caducó. Vuelve a entrar.');}
  let response,data;const controller=typeof AbortController==='undefined'?null:new AbortController(),timer=controller?setTimeout(()=>controller.abort(),15000):null;
  try{response=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:current.refresh_token}),...(controller?{signal:controller.signal}:{})});data=await response.json()}catch{throw Error('No se pudo renovar la sesión. Comprueba la conexión y reintenta.');}finally{if(timer)clearTimeout(timer)}
  if(!response.ok){
   // A different tab may have completed rotation while this request was in flight.
   for(let i=0;i<4;i++){const fresh=readSession(storage);if(fresh&&fresh.access_token!==current.access_token&&valid(fresh))return adopt(fresh);if(i<3)await delay(100)}
   if(response.status===400||response.status===401||response.status===403){expire(original);throw Error('Tu sesión caducó. Vuelve a entrar.');}
   throw Error('No se pudo renovar la sesión. Reintenta.');
  }
  if(!data?.access_token||!data?.refresh_token)throw Error('No se pudo verificar la renovación. Reintenta.');
  // Never resurrect a session after logout or overwrite a different sign-in.
  const latest=readSession(storage);if(!latest){expire(original);throw Error('Sesión cerrada. Vuelve a entrar.');}if(!getSession()||getSession().access_token!==original.access_token){if(latest&&latest.access_token!==original.access_token)return adopt(latest);throw Error('La sesión cambió. Vuelve a entrar.');}
  if(latest&&latest.access_token!==original.access_token)return adopt(latest);
  storage.setItem(SESSION,JSON.stringify(data));return adopt(data);
 }
 async function locked(force,original){
  if(locks?.request)return locks.request('tu-controlas-refresh',{mode:'exclusive'},()=>work(force,original));
  // Older browsers: short lease plus an ownership recheck; no infinite waiting.
  const lockKey='tc_refresh_lease',id=Math.random().toString(36).slice(2),deadline=now()+15000;
  while(now()<deadline){let lease;try{lease=JSON.parse(storage.getItem(lockKey)||'null')}catch{}if(!lease||lease.until<now()){
    storage.setItem(lockKey,JSON.stringify({id,until:now()+30000}));await delay(0);let active;try{active=JSON.parse(storage.getItem(lockKey))}catch{}if(active?.id===id){try{return await work(force,original)}finally{try{if(JSON.parse(storage.getItem(lockKey)||'null')?.id===id)storage.removeItem(lockKey)}catch{}}}
   }const shared=readSession(storage);if(shared&&shared.access_token!==original?.access_token&&valid(shared))return adopt(shared);await delay(80)}
  throw Error('La sesión se está renovando en otra pestaña. Reintenta.');
 }
 function refresh(force=false){if(pending)return pending;const original=getSession();pending=locked(force,original).finally(()=>pending=null);return pending}
 return {refresh,expire,valid};
}
root.TCAuth={readSession,create};if(typeof module!=='undefined')module.exports=root.TCAuth;
})(typeof window==='undefined'?globalThis:window);
