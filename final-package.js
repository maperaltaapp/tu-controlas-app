/* Final package: owner-scoped sheet layouts and existing canonical checklist rows. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),clone=x=>structuredClone(x),E=s=>esc(s),work=()=>NATIVE_WORKS.find(w=>w.id===checkWorkId);
let query='',busy=false,loadSequence=0,navSequence=0,sheetObserver=null,checklistSnapshot=null;
const baseSelect=selectSection;selectSection=function(...args){sheetObserver?.disconnect();sheetObserver=null;navSequence++;if(args[0]!=='checklist')checklistSnapshot=null;return baseSelect(...args)};
const ctx=()=>({owner:session?.user?.id,epoch:sessionEpoch,work:checkWorkId,section:checkSection,nav:navSequence});
const live=c=>c.owner&&c.owner===session?.user?.id&&c.epoch===sessionEpoch&&c.work===checkWorkId&&c.section===checkSection&&c.nav===navSequence;
const layout=w=>clone(w?.workspace_layout||{});
function sections(){const extra=work()?.workspace_layout?.checklist_types||{};return {...CHECK_SECTIONS,...Object.fromEntries(Object.entries(extra).filter(([id,name])=>/^custom_[a-f0-9-]{36}$/.test(id)&&typeof name==='string'&&name.trim()).slice(0,20))}}
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
function lockSheet(value){document.querySelectorAll('.tc-sheet input,.tc-sheet select,.tc-sheet button').forEach(e=>e.disabled=value)}
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
   else statusMessage(error.message,true);
  }
  return false;
 }finally{busy=false;if(live(context))lockSheet(false)}
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
root.tcSheetAddType=async()=>{if(busy||!work())return;const name=prompt('Nombre del nuevo tipo de checklist:');if(!name?.trim())return;const w=work(),context=ctx(),next=layout(w),id='custom_'+crypto.randomUUID();if(Object.keys(next.checklist_types||{}).length>=20)return statusMessage('Máximo 20 tipos adicionales por obra.',true);next.checklist_types={...next.checklist_types,[id]:name.trim().slice(0,100)};try{if(await saveLayout(w,next)&&live(context)){checkSection=id;renderChecklist()}}catch(e){statusMessage(e.message,true)}};
function header(){return `<div class="tc-filter-bar"><label class="tc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="sheetSearch" type="search" aria-label="Buscar tarea u obra" placeholder="Buscar tarea u obra…" value="${E(query)}"></label><select id="sheetWork" aria-label="Obra del checklist">${NATIVE_WORKS.filter(w=>!w.archived_at).map(w=>`<option value="${w.id}" ${w.id===checkWorkId?'selected':''}>${E(w.name)}</option>`).join('')}</select></div><div class="tc-sheet-tabs">${Object.entries(sections()).map(([id,name])=>`<button type="button" class="${id===checkSection?'dark':'light'}" aria-pressed="${id===checkSection}" data-sheet-type="${id}">${E(name)}</button>`).join('')}</div>`}
openChecklist=async function(section=checkSection,workId=checkWorkId){
 // Keep an in-flight write on its originating view until its confirmed response.
 if(busy)return;
 const owner=session?.user?.id,epoch=sessionEpoch;
 const reuse=!!owner&&nativeReady&&selectedSection==='checklist'&&checklistSnapshot?.owner===owner&&checklistSnapshot?.epoch===epoch;
 checkWorkId=workId||NATIVE_WORKS.find(w=>!w.archived_at)?.id||'';checkSection=section;const names=sections();if(!Object.hasOwn(names,section))checkSection='prep';mode='checklist';workDetailId=null;selectSection('checklist');const c=ctx(),sequence=++loadSequence;
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
  if(live(c)&&sequence===loadSequence){checklistSnapshot=null;$('content').innerHTML='<p class="err">'+E(e.message)+'</p><button onclick="openChecklist()">Reintentar</button>'}
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
 selectSection('checklist');mode='checklist';const w=work();if(!w){$('content').innerHTML='<section class="panel"><p>Crea una obra para usar sus checklists.</p></section>';return}
 const providers=checkSection==='providers',q=query.trim().toLocaleLowerCase('es'),matchWork=w.name.toLocaleLowerCase('es').includes(q),rows=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).filter(r=>r.work_id===w.id&&(providers||r.section===checkSection)).filter(r=>!q||matchWork||JSON.stringify([r.title,r.name,r.notes,r.scope,r.cell_values]).toLocaleLowerCase('es').includes(q)),cfg=config(),cols=columns();planningWork=w.id;
 const previous=document.querySelector('.tc-sheet-scroll');
 const left=previous?.scrollLeft||0,top=previous?.scrollTop||0;
 const matches=q?NATIVE_WORKS.filter(other=>!other.archived_at&&other.id!==w.id&&other.name.toLocaleLowerCase('es').includes(q)):[];
 const recover=cfg.hidden_columns.length||defaults().some(col=>!cols.some(c=>c.id===col.id));
 $('content').innerHTML=`<section class="panel control-panel tc-sheet">${header()}
 ${matches.length?`<div class="tc-sheet-tools">${matches.map(other=>`<button class="light" data-found-work="${other.id}">${E(other.name)}</button>`).join('')}</div>`:''}
 <div class="tc-sheet-tools"><button class="dark" id="sheetAddRow">+ Fila</button><button class="light" onclick="tcSheetAddColumn()">+ Columna</button><button class="light" onclick="tcSheetAddType()">+ Tipo</button>${recover?'<button class="light" onclick="tcSheetRestoreColumns()">Recuperar columnas</button>':''}${providers?'<button class="light" onclick="openContractorDirectory(checkWorkId)">Registro de proveedores</button>':''}</div>
 ${sheetMatrix(rows,cfg,providers)}
 <p class="tc-sheet-help">${rows.length} ${rows.length===1?'fila':'filas'} · Arrastra el borde de una columna para ajustar su ancho.</p></section>`;
 $('sheetWork').onchange=e=>{query='';openChecklist(checkSection,e.target.value)};
 $('sheetSearch').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;renderChecklist();$('sheetSearch').focus();$('sheetSearch').setSelectionRange(pos,pos)};
 document.querySelectorAll('[data-found-work]').forEach(b=>b.onclick=()=>{query='';openChecklist(checkSection,b.dataset.foundWork)});document.querySelectorAll('[data-sheet-type]').forEach(b=>b.onclick=()=>{query='';openChecklist(b.dataset.sheetType,checkWorkId)});document.querySelectorAll('[data-column-menu]').forEach(b=>b.onclick=()=>tcSheetColumn(b.dataset.columnMenu));document.querySelectorAll('[data-sheet-delete]').forEach(b=>b.onclick=()=>removeRow(b.dataset.sheetDelete));$('sheetAddRow').onclick=()=>providers?editWorkContractor():addRow();bindTable(cfg,left,top);
};
async function writeRow(row,payload,providers,c){const table=providers?'elite_work_contractors':'elite_work_checklist_items',rows=await eliteRequest('/rest/v1/'+table+'?id=eq.'+row.id+'&updated_at=eq.'+encodeURIComponent(row.updated_at),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});if(!live(c))return;if(rows?.length!==1)throw Error('La fila cambió en otro dispositivo. Actualiza antes de guardar.');if(providers)WORK_CONTRACTORS=WORK_CONTRACTORS.map(x=>x.id===row.id?rows[0]:x);else CHECKLIST_ITEMS=CHECKLIST_ITEMS.map(x=>x.id===row.id?rows[0]:x);renderChecklist()}
root.tcSheetCell=async(id,key,value)=>{if(busy)return;const providers=checkSection==='providers',row=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).find(r=>r.id===id&&r.work_id===checkWorkId);if(!row)return;const c=ctx();busy=true;lockSheet(true);try{if(key==='title'&&!value.trim())throw Error('El elemento necesita nombre.');if(key==='completed_at')await writeRow(row,{completed_at:value?new Date().toISOString():null},false,c);else if(key.startsWith('col_'))await writeRow(row,{cell_values:{...row.cell_values,[key]:String(value)}},providers,c);else if(['title','notes','due_date','entry_date'].includes(key))await writeRow(row,{[key]:value||(['due_date','entry_date'].includes(key)?null:'')},providers,c)}catch(e){if(live(c)){statusMessage(e.message,true);renderChecklist()}}finally{busy=false;if(live(c))lockSheet(false)}};
async function addRow(){if(busy)return;const c=ctx();busy=true;lockSheet(true);try{const result=await eliteRequest('/rest/v1/elite_work_checklist_items',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({work_id:c.work,section:c.section,title:'Nuevo elemento',position:itemsPosition(c.work,c.section)})});if(!live(c))return;if(result?.length!==1)throw Error('No se confirmó la fila.');CHECKLIST_ITEMS.push(result[0]);renderChecklist();document.querySelector('.tc-sheet-table tbody tr:last-child input')?.focus()}catch(e){if(live(c))statusMessage(e.message,true)}finally{busy=false;if(live(c))lockSheet(false)}}
async function removeRow(id){if(busy||!confirm('¿Eliminar esta fila y sus datos?'))return;const providers=checkSection==='providers',row=(providers?WORK_CONTRACTORS:CHECKLIST_ITEMS).find(r=>r.id===id&&r.work_id===checkWorkId),c=ctx();if(!row)return;busy=true;lockSheet(true);try{const result=await eliteRequest('/rest/v1/'+(providers?'elite_work_contractors':'elite_work_checklist_items')+'?id=eq.'+id+'&updated_at=eq.'+encodeURIComponent(row.updated_at),{method:'DELETE',headers:{Prefer:'return=representation'}});if(!live(c))return;if(result?.length!==1)throw Error('La fila cambió. Actualiza antes de eliminar.');if(providers){await refreshControls();if(live(c))renderChecklist()}else{CHECKLIST_ITEMS=CHECKLIST_ITEMS.filter(x=>x.id!==id);renderChecklist()}}catch(e){if(live(c))statusMessage(e.message,true)}finally{busy=false;if(live(c))lockSheet(false)}}
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
const oldControls=renderControlTable;renderControlTable=function(){if(mode==='checklist'&&checkSection==='providers'){checkWorkId=planningWork||checkWorkId;return renderChecklist()}return oldControls()};
const oldEnd=sessionViewEnded;sessionViewEnded=function(...args){sheetObserver?.disconnect();sheetObserver=null;query='';loadSequence++;checklistSnapshot=null;busy=false;return oldEnd(...args)};
})(window);
