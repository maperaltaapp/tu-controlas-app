/* V1 panel económico progresivo. Sample stays in memory; NEVER writes real works. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TCEconomy=api})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
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
function graph(data){
 const points=data.points;if(points.length<2)return '<div class="ec-no-graph">Para ver las curvas, fija una línea base y registra mediciones en el Gantt.</div>';
 const w=900,h=275,x0=47,x1=879,y0=13,y1=235,lo=day(points[0].date),hi=day(points.at(-1).date),x=d=>x0+(day(d)-lo)/Math.max(1,hi-lo)*(x1-x0),y=p=>y1-p/100*(y1-y0);
 const path=kind=>{let result='',on=false;for(const p of points){if(p[kind]===null){on=false;continue}result+=(on?' L':' M')+x(p.date).toFixed(2)+' '+y(p[kind]).toFixed(2);on=true}return result.trim()};
 let svg='<svg class="ec-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Curva de avance previsto y real ponderado por partidas"><title>Avance físico ponderado. Línea discontinua: estimación, no medición</title>';
 for(const v of [0,25,50,75,100])svg+='<line x1="'+x0+'" x2="'+x1+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e1e9ee"/><text x="38" y="'+(y(v)+4)+'" text-anchor="end" fill="#657783" font-size="11">'+v+'%</text>';
 for(let i=0;i<=4;i++){const dt=iso(lo+Math.round((hi-lo)*i/4));svg+='<text x="'+x(dt)+'" y="258" text-anchor="middle" fill="#657783" font-size="11">'+dt.slice(8,10)+'/'+dt.slice(5,7)+'</text>'}
 svg+='<path d="'+path('planned')+'" stroke="#246c9e" fill="none" stroke-width="3.5" stroke-linejoin="round"/><path d="'+path('real')+'" stroke="#16835d" fill="none" stroke-width="3.5" stroke-linejoin="round"/>';
 if(data.trend.length===2)svg+='<path d="M'+x(data.trend[0].date)+' '+y(data.trend[0].real)+' L'+x(data.trend[1].date)+' '+y(data.trend[1].real)+'" stroke="#d98c21" fill="none" stroke-width="3" stroke-dasharray="8 6"/>';
 return svg+'</svg>';
}
if(typeof document==='undefined')return {DEMO,physical,planned,curve,finance,example,graph};
let shown=null,seq=0,saving=false;
const oldDetail=detail;
const validView=view=>shown===view&&view.epoch===sessionEpoch&&view.owner===session?.user?.id;
const readEntries=id=>readAll('elite_work_economic_entries','work_id=eq.'+encodeURIComponent(id)+'&order=entry_date.asc,id.asc');
const metric=(name,value,description)=>'<article class="ec-metric"><span>'+escape(name)+'</span><strong>'+escape(value)+'</strong><small>'+escape(description)+'</small></article>';
function htmlPanel(data,warning){
 const {work,plan,entries,date}=data,f=finance(plan,entries,date),p=planned(plan,date),r=physical(plan,date),d=p===null||r===null?null:r-p,chart=curve(plan,date),end=leaves(plan.baseline||[]).map(x=>x.end).sort().at(-1);
 const options=[...NATIVE_WORKS.filter(w=>!w.archived_at||w.id===work.id).map(w=>[w.id,w.name]),[DEMO,'Prueba (ejemplo)']];
 let out='<div class="ec-panel-root"><header class="ec-title"><div><small>PANEL DE CONTROL · TU CONTROLAS</small><h1>'+escape(work.name)+'</h1><p>Primero el avance físico de la obra; después sus costes.</p></div><span>Corte: '+escape(date)+'</span></header>';
 out+='<nav class="ec-actions"><button id="ecBack" type="button">← Obras</button><label>Obra <select id="ecWork">'+options.map(q=>'<option value="'+escape(q[0])+'" '+(q[0]===work.id?'selected':'')+'>'+escape(q[1])+'</option>').join('')+'</select></label>';
 if(!data.demo)out+='<button id="ecManual" class="ec-primary">+ Datos económicos</button><button id="ecImport">Adjuntar PDF / planilla</button>';
 else out+='<span class="ec-demo-label">DEMOSTRACIÓN · DATOS FICTICIOS</span>';
 out+='</nav>';
 if(data.demo)out+='<p class="ec-disclaimer">«Prueba» es una simulación local. No se guarda ni modifica ninguna obra real.</p>';
 if(warning)out+='<p class="ec-warning">No se pudieron cargar los datos económicos: '+escape(warning)+'. El avance Gantt sigue disponible.</p>';
 out+='<div class="ec-top"><section class="ec-card ec-curve"><h2>Avance previsto frente al real</h2><p>Progreso físico acumulado, ponderado según los pesos de cada partida (sin euros).</p>'+graph(chart)+'<div class="ec-legend"><span><i class="ec-color-blue"></i>Previsto</span><span><i class="ec-color-green"></i>Real medido</span><span><i class="ec-color-orange"></i>Tendencia estimada</span></div></section><section class="ec-card ec-summary"><h2>Situación de la obra</h2>'+metric('Avance previsto',percent(p),'Según línea base')+metric('Avance real',percent(r),'Según mediciones')+metric('Diferencia',d===null?'Sin datos':(d>0?'+':'')+percent(d),'Puntos porcentuales')+metric('Fin previsto',end||'Sin línea base','Fecha inicial del Gantt')+'</section></div>';
 out+='<section class="ec-card ec-simple"><h2>Economía fácil de entender</h2><p>Costes previstos, costes reales y cuánto trabajo se ha realizado. No se mezclan costes con facturación.</p><div class="ec-stats">'+metric('Presupuesto de costes',euro(f.bac),'Coste previsto total')+metric('Coste real acumulado',euro(f.ac),'Lo gastado hasta hoy')+metric('Valor del trabajo realizado',euro(f.ev),'Avance real a precios de coste presupuestado')+metric('Coste estimado al terminar',euro(f.eac),'Proyección con el rendimiento actual')+'</div><details><summary>Ver partidas, pesos e importes</summary><div class="ec-table-scroll"><table><thead><tr><th>Partida</th><th>Peso</th><th>Real</th><th>Previsto €</th><th>Real €</th></tr></thead><tbody>'+f.rows.map(row=>'<tr><td>'+escape(row.name)+'</td><td>'+percent(row.weight)+'</td><td>'+percent(row.progress)+'</td><td>'+euro(row.budget)+'</td><td>'+euro(row.actual)+'</td></tr>').join('')+'</tbody></table></div></details></section>';
 out+='<section class="ec-card ec-pmi"><h2>Indicadores para usuarios PMI</h2><p><b>SPI</b> indica ritmo respecto al plan. <b>CPI</b> indica eficiencia de costes. Valor 1 = conforme; inferior a 1 = desfavorable.</p><div class="ec-stats">'+metric('SPI · Plazo',decimal(f.spi),'EV / PV')+metric('CPI · Coste',decimal(f.cpi),'EV / AC')+metric('PV · Planificado',euro(f.pv),'Valor planificado de coste')+metric('EV · Ganado',euro(f.ev),'Valor ganado según avance')+metric('AC · Coste real',euro(f.ac),'Coste real acumulado')+metric('BAC · Presupuesto',euro(f.bac),'Presupuesto completo')+metric('EAC · Estimación al cierre',euro(f.eac),'BAC / CPI, si CPI > 0')+metric('Contrato',euro(f.contract),'Ingresos contractuales')+metric('Certificado',euro(f.certified),'Acumulado certificado')+'</div><details><summary>Qué significan los cálculos</summary><p>La gráfica superior es avance físico. El peso de una fase agrupadora no se cuenta dos veces. Sin medición no se supone 0 %.</p><p>Para valor ganado: PV = presupuesto de cada partida por su avance previsto según la línea base; EV = presupuesto de cada partida por avance real; AC = costes reales. SPI = EV / PV, CPI = EV / AC, EAC = BAC / CPI. Sin datos completos o divisor cero, no hay cálculo.</p><p>La tendencia de la curva es una extrapolación de mediciones pasadas, nunca un porcentaje ejecutado. Importar no equivale a aprobar importes, IVA o certificaciones.</p></details></section>';
 out+='<footer class="ec-footer"><button id="ecRecord">Ficha de obra</button><button id="ecGantt">Abrir Gantt</button></footer></div>';
 return out;
}
async function show(id=DEMO){
 const data=id===DEMO?example():null,work=data?.work||NATIVE_WORKS.find(w=>w.id===id);
 if(!work){works();return}
 const view={id,epoch:sessionEpoch,owner:session?.user?.id},token=++seq;shown=view;mode='works';selectSection('works');workDetailId=id===DEMO?null:id;$('title').textContent='Panel de Control';
 let records=data?.entries||[],warning=null,plan=data?.plan||planOf(id);
 if(id!==DEMO){if(!view.owner||!session?.access_token)return;$('content').innerHTML='<p>Cargando datos económicos…</p>';try{records=await readEntries(id)}catch(e){warning=e.message}if(!validView(view)||token!==seq)return}
 $('content').innerHTML=htmlPanel({work,plan,entries:records,date:data?.date||planningToday(),demo:id===DEMO},warning);
 $('ecBack').onclick=()=>works();$('ecWork').onchange=e=>show(e.target.value);
 $('ecRecord').onclick=()=>id===DEMO?show(DEMO):oldDetail(id);
 $('ecGantt').onclick=()=>id===DEMO?show(DEMO):gCanPlan(work)?openPlanning(id):editPlan(id);
 if(id!==DEMO){$('ecManual').onclick=()=>manual(view,plan);$('ecImport').onclick=()=>importDialog(view,plan)}
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
root.tcEconomyPrueba=()=>show(DEMO);
const menu=document.getElementById('eliteMenu');if(menu&&!menu.querySelector('#ecPrueba')){const button=document.createElement('button');button.id='ecPrueba';button.textContent='Panel económico · Prueba';button.type='button';button.onclick=()=>{menu.hidden=true;show(DEMO)};menu.append(button)}
return {DEMO,physical,planned,curve,finance,example,graph};
});
