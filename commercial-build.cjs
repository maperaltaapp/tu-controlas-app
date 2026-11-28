#!/usr/bin/env node
'use strict';
// Generates a PRIVATE, isolated deployment directory. Does not deploy, provision
// Supabase, copy databases, or expose service-role secrets.
const fs=require('node:fs'),path=require('node:path');
// TU CONTROLAS keeps its existing Supabase project and all its data. The project reference
// remains stable even if its display name is changed in the dashboard.
const PROJECT_REF='vyswxgbbqyffnduhhrvz',LEGACY_ORIGIN='https://maperaltaapp.github.io';
const LEGACY_FILES_START="const WORK_FILES_BUCKET='elite-work-files'";
const OLD_SESSION='tc_session_v1',NEW_SESSION='tc_commercial_session_v1';
const EXTRAS=['manifest.webmanifest','sw.js','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','favicon-32.png','login-art.webp','launcher-192.png','launcher-512.png','launcher-maskable.png'];
function commercialConfig(env){
 const ref=(env.TC_COMMERCIAL_SUPABASE_REF||'').trim();
 const publishable=(env.TC_COMMERCIAL_PUBLISHABLE_KEY||'').trim();
 const rawUrl=(env.TC_COMMERCIAL_SITE_URL||'').trim();
 if(ref!==PROJECT_REF)
  throw Error('TU CONTROLAS usa un único proyecto Supabase existente. No se permite crear ni apuntar a otro proyecto.');
 if(!/^sb_publishable_[A-Za-z0-9_-]{24,}$/.test(publishable))
  throw Error('Se necesita una clave publicable del proyecto COMERCIAL. Nunca uses una clave secreta o service_role.');
 if(!rawUrl)throw Error('Indica el dominio HTTPS exclusivo del despliegue comercial.');
 const url=new URL(rawUrl);
 if(url.protocol!=='https:'||url.hostname==='maperaltaapp.github.io'||url.hostname.endsWith('.supabase.co')||url.hostname==='localhost'||url.username||url.password||url.search||url.hash)
  throw Error('El sitio comercial necesita su propio origen HTTPS. Nunca publiques en una ruta de GitHub Pages laboral.');
 if(url.pathname!=='/'&&url.pathname!==''||!url.hostname.includes('.'))
  throw Error('La versión comercial debe utilizar la raíz de un origen web exclusivo, sin subcarpetas.');
 return {ref,publishable,siteUrl:url.origin+'/'};
}
function stripLaborFiles(source){
 const from=source.indexOf(LEGACY_FILES_START),to=source.indexOf('\nfunction workHeader(w)',from);
 if(from<0||to<=from)throw Error('El código de archivos antiguos cambió; revisa la eliminación antes de preparar el paquete comercial.');
 const safe="// Commercial mode: documents remain in each client's own Drive/PC/mobile.\nconst workFileBusy=new Set();\nfunction workFilesPanel(){\n return '<section class=\"work-files\"><h4>Documentos del cliente</h4><p class=\"small\">Conserva los archivos en tu Drive, PC o móvil. No se suben fotos ni PDF a TU CONTROLAS. La vinculación privada de referencias requiere revisión independiente.</p></section>';\n}\nasync function refreshWorkFiles(){return}\nasync function removeWorkFiles(){return}\n";
 return source.slice(0,from)+safe+source.slice(to);
}
function commercialIndex(html,config){
 const re=/const BASE='https:\/\/vyswxgbbqyffnduhhrvz\.supabase\.co',KEY='sb_publishable_[A-Za-z0-9_-]+';/g;
 if([...html.matchAll(re)].length!==1)throw Error('No hay un único origen Supabase laboral que sustituir.');
 let content=html.replace(re,'const BASE='+JSON.stringify('https://'+config.ref+'.supabase.co')+',KEY='+JSON.stringify(config.publishable)+';');
 content=stripLaborFiles(content);
 content=content.replaceAll('fotos, PDF e historial','referencias e historial')
  .replace('Guarda la obra para adjuntar fotos y PDF a su descripción.','Guarda la obra para incorporar referencias externas de documentos cuando esté habilitada esa función.');
 return content;
}
function linkedAssets(html){
 const found=[...html.matchAll(/\b(?:src|href)=["'](?:\.\/)?([A-Za-z0-9._-]+\.(?:js|css))(?:\?v=[a-f0-9]+)?["']/g)].map(x=>x[1]);
 return [...new Set(['index.html',...found,...EXTRAS])];
}
function build({root=__dirname,output=path.join(__dirname,'dist-commercial'),env=process.env}={}){
 const config=commercialConfig(env);
 const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const assets=linkedAssets(source),target=path.resolve(output),base=path.resolve(root);
 if(target===base||!target.startsWith(base+path.sep)||!path.basename(target).startsWith('dist-commercial'))
  throw Error('El directorio comercial debe ser dist-commercial* dentro del repositorio.');
 const files=new Map();
 for(const asset of assets){
  if(asset.includes('/')||asset.startsWith('.')||!fs.statSync(path.join(root,asset)).isFile())throw Error('Recurso público inesperado: '+asset);
  let file=fs.readFileSync(path.join(root,asset));
  if(asset==='index.html')file=Buffer.from(commercialIndex(file.toString('utf8'),config));
  if(asset==='auth-session.js')file=Buffer.from(file.toString('utf8').replaceAll("'"+OLD_SESSION+"'","'"+NEW_SESSION+"'")
   .replaceAll("'tu-controlas-refresh'","'tu-controlas-commercial-refresh'")
   .replaceAll("'tc_refresh_lease'","'tc_commercial_refresh_lease'"));
  if(asset==='account-recovery.js')file=Buffer.from(file.toString('utf8').replaceAll("'"+OLD_SESSION+"'","'"+NEW_SESSION+"'").replaceAll("'elite_session'","'__commercial_legacy_disabled__'"));
  if(file.toString('utf8').includes('elite-work-files')||file.toString('utf8').includes(LEGACY_ORIGIN))
   throw Error('Recurso con conexión laboral o almacenamiento heredado: '+asset);
  files.set(asset,file);
 }
 fs.mkdirSync(target,{recursive:true});
 for(const [asset,buffer]of files)fs.writeFileSync(path.join(target,asset),buffer);
 fs.writeFileSync(path.join(target,'_headers'),"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n");
 return {files:[...files.keys()],directory:target,siteUrl:config.siteUrl,ref:config.ref};
}
if(require.main===module){try{const out=build();console.log('PASS: paquete comercial aislado generado ('+out.files.length+' archivos). Destino previsto: '+out.siteUrl+'. No se ha publicado.')}catch(e){console.error('Compilación comercial BLOQUEADA: '+e.message);process.exitCode=1;}}
module.exports={commercialConfig,stripLaborFiles,commercialIndex,linkedAssets,build};
