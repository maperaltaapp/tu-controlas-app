#!/usr/bin/env node
'use strict';
// Generates a PRIVATE, isolated deployment directory. Does not deploy, provision
// Supabase, copy databases, or expose service-role secrets.
const fs=require('node:fs'),path=require('node:path');
const LEGACY_REF='vyswxgbbqyffnduhhrvz',LEGACY_ORIGIN='https://maperaltaapp.github.io';
const LEGACY_FILES_START="const WORK_FILES_BUCKET='elite-work-files'";
const OLD_SESSION='tc_session_v1',NEW_SESSION='tc_commercial_session_v1';
const EXTRAS=['manifest.webmanifest','sw.js','icon.svg','icon-192.png','icon-512.png'];
function commercialConfig(env){
 const ref=(env.TC_COMMERCIAL_SUPABASE_REF||'').trim();
 const publishable=(env.TC_COMMERCIAL_PUBLISHABLE_KEY||'').trim();
 const rawUrl=(env.TC_COMMERCIAL_SITE_URL||'').trim();
 if(!/^[a-z0-9]{20}$/.test(ref)||ref===LEGACY_REF)
  throw Error('Se necesita una referencia de Supabase COMERCIAL distinta de la infraestructura laboral.');
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
 const safe=String.raw