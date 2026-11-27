/* TU CONTROLAS: immutable PM cost forecasts and approved cost baselines.
   No monetary amount is inferred from progress, elapsed days or certification. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TCCostMargin=api})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=10000000000;
const positive=n=>valid(n)&&n>0;
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n):'Sin datos';
const pct=n=>Number.isFinite(n)?new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n)+' %':'Sin datos';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?Date.parse(s+'T00:00:00Z')/86400000:NaN;
const leaves=rows=>{const parents=new Set((rows||[]).map(r=>r.parent_id).filter(Boolean));return (rows||[]).filter(r=>r.id&&!r.is_group&&!r.milestone&&!parents.has(r.id))};
function latest(records,kind,cutoff){
 const rows=(records||[]).filter(x=>x.snapshot_type===kind&&day(x.as_of)<=day(cutoff));
 return rows.sort((a,b)=>a.as_of.localeCompare(b.as_of)||String(a.created_at||'').localeCompare(String(b.created_at||''))).at(-1)||null;
}
function first(records,kind,cutoff){
 const rows=(records||[]).filter(x=>x.snapshot_type===kind&&day(x.as_of)<=day(cutoff));
 return rows.sort((a,b)=>a.as_of.localeCompare(b.as_of)||String(a.created_at||'').localeCompare(String(b.created_at||'')))[0]||null;
}
const margin=(revenue,cost)=>positive(revenue)&&valid(cost)?(revenue-cost)/revenue*100:null;
const validK=k=>typeof k==='number'&&Number.isFinite(k)&&k>=0&&k<=100;
function effectiveCost(raw,k,included){
 if(!valid(raw))return null;
 return included===true||!validK(k)?raw:Math.round(raw*(1+k/100)*100)/100;
}
function latestK(records,date){
 const record=latest(records,'k_setting',date);
 if(!record)return null;
 const n=record.k_indirect_pct===null||record.k_indirect_pct===undefined?null:Number(record.k_indirect_pct);
 return validK(n)?n:null;
}
const isIncluded=r=>r?.cost_includes_indirect===true;
function calcMargin(r,k){if(!r)return null;return margin(Number(r.forecast_revenue),effectiveCost(Number(r.total_cost),k,isIncluded(r)));}

function summary({records=[],date,offerCost=null,contract=null}){
 const offer=first(records,'offer',date),initial=first(records,'pm_initial',date),baseline=latest(records,'baseline',date),forecast=latest(records,'forecast',date);
 const kSnapshot=latest(records,'k_setting',date),k=latestK(records,date);
 const offerRevenue=offer?Number(offer.forecast_revenue):null,offerBudget=offer?Number(offer.total_cost):null;
 const sale=forecast?Number(forecast.forecast_revenue):initial?Number(initial.forecast_revenue):valid(contract)?contract:null;
 const last=forecast||initial,rawFinalCost=last?Number(last.total_cost):null;
 const finalCost=last?effectiveCost(rawFinalCost,k,isIncluded(last)):null;
 const offerMarg=calcMargin(offer,k),initialMarg=calcMargin(initial,k);
 const currentMarg=margin(sale,finalCost);
 return {offer,initial,baseline,forecast,kSnapshot,kPercent:k,hasK:validK(k),offerMargin:offerMarg,initialMargin:initialMarg,currentMargin:currentMarg,
  offerCost:offerBudget,offerCostWithK:offer?effectiveCost(offerBudget,k,isIncluded(offer)):null,offerRevenue:offerRevenue,liveOfferCost:valid(offerCost)?offerCost:null,
  contract:valid(contract)?contract:null,currentSale:sale,rawFinalCost,finalCost,indirectCharge:valid(rawFinalCost)&&valid(finalCost)?Math.round((finalCost-rawFinalCost)*100)/100:null,
  benefit:positive(sale)&&valid(finalCost)?sale-finalCost:null,
  gapOffer:currentMarg!==null&&offerMarg!==null?currentMarg-offerMarg:null,
  gapInitial:currentMarg!==null&&initialMarg!==null?currentMarg-initialMarg:null};
}
function measured(row,date){const a=(row.observations||[]).filter(o=>o.date<=date&&valid(Number(o.percent))&&Number(o.percent)<=100).sort((a,b)=>a.date.localeCompare(b.date));return a.length?Number(a.at(-1).percent):null}
function evm(plan,entries,date,approved){
 const empty={bac:null,pv:null,ev:null,ac:null,cpi:null,spi:null,eacTrend:null,validBaseline:false};
 if(!approved||approved.snapshot_type!=='baseline'||!Array.isArray(approved.activity_costs))return empty;
 const now=leaves(plan?.phases),original=leaves(plan?.baseline),lines=approved.activity_costs;
 if(!now.length||lines.length!==now.length||original.length!==now.length)return empty;
 const byId=new Map(lines.map(i=>[i.activity_id,Number(i.amount)])),baseId=new Map(original.map(r=>[r.id,r]));
 if(byId.size!==now.length||now.some(p=>!byId.has(p.id)||!valid(byId.get(p.id))||!baseId.has(p.id)))return empty;
 const bac=now.reduce((n,p)=>n+byId.get(p.id),0);
 if(!positive(bac)||Math.abs(bac-Number(approved.total_cost))>.01)return empty;
 const amounts=now.map(p=>(entries||[]).filter(e=>e.kind==='actual'&&e.activity_id===p.id&&e.entry_date<=date&&valid(Number(e.amount))));
 const ac=amounts.every(v=>v.length)?amounts.reduce((n,rows)=>n+rows.reduce((s,e)=>s+Number(e.amount),0),0):null;
 const values=now.map(p=>measured(p,date));
 const ev=values.every(v=>v!==null)?now.reduce((n,p,i)=>n+byId.get(p.id)*values[i]/100,0):null;
 const pv=plan?.baseline_at&&original.every(p=>Number.isFinite(day(p.start))&&Number.isFinite(day(p.end))&&day(p.end)>=day(p.start))
  ?now.reduce((n,p)=>{const b=baseId.get(p.id);return n+byId.get(p.id)*Math.max(0,Math.min(1,(day(date)-day(b.start)+1)/(day(b.end)-day(b.start)+1)))},0):null;
 const cpi=valid(ev)&&positive(ac)?ev/ac:null,spi=valid(ev)&&positive(pv)?ev/pv:null;
 return {bac,pv,ev,ac,cpi,spi,eacTrend:positive(cpi)?bac/cpi:null,validBaseline:true};
}
function chart(records,offerMargin,date,k){
 const rows=(records||[]).filter(x=>(x.snapshot_type==='forecast'||x.snapshot_type==='pm_initial')&&day(x.as_of)<=day(date))
  .sort((a,b)=>a.as_of.localeCompare(b.as_of)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const obs=rows.map(r=>({date:r.as_of,margin:calcMargin(r,k)})).filter(x=>x.margin!==null);
 if(!obs.length)return '<p class="ec-margin-empty">Sin previsiones registradas. Carga la estimación inicial del PM para comenzar el historial.</p>';
 const all=obs.map(x=>x.margin).concat(Number.isFinite(offerMargin)?[offerMargin]:[]),lo=Math.min(0,...all)-4,hi=Math.max(0,...all)+4,span=Math.max(1,hi-lo);
 const xpos=i=>50+(Math.max(1,obs.length)-1?i/Math.max(1,obs.length-1)*590:295);
 const ypos=v=>180-(v-lo)/span*145;
 let out='<svg class="ec-margin-chart" viewBox="0 0 680 218" role="img" aria-label="Evolución del margen previsto por el PM frente al margen de oferta"><title>Comparación de márgenes</title>';
 for(let k=0;k<=4;k++){const v=lo+span*k/4,y=ypos(v);out+='<line x1="44" x2="653" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#e0e6ea"/><text x="40" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+pct(v)+'</text>';}
 if(Number.isFinite(offerMargin))out+='<path d="M50 '+ypos(offerMargin).toFixed(1)+' L640 '+ypos(offerMargin).toFixed(1)+'" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="6 4"/>';
 out+='<path d="'+obs.map((p,i)=>(i?'L':'M')+xpos(i).toFixed(1)+' '+ypos(p.margin).toFixed(1)).join(' ')+'" fill="none" stroke="#16835d" stroke-width="3"/>';
 obs.forEach((p,i)=>{out+='<circle cx="'+xpos(i).toFixed(1)+'" cy="'+ypos(p.margin).toFixed(1)+'" r="4" fill="#16835d"/>';if(i===0||i===obs.length-1||obs.length<5)out+='<text x="'+xpos(i).toFixed(1)+'" y="207" text-anchor="middle">'+p.date.slice(8)+'/'+p.date.slice(5,7)+'</text>';});
 return out+'</svg><div class="ec-margin-legend"><span>━━ Margen previsto PM</span><span>┄ Margen de oferta</span></div>';
}
function render(inputs, s=summary(inputs)){
 const review=s.forecast||s.initial;
 const reviewed=review?new Intl.DateTimeFormat('es-ES',{timeZone:'UTC'}).format(new Date(review.as_of+'T12:00Z')):'';
 const gap=s.gapOffer===null?'Sin comparación':new Intl.NumberFormat('es-ES',{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(s.gapOffer)+' pp frente a oferta';
 return `<section class="ec-card ec-margin-section" aria-labelledby="ecReturnTitle">
  <h2 id="ecReturnTitle">Previsión de cierre</h2>
  <dl class="ec-lead-values"><div><dt>Margen previsto</dt><dd>${pct(s.currentMargin)}</dd></div><div><dt>Margen de oferta</dt><dd>${pct(s.offerMargin)}</dd></div></dl>
  <p class="ec-difference">${gap}</p>
  <dl class="ec-amounts"><div><dt>Coste final estimado (EAC)</dt><dd>${money(s.finalCost)}</dd></div></dl>
  ${review?`<p class="ec-source">${s.forecast?'Previsión revisada':'Estimación inicial'} el ${esc(reviewed)}</p>`:''}
  <p class="${s.hasK?'ec-source':'ec-k-warning'}">${s.hasK?'Factor K de indirectos: '+pct(s.kPercent)+'. Solo se aplica a costes directos.':'No se consideran costes indirectos mediante factor K.'}</p>
 </section>`;
}
function marginHistory(records,date,s){
 const values=[
  ['Coste original de oferta',s.offerCost],['Coste de oferta con indirectos',s.offerCostWithK],
  ['Coste inicial del PM',s.initial?Number(s.initial.total_cost):null],['Venta final prevista',s.currentSale],
  ['Beneficio final previsto',s.benefit],['Coste real en el último cierre',s.forecast?Number(s.forecast.actual_cost):null],
  ['Coste pendiente en el último cierre (ETC)',s.forecast?Number(s.forecast.remaining_cost):null],
  ['Indirectos previstos por K',s.hasK?s.indirectCharge:null]
 ];
 return chart(records,s.offerMargin,date,s.kPercent)+
  '<dl class="ec-amounts">'+values.map(([label,v])=>'<div><dt>'+label+'</dt><dd>'+money(v)+'</dd></div>').join('')+'</dl>'+
  (s.hasK?'<p class="ec-source">El histórico compara las previsiones con el K vigente al corte. Los importes registrados conservan su valor original.</p>':'');
}
function formHTML({plan,finance,records,date}){
 const s=summary({records,date,offerCost:finance.bac,contract:finance.contract});
 const phases=leaves(plan?.phases);
 const existing=s.baseline?.activity_costs||[];
 const fromBaseline=new Map(existing.map(v=>[v.activity_id,Number(v.amount)]));
 const offerMap=new Map((finance.rows||[]).map(v=>[v.id,v.budget]));
 const rows=phases.map(p=>'<label class="ec-margin-line">'+esc(p.name)+'<input type="number" step=".01" min="0" max="10000000000" data-ec-baseline="'+esc(p.id)+'" value="'+(valid(fromBaseline.get(p.id))?fromBaseline.get(p.id):valid(offerMap.get(p.id))?offerMap.get(p.id):'')+'" placeholder="Coste aprobado €" required></label>').join('');
 const types='<option value="forecast">Actualizar coste final previsto</option><option value="pm_initial">Registrar estimación inicial del PM</option><option value="offer">Fijar coste y venta de oferta</option><option value="baseline">Registrar línea base aprobada</option><option value="k_setting">Configurar K de indirectos</option>';
 return '<form id="ecMarginForm"><div class="top"><h2>Control de costes · PM</h2><button type="button" id="closeTask" class="light">✕</button></div>'+
 '<p class="small">Cada guardado añade una versión fechada, sin sobrescribir ofertas, líneas base ni cierres anteriores.</p>'+
 '<label>Tipo de registro<select id="ecMarginKind">'+types+'</select></label>'+
 '<div class="ec-margin-field ec-m-offer ec-m-initial"><label>Coste estimado (€)<input id="ecMarginTotal" type="number" step=".01" min="0" max="10000000000" data-offer-default="'+(valid(s.offer?.total_cost)?s.offer.total_cost:valid(finance.bac)?finance.bac:'')+'" data-pm-default="'+(valid(s.initial?.total_cost)?s.initial.total_cost:valid(finance.bac)?finance.bac:'')+'"></label></div>'+
 '<div class="ec-margin-field ec-m-forecast"><label>Coste real acumulado al corte (AC)<input id="ecMarginActual" type="number" readonly value="'+(valid(finance.ac)?finance.ac:'')+'" placeholder="Faltan costes por registrar"></label>'+
 '<label>Coste que falta para terminar (ETC)<input id="ecMarginRemaining" type="number" step=".01" min="0" max="10000000000" placeholder="Pendiente de ejecutar"></label></div>'+
 '<div class="ec-margin-field ec-m-baseline"><p class="small">Distribuí el presupuesto aprobado por actividades. La suma constituirá BAC; no es el coste de oferta.</p>'+rows+
 '<label>Referencia de aprobación de la dirección<input id="ecMarginApproval" maxlength="160" placeholder="Acta, correo o autorización"></label></div>'+
 '<div class="ec-margin-field ec-m-k"><p class="small">K es un porcentaje sobre costes directos. Dejalo vacío para desactivar K y mostrar margen sin indirectos añadidos.</p><label>Factor K de costes indirectos (%)<input id="ecMarginK" type="number" step=".001" min="0" max="100" placeholder="Ej. 5" value="'+(s.kPercent===null?'':s.kPercent)+'"></label></div>'+
 '<div class="ec-margin-field ec-m-scope"><label class="ec-k-check"><input id="ecCostIncludesIndirect" type="checkbox"> Los costes introducidos ya incluyen indirectos (no aplicar K de nuevo)</label></div>'+
 '<label>Venta prevista final (€)<input id="ecMarginRevenue" type="number" step=".01" min="0" max="10000000000" value="'+(valid(s.currentSale)?s.currentSale:valid(finance.contract)?finance.contract:'')+'"></label>'+
 '<label>Nota / justificación<input id="ecMarginNote" maxlength="300" placeholder="Motivo de la previsión o revisión"></label>'+
 '<p class="status err" id="ecMarginError" role="alert"></p><button id="ecMarginSave" class="dark" type="submit">Guardar revisión</button></form>';
}
function configureForm(form){
 const totalInput=form.querySelector('#ecMarginTotal');
 const kToggle=form.querySelector('#ecMarginK');
 const costs={offer:totalInput.dataset.offerDefault||'',pm_initial:totalInput.dataset.pmDefault||''};
 let previousKind=null;
 const choose=()=>{const kind=form.querySelector('#ecMarginKind').value;
 if(previousKind==='offer'||previousKind==='pm_initial')costs[previousKind]=totalInput.value;
 if(kind==='offer'||kind==='pm_initial')totalInput.value=costs[kind]||'';
 previousKind=kind;
 for(const el of form.querySelectorAll('.ec-margin-field'))el.hidden=!(kind==='offer'&&el.classList.contains('ec-m-offer')||kind==='pm_initial'&&el.classList.contains('ec-m-initial')||kind==='forecast'&&el.classList.contains('ec-m-forecast')||kind==='baseline'&&el.classList.contains('ec-m-baseline'));
 const baseline=kind==='baseline',isK=kind==='k_setting';
 form.querySelector('#ecMarginRevenue').closest('label').hidden=baseline||isK;
 for(const el of form.querySelectorAll('.ec-m-scope'))el.hidden=baseline||isK;
 for(const el of form.querySelectorAll('.ec-m-k'))el.hidden=!isK;
 kToggle.required=false;
 form.querySelector('#ecMarginApproval').required=baseline;
 for(const el of form.querySelectorAll('[data-ec-baseline]'))el.required=baseline;
 };
 form.querySelector('#ecMarginKind').addEventListener('change',choose);choose();
}
function parseForm(form,info){
 const kind=form.querySelector('#ecMarginKind').value,amount=id=>{const s=form.querySelector('#'+id).value.trim(),v=Number(s);if(!s||!valid(v))throw Error('Indica un importe válido en los campos necesarios.');return Math.round(v*100)/100};
 let total=null,actual=null,remaining=null,activity_costs=[],approval_reference=null,k_indirect_pct=null,cost_includes_indirect=null;
 const revenue=kind==='baseline'||kind==='k_setting'?null:amount('ecMarginRevenue');
 if(kind!=='baseline'&&kind!=='k_setting'&&!positive(revenue))throw Error('Indica una venta prevista mayor que cero.');
 if(kind==='offer'||kind==='pm_initial'||kind==='forecast')cost_includes_indirect=!!form.querySelector('#ecCostIncludesIndirect')?.checked;
 if(kind==='offer'||kind==='pm_initial')total=amount('ecMarginTotal');
 else if(kind==='forecast'){
  if(!valid(info.finance.ac))throw Error('Completa los costes reales de todas las partidas antes de cerrar una previsión. No asumimos ceros sin confirmar.');
  actual=amount('ecMarginActual');remaining=amount('ecMarginRemaining');total=Math.round((actual+remaining)*100)/100;
 } else if(kind==='k_setting'){
  total=0;
  const raw=form.querySelector('#ecMarginK').value.trim();
  if(raw!==''){const n=Number(raw);if(!validK(n))throw Error('K debe estar entre 0 % y 100 %.');k_indirect_pct=Math.round(n*1000)/1000;}
 } else if(kind==='baseline'){
  if(!info.plan?.baseline_at)throw Error('Primero fija la línea base de fechas del Gantt.');
  const phases=leaves(info.plan.phases);if(!phases.length)throw Error('La obra no tiene actividades con costes.');
  activity_costs=phases.map(p=>{const el=[...form.querySelectorAll('[data-ec-baseline]')].find(x=>x.dataset.ecBaseline===p.id),s=el?.value?.trim(),n=Number(s);if(!s||!valid(n))throw Error('Completa el coste aprobado de todas las actividades, incluso 0.');return {activity_id:p.id,amount:Math.round(n*100)/100}});
  total=Math.round(activity_costs.reduce((n,x)=>n+x.amount,0)*100)/100;
  if(!positive(total))throw Error('El presupuesto de ejecución aprobado debe ser positivo.');
  approval_reference=form.querySelector('#ecMarginApproval').value.trim();
  if(!approval_reference)throw Error('Indica la referencia de aprobación por la dirección.');
 } else throw Error('Tipo de registro desconocido.');
 const note=form.querySelector('#ecMarginNote').value.trim();
 return {work_id:info.id,snapshot_type:kind,as_of:info.date,total_cost:total,forecast_revenue:revenue,actual_cost:actual,remaining_cost:remaining,activity_costs,approval_reference,source_note:note||null,k_indirect_pct,cost_includes_indirect};
}
return {valid,validK,effectiveCost,latestK,leaves,first,latest,margin,summary,evm,chart,render,marginHistory,formHTML,configureForm,parseForm};
});
