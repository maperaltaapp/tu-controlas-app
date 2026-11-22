/* TU CONTROLAS: inspección LOCAL de exportaciones; jamás escribe ni envía datos a servidor. */
(function(root){
'use strict';
const SIZE_LIMIT=60*1024*1024;
async function inspect({file,userId,exportApi=root.TCExport}){
 if(!file||typeof file.text!=='function')throw Error('Selecciona un archivo JSON válido.');
 if(Number.isFinite(file.size)&&file.size>SIZE_LIMIT)throw Error('Archivo demasiado grande para comprobar en este dispositivo.');
 if(!exportApi?.verify||!Array.isArray(exportApi.sources))throw Error('No está disponible el verificador de copias.');
 const raw=await file.text();
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>SIZE_LIMIT)throw Error('El archivo supera el límite permitido.');
 let snapshot;
 try{snapshot=JSON.parse(raw)}catch{throw Error('El archivo no es un JSON válido.');}
 await exportApi.verify(snapshot,userId);
 const works=new Set(snapshot.tables.elite_works.map(row=>row.id));
 const counts=Object.fromEntries(exportApi.sources.map(([name])=>[name,snapshot.tables[name].length]));
 const warnings=[];
 let records=0;
 for(const [name,primary] of exportApi.sources){
  const keys=primary.split(',');
  const seen=new Set();
  for(const row of snapshot.tables[name]){
   records++;
   const id=JSON.stringify(keys.map(k=>row[k]??null));
   if(keys.some(k=>row[k]===undefined||row[k]===null))warnings.push(name+': registro sin clave completa');
   if(seen.has(id))warnings.push(name+': clave duplicada');
   seen.add(id);
   if(name!=='elite_works'&&row.work_id&&!works.has(row.work_id))warnings.push(name+': referencia a obra ausente');
  }
 }
 return {
  valid:true,owner_id:snapshot.owner_id,version:snapshot.version,
  exported_at:snapshot.exported_at,table_count:exportApi.sources.length,
  records,counts,warnings,
  restoration_supported:false,
  message:'Integridad del archivo comprobada en este dispositivo. No se han restaurado ni subido datos.'
 };
}
root.TCBackupPreview={inspect};
if(typeof module!=='undefined')module.exports=root.TCBackupPreview;
})(typeof window==='undefined'?globalThis:window);
