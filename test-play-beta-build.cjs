const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('./play-beta-build.cjs');
const env={TC_COMMERCIAL_SUPABASE_REF:'vyswxgbbqyffnduhhrvz',TC_COMMERCIAL_PUBLISHABLE_KEY:'sb_publishable_123456789012345678901234567890',TC_COMMERCIAL_SITE_URL:'https://tu-controlas-staging.pages.dev/',TC_BETA_CONTROLLER:'Titular ficticio & QA',TC_BETA_PRIVACY_EMAIL:'qa-test@tu-controlas.test',TC_BETA_NOTICE_VERSION:'2026-11-24'};
const output=path.join(__dirname,'dist-commercial-play-beta-qa');
for(const key of ['TC_BETA_CONTROLLER','TC_BETA_PRIVACY_EMAIL','TC_BETA_NOTICE_VERSION'])assert.throws(()=>B.settings({...env,[key]:''}));
assert.throws(()=>B.settings({...env,TC_BETA_PRIVACY_EMAIL:'qa@example.com'}));
assert.throws(()=>B.settings({...env,TC_BETA_CONTROLLER:'<script>alert(1)</script>'}));
assert.throws(()=>B.addLinks('<html></html>'));
const original=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
try{
 fs.rmSync(output,{recursive:true,force:true});
 const r=B.build({root:__dirname,output,env});
 for(const name of ['privacidad.html','eliminar-cuenta.html'])assert(r.files.includes(name));
 const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
 const privacy=fs.readFileSync(path.join(output,'privacidad.html'),'utf8'),deletion=fs.readFileSync(path.join(output,'eliminar-cuenta.html'),'utf8');
 assert.equal((html.match(/href="privacidad.html"/g)||[]).length,2);
 assert.equal((html.match(/href="eliminar-cuenta.html"/g)||[]).length,2);
 assert(privacy.includes('Titular ficticio &amp; QA'));
 assert(privacy.includes('datos ficticios'));
 assert(deletion.includes('mailto:qa-test@tu-controlas.test'));
 assert(deletion.includes('No es necesario volver a iniciar sesión'));
 assert(!deletion.includes('service_role'));
 assert.equal(fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),original);
 console.log('PASS: beta privacy and external account deletion request pages, both entry points, safe configuration, original app unchanged');
}finally{fs.rmSync(output,{recursive:true,force:true})}
