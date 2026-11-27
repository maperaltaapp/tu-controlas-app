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
const euro=n=>!Number.isFinite(n)?'Sin datos':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const percent=n=>!Number.isFinite(n)?'Sin datos':new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n)+' %';
const decimal=n=>!Number.isFinite(n)?'No calculable':new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(n);
function graph(data,amountScale=null){
 const points=data.points;if(!points.some(p=>Number.isFinite(p.real)||Number.isFinite(p.planned)))return '<div class="ec-no-graph">Para ver las curvas, fija una línea base y registra mediciones en el Gantt.</div>';
 const lo=day(points[0].date),hi=day(points.at(-1).date);
 const x=date=>Number(((day(date)-lo)/Math.max(1,hi-lo)*100).toFixed(3)),y=value=>Number((100-value).toFixed(3));
 const path=kind=>{let result='',connected=false;for(const p of points){if(p[kind]===null){connected=false;continue}result+=(connected?' L':' M')+x(p.date)+' '+y(p[kind]);connected=true}return result.trim()};
 const label=amountScale===null?'Curva de avance previsto y real ponderado por partidas':'Curva S de coste planificado y coste real acumulado';
 let svg='<div class="ec-plot"><svg class="ec-chart" role="img" aria-label="'+label+'"><title>'+label+'</title>';
 for(const tick of [0,25,50,75,100]){
  const caption=amountScale===null?tick+'%':new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(amountScale*tick/100)+' €';
  svg+=`<line x2="100%" y1="${y(tick)}%" y2="${y(tick)}%" stroke="#e0e6ed"/><text x="0" dx="-7" y="${y(tick)}%" dy=".32em" text-anchor="end">${caption}</text>`;
 }
 const intervals=Math.min(4,Math.max(0,hi-lo));
 for(let i=0;i<=intervals;i++){
  const date=iso(lo+Math.round((hi-lo)*i/Math.max(1,intervals))),anchor=i===0?'start':i===intervals?'end':'middle';
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

const marginLib=root.TCCostMargin,weightLib=root.TCWeights;
if(!marginLib||!weightLib)throw Error('Falta el módulo de previsiones económicas o pesos');
const validView=view=>view.host===$('ecPanel')&&view.epoch===sessionEpoch&&view.owner===session?.user?.id
 &&mode==='works'&&workDetailId===(view.id===DEMO?null:view.id);
const readEntries=id=>readAll('elite_work_economic_entries','work_id=eq.'+encodeURIComponent(id)+'&order=entry_date.asc,id.asc');
const readForecasts=id=>readAll('tc_cost_forecast_snapshots','work_id=eq.'+encodeURIComponent(id)+'&order=as_of.asc,created_at.asc');
const metric=(name,value,description)=>'<article class="ec-metric"><span>'+escape(name)+'</span><strong>'+escape(value)+'</strong>'+(description?'<small>'+escape(description)+'</small>':'')+'</article>';
function inputCell(data,kind,activity,value,name='obra'){
 const sources=data.entries.filter(e=>e.kind===kind&&(e.activity_id||null)===(activity||null)),locked=data.demo||sources.some(e=>e.source_name!=='Entrada manual'||e.entry_date>data.date);
 return '<input class="ec-input-cell" type="number" min="0" max="10000000000" step=".01" aria-label="'+escape((kind==='budget'?'Costes de Oferta':kind==='actual'?'Coste real':kind==='contract'?'Contrato':'Certificado')+' · '+name)+'" data-cost-kind="'+kind+'" data-cost-activity="'+escape(activity||'')+'" value="'+(value===null?'':value)+'" placeholder="Sin datos" '+(locked?'readonly title="'+(data.demo?'Ejemplo de demostración':'Importe importado o con movimientos posteriores al corte')+'"':'')+'>';
}
function moneyCurve(plan,entries,date,baseline){
 if(!baseline)return '<div class="ec-no-graph">Para ver la curva económica PMI, registra una línea base de costes aprobada.</div>';
 const c=curve(plan,date),points=c.points.map(p=>{const f=marginLib.evm(plan,entries,p.date,baseline);return {date:p.date,planned:f.pv,real:p.date<=date?f.ac:null}});
 const available=points.flatMap(p=>[p.planned,p.real]).filter(v=>v!==null),max=Math.max(1,...available);
 return graph({points:points.map(p=>({...p,planned:p.planned===null?null:p.planned/max*100,real:p.real===null?null:p.real/max*100})),trend:[]},max);
}

function progressCard(data){
 const {plan,date}=data,actual=physical(plan,date),target=planned(plan,date),delta=actual===null||target===null?null:actual-target;
 const rows=leaves(plan.phases||[]),chart=curve(plan,date),measured=rows.filter(r=>observed(r,date)!==null).length;
 const last=rows.flatMap(p=>(p.observations||[]).filter(o=>o.date<=date&&VALID(o.percent)).map(o=>o.date)).sort().at(-1);
 const coverage=rows.length?`Medición en ${measured} de ${rows.length} partidas`:'Sin partidas en el Gantt';
 const gap=delta===null?'':new Intl.NumberFormat('es-ES',{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(delta)+' pp frente al plan';
 const milestone=(plan.phases||[]).filter(p=>p.milestone&&p.end>=date&&p.activity_status!=='done').sort((a,b)=>a.end.localeCompare(b.end))[0];
 const hasCurve=chart.points.some(p=>p.planned!==null||p.real!==null);
 return `<section class="ec-card ec-progress" aria-labelledby="ecProgressTitle">
  <h2 id="ecProgressTitle">Avance físico</h2>
  <dl class="ec-lead-values"><div><dt>Real medido</dt><dd>${percent(actual)}</dd></div><div><dt>Previsto</dt><dd>${percent(target)}</dd></div></dl>
  ${gap?`<p class="ec-difference">${gap}</p>`:''}
  ${graph(chart)}
  ${hasCurve?`<div class="ec-legend">${target===null?'':'<span><i class="ec-color-blue"></i>Previsto</span>'}${measured&&actual!==null?'<span><i class="ec-color-green"></i>Real medido</span>':''}${chart.trend.length?'<span><i class="ec-color-orange"></i>Tendencia estimada</span>':''}</div>`:''}
  <p class="ec-source">${coverage}${last?' · Última medición '+escape(workDateLabel(last)):''}</p>
  ${milestone?`<p class="ec-source">Próximo hito · ${escape(milestone.name)} · ${escape(workDateLabel(milestone.end))}</p>`:''}
 </section>`;
}
function partsDetail(data,f){
 const weights=data.forecastError?{weights:null,costs:[],reason:'Pendiente de cargar la línea base de costes.'}:weightLib.derive(data.plan,data.entries,data.forecasts,data.date);
 if(!f.rows.length)return '<p>Esta obra todavía no tiene partidas en el Gantt.</p>';
 const percentage=v=>Number.isFinite(v)?new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(v)+' %':'Sin datos';
 const proposed=['approved','budget'].includes(weights.source)&&weights.weights?.some((w,i)=>Math.abs(w-f.rows[i].weight)>.005);
 const approved=!!marginLib.latest(data.forecasts,'baseline',data.date)&&weights.costs.length===f.rows.length;
 const rows=f.rows.map((r,i)=>`<tr><th scope="row">${escape(r.name)}</th><td>${percent(r.progress)}</td><td>${percentage(r.weight)}</td>
  ${proposed?`<td>${percentage(weights.weights[i])}</td>`:''}${approved?`<td>${euro(weights.costs[i])}</td>`:''}<td>${euro(r.budget)}</td><td>${euro(r.actual)}</td></tr>`).join('');
 const totalWeight=f.rows.reduce((n,r)=>n+r.weight,0);
 return `<p>${escape(weights.reason)}</p><div class="ec-table-scroll" tabindex="0" aria-label="Avance y costes por partida"><table class="ec-entry-table">
  <thead><tr><th scope="col">Partida</th><th>Avance real</th><th>Peso en Gantt</th>${proposed?'<th>Peso por coste</th>':''}${approved?'<th>Coste aprobado</th>':''}<th>Costes de Oferta</th><th>Coste real</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><th scope="row">Total</th><td>${percent(physical(data.plan,data.date))}</td><td>${percentage(totalWeight)}</td>${proposed?'<td>100 %</td>':''}${approved?`<td>${euro(weights.costs.reduce((a,b)=>a+b,0))}</td>`:''}<td>${euro(f.bac)}</td><td>${euro(f.ac)}</td></tr></tfoot></table></div>`;
}
function indicators(data,f,margin){
 const {plan,entries,date}=data,pmi=marginLib.evm(plan,entries,date,margin.baseline);
 return '<h3>Curvas S de costes acumulados</h3>'+moneyCurve(plan,entries,date,margin.baseline)+
   (pmi.validBaseline?'<div class="ec-legend"><span><i class="ec-color-blue"></i>Planificado (PV)</span><span><i class="ec-color-green"></i>Real (AC)</span></div>':'')+
   '<div class="ec-stats">'+metric('SPI · Plazo',decimal(pmi.spi),'Valor ganado / planificado')+metric('CPI · Coste',decimal(pmi.cpi),'Valor ganado / coste real')+
   metric('Valor planificado (PV)',euro(pmi.pv))+metric('Valor ganado (EV)',euro(pmi.ev))+metric('Coste real acumulado',euro(f.ac))+
   metric('Línea base aprobada (BAC)',euro(pmi.bac),margin.baseline?.approval_reference)+metric('Coste final por tendencia',euro(pmi.eacTrend),'BAC / CPI')+
   metric('Importe contratado',euro(f.contract))+metric('Certificado acumulado',euro(f.certified))+'</div>';
}
function renderSummary(body,data){
 const f=finance(data.plan,data.entries,data.date);
 const inputs={records:data.forecasts,date:data.date,offerCost:f.bac,contract:f.contract},margin=marginLib.summary(inputs);
 const pending='<p>Previsiones pendientes de cargar.</p>';
 const closing=data.forecastError?'<section class="ec-card"><h2>Previsión de cierre</h2>'+pending+'</section>':marginLib.render(inputs,margin);
 const sections=[
  ['ecParts','Avance, pesos y costes por partida',()=>partsDetail(data,f)],
  ['ecIndicators','Costes e indicadores de plazo y coste',()=>indicators(data,f,margin)],
  ['ecHistory','Historial de márgenes y previsiones',()=>data.forecastError?pending:marginLib.marginHistory(data.forecasts,data.date,margin)]
 ];
 if(data.progressPlan!==data.plan){
  data.progressPlan=data.plan;
  data.progressHtml=progressCard(data);
 }
 body.innerHTML='<div class="ec-overview">'+data.progressHtml+closing+'</div>'+
  sections.map(([id,title])=>`<details id="${id}" class="ec-card ec-fold"><summary>${title}</summary><div></div></details>`).join('');
 for(const [id,,renderDetail] of sections){
  const fold=$(id);
  fold.ontoggle=()=>{if(fold.open){fold.lastElementChild.innerHTML=renderDetail();fold.ontoggle=null}};
 }
}
function entryPage(data){
 const f=finance(data.plan,data.entries,data.date);
 const rows=f.rows.map(r=>`<tr><th scope="row">${escape(r.name)}</th><td>${inputCell(data,'budget',r.id,r.budget,r.name)}</td><td>${inputCell(data,'actual',r.id,r.actual,r.name)}</td></tr>`).join('');
 const report=data.work.execution_state==='execution'&&!data.work.archived_at?'<button type="button" id="ecReport" class="light">Registrar parte de avance</button>':'';
 return `<section class="ec-card ec-entry" aria-labelledby="ecEntryTitle"><h2 id="ecEntryTitle">Ingreso de datos</h2>
  <fieldset id="ecEntryFields"${data.demo||data.entriesError||data.forecastError?' disabled':''}><legend class="sr-only">Datos de la obra</legend>
  <div class="ec-entry-actions">${report}<button type="button" id="ecMarginEdit" class="light">Oferta, línea base y previsión</button>
  <button type="button" id="ecKEdit" class="light">Configurar K</button><button type="button" id="ecWeightsEdit" class="light"${f.rows.length?'':' disabled'}>Ajustar pesos</button>
  <button type="button" id="ecImport" class="light"${f.rows.length?'':' disabled'}>Importar PDF o planilla</button></div>
  <h3>Costes por partida</h3>
  ${rows?`<p>Introduce el importe acumulado. Cada cambio se guarda al salir de la celda. Los importes importados son de solo lectura.</p>
   <div class="ec-table-scroll" tabindex="0" aria-label="Editar costes por partida"><table class="ec-entry-table"><thead><tr><th>Partida</th><th>Costes de Oferta (€)</th><th>Coste real (€)</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p>Las partidas aparecen al crearlas en el Gantt.</p>'}
  <h3>Contrato y certificación</h3><div class="ec-contract-fields"><label>Importe contratado (€)${inputCell(data,'contract',null,f.contract)}</label><label>Certificado acumulado (€)${inputCell(data,'certified',null,f.certified)}</label></div>
  </fieldset><p id="ecCellStatus" role="status" aria-live="polite"></p></section>`;
}
function showPage(view,page,focus=false){
 if(!validView(view))return;
 view.page=page;
 const entry=page==='entry',body=$('ecBody'),toggle=$('ecEntryToggle'),data=view.data;
 toggle.className=entry?'light':'dark';
 toggle.textContent=entry?'Volver al resumen':'Ingresar datos';
 if(entry)body.innerHTML=entryPage(data);else renderSummary(body,data);
 if(focus){const title=body.querySelector('h2');if(title){title.tabIndex=-1;title.focus({preventScroll:true})}}
 if(!entry||data.demo||data.entriesError||data.forecastError)return;
 $('ecMarginEdit').onclick=()=>openMarginForm(view,data.plan,data.entries,data.forecasts);
 $('ecKEdit').onclick=()=>openMarginForm(view,data.plan,data.entries,data.forecasts,'k_setting');
 $('ecWeightsEdit').onclick=()=>openWeightsForm(view,data.plan,data.entries,data.forecasts);
 $('ecImport').onclick=()=>importDialog(view,data.plan);
 if($('ecReport'))$('ecReport').onclick=()=>editDailyReport(null,view.id,planningToday());
 body.querySelectorAll('[data-cost-kind]:not([readonly])').forEach(input=>input.onchange=()=>saveCell(view,input));
}
async function saveCell(view,input){
 if(!validView(view)||view.saving)return;
 const raw=input.value.trim(),total=Number(raw),activity=input.dataset.costActivity||null,kind=input.dataset.costKind;
 const status=$('ecCellStatus'),fields=$('ecEntryFields');
 if(!raw||!VALID(total)||total>1e10||input.validity?.stepMismatch){status.textContent='Introduce un importe entre 0 y 10.000.000.000 con un máximo de dos decimales.';return}
 const matches=e=>e.kind===kind&&(e.activity_id||null)===activity;
 const sources=view.data.entries.filter(matches).sort((a,b)=>a.id.localeCompare(b.id)).map(e=>({id:e.id,amount:Number(e.amount),source_name:e.source_name}));
 view.saving=true;fields.disabled=true;$('ecEntryToggle').disabled=true;status.textContent='Guardando…';
 try{
  await eliteRequest('/rest/v1/rpc/tc_set_manual_cost',{method:'POST',body:JSON.stringify({target_work:view.id,target_activity:activity,target_kind:kind,expected_rows:sources,new_total:total})});
  if(!validView(view))return;
  const live=await readEntries(view.id);if(!validView(view))return;
  const verified=live.filter(matches);
  if(!verified.length||Math.abs(verified.reduce((n,e)=>n+Number(e.amount),0)-total)>.001)throw Error('No se verificó el importe. Actualiza antes de reintentar.');
  view.data.entries=live;input.value=String(total);status.textContent='Importe guardado.';
  if(view.page!=='entry')showPage(view,view.page);
 }catch(e){if(validView(view)){status.textContent=e.message;if(view.page==='entry')$('ecRetry').hidden=false}}
 finally{view.saving=false;fields.disabled=false;if(validView(view))$('ecEntryToggle').disabled=false}
}
async function show(id=DEMO,page='summary'){
 const demo=id===DEMO,sample=demo?example():null,work=sample?.work||NATIVE_WORKS.find(w=>w.id===id);
 if(!work){works();return}
 if(!demo&&(!session?.user?.id||!session.access_token))return;
 mode='works';selectSection('works');workDetailId=demo?null:id;$('title').textContent='Panel de Control';
 const options=[...NATIVE_WORKS.filter(w=>!w.archived_at||w.id===id),{id:DEMO,name:'Prueba (ejemplo)'}];
 const date=sample?.date||planningToday();
 $('content').innerHTML=`<section class="ec-panel-root" id="ecPanel"><div class="tc-tool-sticky">${controlPanelTabs(true)}
  <div class="ec-actions"><label>Obra<select id="ecWork">${options.map(w=>`<option value="${escape(w.id)}" ${w.id===id?'selected':''}>${escape(w.name)}</option>`).join('')}</select></label>
  <button type="button" id="ecEntryToggle" class="dark" aria-controls="ecBody" disabled>Ingresar datos</button></div></div>
  <div class="ec-context"><span class="ec-cutoff">Fecha de corte <time datetime="${date}">${workDateLabel(date)}</time></span>${demo?'<span class="ec-demo-label">Datos de ejemplo · Solo lectura</span>':''}</div>
  <div id="ecLoadStatus" role="status"></div><button type="button" id="ecRetry" class="light" hidden>Actualizar datos</button>
  <div id="ecBody"><p role="status">Cargando el avance de la obra…</p></div></section>`;
 const view={id,owner:session?.user?.id,epoch:sessionEpoch,host:$('ecPanel'),page:page==='weights'?'entry':page,saving:false};
 $('ecWork').onchange=e=>show(e.target.value);
 $('tcAdvanceTab').onclick=()=>{if(view.data&&!view.saving)showPage(view,'summary')};
 $('ecRetry').onclick=()=>show(id,view.page);
 const data={work,date,demo,plan:sample?.plan||planOf(id),entries:[],forecasts:[],entriesError:false,forecastError:false};
 data.progressPlan=data.plan;data.progressHtml=progressCard(data);
 if(!demo){
  $('ecBody').innerHTML='<div class="ec-overview">'+data.progressHtml+'<section class="ec-card"><p role="status">Cargando costes y previsiones…</p></section></div>';
 }
 if(demo){
  data.entries=sample.entries;
  data.forecasts=[
   {snapshot_type:'offer',as_of:'2026-11-01',total_cost:90000,forecast_revenue:118000},
   {snapshot_type:'pm_initial',as_of:'2026-11-02',total_cost:94000,forecast_revenue:118000},
   {snapshot_type:'baseline',as_of:'2026-11-02',total_cost:94000,approval_reference:'Ejemplo ficticio',activity_costs:[{activity_id:'prueba-0',amount:13000},{activity_id:'prueba-1',amount:38000},{activity_id:'prueba-2',amount:31000},{activity_id:'prueba-3',amount:12000}]},
   {snapshot_type:'forecast',as_of:'2026-11-24',total_cost:99000,actual_cost:63500,remaining_cost:35500,forecast_revenue:118000}
  ];
 }else{
  const [ledger,forecasts]=await Promise.allSettled([readEntries(id),readForecasts(id)]);
  if(!validView(view))return;
  data.entriesError=ledger.status==='rejected';data.forecastError=forecasts.status==='rejected';
  data.entries=ledger.value||[];data.forecasts=forecasts.value||[];
  if(data.entriesError||data.forecastError){
   const missing=[data.entriesError&&'costes',data.forecastError&&'previsiones'].filter(Boolean).join(' y ');
   $('ecLoadStatus').textContent='No se pudieron cargar los datos de '+missing+'. Actualiza para volver a intentar.';
   $('ecLoadStatus').className='ec-warning';$('ecRetry').hidden=false;
  }
 }
 view.data=data;
 const toggle=$('ecEntryToggle');toggle.disabled=false;
 toggle.onclick=()=>{if(view.saving)return;showPage(view,view.page==='entry'?'summary':'entry',true)};
 showPage(view,view.page);
 if(page==='weights'&&!demo&&!data.entriesError&&!data.forecastError)openWeightsForm(view,data.plan,data.entries,data.forecasts);
}

function openWeightsForm(view,plan,entries,forecasts){
 if(!validView(view)||view.saving)return;
 const on=planningToday(),current=planOf(view.id),base=weightLib.derive(current,entries,forecasts,on);
 const currentLeaves=weightLib.leaves(current.phases),originalWeights=currentLeaves.map(p=>Number(p.weight));
 if(!currentLeaves.length){statusMessage('Primero crea las partidas del Gantt.',true);return}
 let weights=base.weights&&base.weights.length===currentLeaves.length?[...base.weights]:[...originalWeights];
 let method=base.source==='manual'?'manual':'cost';
 const costSnapshot=weightLib.derive(current,entries,forecasts,on,false);
 const formatter=n=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 const rows=currentLeaves.map((p,i)=>'<tr><td>'+escape(p.name)+'</td><td>'+((base.costs||[])[i]===undefined?'—':euro(base.costs[i]))+'</td><td><input data-w-index="'+i+'" type="number" step="0.01" min="0" max="100" value="'+(weights[i]??'')+'" aria-label="Peso de '+escape(p.name)+'"></td></tr>').join('');
 const message=base.source==='unavailable'?base.reason:'Cambia el peso de una partida y se redistribuirá la diferencia entre las demás.';
 dialogForm('<form id="ecWeightsForm"><div class="top"><h2>Pesos físicos por partida</h2><button id="closeTask" type="button" class="light">✕</button></div><p class="small">'+escape(message)+'</p><div class="ec-table-scroll"><table class="ec-entry-table"><thead><tr><th>Partida</th><th>Coste previsto</th><th>Peso %</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="ec-weight-total"><strong>Total: <span id="ecWeightsTotal"></span></strong><span id="ecWeightsMethod"></span></div><div class="ec-weight-actions"><button type="button" class="light" id="ecWeightsReset">Recalcular por costes</button><button type="submit" class="dark" id="ecWeightsSave">Guardar pesos en Gantt</button></div><p id="ecWeightsError" class="status err" role="alert"></p></form>');
 const form=$('ecWeightsForm');if(!form)return;const inputs=[...form.querySelectorAll('[data-w-index]')];
 const alive=()=>validView(view)&&$('ecWeightsForm')===form&&planOf(view.id).revision===current.revision;
 const messageEl=$('ecWeightsError');
 const render=()=>{
  inputs.forEach((field,i)=>field.value=formatter(weights[i]).replace(',','.'));
  $('ecWeightsTotal').textContent=formatter(weights.reduce((a,b)=>a+b,0))+' %';
  $('ecWeightsMethod').textContent=method==='manual'?'Ajuste manual':'Cálculo automático';
  const unavailable=weights.some(w=>!Number.isFinite(w)||w<=0);
  $('ecWeightsSave').disabled=unavailable;
  messageEl.textContent=unavailable?'El Gantt actual requiere pesos mayores que cero para sus partidas. Revisa las partidas de coste nulo o un ajuste al 100 %.':'';
 };
 inputs.forEach((field,i)=>field.onchange=()=>{
  if(!alive())return;
  try{
   const raw=field.value.trim(),requested=Number(raw);
   if(!raw)throw Error('Indica el porcentaje de la partida.');
   weights=weightLib.equalAdjust(weights,i,requested);method='manual';render();
  }catch(err){messageEl.textContent=err.message;field.value=formatter(weights[i]).replace(',','.')}
 });
 $('ecWeightsReset').disabled=!['approved','budget'].includes(costSnapshot.source);
 $('ecWeightsReset').onclick=()=>{
  if(!alive())return;
  if(!['approved','budget'].includes(costSnapshot.source)||!costSnapshot.weights)return;
  weights=[...costSnapshot.weights];method='cost';render();
 };
 render();
 form.onsubmit=async e=>{
  e.preventDefault();if(!alive()||view.saving)return;
  let next;
  try{
   if(weights.some(w=>w<=0))throw Error('No se puede guardar una partida ejecutable con peso cero en el Gantt actual.');
   next=weightLib.apply(current,currentLeaves,weights,method);
   next=ElitePlanning.derive(next);ElitePlanning.validate(next);
   if((current.phases||[]).some(p=>!p.task_id&&!p.is_group&&!current.phases.some(c=>c.parent_id===p.id))
     &&!confirm('Este Gantt contiene actividades sin tarea vinculada. Guardarlo puede crear tareas vinculadas. ¿Continuar?'))return;
   if(!confirm('¿Guardar estos pesos en el Gantt? Se actualizará el avance ponderado, conservando la línea base original.'))return;
  }catch(err){messageEl.textContent=err.message;return}
  view.saving=true;$('ecWeightsSave').disabled=true;
  try{
   if(!alive())throw Error('La planificación cambió. Vuelve a abrir el editor.');
   await eliteRequest('/rest/v1/rpc/elite_save_gantt',{method:'POST',body:JSON.stringify({target_work:view.id,new_phases:next,expected_revision:current.revision,freeze_baseline:false,confirm_work:!!current.confirmed_at,exception_reason:''})});
   if(!validView(view))return;
   const refreshed=await readAll('elite_work_plans','work_id=eq.'+encodeURIComponent(view.id));
   if(!validView(view))return;
   const saved=refreshed[0];
   if(!saved||saved.revision!==current.revision+1)throw Error('No se verificó la actualización del Gantt.');
   const actual=new Map(weightLib.leaves(saved.phases).map(p=>[p.id,p]));
   if(currentLeaves.some((p,i)=>!actual.has(p.id)||Math.abs(Number(actual.get(p.id).weight)-weights[i])>.001||actual.get(p.id).weight_source!==method))
    throw Error('Los pesos guardados no coinciden. Actualiza la obra antes de volver a guardar.');
   await fetchOwnTasks();if(!validView(view))return;
   WORK_PLANS=WORK_PLANS.map(p=>p.work_id===view.id?saved:p);
   view.data.plan=saved;closeTaskDialog();showPage(view,view.page);
  }catch(err){if(validView(view)&&$('ecWeightsForm')===form){messageEl.textContent=err.message;$('ecWeightsSave').disabled=false}}
  finally{view.saving=false}
 };
}

function openMarginForm(view,plan,records,forecasts,presetKind=null){
 if(!validView(view)||view.saving)return;
 const info={id:view.id,plan,date:planningToday(),finance:finance(plan,records,planningToday()),forecasts};
 dialogForm(marginLib.formHTML({plan,finance:info.finance,records:forecasts,date:info.date}));
 const form=$('ecMarginForm');if(!form)return;if(presetKind)form.querySelector('#ecMarginKind').value=presetKind;marginLib.configureForm(form);
 form.onsubmit=async e=>{
  e.preventDefault();if(!validView(view)||view.saving||$('ecMarginForm')!==form)return;
  let payload;try{payload=marginLib.parseForm(form,info)}catch(err){$('ecMarginError').textContent=err.message;return}
  if(!confirm('¿Guardar esta previsión? Se añadirá una versión histórica y no se sobrescribirán los datos anteriores.'))return;
  view.saving=true;$('ecMarginSave').disabled=true;
  try{
   const created=await eliteRequest('/rest/v1/tc_cost_forecast_snapshots',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
   if(!validView(view))return;
   if(!Array.isArray(created)||created.length!==1||!created[0].id)throw Error('No se confirmó el registro. Actualiza antes de volver a guardar.');
   const verified=await readForecasts(view.id);
   if(!validView(view))return;
   if(!verified.some(x=>x.id===created[0].id))throw Error('No se verificó la lectura posterior. Actualiza antes de reintentar.');
   view.data.forecasts=verified;closeTaskDialog();showPage(view,view.page);
  }catch(err){if(validView(view)&&$('ecMarginError')){$('ecMarginError').textContent=err.message;$('ecMarginSave').disabled=false}}
  finally{view.saving=false}
 };
}
function row(info,activity,kind,amount,sourceName,sourceLine){return {work_id:info.id,activity_id:activity,kind,amount:Math.round(amount*100)/100,entry_date:planningToday(),source_name:sourceName,source_line:sourceLine}}
async function save(info,records){
 if(!validView(info)||info.saving)throw Error('La cuenta o la obra cambió. Abre el formulario nuevamente.');
 info.saving=true;try{
  const created=await eliteRequest('/rest/v1/elite_work_economic_entries',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(records)});
  if(!validView(info))return;
  if(created?.length!==records.length)throw Error('La base no confirmó todos los importes. Actualiza antes de reintentar.');
  const live=await readEntries(info.id);
  if(!validView(info))return;
  const ids=new Set(live.map(e=>e.id));if(created.some(e=>!ids.has(e.id)))throw Error('No se verificó la lectura posterior de importes.');
  info.data.entries=live;closeTaskDialog();showPage(info,info.page);
 }finally{info.saving=false}
}
function manual(info,plan){
 if(!validView(info))return;const rows=leaves(plan.phases||[]);if(!rows.length){statusMessage('Primero introduce las partidas y sus pesos en el Gantt.',true);return}
 let body='<form id="ecManualForm"><div class="top"><h2>Ingresar datos económicos</h2><button type="button" id="closeTask" class="light">✕</button></div><p class="small">Cada importe se SUMA a lo registrado. Usa 0 para registrar un coste nulo. No mezclar bases imponibles con importes IVA incluido.</p>';
 rows.forEach((p,i)=>{body+='<section class="ec-entry-row"><b>'+escape(p.name)+'</b> · '+percent(p.weight)+'<div class="form-pair"><label>Nuevo presupuesto €<input id="ecB'+i+'" type="number" min="0" step="0.01" placeholder="Sin cambio"></label><label>Nuevo coste real €<input id="ecA'+i+'" type="number" min="0" step="0.01" placeholder="Sin cambio"></label></div></section>'});
 body+='<p id="ecError" class="status err"></p><button id="ecSave" class="dark">Confirmar importes</button></form>';dialogForm(body);
 $('ecManualForm').onsubmit=async e=>{e.preventDefault();if(!validView(info)||info.saving)return;const payload=[];for(let i=0;i<rows.length;i++)for(const kind of ['budget','actual']){const raw=$(kind==='budget'?'ecB'+i:'ecA'+i).value.trim();if(!raw)continue;const n=Number(raw);if(!VALID(n)||n>1e10){$('ecError').textContent='Revisa el importe.';return}payload.push(row(info,rows[i].id,kind,n,'Entrada manual',crypto.randomUUID()))}
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
  e.preventDefault();if(!validView(info)||!proposal||info.saving)return;
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
root.tcEconomyPrueba=()=>show(DEMO);root.tcOpenEconomy=(id,page)=>show(id||NATIVE_WORKS.find(w=>!w.archived_at&&w.execution_state==='execution')?.id||NATIVE_WORKS.find(w=>!w.archived_at)?.id||DEMO,page);
const menu=document.getElementById('eliteMenu');if(menu&&!menu.querySelector('#ecPrueba')){const button=document.createElement('button');button.id='ecPrueba';button.textContent='Control de Avance · Prueba';button.type='button';button.onclick=()=>{menu.hidden=true;show(DEMO)};menu.append(button)}
return {DEMO,physical,planned,curve,finance,example,graph};
});
