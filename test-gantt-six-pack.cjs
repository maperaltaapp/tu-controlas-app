const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/gantt-workbench.js','utf8');
const css=fs.readFileSync(__dirname+'/gantt-workbench.css','utf8');
const pure={Date,structuredClone};
vm.runInNewContext(source,pure,{filename:'gantt-workbench.js'});
const api=pure.TCGantt;
const works=[{id:'work-a'},{id:'work-b'}];

// TC-045: a new user never inherits the old user's selected Gantt.
assert.equal(api.chooseGanttWork(works,'work-a','work-b',true).id,'work-a');
assert.equal(api.chooseGanttWork(works,'work-a','work-b',false).id,'work-b');
assert.equal(api.chooseGanttWork(works,'old-customer','not-found',false).id,'work-a');
assert.equal(api.chooseGanttWork([], 'work-a','work-b',true),null);
assert.match(source,/preferenceOwner===owner\(\)\)/);

// TC-012: weekly ticks start on Monday in UTC and cannot overlap 72px labels.
const day=str=>Math.floor(Date.parse(str+'T00:00:00Z')/86400000);
const date=n=>new Date(n*86400000).toISOString().slice(0,10);
for(const px of [2,4,12,30]){
 const ticks=api.ticks(day('2026-11-18'),day('2027-03-18'),px,'week',date,day);
 assert(ticks.length>=2);
 assert(ticks.every(t=>new Date(date(t)+'T00:00:00Z').getUTCDay()===1));
 assert(ticks.every(t=>t>=day('2026-11-18')));
 assert(ticks.slice(1).every((t,i)=>(t-ticks[i])*px>=72));
}
const monthly=api.ticks(day('2026-10-18'),day('2027-10-18'),4,'month',date,day);
assert(monthly.every(t=>date(t).endsWith('-01')));
assert.match(source,/timeZone:'UTC'/);

// TC-049: the selected row is an actual activity, accessible from keyboard.
assert.match(source,/role="row" tabindex="0" aria-label="\$\{esc\(p.name\)\}"/);
assert.match(source,/if\(!item\|\|!row\)\{clearSelection\(\);return\}/);
assert.match(source,/\['Enter',' '\]\.includes\(e\.key\)/);

// TC-011: releasing a different finger must not apply the first finger's drag;
// stale owner, work, revision or draft also block a save.
assert.match(source,/if\(drag&&e.pointerId!==drag.pointer\)return/);
assert.match(source,/d\.epoch!==sessionEpoch\|\|d\.owner!==owner\(\)\|\|d\.work!==G2\.work\|\|d\.revision!==planOf\(G2\.work\)\.revision/);
assert.match(source,/G2\.busy\|\|G2\.draft\)return;const rows=gHydrate\(gRows\(\)\),next=reorder/);

// TC-051: contractor line is conditional, accessible, and wraps 2 lines.
assert.ok(source.includes('class="g-contractor" title='));
assert.match(css,/\.g-clean \.g-contractor\{[^}]*-webkit-line-clamp:2/);
assert.match(css,/\.g-clean \.g-grid-row\.has-contractor\{min-height:76px\}/);
assert.doesNotMatch(source,/<small class="g-contractor">Sin subcontrata/);

// TC-050: exercise deletion without server calls using an isolated sandbox.
const start=source.indexOf('async function removeSelected(){'),end=source.indexOf('\n// One transactional endpoint',start);
assert(start>=0&&end>start);
const deletionSource=source.slice(start,end);
const rows=[
 {id:'activity-1',name:'Excavación de prueba',task_id:'local-task',observations:[{date:'2026-11-01',percent:10}]},
 {id:'successor',name:'Hormigonado',depends_on:[],dependency_links:[{id:'activity-1'}]}
];
let owner='A',writes=0,cleared=0,notice='',confirmation='',confirmAllowed=true;
const sandbox={
 G2:{work:'work-a',selected:'activity-1',busy:false,draft:null},sessionEpoch:1,
 owner:()=>owner,selected:()=>rows.find(x=>x.id===sandbox.G2.selected),
 gRows:()=>rows,planOf:()=>({revision:3}),subtree:(_r,id)=>new Set([id]),
 gHydrate:structuredClone,removal:(r,id)=>r.filter(x=>x.id!==id),
 ElitePlanning:{derive:x=>x,validate:()=>{}},
 gMessage:msg=>{notice=msg},confirm:text=>{confirmation=text;return confirmAllowed},
 gCommit:async()=>{writes++;return true},
 clearSelection:()=>{cleared++;sandbox.G2.selected=null}
};
vm.createContext(sandbox);
vm.runInContext(deletionSource,sandbox);
(async()=>{
 confirmAllowed=false;await sandbox.removeSelected();
 assert.equal(writes,0,'Cancel must never save');
 confirmAllowed=true;sandbox.G2.draft=[{id:'unsaved'}];
 await sandbox.removeSelected();assert.equal(writes,0);
 assert.match(notice,/cambios pendientes/);
 sandbox.G2.draft=null;
 let release,entered;
 const started=new Promise(resolve=>entered=resolve);
 sandbox.gCommit=async()=>{writes++;entered();await new Promise(resolve=>release=resolve);return true};
 const pending=sandbox.removeSelected();
 await started;owner='B';sandbox.sessionEpoch=2;release();
 await pending;assert.equal(cleared,0,'Late delete success must not change another session');
 assert.match(confirmation,/perderán su dependencia/,'Warn about modern dependency_links too');
 assert.match(confirmation,/avance registrado/);
 assert.match(confirmation,/tarea vinculada se archivará/);
 owner='A';sandbox.sessionEpoch=1;sandbox.G2.selected='activity-1';
 sandbox.gCommit=async()=>{writes++;return true};
 await sandbox.removeSelected();assert.equal(cleared,1,'Successful same-session deletion clears selection');
 sandbox.G2.selected='activity-1';sandbox.G2.work='work-a';
 sandbox.confirm=()=>{sandbox.G2.work='work-b';return true};
 const before=writes;await sandbox.removeSelected();
 assert.equal(writes,before,'Work switched during confirmation: do not write');
 console.log('PASS: six Gantt improvements - isolated work preference, weekly dates, keyboard selection, drag guard, contractor rows, safe deletion');
})().catch(err=>{console.error(err);process.exitCode=1});
