/* One directed relation, editable from either endpoint. */
(function(root){
'use strict';
const C=TCWorkCalendar,$=id=>document.getElementById(id);
root.tcDependencyFields=function(rows,p){const leaves=TCGantt.leaves(rows).filter(q=>q.id!==p.id);return ['pre','post'].map(direction=>`<fieldset class="g-deps"><legend>${direction==='pre'?'Predecesoras':'Sucesoras'}</legend>${leaves.map(q=>{const target=direction==='pre'?p:q,source=direction==='pre'?q:p,e=C.links(target).find(e=>e.id===source.id);return `<div class="g-edge" data-edge-direction="${direction}" data-edge-id="${q.id}"><label><input type="checkbox" data-edge-active ${e?'checked':''}>${esc(q.name)}</label><div class="form-pair"><label>Relación<select data-edge-type aria-label="Relación con ${esc(q.name)}"><option value="FS" ${e?.type==='SS'?'':'selected'}>Fin–Inicio (FI)</option><option value="SS" ${e?.type==='SS'?'selected':''}>Inicio–Inicio (II)</option></select></label><label>Desfase · días laborables<input data-edge-lag type="number" min="-3660" max="3660" step="1" value="${e?.lag||0}" aria-label="Desfase con ${esc(q.name)}"></label></div></div>`}).join('')}</fieldset>`).join('')+'<p class="small">FI 0: siguiente jornada tras el fin. II 0: mismo inicio. Un desfase negativo adelanta; uno positivo retrasa. El signo es el mismo desde ambos extremos.</p>'};
root.tcCollectDependencies=function(rows,id){const p=rows.find(p=>p.id===id);const set=(target,source,entry)=>{const edges=C.links(target).filter(e=>e.id!==source);if(entry)edges.push(entry);target.depends_on=edges.map(e=>e.id);target.dependency_links=edges;target.lag_days=0};document.querySelectorAll('[data-edge-direction]').forEach(node=>{const direction=node.dataset.edgeDirection,other=rows.find(q=>q.id===node.dataset.edgeId),target=direction==='pre'?p:other,source=direction==='pre'?other:p,active=node.querySelector('[data-edge-active]').checked,value=node.querySelector('[data-edge-lag]').value,lag=Number(value);if(active&&(!value.trim()||!Number.isInteger(lag)||Math.abs(lag)>3660))throw Error('El desfase debe ser un entero entre −3660 y 3660.');set(target,source.id,active?{id:source.id,type:node.querySelector('[data-edge-type]').value,lag}:null)});return rows};
root.tcDependencyWarnings=function(rows,c){
 const map=new Map(rows.map(p=>[p.id,p]));
 return rows.flatMap(p=>C.links(p).flatMap(e=>{
  const predecessor=map.get(e.id);
  if(!predecessor)return ['«'+p.name+'» tiene una dependencia con una actividad inexistente. Revisa los vínculos antes de guardar.'];
  if(e.type==='SS'&&e.lag===0&&predecessor.start!==p.start)
   return ['«'+p.name+'» no empieza junto a «'+predecessor.name+'»: otra restricción o una fecha real fija impide el inicio simultáneo.'];
  return [];
 }));
};
gDependencies=function(id){const rows=gRows(),p=rows.find(p=>p.id===id);if(!p||TCGantt.isGroup(rows,p)||G2.busy)return;const epoch=sessionEpoch,work=G2.work,owner=session?.user?.id||null,revision=planOf(work).revision;let draft=null;dialogForm(`<form id="gdForm"><div class="top"><h2>Dependencias · ${esc(p.name)}</h2><button id="closeTask" class="light" type="button">✕</button></div>${tcDependencyFields(rows,p)}<label>Motivo de excepción de capacidad<textarea id="gdReason" maxlength="2000"></textarea></label><button id="gdPreview" type="button" class="light">Ver fechas resultantes</button><div id="gdImpact" aria-live="polite"></div><div id="gdError" role="status" class="status err"></div><button id="gdSave" class="dark" disabled>Guardar vínculos y fechas</button></form>`);const form=$('gdForm'),current=()=>epoch===sessionEpoch&&owner===session?.user?.id&&G2.work===work&&mode==='gantts'&&$('gdForm')===form;form.addEventListener('input',e=>{if(!current())return;if(e.target.id==='gdReason')return;draft=null;$('gdSave').disabled=true;$('gdImpact').replaceChildren()});form.addEventListener('change',e=>{if(!current())return;if(e.target.id==='gdReason')return;draft=null;$('gdSave').disabled=true;$('gdImpact').replaceChildren()});$('gdPreview').onclick=()=>{if(!current())return;try{const c=tcCalendarForWork(work);draft=C.schedule(tcCollectDependencies(gHydrate(rows),id),c,ElitePlanning);const moved=draft.filter(p=>{const old=rows.find(q=>q.id===p.id);return old.start!==p.start||old.end!==p.end}),warnings=tcDependencyWarnings(draft,c);$('gdImpact').innerHTML=`<h3>${moved.length} actividades cambian de fechas</h3>${warnings.map(s=>`<p class="status err">${esc(s)}</p>`).join('')}${moved.map(q=>{const old=rows.find(p=>p.id===q.id);return `<p><b>${esc(q.name)}</b><br>${old.start} → ${old.end}<br>Nuevo: ${q.start} → ${q.end}</p>`}).join('')||'<p>Las fechas se conservan.</p>'}`;$('gdError').textContent='';$('gdSave').disabled=false}catch(e){if(current()){draft=null;$('gdSave').disabled=true;$('gdError').textContent=e.message}}};form.onsubmit=async e=>{
 e.preventDefault();
 if(!current()||!draft)return;
 if(planOf(work).revision!==revision){$('gdError').textContent='El Gantt cambió. Actualiza antes de guardar.';return}
 const button=$('gdSave');button.disabled=true;
 const saved=await gCommit(draft,{reschedule:false,reason:$('gdReason').value.trim()});
 if(!current())return;
 if(saved)closeTaskDialog();
 else{$('gdError').textContent=G2.message;button.disabled=false}
};
};
})(window);
