const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/gantt-workbench.js','utf8');
const globals={};
vm.runInNewContext(src,globals);
const {linkKind}=globals.TCGantt;
const group={id:'g',name:'Agrupador',is_group:true,start:'2026-11-01',end:'2026-11-10'};
const unlinked={id:'a',name:'Actividad sin vínculo',parent_id:'g',start:'2026-11-01',end:'2026-11-03'};
const linked={id:'b',name:'Actividad vinculada',parent_id:'g',task_id:'t1',start:'2026-11-04',end:'2026-11-06'};
const unavailable={id:'c',name:'Tarea histórica no disponible',parent_id:'g',task_id:'no-longer-present',start:'2026-11-07',end:'2026-11-10'};
const rows=[group,unlinked,linked,unavailable];
assert.equal(linkKind(rows,group,null),'group');
assert.equal(linkKind(rows,unlinked,null),'unlinked');
assert.equal(linkKind(rows,linked,{id:'t1'}),'linked');
assert.equal(linkKind(rows,unavailable,null),'unavailable');

const begin=src.indexOf('const baseHomeCards=homeCards;');
const end=src.indexOf('// Preserve old bookmarks',begin);
assert.ok(begin>=0&&end>begin,'Gantt projection must remain present');
const context={
 root:{},homeCards:()=>[{id:'t1',name:'Texto de prueba',work_id:'w1',closed:false,completed:false,status:'pending'}],
 NATIVE_WORKS:[{id:'w1',name:'Obra ficticia',archived_at:null}],
 WORK_PLANS:[{work_id:'w1',phases:rows}],isGroup:globals.TCGantt.isGroup,linkKind,
 esc:value=>String(value),workDateLabel:value=>String(value)
};
vm.runInNewContext(src.slice(begin,end),context);
const projected=context.homeCards();
const refs=projected.filter(c=>c.ganttReference);
assert.equal(refs.length,3,'Grouped/unlinked/unavailable rows stay visible');
assert.equal(projected.filter(c=>c.id==='t1').length,1,'Existing linked task must not duplicate');
const missing=refs.find(c=>c.activity_id==='a');
assert.equal(missing.ganttLinkKind,'unlinked');
assert.match(context.root.homeGanttReference(missing),/Sin vincular/);
assert.doesNotMatch(context.root.homeGanttReference(missing),/type="checkbox"/,'Unlinked activities must not present a non-working completion toggle');
assert.match(context.root.homeGanttReference(refs.find(c=>c.activity_id==='g')),/Grupo/);
assert.match(context.root.homeGanttReference(refs.find(c=>c.activity_id==='c')),/Tarea no disponible/);
assert.match(src,/storedMissing=leaves\(planOf\(G2\.work\)\.phases\|\|\[\]\)\.filter\(p=>!p\.task_id\)\.length/,'The warning must count only stored executable rows');
assert.match(src,/Guardar podría crear tareas nuevas/,'Users must be warned before editing legacy unlinked activity');
console.log('PASS: legacy Gantt rows are visible and classified; no phantom completion or duplicated linked task.');
