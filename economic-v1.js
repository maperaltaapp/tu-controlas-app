/* V1 panel económico progresivo. Sample stays in memory; NEVER writes real works. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TCEconomy=api})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const root=typeof window==='undefined'?globalThis:window;
const DEMO='__prueba__',DAY=86400000,VALID=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const day=s=>Date.parse(s+'T00:00:00Z')/DAY,iso=n=>new Date(n*DAY).toISOString().slice(0,10);
const leaves=rows=>{const parents=new Set(rows.map(r=>r.parent_id).filter(Boolean));return rows.filter(r=>!r.is_group&&!r.milestone&&!parents.has(r.id))};
const observed=(row,date)=>(row.observations||[]).filter(o=>o.date<=date&&VALID(o.percent)&&o.percent<=100).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)?.percent??null;
function physical(plan,date){const rows=leaves(plan.phases||[]),weight=rows.reduce((a,b)=>a+b.weight,0);if(!rows.length||Math.abs(weight-100)>.01)return null;const measured=rows.map(r=>observed(r,date));if(measured.some(v=>v===null))return null;return measured.reduce((n,v,i)=>n+rows[i].weight*v/100,0)}
function planned(plan,date){if(!plan.baseline_at)return null;const rows=leaves(plan.baseline||[]),weight=rows.reduce((a,b)=>a+b.weight,0);if(!rows.length||Math.abs(weight-100)>.01)return null;return rows.reduce((n,r)=>n+r.weight*Math.max(0,Math.min(1,(day(date)-day(r.start)+1)/(day(r.end)-day(r.start)+1))),0)}
function curve(plan,asOf){const rows=[...leaves(plan.phases||[]),...leaves(plan.baseline||[])];if(!rows.length)return {points:[],trend:[]};const from=Math.min(...rows.map(r=>day(r.start))),to=Math.max(day(asOf),...rows.map(r=>day(r.end)));if(!Number.isFinite(from)||!Number.isFinite(to)||to-from>3660)return {points:[],trend:[]};const dates=new Set([iso(from),iso(to),asOf]);const step=Math.max(1,Math.ceil((to-from)/80));for(let n=from;n<=to;n+=step)dates.add(iso(n));for(const r of plan.phases||[])for(const o of r.observations||[])if(o.date<=asOf)dates.add(o.date);
 const points=[...dates].sort().filter(d=>d>=iso(from)&&d<=iso(to)).map(date=>({date,planned:planned(plan,date),real:date<=asOf?physical(plan,date):null}));const measured=points.filter(p=>p.real!==null),last=measured.at(-1),previous=last?measured.findLast(p=>day(last.date)-day(p.date)>=7):null;let trend=[];if(previous&&last.real>=previous.real){const slope=(last.real-previous.real)/(day(last.date)-day(previous.date));const end=Math.min(to,day(last.date)+21);if(end>day(last.date)&&slope>0)trend=[{date:last.date,real:last.real},{date:iso(end),real:Math.min(100,last.real+slope*(end-day(last.date)))}]}return {points,trend};}
function finance(plan,entries,date){const rows=leaves(plan.phases||[]),past=entries.filter(e=>e.entry_date<=date&&VALID(Number(e.amount))),sums=(kind,id)=>past.filter(e=>e.kind===kind&&e.activity_id===id),total=a=>a.reduce((s,e)=>s+Number(e.amount),0);const b=rows.map(p=>sums('budget',p.id)),a=rows.map(p=>sums('actual',p.id)),completeB=rows.length>0&&b.every(x=>x.length>0),completeA=rows.length>0&&a.every(x=>x.length>0),baseline=new Map(leaves(plan.baseline||[]).map(p=>[p.id,p])),measured=rows.map(p=>observed(p,date));const bac=completeB?b.reduce((n,x)=>n+total(x),0):null,ac=completeA?a.reduce((n,x)=>n+total(x),0):null,ev=completeB&&measured.every(v=>v!==null)?rows.reduce((n,p,i)=>n+total(b[i])*measured[i]/100,0):null;let pv=null;if(completeB&&plan.baseline_at&&rows.every(p=>baseline.has(p.id)))pv=rows.reduce((n,p,i)=>{const original=baseline.get(p.id);return n+total(b[i])*Math.max(0,Math.min(1,(day(date)-day(original.start)+1)/(day(original.end)-day(original.start)+1)))},0);
 const divide=(a,b)=>VALID(a)&&VALID(b)&&b>0?a/b:null,cpi=divide(ev,ac),spi=divide(ev,pv),eac=VALID(bac)&&cpi>0?bac/cpi:null;const extra=k=>past.some(e=>e.kind===k)?total(past.filter(e=>e.kind===k)):null;return {bac,ac,ev,pv,cpi,spi,eac,contract:extra('contract'),certified:extra('certified'),rows:rows.map((p,i)=>({id:p.id,name:p.name,weight:p.weight,progress:measured[i],budget:b[i].length?total(b[i]):null,actual:a[i].length?total(a[i]):null}))};}
function example(){
 const parts=[['Preparación',20,'2026-11-01','2026-11-08',100,12000,10500],['Cimentación',35,'2026-11-07','2026-11-20',80,36000,32000],['Estructura',30,'2026-11-18','2026-12-03',30,30000,18000],['Remates',15,'2026-12-04','2026-12-20',0,12000,3000]];
 const phases=parts.map((r,i)=>({id:'prueba-'+i,name:r[0],weight:r[1],start:r[2],end:r[3],observations:[{date:'2026-11-01',percent:0},{date:'2026-11-12',percent:Math.round(r[4]*.3)},{date:'2026-11-18',percent:Math.round(r[4]*.7)},{date:'2026-11-24',percent:r[4]}]}));
 const baseline=phases.map(p=>({id:p.id,name:p.name,weight:p.weight,start:p.start,end:p.end}));
 const entries=parts.flatMap((r,i)=>[{kind:'budget',activity_id:'prueba-'+i,amount:r[5],entry_date:'2026-11-01'},{kind:'actual',activity_id:'prueba-'+i,amount:r[6],entry_date:'2026-11-24'}]);
 entries.push({kind:'contract',activity_id:null,amount:118000,entry_date:'2026-11-01'},{kind:'certified',activity_id:null,amount:42000,entry_date:'2026-11-24'});
 return {work:{id:DEMO,name:'Prueba',execution_state:'execution'},plan:{phases,baseline,baseline_at:'2026-11-01T00:00:00Z'},entries,date:'2026-11-24',demo:true};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=n=>n===null?'Sin datos':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const percent=n=>n===null?'Sin datos':new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n)+' %';
const decimal=n=>n===null?'No calculable':new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(n);
function graph(data,amountScale=null){
 const points=data.points;if(points.length<2)return '<div class="ec-no-graph">Para ver las curvas, fija una línea base y registra mediciones en el Gantt.</div>';
 const lo=day(points[0].date),hi=day(points.at(-1).date);
 const x=date=>Number(((day(date)-lo)/Math.max(1,hi-lo)*100).toFixed(3)),y=value=>Number((100-value).toFixed(3));
 const path=kind=>{let result='',connected=false;for(const p of points){if(p[kind]===null){connected=false;continue}result+=(connected?' L':' M')+x(p.date)+' '+y(p[kind]);connected=true}return result.trim()};
 const label=amountScale===null?'Curva de avance previsto y real ponderado por partidas':'Curva S de coste planificado y coste real acumulado';
 let svg='<div class="ec-plot"><svg class="ec-chart" role="img" aria-label="'+label+'"><title>'+label+'</title>';
 for(const tick of [0,25,50,75,100]){
  const caption=amountScale===null?tick+'%':new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(amountScale*tick/100)+' €';
  svg+=`<line x2="100%" y1="${y(tick)}%" y2="${y(tick)}%" stroke="#e0e6ed"/><text x="0" dx="-7" y="${y(tick)}%" dy=".32em" text-anchor="end">${caption}</text>`;
 }
 for(let i=0;i<=4;i++){
  const date=iso(lo+Math.round((hi-lo)*i/4)),anchor=i===0?'start':i===4?'end':'middle';
  svg+=`<text x="${x(date)}%" y="100%" dy="16" text-anchor="${anchor}">${date.slice(8,10)}/${date.slice(5,7)}</text>`;
 }
 // Only the line geometry scales. Axis labels keep the same readable size at every width.
 svg+='<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible">';
 for(const [kind,color] of [['planned','#246c9e'],['real','#16835d']]){
  svg+=`<path d="${path(kind)}" stroke="${color}" fill="none" stroke-width="2.1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
 }
 if(data.trend.length===2){const [a,b]=data.trend;svg+=`<path d="M${x(a.date)} ${y(a.real)} L${x(b.date)} ${y(b.real)}" stroke="#b9781e" fill="none" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`}
 svg+='</svg>';
 for(const [kind,color] of [['planned','#246c9e'],['real','#16835d']]){
  const last=points.filter(p=>p[kind]!==null).at(-1);
  if(last)svg+=`<circle cx="${x(last.date)}%" cy="${y(last[kind])}%" r="2.6" fill="${color}"/>`;
 }
 return svg+'</svg></div>';
}
if(typeof document==='undefined')return {DEMO,physical,planned,curve,finance,example,graph};
let shown=null,seq=0,saving=false;
const oldDetail=detail;
const validView=view=>shown===view&&view.epoch===sessionEpoch&&view.owner===session?.user?.id&&mode==='works'&&workDetailId===view.id;
const readEntries=id=>readAll('elite_work_economic_entries','work_id=eq.'+encodeURIComponent(id)+'&order=entry_date.asc,id.asc');
const metric=(name,value,description)=>'<article class="ec-metric"><span>'+escape(name)+'</span><strong>'+escape(value)+'</strong>'+(description?'<small>'+escape(description)+'</small>':'')+'</article>';
function inputCell(data,kind,activity,value){
 const sources=data.entries.filter(e=>e.kind===kind&&(e.activity_id||null)===(activity||null)&&e.entry_date<=data.date),locked=data.demo||sources.some(e=>e.source_name!=='Entrada manual');
 return '<input class="ec-input-cell" type="number" min="0" max="10000000000" step=".01" aria-label="'+escape((kind==='budget'?'Costes de Oferta':kind==='actual'?'Coste real':kind==='contract'?'Contrato':'Certificado')+' · '+(activity||'obra'))+'" data-cost-kind="'+kind+'" data-cost-activity="'+escape(activity||'')+'" value="'+(value===null?'':value)+'" placeholder="Sin datos" '+(locked?'readonly title="'+(data.demo?'Ejemplo de demostración':'Importe procedente de documentos')+'"':'')+'>';
}
function moneyCurve(plan,entries,date){const c=curve(plan,date),points=c.points.map(p=>{const f=finance(plan,entries,p.date);return {date:p.date,planned:f.pv,real:p.date<=date?f.ac:null}}),available=points.flatMap(p=>[p.planned,p.real]).filter(v=>v!==null),max=Math.max(1,...available);return graph({points:points.map(p=>({...p,planned:p.planned===null?null:p.planned/max*100,real:p.real===null?null:p.real/max*100})),trend:[]},max)}
function htmlPanel(data,warning){
 const {work,plan,entries,date}=data,f=finance(plan,entries,date),p=planned(plan,date),r=physical(plan,date),d=p===null||r===null?null:r-p,chart=curve(plan,date),end=leaves(plan.baseline||[]).map(x=>x.end).sort().at(-1);
 const options=[...NATIVE_WORKS.filter(w=>!w.archived_at||w.id===work.id).map(w=>[w.id,w.name]),[DEMO,'Prueba (ejemplo)']];
 let out='<div class="ec-panel-root"><div class="tc-tool-sticky"><nav class="tc-panel-tabs" aria-label="Panel de control"><button class="light" id="ecBack">Obras</button><button class="dark" id="ecCurrent" aria-current="page">Control económico</button></nav><div class="ec-actions"><label>Obra <select id="ecWork">'+options.map(q=>'<option value="'+escape(q[0])+'" '+(q[0]===work.id?'selected':'')+'>'+escape(q[1])+'</option>').join('')+'</select></label>';
 if(!data.demo)out+='<button id="ecImport" class="light">Adjuntar PDF / planilla</button>';else out+='<span class="ec-demo-label">Datos de ejemplo</span>';
 out+='<span class="ec-cutoff">Corte <time datetime="'+escape(date)+'">'+escape(date.split('-').reverse().join('/'))+'</time></span></div></div>';
 if(warning)out+='<p class="ec-warning">No se pudieron cargar los costes: '+escape(warning)+'</p>';
 out+='<div class="ec-top"><section class="ec-card ec-curve"><h2>Avance previsto frente al real</h2>'+graph(chart)+'<div class="ec-legend"><span><i class="ec-color-blue"></i>Previsto</span><span><i class="ec-color-green"></i>Real medido</span><span><i class="ec-color-orange"></i>Tendencia estimada</span></div></section><section class="ec-card ec-summary"><h2>Situación de la obra</h2>'+metric('Avance previsto',percent(p),'Línea base')+metric('Avance real',percent(r),'Mediciones ponderadas')+metric('Diferencia',d===null?'Sin datos':(d>0?'+':'')+new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(d)+' pp','Puntos porcentuales')+metric('Fin previsto',end?end.split('-').reverse().join('/'):'Sin línea base','Fecha del Gantt original')+'</section></div>';
 out+='<section class="ec-card ec-cost-card"><h2>Costes</h2><div class="ec-stats">'+metric('Costes de Oferta',euro(f.bac))+metric('Coste real acumulado',euro(f.ac))+'</div><details id="ecCosts" data-work="'+escape(work.id)+'"><summary>Costes por partidas <small>'+f.rows.length+' '+(f.rows.length===1?'partida':'partidas')+'</small></summary><p>Los importes manuales se editan en la tabla. Los importes importados muestran el valor del documento.</p><div class="ec-table-scroll"><table class="ec-entry-table"><thead><tr><th>Partida</th><th>Peso físico</th><th>Avance real</th><th>Costes de Oferta €</th><th>Coste real €</th></tr></thead><tbody>'+f.rows.map(row=>'<tr><td>'+escape(row.name)+'</td><td>'+percent(row.weight)+'</td><td>'+percent(row.progress)+'</td><td>'+inputCell(data,'budget',row.id,row.budget)+'</td><td>'+inputCell(data,'actual',row.id,row.actual)+'</td></tr>').join('')+'</tbody></table></div><div class="ec-table-scroll"><table><thead><tr><th>Contrato €</th><th>Certificado acumulado €</th></tr></thead><tbody><tr><td>'+inputCell(data,'contract',null,f.contract)+'</td><td>'+inputCell(data,'certified',null,f.certified)+'</td></tr></tbody></table></div><p id="ecCellStatus" role="status"></p></details></section>';
 out+='<section class="ec-card"><h2>Curvas S · costes acumulados</h2>'+moneyCurve(plan,entries,date)+'<div class="ec-legend"><span><i class="ec-color-blue"></i>PV · Coste planificado</span><span><i class="ec-color-green"></i>AC · Coste real</span></div></section>';
 out+='<section class="ec-card ec-indicators"><h2>Indicadores de control</h2><div class="ec-stats">'+metric('SPI · Plazo',decimal(f.spi),'EV / PV')+metric('CPI · Coste',decimal(f.cpi),'EV / AC')+metric('PV · Planificado',euro(f.pv),'Según línea base y costes de oferta')+metric('EV · Valor ganado',euro(f.ev),'Según avance medido')+metric('EAC · Coste estimado al cierre',euro(f.eac),'BAC / CPI, si CPI > 0')+'</div><details><summary>Criterios de cálculo</summary><p>Los pesos físicos proceden del Gantt. PV = coste de oferta por avance previsto; EV = coste de oferta por avance real; AC = coste real registrado. Sin cobertura completa o con divisor cero, el indicador no es calculable. La tendencia es una estimación, no una medición.</p></details></section></div>';
 return out;
}

async function show(id=DEMO){
 const data=id===DEMO?example():null,work=data?.work||NATIVE_WORKS.find(w=>w.id===id);
 if(!work){works();return}
 const oldCosts=$('ecCosts'),samePanel=oldCosts?.dataset.work===id&&shown?.epoch===sessionEpoch&&shown?.owner===session?.user?.id;
 const keepCosts=samePanel&&oldCosts.open,tableOffset=keepCosts?oldCosts.querySelector('.ec-table-scroll').scrollLeft:0;
 const view={id,epoch:sessionEpoch,owner:session?.user?.id},token=++seq;shown=view;mode='works';selectSection('works');workDetailId=id===DEMO?null:id;$('title').textContent='Panel de Control';
 let records=data?.entries||[],warning=null,plan=data?.plan||planOf(id);
 if(id!==DEMO){if(!view.owner||!session?.access_token)return;if(!samePanel)$('content').innerHTML='<p>Cargando datos económicos…</p>';try{records=await readEntries(id)}catch(e){warning=e.message}if(!validView(view)||token!==seq)return}
 $('content').innerHTML=htmlPanel({work,plan,entries:records,date:data?.date||planningToday(),demo:id===DEMO},warning);
 if(keepCosts){$('ecCosts').open=true;$('ecCosts').querySelector('.ec-table-scroll').scrollLeft=tableOffset}
 $('ecBack').onclick=()=>works();$('ecWork').onchange=e=>show(e.target.value);
 $('ecCurrent').onclick=()=>show(id);
 if(id!==DEMO){$('ecImport').onclick=()=>importDialog(view,plan);document.querySelectorAll('[data-cost-kind]:not([readonly])').forEach(input=>input.onchange=async()=>{if(!validView(view)||saving)return;const raw=input.value.trim(),total=Number(raw),activity=input.dataset.costActivity||null,kind=input.dataset.costKind;if(!raw||!VALID(total)||total>1e10){$('ecCellStatus').textContent='Introduce un importe válido, incluido 0.';return}const sources=records.filter(e=>e.kind===kind&&(e.activity_id||null)===activity).sort((a,b)=>a.id.localeCompare(b.id)).map(e=>({id:e.id,amount:Number(e.amount),source_name:e.source_name}));saving=true;input.disabled=true;try{await eliteRequest('/rest/v1/rpc/tc_set_manual_cost',{method:'POST',body:JSON.stringify({target_work:id,target_activity:activity,target_kind:kind,expected_rows:sources,new_total:total})});if(!validView(view))return;const live=await readEntries(id);if(!validView(view))return;const changed=live.filter(e=>e.kind===kind&&(e.activity_id||null)===activity).reduce((n,e)=>n+Number(e.amount),0);if(Math.abs(changed-total)>.001)throw Error('No se verificó el importe. Actualiza antes de reintentar.');await show(id)}catch(e){if(validView(view)){$('ecCellStatus').textContent=e.message;input.disabled=false}}finally{saving=false}})}
}
function row(info,activity,kind,amount,sourceName,sourceLine){return {work_id:info.id,activity_id:activity,kind,amount:Math.round(amount*100)/100,entry_date:planningToday(),source_name:sourceName,source_line:sourceLine}}
async function save(info,records){
 if(!validView(info)||saving)throw Error('La cuenta o la obra cambió. Abre el formulario nuevamente.');
 saving=true;try{
  const created=await eliteRequest('/rest/v1/elite_work_economic_entries',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(records)});
  if(!validView(info))return;
  if(created?.length!==records.length)throw Error('La base no confirmó todos los importes. Actualiza antes de reintentar.');
  const live=await readEntries(info.id);
  if(!validView(info))return;
  const ids=new Set(live.map(e=>e.id));if(created.some(e=>!ids.has(e.id)))throw Error('No se verificó la lectura posterior de importes.');
  closeTaskDialog();await show(info.id);
 }finally{saving=false}
}
function manual(info,plan){
 if(!validView(info))return;const rows=leaves(plan.phases||[]);if(!rows.length){statusMessage('Primero introduce las partidas y sus pesos en el Gantt.',true);return}
 let body='<form id="ecManualForm"><div class="top"><h2>Ingresar datos económicos</h2><button type="button" id="closeTask" class="light">✕</button></div><p class="small">Cada importe se SUMA a lo registrado. Usa 0 para registrar un coste nulo. No mezclar bases imponibles con importes IVA incluido.</p>';
 rows.forEach((p,i)=>{body+='<section class="ec-entry-row"><b>'+escape(p.name)+'</b> · '+percent(p.weight)+'<div class="form-pair"><label>Nuevo presupuesto €<input id="ecB'+i+'" type="number" min="0" step="0.01" placeholder="Sin cambio"></label><label>Nuevo coste real €<input id="ecA'+i+'" type="number" min="0" step="0.01" placeholder="Sin cambio"></label></div></section>'});
 body+='<p id="ecError" class="status err"></p><button id="ecSave" class="dark">Confirmar importes</button></form>';dialogForm(body);
 $('ecManualForm').onsubmit=async e=>{e.preventDefault();if(!validView(info)||saving)return;const payload=[];for(let i=0;i<rows.length;i++)for(const kind of ['budget','actual']){const raw=$(kind==='budget'?'ecB'+i:'ecA'+i).value.trim();if(!raw)continue;const n=Number(raw);if(!VALID(n)||n>1e10){$('ecError').textContent='Revisa el importe.';return}payload.push(row(info,rows[i].id,kind,n,'Entrada manual',crypto.randomUUID()))}
 if(!payload.length){$('ecError').textContent='Introduce al menos un importe.';return}if(!confirm('¿Incorporar '+payload.length+' nuevos importes? Se sumarán a los anteriores. Revisa posibles duplicados.'))return;
 $('ecSave').disabled=true;try{await save(info,payload)}catch(err){if(validView(info)){$('ecError').textContent=err.message;$('ecSave')?.removeAttribute('disabled')}}};
}
function importDialog(info,plan){
 if(!validView(info))return;const phases=leaves(plan.phases||[]);if(!phases.length){statusMessage('Primero introduce las partidas del Gantt.',true);return}
 dialogForm('<form id="ecImportForm"><div class="top"><h2>Adjuntar PDF o planilla</h2><button id="closeTask" class="light" type="button">✕</button></div><p class="small">CSV, XLSX o PDF con texto. El archivo no se almacena en Supabase. La interpretación necesita revisión: IVA, subtotales, cantidades y precios unitarios pueden confundirse.</p><label>Tipo<select id="ecType"><option value="budget">Coste previsto / presupuesto</option><option value="actual">Coste real / factura</option></select></label><label>Archivo<input id="ecDocument" type="file" accept=".csv,.xlsx,.pdf,.tsv,.txt"></label><button type="button" id="ecParse" class="light">Interpretar</button><div id="ecPreview"></div><p id="ecImportError" class="status err"></p><button id="ecAccept" class="dark" disabled>Confirmar importes</button></form>');
 const form=$('ecImportForm');let proposal=null;
 $('ecParse').onclick=async()=>{
  const file=$('ecDocument').files?.[0];if(!file){$('ecImportError').textContent='Selecciona un archivo.';return}
  const pdf=/\.pdf$/i.test(file.name),consent=pdf?confirm('El intérprete PDF.js se descargará desde cdnjs para procesar este PDF en el navegador. ¿Autorizar esta dependencia externa?'):false;
  if(pdf&&!consent)return;
  $('ecParse').disabled=true;$('ecImportError').textContent='';$('ecAccept').disabled=true;
  try{
   proposal=await TCEconomicImport.read(file,$('ecType').value,phases,consent);
   if(!validView(info)||$('ecImportForm')!==form)return;
   let output='<div class="ec-import-preview"><h3>'+proposal.entries.length+' importes detectados</h3>'+proposal.warnings.map(w=>'<p class="small">'+escape(w)+'</p>').join('')+'<div class="ec-table-scroll"><table><thead><tr><th>Concepto detectado</th><th>Partida Gantt</th><th>Importe €</th></tr></thead><tbody>';
   proposal.entries.forEach((p,i)=>{output+='<tr><td>'+escape(p.description)+'</td><td><select data-economy-phase="'+i+'"><option value="">Vincular actividad…</option>'+phases.map(a=>'<option value="'+escape(a.id)+'">'+escape(a.name)+'</option>').join('')+'</select></td><td><input data-economy-amount="'+i+'" type="number" step=".01" min="0" value="'+p.amount+'"></td></tr>'});
   output+='</tbody></table></div></div>';$('ecPreview').innerHTML=output;
   proposal.entries.forEach((p,i)=>{$('ecPreview').querySelector('[data-economy-phase="'+i+'"]').value=p.activity_id||''});
   $('ecAccept').disabled=proposal.entries.length===0;
  }catch(err){if(validView(info))$('ecImportError').textContent=err.message}
  finally{if(validView(info)&&$('ecImportForm')===form)$('ecParse').disabled=false}
 };
 form.onsubmit=async e=>{
  e.preventDefault();if(!validView(info)||!proposal||saving)return;
  const records=[];for(let i=0;i<proposal.entries.length;i++){
   const original=proposal.entries[i],id=$('ecPreview').querySelector('[data-economy-phase="'+i+'"]').value,value=$('ecPreview').querySelector('[data-economy-amount="'+i+'"]').value;
   const n=Number(value);if(!id||!phases.some(p=>p.id===id)||!value.trim()||!VALID(n)||n>1e10){$('ecImportError').textContent='Asigna todas las partidas y revisa sus importes.';return}
   records.push(row(info,id,original.kind,n,proposal.filename,String(original.line)));
  }
  if(!confirm('¿Añadir '+records.length+' importes de '+proposal.filename+'? La aplicación no conoce de forma fiable IVA, descuentos ni duplicados de archivos con otro nombre.'))return;
  $('ecAccept').disabled=true;try{await save(info,records)}catch(err){if(validView(info)){$('ecImportError').textContent=err.message;$('ecAccept').disabled=false}}
 };
}
detail=function(id){show(id)};
root.tcEconomyPrueba=()=>show(DEMO);root.tcOpenEconomy=id=>show(id||NATIVE_WORKS.find(w=>!w.archived_at)?.id||DEMO);
const menu=document.getElementById('eliteMenu');if(menu&&!menu.querySelector('#ecPrueba')){const button=document.createElement('button');button.id='ecPrueba';button.textContent='Panel económico · Prueba';button.type='button';button.onclick=()=>{menu.hidden=true;show(DEMO)};menu.append(button)}
return {DEMO,physical,planned,curve,finance,example,graph};
});
