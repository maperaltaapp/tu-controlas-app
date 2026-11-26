/* TU CONTROLAS · Cost-derived progress weights with exact 0.01%-point accounting.
   This module never writes budgets, approved cost baselines or planning snapshots. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TCWeights=api})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const validAmount=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e10;
const leaves=rows=>{const children=new Set((rows||[]).map(r=>r.parent_id).filter(Boolean));return (rows||[]).filter(r=>r?.id&&!r.is_group&&!r.milestone&&!children.has(r.id))};
function allocate(costs){
 if(!Array.isArray(costs)||!costs.length||costs.length>100||costs.some(n=>!validAmount(n)))throw Error('Indica los costes previstos de todas las partidas.');
 const total=costs.reduce((a,b)=>a+b,0);
 if(!Number.isFinite(total)||total<=0)throw Error('El coste previsto total debe ser mayor que cero.');
 const shares=costs.map((v,i)=>({i,raw:v/total*10000}));
 const cents=shares.map(x=>Math.floor(x.raw+1e-10));
 let remaining=10000-cents.reduce((a,b)=>a+b,0);
 if(remaining<0||remaining>costs.length)throw Error('No se pudo redondear el reparto.');
 for(const item of [...shares].sort((a,b)=>(b.raw-Math.floor(b.raw))-(a.raw-Math.floor(a.raw))||a.i-b.i).slice(0,remaining))cents[item.i]++;
 return cents.map(v=>v/100);
}
function equalAdjust(current,index,desired){
 if(!Array.isArray(current)||!current.length||current.length>100||!Number.isInteger(index)||index<0||index>=current.length)throw Error('Selecciona una partida válida.');
 const toCents=n=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)throw Error('Peso no válido: debe estar entre 0 % y 100 %.');return Math.round(n*100)};
 const originalSum=current.reduce((a,b)=>a+b,0);
 if(Math.abs(originalSum-100)>.01)throw Error('Primero normaliza los pesos para que sumen 100 %.');
 const now=allocate(current).map(toCents);
 const wanted=toCents(desired);if(now.length===1){if(wanted!==10000)throw Error('La única partida debe pesar 100 %.');return [100];}
 const diff=wanted-now[index],others=now.map((_,i)=>i).filter(i=>i!==index);
 if(diff>0){
  let toRemove=diff,available=others.filter(i=>now[i]>0);
  while(toRemove>0){
   if(!available.length)throw Error('No se pueden reducir más los pesos restantes.');
   const equal=Math.max(1,Math.floor(toRemove/available.length));
   for(const i of available){
    if(!toRemove)break;
    const take=Math.min(equal,now[i],toRemove);now[i]-=take;toRemove-=take;
   }
   available=available.filter(i=>now[i]>0);
  }
 }else if(diff<0){
  let give=-diff;
  const each=Math.floor(give/others.length);
  for(const i of others)now[i]+=each;
  give-=each*others.length;
  for(let i=0;i<give;i++)now[others[i]]++;
 }
 now[index]=wanted;
 if(now.reduce((a,b)=>a+b,0)!==10000)throw Error('La suma de pesos no es 100,00 %.');
 return now.map(v=>v/100);
}
function derive(plan,entries=[],snapshots=[],date='9999-12-31',respectManual=true){
 const rows=leaves(plan?.phases);if(!rows.length)return {rows:[],weights:[],source:'none',reason:'No hay partidas ejecutables en el Gantt.',costs:[]};
 const stored=rows.map(r=>Number(r.weight));
 const validStored=stored.every(n=>validAmount(n)&&n<=100)&&Math.abs(stored.reduce((a,b)=>a+b,0)-100)<.005;
 const manualSaved=respectManual&&rows.every(r=>r.weight_source==='manual')&&validStored;
 const unavailable=(reason,costs=[])=>manualSaved?{rows,weights:stored,source:'manual',reason:'Pesos manuales guardados. '+reason,costs}:{rows,weights:validStored?stored:null,source:'unavailable',reason,costs};
 const baselines=(snapshots||[]).filter(s=>s.snapshot_type==='baseline'&&s.as_of<=date).sort((a,b)=>a.as_of.localeCompare(b.as_of)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const approved=baselines.at(-1),byId=new Map(),costs=[];
 if(approved){
  const approvedLines=approved.activity_costs||[];
  if(!Array.isArray(approvedLines)||approvedLines.length!==rows.length)return unavailable('La línea base de costes aprobada no coincide con las partidas del Gantt. Revisar antes de calcular.');
  for(const l of approvedLines)if(!l||!l.activity_id||byId.has(l.activity_id)||!validAmount(Number(l.amount)))return unavailable('Costes de línea base incompletos o duplicados.');else byId.set(l.activity_id,Number(l.amount));
  for(const p of rows)costs.push(byId.get(p.id));
  if(costs.some(n=>n===undefined))return unavailable('Falta una partida en la línea base de costes.');
 }else{
  const budget=(entries||[]).filter(e=>e.kind==='budget'&&e.entry_date<=date&&e.activity_id&&validAmount(Number(e.amount)));
  for(const entry of budget)byId.set(entry.activity_id,(byId.get(entry.activity_id)||0)+Number(entry.amount));
  for(const p of rows)costs.push(byId.get(p.id));
  if(costs.some(n=>n===undefined))return unavailable('Completa el coste previsto de todas las partidas para calcular pesos automáticamente.');
 }
 try {
  const weights=allocate(costs);
  if(manualSaved)return {rows,weights:stored,source:'manual',reason:'Pesos ajustados manualmente y guardados en el Gantt.',costs};
  return {rows,weights,source:approved?'approved':'budget',reason:approved?'Pesos calculados sobre costes de la línea base de ejecución aprobada.':'Pesos provisionales calculados sobre costes de oferta por partida, hasta aprobar el presupuesto de ejecución del PM.',costs};
 }catch(e){return unavailable(e.message,costs);}
}
function apply(plan,rows,weights,mode){
 if(!['manual','cost'].includes(mode))throw Error('Modo de pesos no válido.');
 if(rows.length!==weights.length)throw Error('Las partidas no coinciden.');
 const cents=weights.map(w=>Math.round(Number(w)*100));
 if(cents.some(n=>!Number.isFinite(n)||n<0||n>10000)||cents.reduce((a,b)=>a+b,0)!==10000)throw Error('Los pesos deben sumar exactamente 100,00 %.');
 const copy=structuredClone(plan?.phases||[]),map=new Map(rows.map((p,i)=>[p.id,weights[i]]));
 if(map.size!==rows.length||leaves(copy).length!==rows.length||leaves(copy).some(p=>!map.has(p.id)))throw Error('Las partidas cambiaron durante la edición.');
 for(const p of copy)if(map.has(p.id)){p.weight=map.get(p.id);p.weight_source=mode;}
 return copy;
}
return {validAmount,leaves,allocate,equalAdjust,derive,apply};
});
