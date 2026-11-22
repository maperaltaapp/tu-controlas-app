/* Account recovery for TU CONTROLAS. Never log tokens or alter the legacy app session. */
(function(root){
'use strict';
const LEGACY='elite_session';
const CURRENT='tc_session_v1';
const explain='No se pudo recuperar el acceso anterior. Si ya caducó, utiliza «Olvidé mi contraseña».';
const legacyPresent=storage=>{
 try{const value=JSON.parse(storage.getItem(LEGACY)||'null');return !!(value?.access_token&&value?.user?.id)}catch{return false}
};
async function verifiedUser(fetch,base,key,token){
 const response=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});
 if(!response.ok)throw Error('La sesión anterior ha caducado o ya no es válida.');
 const user=await response.json();
 if(!user?.id)throw Error('No se pudo comprobar la identidad de esta sesión.');
 return user;
}
async function restorePrevious({storage,fetch,base,key}){
 let previous;
 try{previous=JSON.parse(storage.getItem(LEGACY)||'null')}catch{}
 if(!previous?.access_token||!previous?.refresh_token||!previous?.user?.id)throw Error(explain);
 // Do not rotate a legacy refresh token: another application might still be using it.
 if(previous.expires_at&&Number(previous.expires_at)*1000<Date.now()+30000)throw Error(explain);
 const user=await verifiedUser(fetch,base,key,previous.access_token);
 if(user.id!==previous.user.id)throw Error('La cuenta no coincide. No se modificó ninguna sesión.');
 let existing=null;try{existing=JSON.parse(storage.getItem(CURRENT)||'null')}catch{}
 if(existing?.user?.id&&existing.user.id!==user.id)throw Error('Cierra primero la sesión de la otra cuenta.');
 // Only explicit user interaction reaches this method. Leave LEGACY unchanged.
 const restored={...previous,user};
 storage.setItem(CURRENT,JSON.stringify(restored));
 return restored;
}
async function sendResetEmail({fetch,base,key,email,redirect}){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim()))throw Error('Introduce tu correo de acceso.');
 const path='/auth/v1/recover?redirect_to='+encodeURIComponent(redirect);
 const response=await fetch(base+path,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:email.trim()})});
 if(!response.ok){
  if(response.status===429)throw Error('Se han solicitado demasiados correos. Inténtalo más tarde.');
  throw Error('No se pudo solicitar la recuperación. Revisa el servicio de correo.');
 }
 return true;
}
function recoveryFromHash(hash){
 const params=new URLSearchParams(String(hash||'').replace(/^#/,''));
 if(params.get('type')!=='recovery')return null;
 const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
 if(!access_token||!refresh_token)throw Error('El enlace de recuperación está incompleto.');
 const ttl=Number(params.get('expires_in'));
 if(!Number.isFinite(ttl)||ttl<=0||ttl>86400)throw Error('El enlace de recuperación ha caducado.');
 return {access_token,refresh_token,expires_at:Math.floor(Date.now()/1000)+ttl};
}
async function changePassword({fetch,base,key,recovery,password}){
 if(!recovery?.access_token||!recovery?.refresh_token)throw Error('Abre primero el enlace de recuperación.');
 if(typeof password!=='string'||password.length<12)throw Error('La nueva contraseña debe tener al menos 12 caracteres.');
 const response=await fetch(base+'/auth/v1/user',{method:'PUT',headers:{apikey:key,Authorization:'Bearer '+recovery.access_token,'Content-Type':'application/json'},body:JSON.stringify({password})});
 if(!response.ok)throw Error('El enlace ha caducado o la contraseña no es válida. Solicita otro enlace.');
 const user=await verifiedUser(fetch,base,key,recovery.access_token);
 return {...recovery,user};
}
root.TCRecovery={legacyPresent,restorePrevious,sendResetEmail,recoveryFromHash,changePassword};
if(typeof module!=='undefined')module.exports=root.TCRecovery;
})(typeof window==='undefined'?globalThis:window);
