/* Minimal, safe editing of existing tasks and dismissible long-press actions. */
(function(root){
'use strict';
const originalTaskForm=openTaskForm,originalSelect=selectHeldForDelete,originalDelete=deleteHeldItem;
let busy=false,pendingRefresh=null,taskPointer=null;
const selectedRow='.home-row.is-task-selected,.compact-task.is-task-selected';
function flushRefresh(){
 if(taskPointer!==null||document.querySelector(selectedRow)||!pendingRefresh)return;
 const refresh=pendingRefresh;pendingRefresh=null;refresh();
}
function selectionClear(){
 document.querySelectorAll('.home-row.is-task-selected,.compact-task.is-task-selected').forEach(row=>row.classList.remove('is-task-selected'));
 document.querySelectorAll('.tc-task-actions').forEach(node=>node.remove());
 document.querySelectorAll('.home-row.is-delete-selected').forEach(row=>row.classList.remove('is-delete-selected'));
 document.querySelectorAll('.home-row>.tc-delete-button').forEach(node=>node.remove());
}
function validLocalDateTime(value){
 if(!value)return null;
 const d=new Date(value);
 if(!Number.isFinite(d.getTime())||localDateTime(d.toISOString())!==value)throw Error('Fecha y hora no válidas en el dispositivo.');
 return d.toISOString();
}
function linkFor(id){
 for(const plan of WORK_PLANS){const row=(plan.phases||[]).find(p=>p.task_id===id);if(row)return {plan,row}}
 return null;
}
function reminderValues(task,mode,custom,due){
 if(mode==='none')return {remind_minutes:null,remind_at:null};
 if(mode==='custom'){
  const iso=validLocalDateTime(custom);
  if(!iso)throw Error('Selecciona la fecha y hora del recordatorio.');
  const unchanged=task.remind_at&&localDateTime(task.remind_at)===custom;
  if(!unchanged&&new Date(iso).getTime()<=Date.now())throw Error('El nuevo recordatorio debe estar en el futuro.');
  return {remind_minutes:null,remind_at:unchanged?task.remind_at:iso};
 }
 const n=Number(mode);
 if(!['0','5','15','30','60','1440'].includes(mode))throw Error('Selecciona un recordatorio válido.');
 if(!due)throw Error('Introduce el vencimiento para calcular el recordatorio.');
 return {remind_minutes:n,remind_at:null};
}
function edit(id){
 selectionClear();
 let task=OWN_TASKS.find(t=>t.id===id);
 if(!task){
  if(CHECKLIST_ITEMS.some(c=>c.id===id))return editChecklistItem(id);
  statusMessage('La tarea ya no está disponible. Actualizá la lista.',true);return;
 }
 if(task.control_id)return originalTaskForm(id);
 const editorEpoch=sessionEpoch,editorOwner=session?.user?.id;
 const sameSession=()=>sessionEpoch===editorEpoch&&session?.user?.id===editorOwner;
 let linked=linkFor(id);
 const due=linked?linked.row.end:localDateTime(task.due_at);
 const reminder=task.remind_at?'custom':(!task.due_at&&!linked?'none':task.remind_minutes==null?'none':String(task.remind_minutes));
 const title=esc(task.title||'');
 const checklistDraft=JSON.parse(JSON.stringify(task.checklists||[])),checklistOriginal=JSON.stringify(checklistDraft);
 const dateValue=due||'';
 const type=linked?'date':'datetime-local';
 const info=linked?'<p class="small">Actividad vinculada al Gantt. Las fechas con dependencias se editan desde el cronograma.</p>':'';
 let originalExtras=task.extra_remind_at||[];
 const reminderExtras='<details class="task-form-section"><summary>Avisos adicionales</summary>'+[0,1].map(i=>'<label>Aviso '+(i+2)+'<input name="extra'+i+'" type="datetime-local" value="'+esc(localDateTime(originalExtras[i]))+'"></label>').join('')+'</details>';
 const html='<form id="tcQuickTaskForm" class="tc-quick-form" aria-label="Datos de tarea"><div class="top tc-quick-top"><button type="button" class="light" id="closeTask" aria-label="Cerrar">✕</button></div>'
 +'<label>Nombre<input name="title" maxlength="240" required value="'+title+'"></label>'
 +'<label>Vencimiento<input name="due" type="'+type+'" value="'+esc(dateValue)+'"></label>'
 +'<label>Recordatorio<select name="reminder">'
 +[['none','Sin aviso'],['0','Al vencimiento'],['5','5 minutos antes'],['15','15 minutos antes'],['30','30 minutos antes'],['60','1 hora antes'],['1440','1 día antes'],['custom','Elegir día y hora']].map(row=>'<option value="'+row[0]+'"'+(row[0]===reminder?' selected':'')+'>'+row[1]+'</option>').join('')
 +'</select></label>'
 +'<label id="tcQuickCustomRow"'+(reminder==='custom'?'':' hidden')+'>Fecha y hora del recordatorio<input name="custom" type="datetime-local" value="'+esc(localDateTime(task.remind_at))+'"></label>'
 +info+reminderExtras+'<details class="task-form-section"'+(checklistDraft.length?' open':'')+'><summary>Checklist <span id="tcQuickCheckSummary"></span></summary><div id="tcQuickCheckEditor"></div><button type="button" class="light" id="tcQuickAddChecklist">+ Checklist</button></details><div id="tcQuickError" class="status err" role="alert"></div>'
 +'<div class="form-actions tc-quick-actions"><button class="dark" type="submit" data-save>Guardar</button>'+(!task.deleted_at&&!task.completed?'<button class="light" type="button" data-complete>Marcar como completada</button>':'')+'<button class="light" type="button" data-cancel>Cancelar</button><button class="tc-quick-delete" type="button" data-delete>'+((task.deleted_at&&task.stage==='Gantt')?'Historial':task.deleted_at?'Restaurar':'Eliminar')+'</button></div></form>';
 const dialog=dialogForm(html),form=dialog.querySelector('#tcQuickTaskForm');
 dialog.setAttribute?.('aria-label','Datos de tarea');
 if(typeof mountTaskChecklists==='function')mountTaskChecklists(form.querySelector('#tcQuickCheckEditor'),form.querySelector('#tcQuickCheckSummary'),checklistDraft,form.querySelector('#tcQuickAddChecklist'));
 const switchCustom=()=>{form.querySelector('#tcQuickCustomRow').hidden=form.elements.reminder.value!=='custom'};
 form.elements.reminder.onchange=switchCustom;
 form.querySelector('[data-cancel]').onclick=closeTaskDialog;
 const completeButton=form.querySelector('[data-complete]');
 if(completeButton)completeButton.onclick=async()=>{
  if(busy||!sameSession()||!dialog.isConnected)return;
  const status=form.querySelector('#tcQuickError');
  status.textContent='';
  const lock=disabled=>form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=disabled);
  busy=true;
  try{await completeNativeTask(task,{dialog,status,lock})}
  finally{busy=false}
 };
 form.querySelector('[data-delete]').onclick=async()=>{
  if(busy||!sameSession())return;
  if(task.deleted_at){
   if(task.stage==='Gantt'){showHistory(id);return}
   busy=true;
   try{
    await patchNativeTask(task,{deleted_at:null});if(!sameSession())return;
    await fetchOwnTasks();if(!sameSession()||!dialog.isConnected)return;
    closeTaskDialog();if(mode==='tasks')tasks();else render();statusMessage('Tarea restaurada.');
   }catch(e){if(sameSession()&&dialog.isConnected)form.querySelector('#tcQuickError').textContent=e.message}
   finally{busy=false}
   return;
  }
  const button=form.querySelector('[data-delete]'),error=form.querySelector('#tcQuickError');
  button.disabled=true;error.textContent='';
  try{
   const ok=await deleteHeldItem('task',id,message=>{error.textContent=message});
   if(ok&&sameSession()&&dialog.isConnected)closeTaskDialog();
  }finally{button.disabled=false}
 };
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!sameSession())return;
  const title=form.elements.title.value.trim(),selectedDue=form.elements.due.value,reminderMode=form.elements.reminder.value;
  const error=form.querySelector('#tcQuickError');
  let planSaved=false,taskSaved=false;
  try{
   if(!title)throw Error('Escribe el nombre de la tarea.');
   let iso=linked?(selectedDue?selectedDue+'T12:00:00Z':null):(selectedDue===localDateTime(task.due_at)?task.due_at||null:validLocalDateTime(selectedDue));
   if(!linked&&iso&&task.start_at&&new Date(iso)<new Date(task.start_at))throw Error('El vencimiento no puede ser anterior al inicio.');
   if(!iso&&task.recurrence&&task.recurrence!=='none')throw Error('Las tareas repetitivas necesitan vencimiento.');
   const r=reminderValues(task,reminderMode,form.elements.custom.value,iso),add={};
   if(title!==task.title)add.title=title;
   if(JSON.stringify(checklistDraft)!==checklistOriginal)add.checklists=normalizeTaskChecklists(checklistDraft);
   if(!linked&&iso!==(task.due_at||null))add.due_at=iso;
   if(r.remind_minutes!==(task.remind_minutes??null)||r.remind_at!==(task.remind_at||null)){
    add.remind_minutes=r.remind_minutes;add.remind_at=r.remind_at;
   }
   {
    const entered=[0,1].map(i=>form.elements['extra'+i].value);
    if(entered.some((value,i)=>value!==localDateTime(originalExtras[i]))){
     const extras=entered.flatMap((value,i)=>{
      if(!value)return [];
      const unchanged=value===localDateTime(originalExtras[i]);
      const iso=unchanged?originalExtras[i]:validLocalDateTime(value);
      if(!unchanged&&Date.parse(iso)<=Date.now())throw Error('Los avisos nuevos deben tener una fecha y hora futuras.');
      return [iso];
     });
     add.extra_remind_at=extras;
    }
   }
   const reminderTime=r.remind_at?Date.parse(r.remind_at):r.remind_minutes!=null&&iso?Date.parse(iso)-r.remind_minutes*60000:null;
   const extraTimes=(add.extra_remind_at||originalExtras).map(value=>Date.parse(value));
   if(('remind_minutes' in add||'extra_remind_at' in add||'due_at' in add||linked&&selectedDue!==linked.row.end)
     &&(extraTimes.includes(reminderTime)||new Set(extraTimes).size!==extraTimes.length))throw Error('Los avisos deben tener fechas y horas distintas.');
   const dueChanged=!!linked&&selectedDue!==linked.row.end;
   if(!Object.keys(add).length&&!dueChanged){closeTaskDialog();return}
   busy=true;error.textContent='';form.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
   if(linked&&(title!==task.title||dueChanged)){
    const rows=gHydrate(linked.plan.phases),row=rows.find(p=>p.id===linked.row.id);
    if(!row)throw Error('La actividad cambió. Actualiza el Gantt.');
    if(dueChanged){
     if(!selectedDue)throw Error('Las actividades de Gantt requieren vencimiento.');
     if(row.actual_end||row.activity_status==='done')throw Error('Esta actividad ya está cerrada. Revisa la planificación antes de cambiar su fecha.');
     if(rows.some(p=>(p.depends_on||[]).includes(row.id)))throw Error('Esta actividad tiene sucesoras. Modifica el vencimiento desde el Gantt para recalcular los vínculos.');
     if(!row.milestone&&selectedDue<row.start)throw Error('El vencimiento no puede ser anterior al inicio de Gantt.');
     if(row.milestone){row.start=selectedDue;row.end=selectedDue;row.duration_days=0}
     else{
      row.end=selectedDue;
      const cal=typeof tcCalendarForWork==='function'?tcCalendarForWork(task.work_id):null;
      if(cal){
       if(!TCWorkCalendar.working(selectedDue,cal))throw Error('El vencimiento debe ser un día laborable del Gantt.');
       row.duration_days=TCWorkCalendar.count(row.start,selectedDue,cal);
      }else row.duration_days=ElitePlanning.day(selectedDue)-ElitePlanning.day(row.start)+1;
     }
    }
    row.name=title;
    if(G2.busy||G2.draft)throw Error('Termina los cambios abiertos del Gantt antes de editar esta tarea.');
    G2.work=task.work_id;
    const saving=gCommit(rows,{reschedule:false}),token=G2.saveToken;
    const ok=await saving;
    if(!sameSession())return;
    if(!ok){
     if(G2.work===task.work_id&&!G2.busy&&G2.saveToken===token)G2.draft=null;
     throw Error(G2.message||'No se pudo guardar el Gantt.');
    }
    planSaved=true;
    const currentTask=OWN_TASKS.find(t=>t.id===id),currentLink=linkFor(id);
    if(!currentTask||!currentLink)throw Error('Vuelve a abrir la tarea para comprobar su versión actual.');
    task=currentTask;linked=currentLink;
   }
   const reminderPatch={};
   if('remind_minutes' in add){reminderPatch.remind_minutes=add.remind_minutes;reminderPatch.remind_at=add.remind_at}
   if('checklists' in add)reminderPatch.checklists=add.checklists;
   if('extra_remind_at' in add)reminderPatch.extra_remind_at=add.extra_remind_at;
   if(linked){
    if(Object.keys(reminderPatch).length){
     const fresh=OWN_TASKS.find(t=>t.id===id);
     if(!fresh)throw Error('No se encontró la tarea vinculada después de actualizar el Gantt.');
     if(!sameSession())return;
     task=await patchNativeTask(fresh,reminderPatch);
     taskSaved=true;
     originalExtras=task.extra_remind_at||[];
     if(!sameSession())return;
    }
   }else{
    if(!sameSession())return;
    task=await patchNativeTask(task,add);
    taskSaved=true;
    originalExtras=task.extra_remind_at||[];
    if(!sameSession())return;
   }
   await fetchOwnTasks();
   if(!sameSession()||!dialog.isConnected)return;
   closeTaskDialog();
   if(mode==='tasks')tasks();else render();
   statusMessage('Tarea guardada y comprobada.');
  }catch(e){
   if(sameSession()&&dialog.isConnected){
    error.textContent=taskSaved?'Se guardaron los cambios, pero no se pudo actualizar la vista. Vuelve a abrir la tarea para comprobarlos. '+e.message:
     planSaved?'Se guardó el Gantt. Los cambios adicionales de la tarea siguen pendientes. Puedes volver a pulsar Guardar. '+e.message:e.message;
    form.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);
    switchCustom();
   }
  }finally{busy=false}
 };
 form.elements.title.focus();
}
const originalRow=homeRow;
homeRow=function(card){
 const html=originalRow(card);
 if(card.ganttReference||!card.own)return html;
 return html.replace('onclick="void 0"','onclick="openQuickTaskEditor(this.dataset.holdId)"');
};
openTaskForm=function(id=null,workId=null){
 const task=id?OWN_TASKS.find(t=>t.id===id):null;
 if(task&&!task.control_id)return edit(id);
 return originalTaskForm(id,workId);
};
selectHeldForDelete=function(host,kind,id){
 if(kind!=='task'||!host||!(host.classList.contains('home-row')||host.classList.contains('compact-task')))return originalSelect(host,kind,id);
 const same=host.classList.contains('is-task-selected');selectionClear();
 if(same)return;
 host.classList.add('is-task-selected');
 const actions=document.createElement('div');actions.className='tc-task-actions';
 actions.setAttribute('role','group');actions.setAttribute('aria-label','Acciones de la tarea');
 const button=(label,css,action)=>{
  const b=document.createElement('button');b.type='button';b.className=css;b.textContent=label;b.onclick=async e=>{e.stopPropagation();await action();flushRefresh()};actions.append(b);
 };
 button('Editar','light',()=>edit(id));
 if(OWN_TASKS.some(t=>t.id===id&&!t.control_id&&!t.deleted_at))button('Eliminar','tc-action-delete',async()=>{const ok=await deleteHeldItem('task',id);if(ok)selectionClear()});
 button('Cancelar','light',selectionClear);
 host.insertAdjacentElement('afterend',actions);
};
deleteHeldItem=async function(kind,id,onError=message=>statusMessage(message,true)){
 if(kind!=='task')return originalDelete(kind,id);
 if(busy||root.tcTaskCompletionPending?.(id)){onError('Espera a que termine el guardado de la tarea y vuelve a intentarlo.');return false}
 const t=OWN_TASKS.find(row=>row.id===id);
 if(!t||t.deleted_at||t.control_id){onError('No se puede eliminar esta tarea desde aquí.');return false}
 const deleteEpoch=sessionEpoch,deleteOwner=session?.user?.id;
 const sameSession=()=>!!deleteOwner&&sessionEpoch===deleteEpoch&&session?.user?.id===deleteOwner;
 if(!sameSession())return false;
 const linked=linkFor(id);
 if(!confirm('¿Eliminar «'+t.title+'»'+(linked?' y su actividad vinculada de Gantt':'')+'? Podrás consultar el historial.'))return false;
 if(!sameSession())return false;
 busy=true;
 try{
  if(linked){
   if(G2.busy||G2.draft)throw Error('Termina primero los cambios abiertos en Gantt.');
   const rows=gHydrate(linked.plan.phases),next=ElitePlanning.derive(TCGantt.removal(rows,linked.row.id));
   ElitePlanning.validate(next);
   if(!sameSession())return false;
   if(G2.busy||G2.draft)throw Error('El Gantt cambió mientras se preparaba la eliminación.');
   G2.work=t.work_id;
   const saving=gCommit(next,{reschedule:false,removeId:linked.row.id}),token=G2.saveToken;
   const saved=await saving;
   if(!sameSession())return false;
   if(!saved){
    if(G2.work===t.work_id&&!G2.busy&&G2.saveToken===token)G2.draft=null;
    throw Error(G2.message||'No se pudo quitar la actividad Gantt.');
   }
  }else{
   if(!sameSession())return false;
   const archived=await patchNativeTask(t,{deleted_at:new Date().toISOString()});
   if(!sameSession())return false;
   if(!archived?.deleted_at)throw Error('No se confirmó el archivado de la tarea.');
  }
  await fetchOwnTasks();
  if(!sameSession())return false;
  selectionClear();if(mode==='tasks')tasks();else render();
  statusMessage(linked?'Actividad eliminada de Gantt, con historial conservado.':'Tarea eliminada. Podrás restaurarla desde Archivadas.');
  return true;
 }catch(e){if(sameSession())onError(e.message);return false}
 finally{busy=false}
};

root.openQuickTaskEditor=edit;
root.tcClearTaskSelection=selectionClear;
root.tcRefreshTaskResults=()=>renderTaskResults();
root.tcAfterTaskInteraction=refresh=>{pendingRefresh=refresh;flushRefresh()};
document.addEventListener('pointerdown',e=>{
 if(e.target.closest('[data-hold-kind="task"],.tc-task-actions'))taskPointer=e.pointerId;
 if(document.querySelector(selectedRow)&&!e.target.closest(selectedRow+',.tc-task-actions'))selectionClear();
},true);
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,e=>{
 if(taskPointer===e.pointerId)taskPointer=null;
 if(pendingRefresh)setTimeout(flushRefresh,0);
},true);
document.addEventListener('click',()=>{if(pendingRefresh)setTimeout(flushRefresh,0)},true);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.querySelector(selectedRow)){selectionClear();e.preventDefault();flushRefresh()}
},true);
})(typeof window==='undefined'?globalThis:window);
