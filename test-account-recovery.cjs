const assert=require('node:assert/strict'),fs=require('node:fs');
const {readSession}=require('./auth-session.js');
const R=require('./account-recovery.js');
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const legacy={access_token:'fixture-original-token',refresh_token:'fixture-original-refresh',expires_at:9999999999,user:{id:'tenant-a'}};
const base='https://example.invalid',key='fixture-publishable';
const successUser={id:'tenant-a',email:'fixture@example.invalid'};
(async()=>{
 const storage=memory();storage.setItem('elite_session',JSON.stringify(legacy));
 assert.equal(readSession(storage),null,'Do not silently import older app sessions');
 assert.equal(R.legacyPresent(storage),true);
 const requests=[];const fetch=async(url,options)=>{requests.push([url,options]);return{ok:true,json:async()=>successUser}};
 const restored=await R.restorePrevious({storage,fetch,base,key});
 assert.equal(restored.user.id,successUser.id);
 assert.equal(requests.length,1);
 assert.equal(requests[0][0],base+'/auth/v1/user');
 assert.equal(requests[0][1].headers.Authorization,'Bearer '+legacy.access_token);
 assert.equal(readSession(storage).access_token,legacy.access_token);
 assert.deepEqual(JSON.parse(storage.getItem('elite_session')),legacy,'Legacy application credentials must remain unchanged');
 // A stale legacy access token is not refreshed, rotated or silently imported.
 const expired=memory();expired.setItem('elite_session',JSON.stringify({...legacy,expires_at:1}));
 let hit=false;
 await assert.rejects(R.restorePrevious({storage:expired,fetch:async()=>{hit=true},base,key}),/caduc|recuperar/);
 assert.equal(hit,false);assert.equal(readSession(expired),null);
 // A changed identity must never be imported.
 const impostor=memory();impostor.setItem('elite_session',JSON.stringify(legacy));
 await assert.rejects(R.restorePrevious({storage:impostor,fetch:async()=>({ok:true,json:async()=>({id:'tenant-b'})}),base,key}),/no coincide/);
 assert.equal(readSession(impostor),null);
 assert.deepEqual(JSON.parse(impostor.getItem('elite_session')),legacy);
 // Never overwrite an active different account.
 const other=memory();other.setItem('elite_session',JSON.stringify(legacy));other.setItem('tc_session_v1',JSON.stringify({...legacy,user:{id:'tenant-b'}}));
 await assert.rejects(R.restorePrevious({storage:other,fetch,base,key}),/otra cuenta/);
 assert.equal(readSession(other).user.id,'tenant-b');
 // Email recovery only sends an address and an allowlisted caller-chosen redirect URL.
 let emailRequest=null;
 await R.sendResetEmail({fetch:async(url,options)=>{emailRequest={url,options};return{ok:true}},base,key,email:'fixture@example.invalid',redirect:'https://example.invalid/app/'});
 assert.equal(emailRequest.options.method,'POST');
 assert.deepEqual(JSON.parse(emailRequest.options.body),{email:'fixture@example.invalid'});
 assert.equal(new URL(emailRequest.url).searchParams.get('redirect_to'),'https://example.invalid/app/');
 await assert.rejects(R.sendResetEmail({fetch,base,key,email:'not-an-email',redirect:'https://example.invalid/app/'}),/correo/);
 await assert.rejects(R.sendResetEmail({fetch:async()=>({ok:false,status:429}),base,key,email:'fixture@example.invalid',redirect:'https://example.invalid/app/'}),/demasiados/);
 // Recovery tokens are accepted only from recovery links, never from arbitrary fragments.
 assert.equal(R.recoveryFromHash('#ia'),null);
 assert.equal(R.recoveryFromHash('#access_token=x&refresh_token=y&type=signup&expires_in=3600'),null);
 assert.throws(()=>R.recoveryFromHash('#type=recovery&access_token=x'),/incompleto/);
 const tokens=R.recoveryFromHash('#type=recovery&access_token=fixture-recover&refresh_token=fixture-refresh&expires_in=3600');
 assert.equal(tokens.access_token,'fixture-recover');
 assert.ok(tokens.expires_at>Math.floor(Date.now()/1000));
 await assert.rejects(R.changePassword({fetch,base,key,recovery:tokens,password:'weak'}),/12/);
 let update=null;const resetFetch=async(url,options)=>{if(options?.method==='PUT'){update={url,options};return{ok:true}}return{ok:true,json:async()=>successUser}};
 const newSession=await R.changePassword({fetch:resetFetch,base,key,recovery:tokens,password:'testing-Supabase-123'});
 assert.equal(update.url,base+'/auth/v1/user');
 assert.equal(update.options.headers.Authorization,'Bearer '+tokens.access_token);
 assert.deepEqual(JSON.parse(update.options.body),{password:'testing-Supabase-123'});
 assert.equal(newSession.user.id,'tenant-a');
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 for(const required of ['src="account-recovery.js"','id="restorePrevious"','id="forgotPassword"','id="newRecoveryPassword"','id="saveRecoveryPassword"','initAccountRecovery();','TCRecovery.restorePrevious','TCRecovery.sendResetEmail','TCRecovery.changePassword','TCAuth.storageKey'])assert.ok(html.includes(required),'Missing account recovery integration: '+required);
 assert.ok(html.indexOf('src="account-recovery.js"')<html.indexOf('initAccountRecovery();'),'Recovery functions must load before handlers');
 assert.ok(!html.includes("localStorage.setItem('elite_session'"),'Do not write legacy app credentials');
 console.log('PASS: explicit legacy recovery, verified identity, no legacy mutation/rotation, password reset request, recovery-link password change, login UI integration');
})().catch(e=>{console.error(e);process.exitCode=1});
