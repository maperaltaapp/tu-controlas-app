// CI guard: the published entrypoint must not reference missing assets or server credentials.
// It is intentionally dependency-free and does not connect to a live account.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function refs(tag,attribute){
 const tags=html.match(new RegExp('<'+tag+'\\b[^>]*>','gi'))||[];
 return tags.map(t=>t.match(new RegExp('\\b'+attribute+'=["\\x27]([^"\\x27]+)["\\x27]','i'))?.[1]).filter(Boolean)
   .filter(v=>!v.startsWith('http:')&&!v.startsWith('https:')&&!v.startsWith('data:')&&!v.startsWith('#'));
}
const assets=[...refs('script','src'),...refs('link','href')];
const retiredProvider=['tre','llo'].join('');
for(const filename of ['index.html','native-schema.sql']){
 const content=fs.readFileSync(path.join(root,filename),'utf8');
 assert.ok(!content.toLowerCase().includes(retiredProvider),'Provider remnants found in '+filename);
}
assert.ok(assets.length>=15,'La aplicación debe cargar los módulos y estilos conocidos');
for(const ref of assets){
 const clean=ref.split('?')[0].split('#')[0],location=path.resolve(root,clean);
 assert.ok(location.startsWith(root+path.sep),'No se permite una ruta externa: '+ref);
 assert.ok(fs.existsSync(location),'Falta recurso referenciado en index.html: '+ref);
}

// Detect real JWT separators (.) and fail the test if this guard regresses.
// Both examples are synthetic, not authentication credentials.
const jwtPattern=/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}/g;
function containsPrivilegedJwt(source){
 for(const hit of source.matchAll(jwtPattern)){
  try{
   const payload=JSON.parse(Buffer.from(hit[0].split('.')[1],'base64url').toString('utf8'));
   if(payload.role==='service_role')return true;
  }catch{}
 }
 return false;
}
function syntheticJwt(role){
 const encoded=payload=>Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
 return [encoded({alg:'HS256',typ:'JWT'}),encoded({role,iss:'fixture.invalid'}),'a'.repeat(32)].join('.');
}
assert.equal(containsPrivilegedJwt(syntheticJwt('service_role')),true,'La prueba debe detectar credenciales privilegiadas sintéticas');
assert.equal(containsPrivilegedJwt(syntheticJwt('anon')),false,'La clave publicable/anon no debe marcarse como service_role');
const production=fs.readdirSync(root).filter(f=>f==='index.html'||(f.endsWith('.js')&&!f.startsWith('test-')&&!f.startsWith('qa-')));
for(const f of production){
 const code=fs.readFileSync(path.join(root,f),'utf8');
 assert.doesNotMatch(code,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'Clave privada incrustada en '+f);
 assert.doesNotMatch(code,/sb_secret_[a-zA-Z0-9_-]{10,}/,'Clave secreta de Supabase incrustada en '+f);
 assert.doesNotMatch(code,/sk-proj-[a-zA-Z0-9_-]{10,}/,'Clave secreta de OpenAI incrustada en '+f);
 // Publishable/anon keys are expected in a public client. A service_role JWT is not.
 assert.equal(containsPrivilegedJwt(code),false,'JWT service_role incrustado en '+f);
}
console.log('PASS: recursos estáticos locales presentes y sin credenciales privilegiadas expuestas');
