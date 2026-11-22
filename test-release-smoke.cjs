const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('./release-smoke.cjs');
const root=__dirname;
assert.equal(S.SITE,'https://maperaltaapp.github.io/tu-controlas-app/');
assert(S.ASSETS.length>=10);
assert(new Set(S.ASSETS).size===S.ASSETS.length);
assert(S.ASSETS.includes('auth-session.js')&&S.ASSETS.includes('account-recovery.js'));
for(const asset of S.ASSETS)assert(fs.statSync(path.join(root,asset)).isFile(),'Missing public asset '+asset);
function fakeFetch(missing='',corrupt=''){
 return async request=>{
  const url=new URL(request),name=url.pathname.slice('/tu-controlas-app/'.length);
  assert.equal(url.origin,'https://maperaltaapp.github.io');
  assert.equal(url.searchParams.has('release_check'),true);
  assert.equal(request?.headers?.Authorization,undefined);
  if(name===missing)return{ok:false,status:404,url:request,arrayBuffer:async()=>new ArrayBuffer(0)};
  const content=name===corrupt?Buffer.from('outdated'):fs.readFileSync(path.join(root,name));
  return{ok:true,status:200,url:request,arrayBuffer:async()=>content};
 };
}
(async()=>{
 assert.deepEqual(await S.checkOnce({fetcher:fakeFetch()}),[]);
 const missing=await S.checkOnce({fetcher:fakeFetch('auth-session.js')});
 assert(missing.some(x=>x.startsWith('auth-session.js:')));
 const stale=await S.checkOnce({fetcher:fakeFetch('', 'account-recovery.js')});
 assert(stale.some(x=>x.includes('account-recovery.js: versión publicada diferente')));
 await assert.rejects(S.run({attempts:1,delayMs:0,check:async()=>['index.html: versión publicada diferente']}),/PUBLICACIÓN NO VERIFICADA/);
 let calls=0;
 assert.equal(await S.run({attempts:2,delayMs:0,check:async()=>++calls===1?['primer intento']:[]}),true);
 assert.equal(calls,2);
 assert.throws(()=>S.localFingerprint('../private.env'),/no permitido/);
 console.log('PASS: public release assets, live-byte verification, missing/stale detection, bounded retry and no secrets.');
})().catch(e=>{console.error(e);process.exitCode=1});
