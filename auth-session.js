/* Coordinates rotating sessions without logging credentials. */
(function(root){
'use strict';
const SESSION='tc_session_v1';
function readSession(storage){
 try{
  const value=JSON.parse(storage.getItem(SESSION)||'null');
  return value&&typeof value.access_token==='string'&&typeof value.user?.id==='string'&&value.user.id?value:null;
 }catch{return null}
}
function create({storage,fetch,base,key,getSession,setSession,onExpired,locks,now=Date.now,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 let pending=null;
 const valid=s=>!!s?.access_token&&(!s.expires_at||s.expires_at*1000>now()+30000);
 const owner=s=>typeof s?.user?.id==='string'&&s.user.id?s.user.id:null;
 const sameOwner=(a,b)=>!!owner(a)&&owner(a)===owner(b);
 const sessionChanged=()=>Error('La cuenta cambió. Vuelve a entrar.');
 // A rotated token may be adopted from a different tab only if the owner is unchanged
 // and the initiating tab has not signed out or switched to another account.
 const adopt=(next,original)=>{
  if(!sameOwner(next,original)||!sameOwner(getSession(),original))throw sessionChanged();
  setSession(next);return next;
 };
 function expire(original){
  const active=getSession();
  // API callers may pass only the original access_token; infer the owner only if
  // that token still belongs to the active session.
  const expected=owner(original)?original:active?.access_token===original?.access_token?active:null;
  if(!expected||!sameOwner(active,expected))throw sessionChanged();
  const shared=readSession(storage);
  if(shared&&shared.access_token!==original?.access_token)return adopt(shared,expected);
  if(shared&&!sameOwner(shared,expected))throw sessionChanged();
  // Never clear a newer session, including after an account switch in another tab.
  storage.removeItem(SESSION);setSession(null);onExpired();return null;
 }
 async function work(force,original){
  if(!owner(original))throw sessionChanged();
  const shared=readSession(storage);
  if(!shared){expire(original);throw Error('Tu sesión caducó. Vuelve a entrar.');}
  if(!sameOwner(shared,original))throw sessionChanged();
  if(shared.access_token!==original.access_token)return adopt(shared,original);
  if(!sameOwner(getSession(),original)||getSession().access_token!==original.access_token)throw sessionChanged();
  const current=shared;
  if(!force&&valid(current))return adopt(current,original);
  if(!current?.refresh_token){expire(original);throw Error('Tu sesión caducó. Vuelve a entrar.');}
  let response,data;const controller=typeof AbortController==='undefined'?null:new AbortController(),timer=controller?setTimeout(()=>controller.abort(),15000):null;
  try{response=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:current.refresh_token}),...(controller?{signal:controller.signal}:{})});data=await response.json()}catch{throw Error('No se pudo renovar la sesión. Comprueba la conexión y reintenta.');}finally{if(timer)clearTimeout(timer)}
  if(!response.ok){
   // Another tab may have rotated the token; never adopt a different account.
   for(let i=0;i<4;i++){
    const fresh=readSession(storage);
    if(fresh&&!sameOwner(fresh,original))throw sessionChanged();
    if(fresh&&fresh.access_token!==current.access_token&&valid(fresh))return adopt(fresh,original);
    if(i<3)await delay(100);
   }
   if(response.status===400||response.status===401||response.status===403){expire(original);throw Error('Tu sesión caducó. Vuelve a entrar.');}
   throw Error('No se pudo renovar la sesión. Reintenta.');
  }
  if(!data?.access_token||!data?.refresh_token||!sameOwner(data,original))throw Error('No se pudo verificar la renovación. Reintenta.');
  const latest=readSession(storage);
  if(!latest){expire(original);throw Error('Sesión cerrada. Vuelve a entrar.');}
  if(!sameOwner(latest,original)||!sameOwner(getSession(),original))throw sessionChanged();
  if(getSession().access_token!==original.access_token){
   if(latest.access_token!==original.access_token)return adopt(latest,original);
   throw sessionChanged();
  }
  if(latest.access_token!==original.access_token)return adopt(latest,original);
  storage.setItem(SESSION,JSON.stringify(data));return adopt(data,original);
 }
 async function locked(force,original){
  if(locks?.request)return locks.request('tu-controlas-refresh',{mode:'exclusive'},()=>work(force,original));
  // Older browsers: short lease plus an ownership recheck; no infinite waiting.
  const lockKey='tc_refresh_lease',id=Math.random().toString(36).slice(2),deadline=now()+15000;
  while(now()<deadline){
   let lease;try{lease=JSON.parse(storage.getItem(lockKey)||'null')}catch{}
   if(!lease||lease.until<now()){
    storage.setItem(lockKey,JSON.stringify({id,until:now()+30000}));await delay(0);
    let active;try{active=JSON.parse(storage.getItem(lockKey))}catch{}
    if(active?.id===id){try{return await work(force,original)}finally{try{if(JSON.parse(storage.getItem(lockKey)||'null')?.id===id)storage.removeItem(lockKey)}catch{}}}
   }
   const shared=readSession(storage);
   if(shared&&!sameOwner(shared,original))throw sessionChanged();
   if(shared&&shared.access_token!==original?.access_token&&valid(shared))return adopt(shared,original);
   await delay(80);
  }
  throw Error('La sesión se está renovando en otra pestaña. Reintenta.');
 }
 function refresh(force=false){if(pending)return pending;const original=getSession();pending=locked(force,original).finally(()=>pending=null);return pending}
 return {refresh,expire,valid};
}
root.TCAuth={readSession,create,storageKey:SESSION};if(typeof module!=='undefined')module.exports=root.TCAuth;
})(typeof window==='undefined'?globalThis:window);
