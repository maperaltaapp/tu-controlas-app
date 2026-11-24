/* Compact physical daily report. One server transaction saves report and Gantt. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
let plan=null,draft=null,original=null,busy=false,request=0,navigation=0;
const leaves=p=>(p?.phases||[]).filter(a=>!a.is_group&&!(p.phases||[]).some(child=>child.parent_id===a.id));
const scheduled=(p,day)=>leaves(p).filter(a=>a.start<=day&&a.end>=day);
const progress=(a,day)=>(a.observations||[]).filter(o=>o.date<=day).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)?.percent??null;
root.TCDailyActivities={leaves,scheduled,progress};
const oldSection=selectSection;selectSection=function(...args){navigation++;return oldSection(...args)};
const oldEnd=sessionViewEnded;sessionViewEnded=function(...args){request++;draft=plan=original=followDraft=null;busy=followBusy=false;return oldEnd(...args)};
editDailyReport=async function(id=null,workId=null,day=planningToday()){
 if(!session?.access_token||!nativeReady||busy)return;
 const epoch=sessionEpoch,owner=session?.user?.id||null,nav=navigation,token=++request;
 dialogForm('<div id="dailyLoading"><p role="status">Cargando parte y actividades…</p><button id="closeTask" type="button" class="light">Cerrar</button></div>');
 const loading=$('dailyLoading'),current=()=>!!owner&&!!session?.access_token&&owner===session?.user?.id&&epoch===sessionEpoch&&nav===navigation&&token===request&&$('dailyLoading')===loading;
 try{
  const reports=await readAll('elite_daily_reports','order=report_date.desc,id.asc');if(!current())return;
  let saved=id?reports.find(r=>r.id===id):reports.find(r=>r.work_id===workId&&r.report_date===day);
  if(id&&!saved)throw Error('El parte ya no está disponible. Actualiza el historial.');
  const target=saved?.work_id||workId||followWork||'';
  const plans=target?await readAll('elite_work_plans','work_id=eq.'+target):[];if(!current())return;
  DAILY_REPORTS=reports;original=saved||null;plan=plans[0]||null;
  draft=saved?structuredClone(saved):{id:crypto.randomUUID(),work_id:target,report_date:day,activities:[]};
  draft.activities??=[];
  // Only a single unambiguous planned activity is preselected; never invent one.
  const suggestions=scheduled(plan,draft.report_date);if(!saved&&suggestions.length===1)draft.activities.push(newEntry(suggestions[0]));
  followDraft=draft;renderFollowEditor();
 }catch(error){if(current()){loading.innerHTML=`<p class="err" role="alert">${esc(error.message)}</p><button id="dailyLoadRetry" class="light">Reintentar</button><button id="closeTask" type="button" class="light">Cerrar</button>`;$('dailyLoadRetry').onclick=()=>editDailyReport(id,workId,day);$('closeTask').onclick=closeTaskDialog;}}
};
function newEntry(activity){return {activity_id:activity?.id||null,activity_name:activity?.name||'',progress_pct:activity?progress(activity,draft.report_date)??'':'',observations:'',workers:0,machines:0};}
function collect(){
 draft.activities=draft.activities.map((a,i)=>{
  if(!a.activity_id&&$('daName'+i))a.activity_name=$('daName'+i).value.trim();
  return {...a,progress_pct:$('daPercent'+i).value===''?'':Number($('daPercent'+i).value),observations:$('daNote'+i).value,workers:Number($('daWorkers'+i).value),machines:Number($('daMachines'+i).value)};
 });followDraft=draft;
}
function entryEditor(a,i){const archived=!!original?.activities?.some(p=>p.activity_id===a.activity_id&&p.activity_name===a.activity_name)&&a.activity_id&&!leaves(plan).some(p=>p.id===a.activity_id),stored=original?.activities?.some(p=>p.activity_id===a.activity_id&&p.activity_name===a.activity_name);return `<section class="tc-daily-activity"><h3>${esc(a.activity_name||'Trabajo sin Gantt')}</h3>${!a.activity_id?`<label>Actividad<input id="daName${i}" required maxlength="160" value="${esc(a.activity_name)}" ${stored?'readonly':''}></label>`:''}${archived?'<p class="small">Actividad histórica: se conserva sin modificar.</p>':''}<fieldset ${archived?'disabled':''}><label>Avance acumulado · %<input id="daPercent${i}" required type="number" min="0" max="100" step="0.01" value="${a.progress_pct}"></label><label>Observaciones<textarea id="daNote${i}" maxlength="10000">${esc(a.observations)}</textarea></label><div class="form-pair"><label>Operarios<input id="daWorkers${i}" required type="number" min="0" max="500" step="1" value="${a.workers}"></label><label>Máquinas<input id="daMachines${i}" required type="number" min="0" max="500" step="1" value="${a.machines}"></label></div></fieldset>${!stored?`<button type="button" class="light" data-remove-activity="${i}">Quitar actividad</button>`:''}</section>`;}
renderFollowEditor=function(){
 if(!draft)return;
 const works=NATIVE_WORKS.filter(w=>!w.archived_at||w.id===draft.work_id),options=leaves(plan).filter(p=>!draft.activities.some(a=>a.activity_id===p.id)),suggestions=scheduled(plan,draft.report_date),suggestedIds=new Set(suggestions.map(p=>p.id));
 const option=p=>`<option value="${p.id}">${esc(p.name)}</option>`,suggested=options.filter(p=>suggestedIds.has(p.id)),others=options.filter(p=>!suggestedIds.has(p.id));
 dialogForm(`<form id="dailyForm" class="tc-daily-form"><div class="top"><h2>${original?'Editar':'Nuevo'} parte diario</h2><button id="closeTask" type="button" class="light">✕</button></div><div class="form-pair"><label>Obra<select id="dailyWork" required ${original?'disabled':''}><option value="">Elige obra</option>${works.map(w=>`<option value="${w.id}" ${w.id===draft.work_id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></label><label>Fecha<input id="dailyDate" type="date" min="2000-01-01" max="${planningToday()}" required value="${draft.report_date}" ${original?'readonly':''}></label></div><p class="small">${suggestions.length?'Actividades previstas para este día: '+suggestions.length+'.':'No hay actividades previstas para este día. Elige una del Gantt o registra un trabajo manual si no hay cronograma.'} Un parte por obra y día.</p>${original?.format_version!==2&&original?`<details class="tc-daily-legacy"><summary>Información anterior conservada</summary><p>${esc(original.notes||'Sin observaciones generales.')}</p>${original.progress_note?`<p>${esc(original.progress_note)}</p>`:''}<p class="small">Los datos y recursos del parte anterior se conservan íntegros. Su porcentaje global no se convierte en avance de una actividad.</p></details>`:''}<div id="dailyActivities">${draft.activities.map(entryEditor).join('')}</div><label>Actividad del Gantt<select id="dailyActivity"><option value="">Elige actividad</option>${suggested.length?`<optgroup label="Previstas para este día">${suggested.map(option).join('')}</optgroup>`:''}${others.length?`<optgroup label="Otras actividades">${others.map(option).join('')}</optgroup>`:''}</select></label><div class="form-actions"><button id="dailyAdd" type="button" class="light" ${options.length?'':'disabled'}>+ Actividad</button>${!leaves(plan).length?'<button id="dailyManual" type="button" class="light">+ Trabajo manual</button>':''}</div><div id="dailyError" class="status err" role="status"></div><div class="form-actions"><button id="dailySave" class="dark" ${draft.activities.length?'':'disabled'}>Guardar parte</button><button id="dailyHistory" type="button" class="light">Historial</button></div></form>`);
 const form=$('dailyForm');
 if(NATIVE_WORKS.find(w=>w.id===draft.work_id)?.archived_at){form.querySelectorAll('input,select,textarea,button:not(#closeTask):not(#dailyHistory)').forEach(el=>el.disabled=true);$('dailyError').textContent='Obra archivada: parte disponible para consulta.';}
 form.onsubmit=saveDailyReport;
 $('dailyAdd').onclick=()=>{const selected=leaves(plan).find(p=>p.id===$('dailyActivity').value);if(!selected){$('dailyError').textContent='Elige una actividad.';return}collect();draft.activities.push(newEntry(selected));renderFollowEditor()};
 if($('dailyManual'))$('dailyManual').onclick=()=>{collect();draft.activities.push(newEntry(null));renderFollowEditor()};
 document.querySelectorAll('[data-remove-activity]').forEach(b=>b.onclick=()=>{collect();draft.activities.splice(Number(b.dataset.removeActivity),1);renderFollowEditor()});
 const changeContext=()=>{const work=$('dailyWork').value,date=$('dailyDate').value;collect();if(draft.activities.length&&!confirm('Cambiar obra o fecha vacía la selección de este parte sin guardar. ¿Continuar?')){renderFollowEditor();return}editDailyReport(null,work,date)};
 $('dailyWork').onchange=changeContext;$('dailyDate').onchange=changeContext;
 $('dailyHistory').onclick=()=>{closeTaskDialog();followWork=draft.work_id;openFollowup()};
};
saveDailyReport=async function(event){
 event.preventDefault();if(busy||!draft||!session?.access_token)return;
 const form=$('dailyForm'),epoch=sessionEpoch,owner=session?.user?.id||null,nav=navigation,active=()=>!!owner&&!!session?.access_token&&owner===session?.user?.id&&epoch===sessionEpoch&&nav===navigation&&$('dailyForm')===form;
 try{
  if(!active())return;
  collect();
  if(!draft.work_id||!draft.report_date||!draft.activities.length)throw Error('Elige obra, fecha y al menos una actividad.');
  if(!NATIVE_WORKS.some(w=>w.id===draft.work_id&&!w.archived_at))throw Error('Selecciona una obra activa antes de guardar.');
  const date=draft.report_date,parsed=new Date(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date>planningToday())
   throw Error('La fecha del parte debe ser válida y no posterior a hoy.');
  const linked=new Set();
  for(const activity of draft.activities){
   if(!activity.activity_id)continue;
   if(linked.has(activity.activity_id))throw Error('No repitas una misma actividad del Gantt en el parte.');
   linked.add(activity.activity_id);
   if(!leaves(plan).some(p=>p.id===activity.activity_id)&&!original?.activities?.some(p=>p.activity_id===activity.activity_id))
    throw Error('La actividad ya no existe en este Gantt. Actualiza antes de guardar.');
  }
  for(const a of draft.activities){if(!a.activity_name.trim()||!Number.isFinite(a.progress_pct)||a.progress_pct<0||a.progress_pct>100||![a.workers,a.machines].every(n=>Number.isInteger(n)&&n>=0&&n<=500))throw Error('Revisa avance, operarios y máquinas.');}
  if(!active())return;const expected=structuredClone(draft);busy=followBusy=true;form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
  const result=await eliteRequest('/rest/v1/rpc/elite_save_daily_activities',{method:'POST',body:JSON.stringify({target_report:draft.id,target_work:draft.work_id,report_day:draft.report_date,new_activities:draft.activities,expected_updated_at:original?.updated_at||null,expected_plan_revision:plan?.revision||0})});
  if(!active())return;
  const [reports,plans,tasks]=await Promise.all([readAll('elite_daily_reports','id=eq.'+expected.id),readAll('elite_work_plans','work_id=eq.'+expected.work_id),readAll('elite_tasks','work_id=eq.'+expected.work_id)]);if(!active())return;
  const saved=reports[0];
  if(reports.length!==1||saved.work_id!==expected.work_id||saved.report_date!==expected.report_date||saved.format_version!==2||saved.activities.length!==expected.activities.length||expected.activities.some((a,i)=>Object.keys(a).some(k=>(saved.activities[i][k]??null)!==(a[k]??null)))||Date.parse(result?.report?.updated_at)!==Date.parse(saved.updated_at))throw Error('El parte se guardó, pero cambió durante la verificación. Actualiza antes de reintentar.');
  if((result.plan?.revision??0)!==(plans[0]?.revision??0))throw Error('El Gantt cambió durante la verificación. Actualiza antes de continuar.');
  const actualPlan=plans[0];if(actualPlan&&(actualPlan.phases||[]).some(p=>p.task_id&&(!tasks.some(t=>t.id===p.task_id&&!t.deleted_at&&t.status===(p.activity_status||'pending')&&Number(t.progress_pct??-1)===Number((p.activity_status==='done'?100:progress(p,planningToday()))??-1)))))throw Error('No se pudo verificar el avance de las tareas. Actualiza.');
  DAILY_REPORTS=DAILY_REPORTS.filter(r=>r.id!==saved.id).concat(saved);WORK_PLANS=WORK_PLANS.filter(p=>p.work_id!==expected.work_id).concat(plans);OWN_TASKS=OWN_TASKS.filter(t=>t.work_id!==expected.work_id).concat(tasks);
  followWork=expected.work_id;closeTaskDialog();await openFollowup();statusMessage('Parte y avance guardados y verificados.');
 }catch(error){if(active()){renderFollowEditor();$('dailyError').textContent=error.message;}}
 finally{if(epoch===sessionEpoch&&owner===session?.user?.id){busy=followBusy=false;}}
};
})(window);
