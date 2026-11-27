/* Final package: owner-scoped sheet layouts and existing canonical checklist rows. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),clone=x=>structuredClone(x),E=s=>esc(s),work=()=>NATIVE_WORKS.find(w=>w.id===checkWorkId);
let query='',busy=false,loadSequence=0,navSequence=0,sheetObserver=null,checklistSnapshot=null;
const baseSelect=selectSection;selectSection=function(...args){sheetObserver?.disconnect();sheetObserver=null;navSequence++;if(!['checklist','suppliers'].includes(args[0]))checklistSnapshot=null;return baseSelect(...args)};
const ctx=()=>({owner:session?.user?.id,epoch:sessionEpoch,work:checkWorkId,section:checkSection,nav:navSequence});
const live=c=>c.owner&&c.owner===session?.user?.id&&c.epoch===sessionEpoch&&c.work===checkWorkId&&c.section===checkSection&&c.nav===navSequence;
const layout=w=>clone(w?.workspace_layout||{});
function sections(w=work()){const extra=w?.workspace_layout?.checklist_types||{};const overrides=w?.workspace_layout?.checklist_type_labels||{};const builtins=Object.fromEntries(Object.entries(CHECK_SECTIONS).map(([id,name])=>[id,typeof overrides[id]==='string'&&overrides[id].trim()?overrides[id].trim().slice(0,100):name]));return {...builtins,...Object.fromEntries(Object.entries(extra).filter(([id,name])=>/^custom_[a-f0-9-]{36}$/.test(id)&&typeof name==='string'&&name.trim()).slice(0,20))}}
function defaults(){return checkSection==='providers'?[{id:'name',label:'Subcontrata / proveedor'},{id:'entry_date',label:'Entrada prevista'},...Object.entries(CONTROL_STEPS).map(([id,label])=>({id:'stage_'+id,label}))]:[{id:'title',label:'Elemento'},{id:'due_date',label:'Fecha'},{id:'notes',label:'Notas'},{id:'completed_at',label:'Completado'}]}
function config(){const raw=layout(work()).sheets?.[checkSection]||{},valid=c=>c&&typeof c.label==='string'&&(defaults().some(d=>d.id===c.id)||/^col_[a-f0-9-]{36}$/.test(c.id)),clean=rows=>(Array.isArray(rows)?rows:[]).filter(valid).slice(0,40).map(c=>({id:c.id,label:c.label.slice(0,100)})),cols=clean(raw.columns);return {columns:cols.length?cols:defaults(),hidden_columns:clean(raw.hidden_columns),widths:Object.fromEntries(Object.entries(raw.widths||{}).map(([id,width])=>[id,Math.max(90,Math.min(600,Number(width)||180))])),scale:Math.max(.6,Math.min(1.8,Number(raw.scale)||1))}}
const columns=()=>config().columns||defaults();
const minWidth=90,maxWidth=600,actionWidth=48;
const clampWidth=value=>Math.max(minWidth,Math.min(maxWidth,Math.round(value)));
function columnWidth(id,cfg){
 const initial={title:166,name:166,notes:226,due_date:134,entry_date:134,completed_at:136};
 return cfg.widths[id]||initial[id]||(id.startsWith('stage_')?134:154);
}
async function saveLayout(w,next){
 const epoch=sessionEpoch,owner=session?.user?.id;if(!owner||!w)throw Error('Selecciona una obra.');
 const rows=await eliteRequest('/rest/v1/elite_works?id=eq.'+w.id+'&updated_at=eq.'+encodeURIComponent(w.updated_at),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_layout:next})});
 if(epoch!==sessionEpoch||owner!==session?.user?.id)return false;
 if(rows?.length!==1)throw Error('La obra cambió. Actualiza antes de guardar el formato.');
 NATIVE_WORKS=NATIVE_WORKS.map(x=>x.id===w.id?rows[0]:x);return true;
}
root.TCFinal={layout,saveLayout};
function sameOwner(c){return c.owner&&c.owner===session?.user?.id&&c.epoch===sessionEpoch}
function lockSheet(value){document.querySelectorAll('.tc-sheet input,.tc-sheet select,.tc-sheet button').forEach(e=>e.disabled=value);const panel=document.querySelector('.tc-sheet');if(panel)panel.setAttribute('aria-busy',String(value));const status=$('sheetSaveStatus');if(status&&value){status.classList.remove('err');status.textContent='Guardando…'}else if(status&&status.textContent==='Guardando…')status.textContent=''}
function sheetError(message){const status=$('sheetSaveStatus');if(status){status.textContent=message;status.classList.add('err')}statusMessage(message,true)}
root.tcSheetRefresh=()=>{if(busy)return;checklistSnapshot=null;return openChecklist(checkSection,checkWorkId,mode==='supplierChecklist')};
async function changeConfig(edit, repaint=renderChecklist){
 if(busy||!work())return false;
 const w=work(),context=ctx(),next=layout(w),cfg=config();
 busy=true;lockSheet(true);
 try{
  edit(cfg,next);
  next.sheets={...next.sheets,[context.section]:cfg};
  if(!await saveLayout(w,next)||!live(context))return false;
  repaint(cfg);
  return true;
 }catch(error){
  if(live(context)){
   if(repaint!==renderChecklist)repaint(config());
   const field=$('tcColumnError');
   if(field)field.textContent=error.message;
   else sheetError(error.message);
  }
  return false;
 }finally{if(sameOwner(context)){busy=false;if(live(context))lockSheet(false)}}
}
root.tcSheetAddColumn=()=>{const label=prompt('Nombre de la columna:');if(!label?.trim())return;if(columns().length>=40)return statusMessage('Máximo 40 columnas por planilla.',true);changeConfig(c=>{c.columns=[...(c.columns||defaults()),{id:'col_'+crypto.randomUUID(),label:label.trim().slice(0,100)}]})};
root.tcSheetColumn=id=>{
 const cfg=config(),col=cfg.columns.find(c=>c.id===id);
 if(!col||busy)return;
 const context=ctx();
 const dialog=dialogForm(`<form id="tcColumnForm"><div class="top"><h2>Editar columna</h2><button type="button" id="closeTask" class="light" aria-label="Cerrar">×</button></div><label>Nombre<input id="tcColumnLabel" maxlength="100" required value="${E(col.label)}"></label><label>Ancho en píxeles<input id="tcColumnWidth" type="number" min="${minWidth}" max="${maxWidth}" step="1" required value="${columnWidth(id,cfg)}"></label><div id="tcColumnError" role="status" class="status err"></div><div class="form-actions"><button class="dark" type="submit">Guardar</button><button class="light" id="tcColumnHide" type="button" ${cfg.columns.length===1?'disabled':''}>Ocultar columna</button></div></form>`);
 const finish=async edit=>{
  if(!live(context)||busy)return;
  if(await changeConfig(edit)&&dialog.isConnected)closeTaskDialog();
 };
 $('tcColumnForm').onsubmit=event=>{
  event.preventDefault();
  const label=$('tcColumnLabel').value.trim(),width=Number($('tcColumnWidth').value);
  if(!label||!Number.isInteger(width)||width<minWidth||width>maxWidth)return;
  return finish(c=>{c.columns=c.columns.map(v=>v.id===id?{...v,label}:v);c.widths[id]=width});
 };
 $('tcColumnHide').onclick=()=>finish(c=>{
  c.hidden_columns=[...c.hidden_columns.filter(v=>v.id!==id),col];
  c.columns=c.columns.filter(v=>v.id!==id);
 });
};
root.tcSheetRestoreColumns=()=>changeConfig(c=>{const ids=new Set(columns().map(x=>x.id));c.columns=[...columns(),...(c.hidden_columns||[]).filter(x=>!ids.has(x.id)),...defaults().filter(x=>!ids.has(x.id)&&!(c.hidden_columns||[]).some(h=>h.id===x.id))];c.hidden_columns=[]});
async function changeTypes(edit,sectionAfter){
 if(busy||!work())return false;
 const w=work(),context=ctx(),next=layout(w);
 busy=true;lockSheet(true);
 try{
  edit(next);
  if(!await saveLayout(w,next)||!live(context))return false;
  checkSection=sectionAfter||context.section;renderChecklist();return true;
 }catch(e){if(live(context))statusMessage(e.message,true);return false}
 finally{if(sameOwner(context)){busy=false;if(live(context))lockSheet(false)}}
}
root.tcSheetAddType=async()=>{
 if(busy||!work())return;
 const name=prompt('Nombre del nuevo tipo de checklist:')?.trim();if(!name)return;
 const existing=work().workspace_layout||{};
 if(Object.keys(existing.checklist_types||{}).length+Object.keys(existing.archived_checklist_types||{}).length>=20)return statusMessage('Máximo 20 tipos adicionales por obra, incluidos los archivados.',true);
 const id='custom_'+crypto.randomUUID();
 await changeTypes(next=>{next.checklist_types={...next.checklist_types,[id]:name.slice(0,100)}},id);
};
root.tcSheetEditType=()=>{
 const id=checkSection,name=sections()[id];if(!name||busy)return;const custom=id.startsWith('custom_');
 const context=ctx();
 const dialog=dialogForm(`<form id="tcTypeForm"><div class="top"><button type="button" class="light" id="closeTask" aria-label="Cerrar">×</button></div><label>Nombre del checklist<input id="tcTypeName" maxlength="100" required value="${E(name)}"></label><p class="small">${custom?'Archivar conserva las filas y tareas vinculadas. Puedes recuperarlo después.':'El nombre se guarda para esta obra sin cambiar sus filas ni tareas vinculadas.'}</p><div class="form-actions"><button type="submit" class="dark">Guardar</button>${custom?'<button type="button" class="light" id="tcTypeArchive">Archivar tipo</button>':''}</div></form>`);
 $('tcTypeForm').onsubmit=async e=>{e.preventDefault();const label=$('tcTypeName').value.trim();if(label&&live(context)&&await changeTypes(next=>{if(custom)next.checklist_types={...next.checklist_types,[id]:label.slice(0,100)};else next.checklist_type_labels={...next.checklist_type_labels,[id]:label.slice(0,100)}})&&dialog.isConnected)closeTaskDialog()};
 if(custom)$('tcTypeArchive').onclick=async()=>{if(!live(context)||!confirm('¿Archivar este tipo de checklist? Se conservarán sus filas, columnas y tareas vinculadas.'))return;if(await changeTypes(next=>{next.archived_checklist_types={...next.archived_checklist_types,[id]:name};delete next.checklist_types[id]},'prep')&&dialog.isConnected)closeTaskDialog()};
};
root.tcSheetRestoreTypes=()=>{
 if(busy||!work())return;
 const archived=Object.entries(layout(work()).archived_checklist_types||{}).filter(([id,name])=>/^custom_[a-f0-9-]{36}$/.test(id)&&typeof name==='string');
 if(!archived.length)return;
 const context=ctx(),dialog=dialogForm(`<div class="top"><h2>Checklist archivados</h2><button id="closeTask" class="light" type="button">×</button></div><div class="form-actions">${archived.map(([id,name])=>`<button type="button" class="light" data-restore-type="${id}">${E(name)}</button>`).join('')}</div>`);
 dialog.querySelectorAll('[data-restore-type]').forEach(button=>button.onclick=async()=>{const id=button.dataset.restoreType,name=archived.find(([key])=>key===id)?.[1];if(!name||!live(context))return;if(await changeTypes(next=>{next.checklist_types={...next.checklist_types,[id]:name};delete next.archived_checklist_types[id]},id)&&dialog.isConnected)closeTaskDialog()});
};

function templateChoices(){
 const owner=session?.user?.id,providers=checkSection==='providers';
 if(!owner)return [];
 return NATIVE_WORKS.filter(w=>w.id!==checkWorkId&&w.user_id===owner).flatMap(w=>
  Object.entries(sections(w)).filter(([id])=>(id==='providers')===providers).map(([id,name])=>{
   const count=providers?WORK_CONTRACTORS.filter(r=>r.work_id===w.id).length:CHECKLIST_ITEMS.filter(r=>r.work_id===w.id&&r.section===id).length;
   return {work:w.id,section:id,label:w.name+' · '+name,count,hasLayout:!!w.workspace_layout?.sheets?.[id],same:id===checkSection};
  }).filter(x=>x.count||x.hasLayout)
 ).sort((a,b)=>Number(b.same)-Number(a.same)||a.label.localeCompare(b.label,'es'));
}
function templateBox(){
 const options=templateChoices(),providers=checkSection==='providers',occupied=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).some(r=>r.work_id===checkWorkId&&(providers||r.section===checkSection));
 return `<div class="tc-check-template"><label for="tcTemplateSelect">Usar checklist de otra obra</label><div class="tc-template-controls"><select id="tcTemplateSelect" aria-label="Checklist de origen" ${!options.length||providers&&occupied?'disabled':''}><option value="">Elegir una plantilla…</option>${options.map(x=>`<option value="${E(x.work+'|'+x.section)}">${E(x.label)}${providers?'':` · ${x.count} filas`}</option>`).join('')}</select><button type="button" class="light" id="tcTemplateApply" disabled>Usar plantilla</button></div><small>${providers?(occupied?'El cuadro ya contiene empresas; usa una obra sin registros para copiar el formato.':'Solo columnas; no se copian empresas ni etapas.'):(!options.length?'No hay checklists de otras obras con filas o formato guardado.':occupied?'Se creará un checklist independiente, sin cambiar esta tabla.':'Copia columnas y nombres de filas; sin fechas, notas, valores ni estados.')}</small></div>`;
}
async function applyTemplate(){
 if(busy||!work())return;
 const value=$('tcTemplateSelect')?.value,source=templateChoices().find(x=>x.work+'|'+x.section===value);
 if(!source)return;
 const c=ctx(),w=work(),providers=c.section==='providers',occupied=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).some(r=>r.work_id===c.work&&(providers||r.section===c.section));
 if(providers&&occupied)return;
 if(!confirm(occupied?'¿Crear un nuevo checklist a partir de esta plantilla, conservando el actual?':'¿Copiar la estructura a este checklist? No se copiarán los datos de seguimiento.'))return;
 busy=true;lockSheet(true);
 try{
  const result=await eliteRequest('/rest/v1/rpc/tc_copy_checklist_template',{method:'POST',body:JSON.stringify({source_work:source.work,source_section:source.section,target_work:c.work,target_section:occupied?null:c.section,expected_updated_at:w.updated_at})});
  if(!sameOwner(c))return;
  if(!result?.work||result.work.id!==c.work||typeof result.section!=='string'||!Array.isArray(result.rows))throw Error('No se pudo confirmar la copia. Actualiza la aplicación.');
  NATIVE_WORKS=NATIVE_WORKS.map(x=>x.id===c.work?result.work:x);
  const added=new Set(result.rows.map(r=>r.id));
  CHECKLIST_ITEMS=CHECKLIST_ITEMS.filter(r=>!added.has(r.id)).concat(result.rows);
  if(live(c)){checkSection=result.section;query='';renderChecklist();statusMessage('Plantilla copiada. Ya puedes editar la tabla.')}
 }catch(e){if(live(c))sheetError(e.message)}
 finally{if(sameOwner(c)){busy=false;if(live(c))lockSheet(false);const apply=$('tcTemplateApply');if(apply)apply.disabled=!$('tcTemplateSelect')?.value}}
}

const supplierSections={registry:'Registro de empresas',checklist:'Checklist de Subcontratas y Proveedores',capacity:'Avisos de capacidad'};
let registryQuery='',registryKind='',registryArchived=false;
function supplierTabs(active){
 return '<nav class="tc-supplier-tabs" aria-label="Subcontratas y Proveedores">'+Object.entries(supplierSections).map(([id,label])=>`<button type="button" class="${id===active?'dark':'light'}" aria-pressed="${id===active}" onclick="tcSupplierTab('${id}')">${label}</button>`).join('')+'</nav>';
}
function registryRows(){
 const rows=CONTRACTORS.filter(c=>!!c.archived_at===registryArchived&&(!registryKind||registryKind===c.kind)&&tcSearchMatches(registryQuery,c.name,c.trade)).sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));
 const body=$('supplierBody');
 body.innerHTML=rows.map(c=>`<tr data-company="${E(c.id)}"><th scope="row"><button type="button" class="tc-company-name">${E(c.name)}</button></th><td>${E(c.trade||'—')}</td><td>${c.kind==='supplier'?'Proveedor':'Subcontrata'}</td></tr>`).join('')||'<tr><td colspan="3">Sin empresas para esta selección.</td></tr>';
 body.querySelectorAll('[data-company]').forEach(row=>row.onclick=()=>editContractor(row.dataset.company));
}
function renderRegistry(){
 $('content').innerHTML=`<section class="panel tc-companies">${supplierTabs('registry')}<div class="tc-company-controls">
 <label class="tc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="supplierSearch" type="search" aria-label="Buscar empresa o especialidad" placeholder="Buscar empresa o especialidad" value="${E(registryQuery)}"></label>
 <select id="supplierKind" aria-label="Tipo de empresa"><option value="">Todos los tipos</option><option value="subcontractor">Subcontratas</option><option value="supplier">Proveedores</option></select><select id="supplierState" aria-label="Estado de la empresa"><option value="active">Activas</option><option value="archived">Retiradas</option></select><button type="button" class="dark" onclick="editContractor()">+ Empresa</button></div>
 <div class="tc-company-scroll" tabindex="0" aria-label="Registro de empresas"><table><thead><tr><th scope="col">Empresa</th><th scope="col">Especialidad</th><th scope="col">Tipo</th></tr></thead><tbody id="supplierBody"></tbody></table></div></section>`;
 $('supplierSearch').oninput=e=>{registryQuery=e.target.value;registryRows()};
 $('supplierKind').value=registryKind;$('supplierKind').onchange=e=>{registryKind=e.target.value;registryRows()};
 $('supplierState').value=registryArchived?'archived':'active';$('supplierState').onchange=e=>{registryArchived=e.target.value==='archived';registryRows()};
 registryRows();
}
root.tcSupplierTab=async function(tab='registry'){
 if(!session?.user?.id||!nativeReady||busy||!Object.hasOwn(supplierSections,tab))return;
 if(tab==='checklist'){query='';return openChecklist('providers',checkWorkId,true)}
 checklistSnapshot=null;
 mode=tab==='registry'?'supplierRegistry':'supplierCapacity';workDetailId=null;selectSection('suppliers');
 if(tab==='registry')return renderRegistry();
 $('content').innerHTML=`<section class="panel tc-companies">${supplierTabs('capacity')}<div id="supplierAlerts" role="status">Comprobando avisos…</div></section>`;
 const target=$('supplierAlerts');
 await tcRefreshCapacity();
 if(target.isConnected)tcRenderCapacity(target);
};
const previousRender=render;render=function(...args){
 if(mode==='supplierRegistry')return tcSupplierTab('registry');
 if(mode==='supplierCapacity')return tcSupplierTab('capacity');
 if(mode==='supplierChecklist')return tcSupplierTab('checklist');
 return previousRender(...args);
};

function header(){return `<div class="tc-filter-bar"><label class="tc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="sheetSearch" type="search" aria-label="Buscar tarea u obra" placeholder="Buscar tarea u obra…" value="${E(query)}"></label><select id="sheetWork" aria-label="Obra del checklist">${NATIVE_WORKS.filter(w=>!w.archived_at).map(w=>`<option value="${w.id}" ${w.id===checkWorkId?'selected':''}>${E(w.name)}</option>`).join('')}</select><button type="button" class="light tc-sheet-refresh" id="sheetRefresh" aria-label="Actualizar planilla" title="Actualizar planilla"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/></svg></button></div><div class="tc-sheet-tabs" ${mode==='supplierChecklist'?'hidden':''}>${Object.entries(sections()).map(([id,name])=>`<button type="button" class="${id===checkSection?'dark':'light'}" aria-pressed="${id===checkSection}" data-sheet-type="${id}" title="${id===checkSection?(id.startsWith('custom_')?'Toca de nuevo para editar o archivar':'Toca de nuevo para editar el nombre'):E(name)}">${E(name)}</button>`).join('')}</div>`}
openChecklist=async function(section=checkSection,workId=checkWorkId,supplier=false){
 // Keep an in-flight write on its originating view until its confirmed response.
 if(busy)return;
 const owner=session?.user?.id,epoch=sessionEpoch;
 const reuse=!!owner&&nativeReady&&selectedSection===(supplier?'suppliers':'checklist')&&checklistSnapshot?.owner===owner&&checklistSnapshot?.epoch===epoch;
 checkWorkId=workId||NATIVE_WORKS.find(w=>!w.archived_at)?.id||'';checkSection=section;const names=sections();if(!Object.hasOwn(names,section))checkSection='prep';mode=supplier?'supplierChecklist':'checklist';workDetailId=null;selectSection(supplier?'suppliers':'checklist');const c=ctx(),sequence=++loadSequence;
 // A single confirmed snapshot covers all checklist types and works of this account.
 // Changing tabs is a local view operation; entering from another tool reloads fresh data.
 if(reuse){renderChecklist();return}
 checklistSnapshot=null;
 $('content').innerHTML='<p role="status">Cargando planilla…</p>';
 try{
  const [rows,providers,tasks]=await Promise.all([readAll('elite_work_checklist_items','order=position.asc,created_at.asc,id.asc'),readAll('elite_work_contractors','order=created_at.asc,id.asc'),readAll('elite_tasks','order=position.asc,created_at.asc,id.asc')]);
  if(!live(c)||sequence!==loadSequence)return;
  CHECKLIST_ITEMS=rows;WORK_CONTRACTORS=providers;OWN_TASKS=tasks;
  checklistSnapshot={owner,epoch};
  renderChecklist();
 }catch(e){
  if(live(c)&&sequence===loadSequence){checklistSnapshot=null;$('content').innerHTML='<p class="err">'+E(e.message)+'</p><button onclick="tcSheetRefresh()">Reintentar</button>'}
 }
};
function cells(row,col,providers){
 const id=row.id,key=col.id;
 if(providers&&key.startsWith('stage_'))return controlCell(row,key.slice(6));
 if(providers&&key==='name')return `<button class="control-name" onclick="editWorkContractor('${id}')">${E(row.name)}${row.scope?`<small class="control-activity">${E(row.scope)}</small>`:''}</button>`;
 const custom=key.startsWith('col_'),value=custom?row.cell_values?.[key]:row[key];
 if(key==='completed_at'){
  return `<label class="control-cell tc-completion control-${value?'done':'pending'}"><input type="checkbox" aria-label="Completar ${E(row.title)}" ${value?'checked':''} onchange="tcSheetCell('${id}','${key}',this.checked)"><span>${value?'Completado':'Pendiente'}</span></label>`;
 }
 return `<input class="tc-sheet-field" aria-label="${E(col.label)} · ${E(row.title||row.name)}" type="${['due_date','entry_date'].includes(key)?'date':'text'}" value="${E(value||'')}" placeholder="—" maxlength="${key==='notes'?5000:custom?2000:240}" onchange="tcSheetCell('${id}','${key}',this.value)">`;
}
function sheetMatrix(rows,cfg,providers){
 const cols=cfg.columns,widths=cols.map(c=>columnWidth(c.id,cfg));
 const head=cols.map((c,i)=>`<th scope="col"><button type="button" data-column-menu="${c.id}" title="Editar columna · ${E(c.label)}">${E(c.label)}</button><span role="separator" tabindex="0" aria-orientation="vertical" aria-valuemin="${minWidth}" aria-valuemax="${maxWidth}" aria-valuenow="${widths[i]}" aria-label="Ancho de ${E(c.label)}" data-column-resize="${c.id}"></span></th>`).join('');
 const body=rows.map(row=>{
  const values=cols.map((col,i)=>i===0?`<th scope="row">${cells(row,col,providers)}</th>`:`<td>${cells(row,col,providers)}</td>`).join('');
  return `<tr>${values}<td><button type="button" class="tc-row-remove" data-sheet-delete="${row.id}" aria-label="Eliminar fila ${E(row.title||row.name)}">×</button></td></tr>`;
 }).join('');
 const width=widths.reduce((sum,w)=>sum+w,actionWidth);
 return `<div class="control-scroll tc-sheet-scroll" role="region" tabindex="0" aria-label="Cuadro de ${E(sections()[checkSection])}"><table class="control-table tc-sheet-table" style="width:${width}px;--sheet-scale:${cfg.scale}"><colgroup>${widths.map(w=>`<col style="width:${w}px">`).join('')}<col style="width:${actionWidth}px"></colgroup><thead><tr>${head}<th scope="col" aria-label="Acciones de fila">Fila</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
renderChecklist=function(){
 const supplier=mode==='supplierChecklist';selectSection(supplier?'suppliers':'checklist');if(!supplier)mode='checklist';const w=work();if(!w){$('content').innerHTML='<section class="panel">'+(supplier?supplierTabs('checklist'):'')+'<p>Crea una obra para usar sus checklists.</p></section>';return}
 const providers=checkSection==='providers',q=query.trim().toLocaleLowerCase('es'),rows=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).filter(r=>r.work_id===w.id&&(providers||r.section===checkSection)).filter(r=>tcSearchMatches(q,w.name,r.title,r.name,r.notes,r.scope,Object.values(r.cell_values||{}))),cfg=config(),cols=columns();planningWork=w.id;
 const previous=document.querySelector('.tc-sheet-scroll');
 const left=previous?.scrollLeft||0,top=previous?.scrollTop||0;
 const matches=q?NATIVE_WORKS.filter(other=>!other.archived_at&&other.id!==w.id&&tcSearchMatches(q,other.name)):[];
 const recover=cfg.hidden_columns.length||defaults().some(col=>!cols.some(c=>c.id===col.id));
 $('content').innerHTML=`<section class="panel control-panel tc-sheet"><div class="tc-tool-sticky">${supplier?supplierTabs('checklist'):''}${header()}</div>
 ${templateBox()}
 ${matches.length?`<div class="tc-sheet-tools">${matches.map(other=>`<button class="light" data-found-work="${other.id}">${E(other.name)}</button>`).join('')}</div>`:''}
 <div class="tc-sheet-tools"><button class="dark" id="sheetAddRow">+ Fila</button><button class="light" onclick="tcSheetAddColumn()">+ Columna</button>${supplier?'':`<button class="light" onclick="tcSheetAddType()">+ Tipo</button><button type="button" class="light" onclick="tcSheetEditType()">Editar tipo</button>${Object.keys(layout(w).archived_checklist_types||{}).length?'<button class="light" onclick="tcSheetRestoreTypes()">Recuperar tipos</button>':''}` }${recover?'<button class="light" onclick="tcSheetRestoreColumns()">Recuperar columnas</button>':''}</div>
 <p class="tc-sheet-save-status" id="sheetSaveStatus" role="status" aria-live="polite"></p>${sheetMatrix(rows,cfg,providers)}
 <p class="tc-sheet-help">${rows.length} ${rows.length===1?'fila':'filas'} · Arrastra el borde de una columna para ajustar su ancho.</p></section>`;
 $('sheetRefresh').onclick=()=>tcSheetRefresh();
 $('tcTemplateSelect').onchange=()=>{$('tcTemplateApply').disabled=!$('tcTemplateSelect').value};$('tcTemplateApply').onclick=applyTemplate;
 $('sheetWork').onchange=e=>{query='';openChecklist(checkSection,e.target.value,supplier)};
 $('sheetSearch').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;renderChecklist();$('sheetSearch').focus();$('sheetSearch').setSelectionRange(pos,pos)};
 document.querySelectorAll('[data-found-work]').forEach(b=>b.onclick=()=>{query='';openChecklist(checkSection,b.dataset.foundWork,supplier)});document.querySelectorAll('[data-sheet-type]').forEach(b=>b.onclick=()=>{if(b.dataset.sheetType===checkSection)return tcSheetEditType();query='';openChecklist(b.dataset.sheetType,checkWorkId)});document.querySelectorAll('[data-column-menu]').forEach(b=>b.onclick=()=>tcSheetColumn(b.dataset.columnMenu));document.querySelectorAll('[data-sheet-delete]').forEach(b=>b.onclick=()=>removeRow(b.dataset.sheetDelete));$('sheetAddRow').onclick=()=>providers?editWorkContractor():addRow();bindTable(cfg,left,top);
};
async function writeRow(row,payload,providers,c){const table=providers?'elite_work_contractors':'elite_work_checklist_items',rows=await eliteRequest('/rest/v1/'+table+'?id=eq.'+row.id+'&updated_at=eq.'+encodeURIComponent(row.updated_at),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});if(!live(c))return;if(rows?.length!==1)throw Error('La fila cambió en otro dispositivo. Actualiza antes de guardar.');if(providers)WORK_CONTRACTORS=WORK_CONTRACTORS.map(x=>x.id===row.id?rows[0]:x);else CHECKLIST_ITEMS=CHECKLIST_ITEMS.map(x=>x.id===row.id?rows[0]:x);renderChecklist()}
root.tcSheetCell=async(id,key,value)=>{if(busy)return;const providers=checkSection==='providers',row=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).find(r=>r.id===id&&r.work_id===checkWorkId);if(!row)return;const c=ctx();busy=true;lockSheet(true);try{if(key==='title'&&!value.trim())throw Error('El elemento necesita nombre.');if(key==='completed_at')await writeRow(row,{completed_at:value?new Date().toISOString():null},false,c);else if(key.startsWith('col_'))await writeRow(row,{cell_values:{...row.cell_values,[key]:String(value)}},providers,c);else if(['title','notes','due_date','entry_date'].includes(key))await writeRow(row,{[key]:value||(['due_date','entry_date'].includes(key)?null:'')},providers,c)}catch(e){if(live(c)){renderChecklist();sheetError(e.message)}}finally{if(sameOwner(c)){busy=false;if(live(c))lockSheet(false)}}};
async function addRow(){if(busy)return;const c=ctx();busy=true;lockSheet(true);try{const result=await eliteRequest('/rest/v1/elite_work_checklist_items',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({work_id:c.work,section:c.section,title:'Nuevo elemento',position:itemsPosition(c.work,c.section)})});if(!live(c))return;if(result?.length!==1)throw Error('No se confirmó la fila.');CHECKLIST_ITEMS.push(result[0]);renderChecklist();document.querySelector('.tc-sheet-table tbody tr:last-child input')?.focus()}catch(e){if(live(c))sheetError(e.message)}finally{if(sameOwner(c)){busy=false;if(live(c))lockSheet(false)}}}
async function removeRow(id){if(busy||!confirm('¿Eliminar esta fila y sus datos?'))return;const providers=checkSection==='providers',row=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).find(r=>r.id===id&&r.work_id===checkWorkId),c=ctx();if(!row)return;busy=true;lockSheet(true);try{const result=await eliteRequest('/rest/v1/'+(providers?'elite_work_contractors':'elite_work_checklist_items')+'?id=eq.'+id+'&updated_at=eq.'+encodeURIComponent(row.updated_at),{method:'DELETE',headers:{Prefer:'return=representation'}});if(!live(c))return;if(result?.length!==1)throw Error('La fila cambió. Actualiza antes de eliminar.');if(providers){await refreshControls();if(live(c))renderChecklist()}else{CHECKLIST_ITEMS=CHECKLIST_ITEMS.filter(x=>x.id!==id);renderChecklist()}}catch(e){if(live(c))sheetError(e.message)}finally{if(sameOwner(c)){busy=false;if(live(c))lockSheet(false)}}}
function bindTable(cfg,left,top){
 const host=document.querySelector('.tc-sheet-scroll'),table=host.querySelector('table');
 const handles=[...table.querySelectorAll('[data-column-resize]')],cols=[...table.querySelectorAll('col')];
 let widths,scale,drag=null,pinch=null;
 function draw(){
  table.style.width=widths.reduce((sum,w)=>sum+w,actionWidth)+'px';
  table.style.setProperty('--sheet-scale',scale);
  // Keep other cells reachable when the first column is expanded on a narrow screen.
  host.classList.toggle('tc-unpin',widths[0]*scale>host.clientWidth*.58);
 }
 function apply(saved){
  scale=saved.scale;widths=saved.columns.map(c=>columnWidth(c.id,saved));
  widths.forEach((w,i)=>{cols[i].style.width=w+'px';handles[i].setAttribute('aria-valuenow',w)});
  draw();
 }
 apply(cfg);host.scrollLeft=left;host.scrollTop=top;
 if(typeof ResizeObserver!=='undefined'){
  sheetObserver=new ResizeObserver(()=>host.classList.toggle('tc-unpin',widths[0]*scale>host.clientWidth*.58));
  sheetObserver.observe(host);
 }
 function setWidth(i,value){
  const width=clampWidth(value);
  widths[i]=width;cols[i].style.width=width+'px';handles[i].setAttribute('aria-valuenow',width);draw();
 }
 function stopDrag(commit){
  if(!drag)return;
  const d=drag;drag=null;
  d.handle.classList.remove('is-resizing');
  if(d.handle.hasPointerCapture?.(d.pointer))d.handle.releasePointerCapture(d.pointer);
  if(!commit||!live(d.context)){setWidth(d.index,d.before);return}
  const width=widths[d.index];
  if(width!==d.before)changeConfig(c=>{c.widths[d.id]=width},apply);
 }
 handles.forEach((handle,i)=>{
  const id=handle.dataset.columnResize;
  handle.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight'].includes(event.key)||busy)return;
   event.preventDefault();
   const width=clampWidth(widths[i]+(event.key==='ArrowRight'?16:-16));
   if(width!==widths[i])changeConfig(c=>{c.widths[id]=width},apply);
  };
  handle.onpointerdown=event=>{
   if(busy||pinch||drag||event.button!==0||event.isPrimary===false)return;
   event.preventDefault();
   drag={context:ctx(),index:i,id,handle,pointer:event.pointerId,start:event.clientX,before:widths[i]};
   handle.setPointerCapture(event.pointerId);handle.classList.add('is-resizing');
  };
  handle.onpointermove=event=>{
   if(drag?.pointer===event.pointerId)setWidth(i,drag.before+(event.clientX-drag.start)/scale);
  };
  handle.onpointerup=event=>{if(drag?.pointer===event.pointerId)stopDrag(true)};
  handle.onlostpointercapture=handle.onpointercancel=event=>{if(drag?.pointer===event.pointerId)stopDrag(false)};
 });
 const distance=(a,b)=>Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
 host.addEventListener('touchstart',event=>{
  if(event.touches.length!==2||busy)return;
  const [a,b]=event.touches;
  if(!host.contains(a.target)||!host.contains(b.target))return;
  event.preventDefault();stopDrag(false);
  const rect=host.getBoundingClientRect(),x=(a.clientX+b.clientX)/2-rect.left,y=(a.clientY+b.clientY)/2-rect.top;
  pinch={context:ctx(),distance:Math.max(1,distance(a,b)),scale,left:host.scrollLeft,top:host.scrollTop,x:(host.scrollLeft+x)/scale,y:(host.scrollTop+y)/scale};
 },{passive:false});
 host.addEventListener('touchmove',event=>{
  if(!pinch||event.touches.length!==2)return;
  event.preventDefault();
  const [a,b]=event.touches,rect=host.getBoundingClientRect();
  scale=Math.max(.6,Math.min(1.8,pinch.scale*distance(a,b)/pinch.distance));draw();
  host.scrollLeft=pinch.x*scale-((a.clientX+b.clientX)/2-rect.left);
  host.scrollTop=pinch.y*scale-((a.clientY+b.clientY)/2-rect.top);
 },{passive:false});
 host.addEventListener('touchend',event=>{
  if(!pinch||event.touches.length>=2)return;
  const previous=pinch;pinch=null;
  if(live(previous.context)&&Math.abs(previous.scale-scale)>.005){
   const value=Math.round(scale*1000)/1000;
   changeConfig(c=>{c.scale=value},apply);
  }else{scale=previous.scale;draw()}
 });
 host.addEventListener('touchcancel',()=>{
  if(!pinch)return;
  scale=pinch.scale;draw();host.scrollLeft=pinch.left;host.scrollTop=pinch.top;pinch=null;
 });
}
const oldControls=renderControlTable;renderControlTable=function(){if(['checklist','supplierChecklist'].includes(mode)&&checkSection==='providers'){checkWorkId=planningWork||checkWorkId;return renderChecklist()}return oldControls()};
const oldEnd=sessionViewEnded;sessionViewEnded=function(...args){sheetObserver?.disconnect();sheetObserver=null;query='';registryQuery='';registryKind='';registryArchived=false;loadSequence++;checklistSnapshot=null;busy=false;return oldEnd(...args)};
})(window);
