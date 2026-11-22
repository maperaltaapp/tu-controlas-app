#!/usr/bin/env node
'use strict';
// Read-only release smoke check. No credentials, cookies, database calls or user data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SITE='https://maperaltaapp.github.io/tu-controlas-app/';
const ASSETS=Object.freeze([
 'index.html','auth-session.js','account-recovery.js','client-export.js','client-backup-preview.js','work-calendar.js',
 'shared-holidays.js','work-dashboard.js','work-actions.js','task-quick-editor.js',
 'task-order.js','gantt-workbench.js','daily-report.js','sw.js'
]);
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function localFingerprint(asset,root=__dirname){
 if(!ASSETS.includes(asset))throw Error('Recurso de publicación no permitido');
 return sha(fs.readFileSync(path.join(root,asset)));
}
async function remoteFingerprint(asset,fetcher=fetch){
 if(!ASSETS.includes(asset))throw Error('Recurso de publicación no permitido');
 const url=new URL(asset+'?release_check='+Date.now(),SITE);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetcher(url.href,{redirect:'follow',signal:controller.signal,headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}});
  if(!response.ok||new URL(response.url||url.href).origin!==url.origin)throw Error(asset+': HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length===0)throw Error(asset+': respuesta vacía');
  return sha(bytes);
 }finally{clearTimeout(timer)}
}
async function checkOnce({root=__dirname,fetcher=fetch}={}){
 const mismatches=[];
 for(const asset of ASSETS){
  try{
   const remote=await remoteFingerprint(asset,fetcher);
   const local=localFingerprint(asset,root);
   if(local!==remote)mismatches.push(asset+': versión publicada diferente');
  }catch(e){mismatches.push(asset+': '+String(e.message||e).slice(0,150))}
 }
 return mismatches;
}
async function run({attempts=24,delayMs=15000,check=checkOnce}={}){
 if(!Number.isInteger(attempts)||attempts<1||attempts>40)throw Error('Intentos fuera de rango');
 let mismatches=[];
 for(let attempt=1;attempt<=attempts;attempt++){
  mismatches=await check();
  if(mismatches.length===0){
   console.log('PASS: GitHub Pages entrega exactamente los 12 recursos de este commit de main.');
   return true;
  }
  console.log('Comprobación pública '+attempt+'/'+attempts+': '+mismatches.slice(0,5).join('; '));
  if(attempt<attempts)await pause(delayMs);
 }
 throw Error('PUBLICACIÓN NO VERIFICADA: '+mismatches.join('; '));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={SITE,ASSETS,sha,localFingerprint,remoteFingerprint,checkOnce,run};
