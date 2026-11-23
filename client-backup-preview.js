/* TU CONTROLAS: inspección LOCAL de exportaciones; jamás escribe ni envía datos a servidor. */
(function(root){
'use strict';
const SIZE_LIMIT=60*1024*1024;
const MAX_WARNINGS=20;
async function inspect({file,userId,exportApi=root.TCExport}){
 if(!file||typeof file.text!=='function')throw Error('Selecciona un archivo JSON válido.');
 if(Number.isFinite(file.size)&&file.size>SIZE_LIMIT)throw Error('Archivo demasiado grande para comprobar en este dispositivo.');
 if(!exportApi?.verify||!Array.isArray(exportApi.sources))throw Error('No está disponible el verificador de copias.');
 const raw=await file.text();
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>SIZE_LIMIT)throw Error('El archivo supera el límite permitido.');
 let snapshot;
 try{snapshot=JSON.parse(raw)}catch{throw Error('El archivo no es un JSON válido.');}
 await exportApi.verify(snapshot,userId);
 const tables=snapshot.tables;
 const works=new Set(tables.elite_works.map(row=>row.id));
 const tasks=new Map(tables.elite_tasks.map(row=>[row.id,row]));
 const contractors=new Set(tables.elite_contractors.map(row=>row.id));
 const controls=new Map(tables.elite_work_contractors.map(row=>[row.id,row]));
 const reports=new Map(tables.elite_daily_reports.map(row=>[row.id,row]));
 const counts=Object.fromEntries(exportApi.sources.map(([name])=>[name,tables[name].length]));
 const warnings=[];
 let records=0,issueCount=0;
 const warn=message=>{issueCount++;if(warnings.length<MAX_WARNINGS)warnings.push(message);};
 for(const [name,primary] of exportApi.sources){
  const keys=primary.split(',');
  const seen=new Set();
  for(const row of tables[name]){
   records++;
   const id=JSON.stringify(keys.map(k=>row[k]??null));
   if(keys.some(k=>row[k]===undefined||row[k]===null))warn(name+': registro sin clave completa');
   if(seen.has(id))warn(name+': clave duplicada');
   seen.add(id);
   if(name!=='elite_works'&&row.work_id!=null&&!works.has(row.work_id))warn(name+': referencia a obra ausente');
   if(name==='elite_tasks'){
    if(row.previous_task_id!=null){
     const predecessor=tasks.get(row.previous_task_id);
     if(!predecessor)warn(name+': tarea predecesora ausente');
     else if(predecessor.work_id!==row.work_id)warn(name+': tarea predecesora de otra obra');
    }
    if(row.control_id!=null){
     const control=controls.get(row.control_id);
     if(!control||control.work_id!==row.work_id)warn(name+': asignación de empresa ausente o de otra obra');
    }
   }
   if(name==='elite_work_contractors'&&row.contractor_id!=null&&!contractors.has(row.contractor_id))
    warn(name+': empresa asignada ausente');
   if(name==='elite_incidents'&&row.report_id!=null){
    const report=reports.get(row.report_id);
    if(!report||report.work_id!==row.work_id)warn(name+': parte vinculado ausente o de otra obra');
   }
   if(name==='elite_work_plans'&&Array.isArray(row.phases)){
    // Validate only the CURRENT plan. Historical baselines may legitimately refer
    // to removed activities and must remain exportable for traceability.
    const phaseIds=new Set(),linkedTasks=new Set();
    for(const phase of row.phases){
     if(!phase||typeof phase!=='object'||Array.isArray(phase)){
      warn(name+': actividad Gantt no válida');continue;
     }
     if(phase.id!=null){
      if(phaseIds.has(phase.id))warn(name+': identificador de actividad Gantt duplicado');
      phaseIds.add(phase.id);
     }
    }
    for(const phase of row.phases){
     if(!phase||typeof phase!=='object'||Array.isArray(phase))continue;
     if(phase.task_id!=null){
      const task=tasks.get(phase.task_id);
      if(!task||task.work_id!==row.work_id)warn(name+': actividad Gantt vinculada a tarea ausente o de otra obra');
      if(linkedTasks.has(phase.task_id))warn(name+': tarea vinculada a varias actividades Gantt');
      linkedTasks.add(phase.task_id);
     }
     if(phase.contractor_id!=null&&!contractors.has(phase.contractor_id))
      warn(name+': actividad Gantt con subcontrata ausente');
     if(phase.parent_id!=null&&!phaseIds.has(phase.parent_id))
      warn(name+': actividad Gantt con fase principal ausente');
     if(Array.isArray(phase.depends_on)){
      for(const predecessor of phase.depends_on){
       if(!phaseIds.has(predecessor)||predecessor===phase.id)
        warn(name+': actividad Gantt con dependencia ausente o sobre sí misma');
      }
     }
    }
   }
  }
 }
 return {
  valid:true,owner_id:snapshot.owner_id,version:snapshot.version,
  exported_at:snapshot.exported_at,table_count:exportApi.sources.length,
  records,counts,warnings,issue_count:issueCount,
  references_consistent:issueCount===0,warnings_truncated:issueCount>warnings.length,
  restoration_supported:false,
  message:'Integridad SHA-256 comprobada en este dispositivo. '+(issueCount?'Se detectaron incoherencias entre registros. ':'')+'No se han restaurado ni subido datos.'
 };
}
root.TCBackupPreview={inspect};
if(typeof module!=='undefined')module.exports=root.TCBackupPreview;
})(typeof window==='undefined'?globalThis:window);
