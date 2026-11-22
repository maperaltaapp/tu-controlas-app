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
 ['elite_history','id'],
 ['elite_ai_learnings','id'],
 ['elite_ai_learning_history','id'],
 ['elite_ai_corrections','id'],
 ['elite_ai_correction_history','id'],
 ['elite_ai_agent_settings','user_id']
]);
const LIMIT_ROWS=120000,LIMIT_BYTES=60*1024*1024;
function own(userId){if(typeof userId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId))throw Error('No se pudo identificar la cuenta autenticada.');return userId.toLowerCase()}
function check({format,version,owner_id,tables,counts},userId){
 const uid=own(userId);
 if(format!=='tu-controlas-structured-export'||version!==1||owner_id!==uid||!tables||typeof tables!=='object')throw Error('Exportación incompatible o de otra cuenta.');
 for(const [table] of SOURCES){
  if(!Array.isArray(tables[table])||counts?.[table]!==tables[table].length)throw Error('Faltan registros de '+table+'.');
  if(tables[table].some(row=>!row||typeof row!=='object'||row.user_id!==uid))throw Error('Datos de otro propietario en '+table+'. Exportación cancelada.');
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
  if(rows.some(row=>!row||typeof row!=='object'||row.user_id!==uid))throw Error('Datos de otra cuenta detectados en '+table+'. Exportación cancelada.');
  total+=rows.length;
  if(total>LIMIT_ROWS)throw Error('Exportación demasiado grande. Contacta con soporte para exportación por partes.');
  tables[table]=rows;counts[table]=rows.length;
 }
 const created=time();
 if(!(created instanceof Date)||!Number.isFinite(created.getTime()))throw Error('Fecha de exportación no válida.');
 const snapshot={
  format:'tu-controlas-structured-export',
  version:1,
  owner_id:uid,
  exported_at:created.toISOString(),
  scope:'datos estructurados: obras, tareas, Gantt, partes, costes, calendario, historial y registros históricos',
  excluded:['archivos binarios y documentos externos','suscripciones push y tokens de notificación','credenciales y tokens de sesión'],
  restoration_supported:false,
  consistency:'lecturas paginadas no transaccionales; una edición simultánea puede alterar la instantánea',
  counts,tables
 };
 check(snapshot,uid);guard();
 const json=JSON.stringify(snapshot,null,2);
 if(json.length>LIMIT_BYTES)throw Error('Exportación demasiado grande. Contacta con soporte.');
 return {snapshot,json,filename:'tu-controlas-datos-'+created.toISOString().slice(0,10)+'.json'};
}
function download(result,{doc=root.document,webUrl=root.URL,BlobType=root.Blob}={}){
 if(!result||typeof result.json!=='string'||!doc||!webUrl?.createObjectURL||!BlobType)throw Error('Este navegador no permite descargar el archivo.');
 const blob=new BlobType([result.json],{type:'application/json;charset=utf-8'});
 const url=webUrl.createObjectURL(blob),link=doc.createElement('a');
 try{link.href=url;link.download=result.filename;link.style.display='none';doc.body.appendChild(link);link.click();}
 finally{link.remove();setTimeout(()=>webUrl.revokeObjectURL(url),1000);}
}
root.TCExport={sources:SOURCES,build,check,download};
if(typeof module!=='undefined')module.exports=root.TCExport;
})(typeof window==='undefined'?globalThis:window);
