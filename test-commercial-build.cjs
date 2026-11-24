// V1 step 6: build a commercial artifact without exposing/copying any legacy customer data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const B=require('./commercial-build.cjs'),root=__dirname,output=path.join(root,'dist-commercial-qa');
const env={TC_COMMERCIAL_SUPABASE_REF:'vyswxgbbqyffnduhhrvz',TC_COMMERCIAL_PUBLISHABLE_KEY:'sb_publishable_123456789012345678901234567890',TC_COMMERCIAL_SITE_URL:'https://tu-controlas-staging.pages.dev/'};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const originalIndex=hash(path.join(root,'index.html')),originalAuth=hash(path.join(root,'auth-session.js'));
const mustFail=(changes,pattern)=>assert.throws(()=>B.commercialConfig({...env,...changes}),pattern);
mustFail({TC_COMMERCIAL_SUPABASE_REF:'abcdefghijklmnopqrst'},/único proyecto/i);
mustFail({TC_COMMERCIAL_SUPABASE_REF:''},/Supabase/);
mustFail({TC_COMMERCIAL_PUBLISHABLE_KEY:'sb_secret_EJEMPLO'},/publicable/);
mustFail({TC_COMMERCIAL_PUBLISHABLE_KEY:''},/publicable/);
mustFail({TC_COMMERCIAL_SITE_URL:'http://tu-controlas-staging.pages.dev/'},/HTTPS/);
mustFail({TC_COMMERCIAL_SITE_URL:'https://maperaltaapp.github.io/tu-controlas-app/'},/origen|GitHub/);
mustFail({TC_COMMERCIAL_SITE_URL:'https://tu-controlas-staging.pages.dev/subcarpeta/'},/raíz/);
mustFail({TC_COMMERCIAL_SITE_URL:''},/dominio/);
const legacy=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(legacy,/elite-work-files/,'The build must strip the legacy storage implementation');
assert.throws(()=>B.stripLaborFiles('<html></html>'),/archivos antiguos/);
fs.rmSync(output,{force:true,recursive:true});
try{
 const result=B.build({root,output,env});
 assert.equal(result.ref,env.TC_COMMERCIAL_SUPABASE_REF);
 assert(result.files.length>=20);
 for(const asset of result.files)assert(fs.existsSync(path.join(output,asset)),'Missing bundled '+asset);
 const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
 assert(html.includes('https://vyswxgbbqyffnduhhrvz.supabase.co'));
 assert(html.includes(env.TC_COMMERCIAL_PUBLISHABLE_KEY));
 assert(!html.includes('https://abcdefghijklmnopqrst.supabase.co'));
 assert(!html.includes('elite-mail'));
 assert(!html.includes('elite-work-files'));
 assert(!html.includes('/storage/v1/object'));
 assert(!html.includes('uploadWorkFiles('));
 assert(html.includes('Conserva los archivos en tu Drive, PC o móvil'));
 const auth=fs.readFileSync(path.join(output,'auth-session.js'),'utf8');
 assert(auth.includes("'tc_commercial_session_v1'"));assert(!auth.includes("'tc_session_v1'"));
 const recovery=fs.readFileSync(path.join(output,'account-recovery.js'),'utf8');
 assert(recovery.includes("'tc_commercial_session_v1'"));assert(!recovery.includes("'elite_session'"));
 for(const forbidden of ['mail-connect.html','mail-connect.js','oauth-consent.js','oauth-consent.html','tasks-schema.sql','package.json','test-client-isolation.cjs','COMMERCIAL-READINESS.md'])
  assert(!fs.existsSync(path.join(output,forbidden)),'Labor/SQL/internal resource included: '+forbidden);
 assert(fs.existsSync(path.join(output,'_headers')));
 assert(fs.readFileSync(path.join(output,'_headers'),'utf8').includes('X-Content-Type-Options: nosniff'));
 // No work/account data are read. The source app must remain byte-for-byte unchanged.
 assert.equal(hash(path.join(root,'index.html')),originalIndex);
 assert.equal(hash(path.join(root,'auth-session.js')),originalAuth);
 const result2=B.build({root,output,env});assert.deepEqual(result2.files,result.files);
 console.log('PASS: commercial deployment build isolates Supabase origin, session keys and work-file storage; source and legacy app unchanged');
}finally{fs.rmSync(output,{force:true,recursive:true});}
