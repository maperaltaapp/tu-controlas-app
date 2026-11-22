const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/task-quick-editor.js','utf8');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
assert.match(html,/src="task-quick-editor\.js"/);
assert.match(html,/href="task-quick-editor\.css"/);
const tid='00000000-0000-4000-8000-000000000001';
class Node{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.isConnected=true;this.className='';this.flags=new Set();this.classList={add:v=>this.flags.add(v),remove:v=>this.flags.delete(v),contains:v=>this.flags.has(v)}}
 setAttribute(k,v){this.attributes[k]=v}
 append(node){this.children.push(node)}
 remove(){this.isConnected=false}
 insertAdjacentElement(_pos,node){nodes.push(node)}
}
const nodes=[],hosts=[],listeners={},messages=[],patches=[];
const document={
 querySelectorAll(s){
  if(s==='.home-row.is-task-selected')return hosts.filter(x=>x.classList.contains('is-task-selected'));
  if(s==='.tc-task-actions')return nodes.filter(x=>x.className==='tc-task-actions'&&x.isConnected);
  return [];
 },
 querySelector(s){return s==='.home-row.is-task-selected'?hosts.find(x=>x.classList.contains('is-task-selected'))||null:null},
 createElement:tag=>new Node(tag),
 addEventListener:(type,fn)=>{listeners[type]=fn}
};
let lastDialog=null,renderCount=0,accepted=false,failSave=false;
let task={id:tid,title:'Pedir mallas',due_at:'2026-11-23T18:00:00.000Z',start_at:'2026-11-19T09:00:00.000Z',remind_minutes:null,remind_at:null,extra_remind_at:[],recurrence:'none',stage:'General',completed:false,deleted_at:null,updated_at:'v1',priority:'normal'};
const formControls=()=>({
 title:{value:task.title,focus(){}},
 due:{value:task.due_at.slice(0,16)},
 reminder:{value:'none'},
 custom:{value:''}
});
function modal(content){
 const controls=formControls(),fields=[{disabled:false},{disabled:false}],close={onclick:null},remove={onclick:null},cancel={onclick:null},error={textContent:''},customRow={hidden:true};
 const form={
  elements:controls,onsubmit:null,
  querySelector(s){return ({'[data-delete]':remove,'[data-cancel]':cancel,'#tcQuickError':error,'#tcQuickCustomRow':customRow})[s]||null},
  querySelectorAll(){return fields},
 };
 const dialog={isConnected:true,querySelector(){return form}};
 lastDialog={content,form,dialog,error,close,remove,cancel,fields};
 return dialog;
}
const sandbox={
 document,window:null,console,Date,Set,Math,Number,String,Array,Object,Error,
 OWN_TASKS:[task],CHECKLIST_ITEMS:[],WORK_PLANS:[],
 mode:'tasks',G2:{busy:false,draft:null,work:null},
 openTaskForm:()=>42,
 homeRow:()=>'<div class="home-row "><button class="home-open" data-hold-id="'+tid+'" onclick="void 0">Fila</button></div>',
 selectHeldForDelete:()=>99,
 deleteHeldItem:()=>7,
 editChecklistItem:()=>{},statusMessage:(s,err)=>messages.push({s,err}),
 localDateTime:v=>v?new Date(v).toISOString().slice(0,16):'',
 madridDay:v=>String(v).slice(0,10),
 esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
 dialogForm:modal,closeTaskDialog:()=>{if(lastDialog)lastDialog.dialog.isConnected=false},
 patchNativeTask:async (t,data)=>{if(failSave)throw Error('La tarea cambió en otro dispositivo.');patches.push({...data});Object.assign(t,data,{updated_at:'v'+(patches.length+1)});return t},
 fetchOwnTasks:async()=>{},
 tasks:()=>{renderCount++},
 render:()=>{renderCount++},
 confirm:()=>accepted,
 tcCalendarForWork:()=>null,
 gHydrate:rows=>structuredClone(rows),
 };
sandbox.window=sandbox;sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'task-quick-editor.js'});
async function main(){
 assert.match(sandbox.homeRow({own:true,id:tid}),/openQuickTaskEditor\(this\.dataset\.holdId\)/);
 assert.equal(sandbox.openTaskForm(null),42,'Crear tareas no debe cambiar');
 const row=new Node();hosts.push(row);
 sandbox.selectHeldForDelete(row,'task',tid);
 assert.equal(row.classList.contains('is-task-selected'),true);
 let bar=document.querySelectorAll('.tc-task-actions').at(-1);
 assert.deepEqual(bar.children.map(b=>b.textContent),['Editar','Eliminar','Cancelar']);
 await bar.children[2].onclick({stopPropagation(){}});
 assert.equal(row.classList.contains('is-task-selected'),false,'Cancelar debe salir de selección');
 sandbox.selectHeldForDelete(row,'task',tid);
 listeners.pointerdown({target:{closest:()=>null}});
 assert.equal(row.classList.contains('is-task-selected'),false,'Pulsar fuera debe salir');
 sandbox.selectHeldForDelete(row,'task',tid);
 listeners.keydown({key:'Escape',preventDefault(){}});
 assert.equal(row.classList.contains('is-task-selected'),false,'Escape debe salir');
 sandbox.selectHeldForDelete(row,'task',tid);
 sandbox.selectHeldForDelete(row,'task',tid);
 assert.equal(row.classList.contains('is-task-selected'),false,'Pulsación repetida debe alternar selección');
 sandbox.openQuickTaskEditor(tid);
 assert.match(lastDialog.content,/>Nombre<input/);
 assert.match(lastDialog.content,/>Vencimiento<input/);
 assert.match(lastDialog.content,/>Recordatorio<select/);
 assert.doesNotMatch(lastDialog.content,/name="status"|name="priority"|name="work_id"/);
 lastDialog.form.elements.title.value='Pedir mallas corregidas';
 lastDialog.form.elements.due.value='2026-11-25T19:30';
 lastDialog.form.elements.reminder.value='60';
 await lastDialog.form.onsubmit({preventDefault(){}});
 assert.deepEqual(Object.keys(patches.at(-1)).sort(),['due_at','remind_at','remind_minutes','title']);
 assert.equal(task.priority,'normal');
 assert.equal(task.title,'Pedir mallas corregidas');
 assert.equal(renderCount,1);
 sandbox.openQuickTaskEditor(tid);
 lastDialog.form.elements.title.value='Solo nombre';
 // Same minute due date must not spuriously update the timestamp.
 lastDialog.form.elements.due.value='2026-11-25T19:30';
 lastDialog.form.elements.reminder.value='60';
 await lastDialog.form.onsubmit({preventDefault(){}});
 assert.deepEqual(Object.keys(patches.at(-1)),['title']);
 const before=patches.length;
 sandbox.openQuickTaskEditor(tid);
 lastDialog.cancel.onclick();
 assert.equal(patches.length,before,'Cancelar formulario no debe escribir');
 sandbox.openQuickTaskEditor(tid);failSave=true;
 lastDialog.form.elements.title.value='Cambio rechazado';
 await lastDialog.form.onsubmit({preventDefault(){}});
 assert.match(lastDialog.error.textContent,/cambió/);
 assert.equal(lastDialog.dialog.isConnected,true);
 assert.equal(lastDialog.fields.every(f=>f.disabled===false),true,'Se deben recuperar controles tras error');
 failSave=false;
 accepted=false;
 assert.equal(await sandbox.deleteHeldItem('task',tid),false,'Cancelar borrado no modifica datos');
 assert.equal(patches.length,before);
 accepted=true;
 assert.equal(await sandbox.deleteHeldItem('task',tid),true);
 assert.ok(task.deleted_at,'Borrado reversible usa deleted_at');
 assert.deepEqual(Object.keys(patches.at(-1)),['deleted_at']);
 assert.equal(sandbox.OWN_TASKS[0].id,tid,'Nunca modifica otras tareas');
 console.log('PASS: selección cancelable, edición de 3 campos, validación, cancelación/error sin escrituras y eliminación reversible');
}
main().catch(e=>{console.error(e);process.exitCode=1});
