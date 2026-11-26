/* TU CONTROLAS V4: all owner-owned structured data, one server snapshot.
   Excludes authentication secrets, push keys and customer documents. */
(function(root){'use strict';
const SOURCE_KEYS=Object.freeze([
 ['elite_works','id'],['elite_contractors','id'],['elite_work_contractors','id'],
 ['elite_tasks','id'],['elite_work_plans','work_id'],['elite_plan_versions','id'],
 ['elite_plan_exceptions','id'],['elite_work_checklist_items','id'],
 ['elite_daily_reports','id'],['elite_incidents','id'],['elite_capacity_reviews','id'],
 ['elite_contract_plan_versions','id'],['elite_contract_plan_drafts','work_id'],
 ['elite_holiday_calendars','user_id'],['elite_task_orders','user_id,group_key'],
 ['elite_history','id'],['elite_work_economic_entries','id'],['tc_cost_forecast_snapshots','id'],
 ['elite_ai_learnings','id'],['elite_ai_corrections','id'],
 ['elite_ai_learning_history','id'],['elite_ai_correction_history','id'],
 ['elite_ai_agent_settings','user_id']
]);
const MAX_ROWS=120000,MAX_BYTES=60*1024*1024;
const SECRET=/(?:^|_)(?:password|passwd|passphrase|credential|credentials|secret|token|jwt|api_key|private_key|service_role|authorization)(?:$|_)/i;
const own=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(v)?v.toLowerCase():(()=>{throw Error('Cuenta no válida.')})();
function noSecrets(obj,depth=0){if(depth>45)throw Error('Datos anidados fuera del límite.');if(!obj||typeof obj!=='object')return;for(const [k,v] of Object.entries(obj)){if(SECRET.test(k))throw Error('Se encontró un dato confidencial; copia cancelada.');noSecrets(v,depth+1)}}
function check(snapshot,userId){
 const uid=own(userId),names=new Set(SOURCE_KEYS.map(x=>x[0]));
 if(!snapshot||snapshot.format!=='tu-controlas-structured-export'||snapshot.version!==4||snapshot.owner_id!==uid||!snapshot.tables||!snapshot.counts)throw Error('Copia V3 incompatible o de otra cuenta.');
 if(Object.keys(snapshot.tables).length!==names.size||Object.keys(snapshot.tables).some(n=>!names.has(n)))throw Error('Tablas incompletas o inesperadas en la copia.');
 let count=0;
 for(const [table] of SOURCE_KEYS){
  const rows=snapshot.tables[table];
  if(!Array.isArray(rows)||rows.length!==snapshot.counts[table])throw Error('Recuentos inconsistentes: '+table);
  count+=rows.length;if(count>MAX_ROWS)throw Error('Copia demasiado grande.');
  for(const row of rows){if(!row||typeof row!=='object'||Array.isArray(row)||row.user_id!==uid)throw Error('Registro de otra cuenta en '+table);noSecrets(row)}
 }
 if(Object.keys(snapshot.counts).length!==names.size)throw Error('Recuentos adicionales no permitidos.');
 return count;
}
async function digest(value){
 if(!root.crypto?.subtle?.digest)throw Error('SHA-256 no está disponible.');
 const raw=new TextEncoder().encode(JSON.stringify(value));
 return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function build({userId,read,guard=()=>{}}={}){
 const uid=own(userId);if(typeof read!=='function')throw Error('No se pueden leer los datos.');
 guard();const payload=await read();guard();
 if(payload?.owner_id!==uid)throw Error('Copia de otra cuenta.');
 const snapshot={
  format:'tu-controlas-structured-export',version:4,owner_id:uid,
  exported_at:payload.exported_at,scope:'23 tablas estructuradas del cliente, incluidos costes y conocimientos de IA',
  excluded:['archivos y documentos externos','suscripciones push y claves de dispositivos','contraseñas, sesiones y credenciales de Auth'],
  restoration_supported:true,restoration_mode:'empty_account_only',
  consistency:'instantánea consistente de una única transacción de consulta de PostgreSQL',
  counts:payload.counts,tables:payload.tables
 };
 const count=check(snapshot,uid);guard();
 snapshot.integrity={algorithm:'SHA-256',sha256:await digest(snapshot),scope:'detecta alteraciones accidentales, no autentica al autor'};
 guard();const json=JSON.stringify(snapshot,null,2);
 if(new TextEncoder().encode(json).byteLength>MAX_BYTES)throw Error('Copia demasiado grande para el dispositivo.');
 const safeDate=new Date(snapshot.exported_at);
 if(!Number.isFinite(safeDate.getTime()))throw Error('Fecha de la copia no válida.');
 return {snapshot,json,filename:'tu-controlas-copia-'+safeDate.toISOString().replace(/[:.]/g,'-')+'-'+snapshot.integrity.sha256.slice(0,12)+'.json',records:count};
}
async function verify(snapshot,userId){
 check(snapshot,userId);
 if(snapshot.integrity?.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(snapshot.integrity.sha256))throw Error('Falta la comprobación de integridad.');
 const {integrity,...data}=snapshot;
 if(await digest(data)!==integrity.sha256)throw Error('El archivo ha sido modificado o está dañado.');
 return true;
}
function download(result,config){return root.TCExport.download(result,config)}
const api={sources:SOURCE_KEYS,build,check,verify,download};
root.TCBackupV4=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
