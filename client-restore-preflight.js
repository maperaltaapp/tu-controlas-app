/* TU CONTROLAS V1: comprobación previa de restauración INDIVIDUAL.
   Solo lectura, nunca llama a POST/PATCH/DELETE ni restaura registros.
   Bloquea la restauración cuando la cuenta tiene datos existentes. */
(function(root){'use strict';
const LIMIT_BYTES=60*1024*1024;
const TABLE_ORDER=Object.freeze([
 'elite_works','elite_contractors','elite_work_contractors','elite_tasks',
 'elite_work_plans','elite_plan_versions','elite_plan_exceptions',
 'elite_work_checklist_items','elite_daily_reports','elite_incidents',
 'elite_capacity_reviews','elite_contract_plan_versions','elite_contract_plan_drafts',
 'elite_holiday_calendars','elite_task_orders','elite_history'
]);
async function inspect({file,userId,read,guard=()=>{},previewApi=root.TCBackupPreview,exportApi=root.TCExport}={}){
 if(typeof guard!=='function'||typeof read!=='function')throw Error('No hay una conexión segura para comprobar el destino.');
 guard();
 const candidate=await previewApi.inspect({file,userId,exportApi});
 guard();
 if(candidate.owner_id!==userId)throw Error('La copia es de otra cuenta.');
 const registered=exportApi.sources.map(pair=>pair[0]);
 const order=candidate.version===3&&exportApi===root.TCBackupV3?registered:TABLE_ORDER;
 if(registered.length!==order.length||new Set(registered).size!==order.length||
    !order.every(table=>registered.includes(table)))throw Error('Versión de exportación no compatible con esta simulación.');
 const counters=Object.create(null);let currentTotal=0;
 for(const table of order){
  guard();
  // Only one owner row per table is needed; never download all private records.
  const rows=await read(table,'user_id=eq.'+encodeURIComponent(userId)+'&select=user_id&limit=1');
  guard();
  if(!Array.isArray(rows))throw Error('No se pudo comprobar la tabla '+table+'.');
  if(rows.some(v=>!v||v.user_id!==userId))throw Error('Respuesta de otro propietario en '+table+'.');
  const occupied=rows.length>0;counters[table]=occupied?'con datos':'vacía';
  if(occupied)currentTotal++;
 }
 // Some structured or economic records are omitted from export v2. A full
 // recovery cannot be claimed while these auxiliary tables may hold data.
 for(const table of ['elite_work_economic_entries','elite_ai_learnings','elite_ai_corrections'].filter(t=>!order.includes(t))){
  guard();const rows=await read(table,'user_id=eq.'+encodeURIComponent(userId)+'&select=user_id&limit=1');
  guard();
  if(!Array.isArray(rows)||rows.some(v=>!v||v.user_id!==userId))throw Error('No se pudo verificar la tabla complementaria '+table+'.');
  counters[table]=rows.length?'con datos':'vacía';
  if(rows.length)currentTotal++;
 }
 if(!file||Number.isFinite(file.size)&&file.size>LIMIT_BYTES)throw Error('Copia incompatible o demasiado grande.');
 const issues=Array.isArray(candidate.warnings)?candidate.warnings:[];
 const clean=candidate.references_consistent===true&&candidate.issue_count===0&&!candidate.warnings_truncated;
 const empty=currentTotal===0;
 const supported=candidate.version===3&&exportApi===root.TCBackupV3;
 const eligible=supported&&clean&&empty;
 return Object.freeze({
  valid_archive:candidate.valid===true,
  owner_id:userId,records:candidate.records,table_count:candidate.table_count,
  consistency_ok:clean,destination_empty:empty,existing_table_count:currentTotal,
  destination_tables:counters,preview_issues:issues,
  restoration_supported:supported,can_restore_now:eligible,
  blocked_reasons:[
   ...(clean?[]:['La copia contiene referencias inconsistentes o advertencias que requieren revisión.']),
   ...(empty?[]:['La cuenta de destino ya contiene datos. No se permite sobrescribirlos ni fusionar registros.']),
   ...(!supported?['Esta copia antigua solo puede verificarse; la recuperación requiere una copia V3.']:[])
  ],
  message:eligible?
   'Copia V3 coherente y cuenta vacía. Solo puede recuperarse con confirmación expresa.':
   'No se puede restaurar esta copia en la cuenta actual. No se han modificado registros.'
 });
}
root.TCRestorePreflight={inspect,tableOrder:TABLE_ORDER};
if(typeof module!=='undefined')module.exports=root.TCRestorePreflight;
})(typeof window==='undefined'?globalThis:window);
