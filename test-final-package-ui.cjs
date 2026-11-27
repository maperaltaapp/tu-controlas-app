// DOM integration with fictitious data: startup, canonical edits and stale-account responses.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom'),crypto=require('node:crypto').webcrypto;
const html=fs.readFileSync('index.html','utf8'),{window}=parseHTML(html),document=window.document;
window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','')};window.HTMLElement.prototype.close=function(){this.removeAttribute('open')};
window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:100,bottom:44,width:100,height:44}};
window.HTMLElement.prototype.scrollIntoView=function(){};
window.HTMLInputElement.prototype.setSelectionRange=function(){};
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(v){this.querySelectorAll('option').forEach(o=>{if(o.value===String(v))o.setAttribute('selected','');else o.removeAttribute('selected')})}});
const prompts=[],messages=[],storage=new Map(),ctx=vm.createContext({document,console,crypto,Date,URL,URLSearchParams,Map,Set,TextEncoder,TextDecoder,Blob,structuredClone,location:{href:'http://qa.invalid/',origin:'http://qa.invalid',search:'',pathname:'/',hash:''},history:{replaceState(){}},navigator:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},MutationObserver:window.MutationObserver,Event:window.Event,confirm:()=>true,prompt:()=>prompts.shift()??null});ctx.window=ctx;
for(const script of document.querySelectorAll('script')){const src=script.getAttribute('src')?.split('?')[0];if(src?.startsWith('http'))continue;vm.runInContext(src?fs.readFileSync(src,'utf8'):script.textContent,ctx,{filename:src||'index-inline.js'})}
const run=s=>vm.runInContext(s,ctx),id='11111111-1111-4111-8111-111111111111',item='22222222-2222-4222-8222-222222222222';
run(`session={access_token:'fixture',user:{id:'A'}};nativeReady=true;NATIVE_WORKS=[{id:'${id}',user_id:'A',name:'Obra de prueba',execution_state:'execution',updated_at:'v1',workspace_layout:null}];WORK_PLANS=[{work_id:'${id}',revision:1,phases:[{id:'leaf',name:'Partida',start:'2026-11-01',end:'2026-12-01',weight:100,observations:[{date:'2026-11-25',percent:50}]}],baseline:[{id:'leaf',name:'Partida',start:'2026-11-01',end:'2026-12-01',weight:100}],baseline_at:'2026-11-01'}];CHECKLIST_ITEMS=[{id:'${item}',work_id:'${id}',section:'prep',title:'Ensayo',notes:'Dato original',position:0,updated_at:'r1'}];checkWorkId='${id}';checkSection='prep';statusMessage=(m)=>messages.push(m);`);ctx.messages=messages;
(async()=>{
 // Both entry points edit the same provider sheet. Registry rows retain their company IDs.
 const companyId='33333333-3333-4333-8333-333333333333';
 const company={id:companyId,name:'Áridos y suministros industriales de Levante',kind:'supplier',trade:'Áridos para cimentaciones y pavimentos',phone:'123',updated_at:'c1'};
 const provider={id:item,work_id:id,contractor_id:companyId,name:company.name,scope:company.trade,updated_at:'r1',notes:'',cell_values:{}};
 ctx.testCompanies=[{...company,id:'z',name:'Zanjas',trade:'Excavación',kind:'subcontractor'},company,{...company,id:'retired',archived_at:'ayer'}];
 run("CONTRACTORS=testCompanies;eliteNavigate('suppliers')");
 const get=k=>document.getElementById(k);
 assert.equal(document.querySelector('#tcNav [aria-current="page"]').textContent,'Subcontratas y Proveedores');
 assert.deepEqual([...get('supplierBody').querySelectorAll('[data-company]')].map(x=>x.dataset.company),[companyId,'z']);
 get('supplierSearch').oninput({target:{value:'aridos pavimentos'}});assert.equal(get('supplierBody').children.length,1);
 get('supplierBody').firstElementChild.onclick();assert.equal(get('contractorPhone').value,'123');run('closeTaskDialog()');
 assert(!document.querySelector('#tcCreateActions [data-create="company"]'));
 run('editContractor()');
 const contactButton=[...get('contractorForm').querySelectorAll('button')].find(button=>button.textContent==='Elegir contacto del móvil');
 let selectedProperties;
 ctx.navigator.contacts={select:async(properties,options)=>{selectedProperties={properties,options};return [{name:['Contacto de prueba'],tel:['654321'],email:['contacto@example.invalid']}]}};
 await contactButton.onclick();assert.equal(get('contractorName').value,'Contacto de prueba');assert.equal(get('contractorPhone').value,'654321');
 assert.equal(get('contractorEmail').value,'contacto@example.invalid');assert.deepEqual([...selectedProperties.properties],['name','tel','email']);assert.equal(selectedProperties.options.multiple,false);
 get('contractorName').value='Empresa editada';await contactButton.onclick();assert.equal(get('contractorName').value,'Empresa editada');
 let resolveContact;ctx.navigator.contacts.select=()=>new Promise(resolve=>resolveContact=resolve);
 const pendingContact=contactButton.onclick();run('closeTaskDialog();editContractor()');resolveContact([{name:['No debe aparecer']}]);await pendingContact;
 assert.equal(get('contractorName').value,'');run('closeTaskDialog()');
 get('supplierState').onchange({target:{value:'archived'}});assert.equal(get('supplierBody').firstElementChild.dataset.company,'retired');
 const canonical=run('CHECKLIST_ITEMS');
 ctx.readAll=async table=>table==='elite_work_contractors'?[provider]:table==='elite_work_checklist_items'?canonical:[];
 await ctx.tcSupplierTab('checklist');assert.equal(run('selectedSection'),'suppliers');
 const matrix=document.querySelector('.tc-sheet-table').outerHTML;
 await run("openChecklist('providers')");assert.equal(run('selectedSection'),'checklist');assert.equal(document.querySelector('.tc-sheet-table').outerHTML,matrix);
 ctx.eliteRequest=async(path,options)=>{assert(path.includes('elite_work_contractors'));Object.assign(provider,JSON.parse(options.body),{updated_at:'r2'});return [provider]};
 await ctx.tcSheetCell(item,'entry_date','2026-12-02');await ctx.tcSupplierTab('checklist');
 assert.equal(document.querySelector('.tc-sheet-table input[type=date]').value,'2026-12-02');
 assert.equal(document.querySelectorAll('.tc-sheet-table tbody tr').length,1);
 await ctx.tcSupplierTab('capacity');assert(get('supplierAlerts').textContent.includes('Sin avisos'));
 run("selectSection('tasks');mode='tasks';checkSection='prep'");
 run('tasks()');assert(!document.getElementById('filterWork'));assert(document.getElementById('filterPriority'));assert(document.querySelector('#content .tc-task-history'));assert(!document.querySelector('#content #newOwn'));
 run('renderChecklist()');assert.equal(document.querySelectorAll('[data-sheet-type]').length,4);assert.equal(document.querySelectorAll('.tc-sheet-table tbody tr').length,1);assert(!document.querySelector('.tc-sheet h2'));assert.equal(document.querySelector('input[aria-label="Notas · Ensayo"]').value,'Dato original');
 const search=document.getElementById('sheetSearch');search.oninput({target:{value:'original ensa',selectionStart:13}});assert.equal(document.querySelectorAll('.tc-sheet-table tbody tr input[aria-label="Notas · Ensayo"]').length,1);document.getElementById('sheetSearch').oninput({target:{value:'palabra inexistente',selectionStart:18}});assert(!document.querySelector('input[aria-label="Notas · Ensayo"]'));document.getElementById('sheetSearch').oninput({target:{value:'',selectionStart:0}});
 // Navigation regression: first entry fetches three canonical collections; switching
 // between types and works must not perform any network read. Reentry refreshes.
 const reads=[];const checklistTables=['elite_tasks','elite_work_checklist_items','elite_work_contractors'].sort();const readSnapshot=async(table)=>{if(checklistTables.includes(table))reads.push(table);return table==='elite_work_checklist_items'?run('CHECKLIST_ITEMS'):[]};ctx.readAll=readSnapshot;
 run("selectSection('tasks')");await run("openChecklist('prep')");
 assert.deepEqual([...reads].sort(),checklistTables,'initial entry must read each checklist table once');
 await run("openChecklist('providers')");assert.equal(reads.length,3);assert.equal(run('checkSection'),'providers');
 await run("openChecklist('prep')");assert.equal(reads.length,3);
 assert.equal(document.querySelector('input[aria-label="Notas · Ensayo"]').value,'Dato original');
 run("selectSection('works')");await run("openChecklist('prep')");assert.equal(reads.length,6);
 // A failed first read cannot promote a stale snapshot into an active cache.
 run("selectSection('works')");ctx.readAll=async()=>{throw Error('Sin conexión')};
 await run("openChecklist('prep')");assert(document.getElementById('content').textContent.includes('Sin conexión'));
 ctx.readAll=readSnapshot;
 await run("openChecklist('prep')");assert.equal(reads.length,9);
 // A late first-load response from another account cannot enter B's cache.
 run("selectSection('works')");let release;const slow=new Promise(r=>release=r);ctx.readAll=()=>slow;
 const original=run('CHECKLIST_ITEMS');const old=run("openChecklist('prep')");
 run("sessionEpoch++;session={access_token:'B',user:{id:'B'}};CHECKLIST_ITEMS=[];WORK_CONTRACTORS=[];OWN_TASKS=[]");
 release(original);await old;assert.equal(run('CHECKLIST_ITEMS.length'),0);
 run("sessionEpoch++;session={access_token:'fixture',user:{id:'A'}}");run("selectSection('works')");
 ctx.readAll=async(table)=>table==='elite_work_checklist_items'?original:[];
 await run("openChecklist('prep')");assert.equal(run('CHECKLIST_ITEMS.length'),1);
 const writes=[];ctx.capture=async(path,opts)=>{const payload=JSON.parse(opts.body);writes.push({path,payload});if(path.includes('elite_works'))return [{...run('NATIVE_WORKS[0]'),...payload,updated_at:'v'+writes.length}];return [{...run('CHECKLIST_ITEMS[0]'),...payload,updated_at:'r'+writes.length}]};run('eliteRequest=capture');
 await run(`tcSheetCell('${item}','title','Ensayo corregido')`);assert.equal(run('CHECKLIST_ITEMS[0].title'),'Ensayo corregido');assert(writes[0].path.includes('updated_at=eq.r1'));
 prompts.push('Resistencia');run('tcSheetAddColumn()');await new Promise(r=>setTimeout(r,0));assert(document.querySelector('[data-column-menu^="col_"]'));assert(run('NATIVE_WORKS[0].workspace_layout.sheets.prep.columns.length')===5);
 const col=run('NATIVE_WORKS[0].workspace_layout.sheets.prep.columns.at(-1).id');await ctx.tcSheetCell(item,col,'40 MPa');assert.equal(run('CHECKLIST_ITEMS[0].cell_values')[col],'40 MPa');
 assert(!document.querySelector('.tc-sheet input[type=range]'));
 assert(document.querySelector('.tc-sheet-table.control-table th[scope=row]'));
 assert(document.querySelector('.tc-sheet-table .tc-completion.control-pending'));
 ctx.tcSheetColumn(col);document.getElementById('tcColumnWidth').value='215';
 await document.getElementById('tcColumnForm').onsubmit({preventDefault(){}});
 assert.equal(run('NATIVE_WORKS[0].workspace_layout.sheets.prep.widths')[col],215);
 ctx.tcSheetColumn(col);await document.getElementById('tcColumnHide').onclick();
 assert(!document.querySelector('[data-column-menu="'+col+'"]'));assert.equal(run('CHECKLIST_ITEMS[0].cell_values')[col],'40 MPa');
 ctx.tcSheetRestoreColumns();await new Promise(r=>setTimeout(r,0));assert(document.querySelector('[data-column-menu="'+col+'"]'));
 const handle=document.querySelector('[data-column-resize="'+col+'"]');
 handle.onkeydown({key:'ArrowRight',preventDefault(){}});
 await new Promise(r=>setTimeout(r,0));assert.equal(run('NATIVE_WORKS[0].workspace_layout.sheets.prep.widths')[col],231);
 assert.equal(handle.getAttribute('aria-valuenow'),'231');

 // A stale row cannot overwrite a concurrent edit. The message remains beside
 // the planilla and refresh reloads authoritative data without leaving the tool.
 const oldCapture=ctx.capture;
 ctx.eliteRequest=async()=>[];
 await ctx.tcSheetCell(item,'notes','Cambio no confirmado');
 assert.equal(run('CHECKLIST_ITEMS[0].notes'),'Dato original');
 assert.match(document.getElementById('sheetSaveStatus').textContent,/cambió en otro dispositivo/);
 assert.equal(document.querySelector('.tc-sheet').getAttribute('aria-busy')==='true',false);
 const refreshed=[];
 const freshRow={...run('CHECKLIST_ITEMS[0]'),notes:'Dato de otro dispositivo',updated_at:'r-refresh'};
 ctx.readAll=async table=>{refreshed.push(table);return table==='elite_work_checklist_items'?[freshRow]:[]};
 await document.getElementById('sheetRefresh').onclick();
 assert.deepEqual(refreshed.sort(),checklistTables);
 assert.equal(run('CHECKLIST_ITEMS[0].notes'),'Dato de otro dispositivo');
 assert.equal(document.getElementById('sheetSaveStatus').textContent,'');
 ctx.eliteRequest=oldCapture;
 // Built-in labels are scoped to a work; canonical section IDs and rows are unchanged.
 assert.equal(document.querySelector('[data-sheet-type="prep"]').textContent,'Planificación');
 const beforeRename=JSON.stringify(run('CHECKLIST_ITEMS'));
 for(const key of ['prep','providers','execution','close']){
  await run("openChecklist('"+key+"')");
  document.querySelector('[data-sheet-type="'+key+'"]').onclick();
  assert(!document.getElementById('tcTypeArchive'));
  document.getElementById('tcTypeName').value='Nombre '+key;
  await document.getElementById('tcTypeForm').onsubmit({preventDefault(){}});
  assert.equal(document.querySelector('[data-sheet-type="'+key+'"]').textContent,'Nombre '+key);
  assert.equal(run('NATIVE_WORKS[0].workspace_layout.checklist_type_labels')[key],'Nombre '+key);
 }
 assert.equal(JSON.stringify(run('CHECKLIST_ITEMS')),beforeRename);
 await run("openChecklist('prep')");
 // New custom types can be renamed, archived and restored with existing metadata intact.
 prompts.push('Control QA');await ctx.tcSheetAddType();
 const type=run('checkSection');assert.match(type,/^custom_/);
 assert.equal(run('NATIVE_WORKS[0].workspace_layout.checklist_types')[type],'Control QA');
 document.querySelector('[data-sheet-type="'+type+'"]').onclick();
 document.getElementById('tcTypeName').value='Control QA editado';
 await document.getElementById('tcTypeForm').onsubmit({preventDefault(){}});
 assert.equal(run('NATIVE_WORKS[0].workspace_layout.checklist_types')[type],'Control QA editado');
 const before=JSON.stringify(run('CHECKLIST_ITEMS'));
 ctx.tcSheetEditType();await document.getElementById('tcTypeArchive').onclick();
 assert.equal(run('checkSection'),'prep');assert(!document.querySelector('[data-sheet-type="'+type+'"]'));
 assert.equal(run('NATIVE_WORKS[0].workspace_layout.archived_checklist_types')[type],'Control QA editado');
 ctx.tcSheetRestoreTypes();await document.querySelector('[data-restore-type="'+type+'"]').onclick();
 assert.equal(run('checkSection'),type);assert(document.querySelector('[data-sheet-type="'+type+'"]'));
 assert.equal(JSON.stringify(run('CHECKLIST_ITEMS')),before);
 run("checkSection='prep'");run('renderChecklist()');
 // Templates are offered only from other works of this account; populated destination is preserved.
 const sourceId='33333333-3333-4333-8333-333333333333',alienId='44444444-4444-4444-8444-444444444444';
 run(`NATIVE_WORKS.push({id:'${sourceId}',user_id:'A',name:'Origen',workspace_layout:{sheets:{prep:{columns:[{id:'title',label:'Control'}]}}}},{id:'${alienId}',user_id:'B',name:'Ajena',workspace_layout:{sheets:{prep:{columns:[{id:'title',label:'Privado'}]}}}});renderChecklist()`);
 const template=document.getElementById('tcTemplateSelect');
 assert(template.closest('.tc-check-template'));assert(!template.closest('.tc-tool-sticky'),'Template selector must not be hidden in mobile sticky header');
 assert(template.textContent.includes('Origen'));assert(!template.textContent.includes('Ajena'));
 const templateValue=sourceId+'|prep';template.value=templateValue;template.onchange();
 assert.equal(document.getElementById('tcTemplateApply').disabled,false);
 const cloneType='custom_55555555-5555-4555-8555-555555555555';
 ctx.eliteRequest=async(path,opts)=>{assert(path.includes('tc_copy_checklist_template'));const p=JSON.parse(opts.body);assert.equal(p.source_work,sourceId);assert.equal(p.target_work,id);assert.equal(p.target_section,null);const w=run('NATIVE_WORKS[0]');return {work:{...w,workspace_layout:{...w.workspace_layout,checklist_types:{...w.workspace_layout.checklist_types,[cloneType]:'Plantilla'}}},section:cloneType,rows:[]}};
 await document.getElementById('tcTemplateApply').onclick();assert.equal(run('checkSection'),cloneType);assert.equal(JSON.stringify(run('CHECKLIST_ITEMS')),before);
 run("NATIVE_WORKS=NATIVE_WORKS.slice(0,1);checkSection='prep';renderChecklist()");ctx.eliteRequest=oldCapture;
 run('openSettings()');assert(document.getElementById('exportClientData'));assert(!document.getElementById('tcBell'));run('works()');assert(!document.getElementById('exportClientData'));assert(document.querySelector('.tc-work-table'));assert.equal(document.querySelectorAll('.tc-work-table tbody tr').length,1);
 // Phase reordering changes only presentation, never work execution state.
 const states=()=>Array.from(document.querySelectorAll('.work-state-section')).map(el=>el.dataset.workState);
 assert.deepEqual(states(),['execution','planning','closing','studies']);
 run("moveWorkStateGroup('studies',-1)");
 assert.deepEqual(states(),['execution','planning','studies','closing']);
 assert.equal(run('NATIVE_WORKS[0].execution_state'),'execution');
 run('works()');assert.deepEqual(states(),['execution','planning','studies','closing']);
 run("session={access_token:'B',user:{id:'B'}}");run('works()');
 assert.deepEqual(states(),['execution','planning','closing','studies']);
 run("session={access_token:'fixture',user:{id:'A'}}");run('works()');
 assert.deepEqual(states(),['execution','planning','studies','closing']);
 assert(document.querySelector('.tc-tool-sticky .tc-panel-tabs'));
 // Checklist item removal is draft-only, with an explicit confirm for nonempty items.
 run("editorChecks=[{id:'g1',name:'Prueba',items:[{id:'i1',text:'Conservar',done:true},{id:'i2',text:'Quitar',done:false}]}]");
 const originalDraft=run('JSON.stringify(editorChecks)');
 const box=document.createElement('div'),summary=document.createElement('span'),add=document.createElement('button');
 ctx.fixtureHost=box;ctx.fixtureSummary=summary;ctx.fixtureAdd=add;
 run('mountTaskChecklists(fixtureHost,fixtureSummary,editorChecks,fixtureAdd)');
 assert.equal(summary.textContent,'1/2');ctx.confirm=()=>false;
 box.querySelector('[data-check-item-remove="0:1"]').onclick();assert.equal(run('JSON.stringify(editorChecks)'),originalDraft);
 ctx.confirm=()=>true;box.querySelector('[data-check-item-remove="0:1"]').onclick();
 assert.equal(run('editorChecks[0].items.length'),1);assert.equal(run('editorChecks[0].items[0].id'),'i1');assert.equal(summary.textContent,'1/1');
 box.querySelector('[data-check-group-remove="0"]').onclick();assert.equal(run('editorChecks.length'),0);
 assert.equal(summary.textContent,'');add.onclick();box.querySelector('[data-check-add="0"]').onclick();
 box.querySelector('[data-check-item-remove="0:0"]').onclick();assert.equal(run('editorChecks[0].items.length'),0);
 // Economic cells replace totals through the validated RPC; computed fields stay read-only.
 let costs=[{id:'cost-1',work_id:id,activity_id:'leaf',kind:'budget',amount:1000,entry_date:'2026-11-01',source_name:'Entrada manual'},{id:'cost-2',work_id:id,activity_id:'leaf',kind:'actual',amount:600,entry_date:'2026-11-01',source_name:'factura.pdf'}];
 const loadPanel=async table=>table==='elite_work_economic_entries'?costs:[];
 ctx.readAll=loadPanel;let costWrites=0;
 ctx.eliteRequest=async(path,opts)=>{costWrites++;const payload=JSON.parse(opts.body);assert(path.includes('tc_set_manual_cost'));assert.equal(payload.target_work,id);assert.equal(payload.expected_rows[0].id,'cost-1');costs=costs.map(e=>e.kind==='budget'?{...e,amount:payload.new_total}:e);return payload.new_total};
 const el=id=>document.getElementById(id),toggle=()=>el('ecEntryToggle').onclick();
 await ctx.tcOpenEconomy(id);
 assert.equal(el('tcAdvanceTab').textContent,'Control de Avance');
 assert.equal(el('ecEntryToggle').textContent,'Ingresar datos');
 assert(!el('ecBody').querySelector('input,form,[data-cost-kind]'));
 assert(!el('ecBody').querySelector('details[open]'));
 assert.equal(el('ecWork').value,id);
 el('ecIndicators').open=true;el('ecIndicators').ontoggle();
 assert.match(el('ecIndicators').textContent,/línea base de costes aprobada/);
 el('ecParts').open=true;el('ecParts').ontoggle();assert.match(el('ecParts').textContent,/Partida/);
 toggle();assert.equal(costWrites,0);assert(!el('ecRecord'));assert(!el('ecGantt'));
 assert(el('ecImport')&&el('ecKEdit')&&el('ecMarginEdit')&&el('ecWeightsEdit')&&el('ecReport'));
 assert(document.querySelector('[data-cost-kind="actual"]').hasAttribute('readonly'));
 const costInput=document.querySelector('[data-cost-kind="budget"]');costInput.value='1250';await costInput.onchange();
 assert.equal(el('ecCellStatus').textContent,'Importe guardado.');assert.equal(costWrites,1);
 toggle();assert.equal(el('ecWork').value,id);assert(!el('ecBody').querySelector('input'));
 el('ecParts').open=true;el('ecParts').ontoggle();assert.match(el('ecParts').textContent,/1250|1.250/);
 toggle();assert.equal(document.querySelector('[data-cost-kind="budget"]').value,'1250');
 el('ecWeightsEdit').onclick();assert(el('ecWeightsForm'));run('closeTaskDialog()');
 el('ecKEdit').onclick();assert.equal(el('ecMarginKind').value,'k_setting');run('closeTaskDialog()');
 el('ecImport').onclick();assert(el('ecImportForm'));run('closeTaskDialog()');
 await ctx.tcEconomyPrueba();assert.match(el('ecPanel').textContent,/Datos de ejemplo/);toggle();assert(el('ecEntryFields').hasAttribute('disabled'));assert.equal(costWrites,1);
 ctx.readAll=async()=>{throw Error('offline')};await ctx.tcOpenEconomy(id);assert.equal(el('ecRetry').hidden,false);toggle();assert(el('ecEntryFields').hasAttribute('disabled'));
 ctx.readAll=loadPanel;await el('ecRetry').onclick();assert(!el('ecEntryFields').hasAttribute('disabled'));
 let resume;const delayed=new Promise(resolve=>resume=resolve);ctx.readAll=()=>delayed;
 const stalePanel=ctx.tcOpenEconomy(id);
 assert(el('ecProgressTitle'),'The physical chart is visible before either economic request resolves');
 assert.match(el('ecBody').textContent,/Cargando costes y previsiones/);
 assert(el('ecEntryToggle').disabled,'Economic data entry stays gated until the reads finish');
 run("sessionEpoch++;session={access_token:'B',user:{id:'B'}};works()");resume(costs);await stalePanel;
 assert(!el('ecPanel'));assert(document.querySelector('.tc-work-table'));assert.equal(costWrites,1);
 run("sessionEpoch++;session={access_token:'fixture',user:{id:'A'}}");ctx.readAll=loadPanel;
 // Work exceptions are chosen visually, while the proposal remains uncommitted.
 run(`tcEditWorkCalendar('${id}')`);assert(document.getElementById('wcExceptions').querySelector('[data-wc-day="2026-11-07"]'));assert(document.getElementById('wcDayEditor').hidden);document.querySelector('[data-wc-day="2026-11-07"]').onclick();assert.equal(document.getElementById('wcDate').value,'2026-11-07');assert.equal(document.getElementById('wcWorking').value,'true');document.getElementById('wcAdd').onclick();assert(document.querySelector('[data-wc-day="2026-11-07"]').classList.contains('is-exception'));assert.equal(document.querySelector('[data-wc-day="2026-11-07"]').dataset.working,'true');document.getElementById('wcPreview').onclick();assert.equal(document.getElementById('wcSave').disabled,false);assert(document.getElementById('wcReasonRow').hidden);assert.equal(run('WORK_PLANS[0].revision'),1);
 run('closeTaskDialog()');
 // No late account A write response may enter the account B cache.
 run('renderChecklist()');let resolve;ctx.eliteRequest=()=>new Promise(r=>resolve=r);const pending=ctx.tcSheetCell(item,'notes','No debe aparecer en B');run("sessionEpoch++;session={access_token:'B',user:{id:'B'}};CHECKLIST_ITEMS=[]");resolve([{id:item,title:'A'}]);await pending;assert.equal(run('CHECKLIST_ITEMS.length'),0);
 console.log('PASS: full script startup, compact task controls, editable checklist columns, hidden-column recovery, preserved values, settings move, state tables and stale-account write rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
