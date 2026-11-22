/* TU CONTROLAS: exportación de datos exclusivamente del usuario autenticado.
   No incluye credenciales, claves, suscripciones push ni archivos adjuntos.
   No realiza ninguna escritura en el servidor ni implementa restauración. */
(function(root){
'use strict';
const SOURCES=Object.freeze([
 ['elite_works','id'],
 ['elite_tasks','id'],
 ['elite_work_plans','work_id'],
 ['elite_plan_versions','id'],
 ['elite_plan_exceptions','id'],
 ['elite_contractors','id'],
 ['elite_work_contractors','id'],
 ['elite_work_checklist_items','id'],
 ['elite_daily_reports','id'],
 ['elite_incidents','id'],
 ['elite_capacity_reviews','id'],
 ['elite_contract_plan_versions','id'],
 ['elite_contract_plan_drafts','work_id'],
 ['elite_holiday_calendars','user_id'],
 ['elite_task_orders','user_id,group_key'],
 ['elite_history','id']
]);
const LIMIT_ROWS=120000,LIMIT_BYTES=60*1024*1024;
const SECRET_KEY=/(?:^|_)(?:password|passwd|passphrase|credential|credentials|secret|token|jwt|api_key|private_key|service_role|authorization)(?:$|_)/i;
const utf8=value=>new TextEncoder().encode(value);
function ensureNoSecrets(value,depth=0){
 if(depth>45)throw Error('Datos demasiado anidados para una exportación segura.');
 if(!value||typeof value!=='object')return;
 for(const [key,nested] of Object.entries(value)){
  if(SECRET_KEY.test(key))throw Error('Se ha encontrado un campo confidencial. Exportación cancelada.');
  ensureNoSecrets(nested,depth+1);
 }
}
async function digest(payload){
 if(!root.crypto?.subtle?.digest)throw Error('Este navegador no admite comprobación SHA-256 segura.');
 const data=utf8(JSON.stringify(payload));
 const result=await root.crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(result),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function own(userId){if(typeof userId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId))throw Error('No se pudo identificar la cuenta autenticada.');return userId.toLowerCase()}
function check({format,version,owner_id,tables,counts},userId){
 const uid=own(userId);
 if(format!=='tu-controlas-structured-export'||version!==2||owner_id!==uid||!tables||typeof tables!=='object'||Array.isArray(tables))throw Error('Exportación incompatible o de otra cuenta.');
 const expected=new Set(SOURCES.map(([table])=>table));
 if(Object.keys(tables).length!==expected.size||Object.keys(tables).some(table=>!expected.has(table)))throw Error('Las tablas no coinciden con el formato permitido.');
 for(const [table] of SOURCES){
  if(!Array.isArray(tables[table])||counts?.[table]!==tables[table].length)throw Error('Faltan registros de '+table+'.');
  if(tables[table].some(row=>!row||typeof row!=='object'||Array.isArray(row)||row.user_id!==uid))throw Error('Datos de otro propietario en '+table+'. Exportación cancelada.');
  for(const row of tables[table])ensureNoSecrets(row);
 }
 return true;
}
async function build({userId,read,guard=()=>{},time=()=>new Date()}){
 const uid=own(userId);
 if(typeof read!=='function')throw Error('No hay conexión autenticada a los datos.');
 const tables=Object.create(null),counts=Object.create(null);let total=0;
 for(const [table,primary] of SOURCES){
  guard();
  const query='user_id=eq.'+encodeURIComponent(uid)+'&order='+primary.split(',').map(k=>k+'.asc').join(',');
  const rows=await read(table,query);
  guard();
  if(!Array.isArray(rows))throw Error('No se pudieron leer todos los registros de '+table+'.');
  if(rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)||row.user_id!==uid))throw Error('Datos de otra cuenta detectados en '+table+'. Exportación cancelada.');
  for(const row of rows)ensureNoSecrets(row);
  total+=rows.length;
  if(total>LIMIT_ROWS)throw Error('Exportación demasiado grande. Contacta con soporte para exportación por partes.');
  tables[table]=rows;counts[table]=rows.length;
 }
 const created=time();
 if(!(created instanceof Date)||!Number.isFinite(created.getTime()))throw Error('Fecha de exportación no válida.');
 const snapshot={
  format:'tu-controlas-structured-export',
  version:2,
  owner_id:uid,
  exported_at:created.toISOString(),
  scope:'obras, tareas, Gantt, partes, subcontratas, calendarios e historial operativo; sin tablas históricas de IA',
  excluded:['archivos binarios y documentos externos','suscripciones push y tokens de notificación','credenciales y tokens de sesión'],
  restoration_supported:false,
  consistency:'lecturas paginadas no transaccionales; una edición simultánea puede alterar la instantánea',
  counts,tables
 };
 check(snapshot,uid);guard();
 const sha256=await digest(snapshot);
 guard();
 snapshot.integrity={algorithm:'SHA-256',sha256,scope:'integridad accidental; no demuestra autenticidad',hash_encoding:'JSON.stringify sin metadatos de integridad'};
 const json=JSON.stringify(snapshot,null,2);
 if(utf8(json).byteLength>LIMIT_BYTES)throw Error('Exportación demasiado grande. Contacta con soporte.');
 return {snapshot,json,filename:'tu-controlas-datos-'+created.toISOString().slice(0,10)+'.json'};
}
async function verify(snapshot,userId){
 check(snapshot,userId);
 const integrity=snapshot.integrity;
 if(!integrity||integrity.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(integrity.sha256||''))throw Error('Falta la huella de integridad del archivo.');
 const {integrity:ignored,...payload}=snapshot;
 const calculated=await digest(payload);
 if(calculated!==integrity.sha256)throw Error('Los datos del archivo han sido modificados o dañados.');
 return true;
}
function download(result,{doc=root.document,webUrl=root.URL,BlobType=root.Blob}={}){
 if(!result||typeof result.json!=='string'||!doc||!webUrl?.createObjectURL||!BlobType)throw Error('Este navegador no permite descargar el archivo.');
 const blob=new BlobType([result.json],{type:'application/json;charset=utf-8'});
 const url=webUrl.createObjectURL(blob),link=doc.createElement('a');
 try{link.href=url;link.download=result.filename;link.style.display='none';doc.body.appendChild(link);link.click();}
 finally{link.remove();setTimeout(()=>webUrl.revokeObjectURL(url),1000);}
}
root.TCExport={sources:SOURCES,build,check,verify,download};
if(typeof module!=='undefined')module.exports=root.TCExport;
})(typeof window==='undefined'?globalThis:window);
