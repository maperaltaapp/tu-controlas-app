const assert=require('node:assert/strict'),p=require('./planning-engine.js');
const phase=(id,start,end,weight,patch={})=>({id,name:id,start,end,weight,depends_on:[],observations:[],...patch});
const original=[phase('Excavación','2026-11-01','2026-11-04',30),phase('Cimentación','2026-11-05','2026-11-10',70,{depends_on:['Excavación']})];
const current=JSON.parse(JSON.stringify(original));current[0].end='2026-11-07';current[0].observations=[{date:'2026-11-04',percent:50}];
const shifted=p.propagate(current);assert.equal(shifted[1].start,'2026-11-08');assert.equal(shifted[1].end,'2026-11-13');assert.equal(original[1].end,'2026-11-10');
assert.equal(p.progress(shifted,'2026-11-04'),15);assert.equal(p.summary({phases:shifted,baseline:original},'2026-11-04').delta,3);
const cyclic=JSON.parse(JSON.stringify(original));cyclic[0].depends_on=['Cimentación'];assert.throws(()=>p.validate(cyclic),/ciclo/);
assert.throws(()=>p.day('2026-02-30'),/válida/);assert.throws(()=>p.validate([phase('Bad','2026-11-01','2026-11-02',40)]),/100/);
const plans=[{work_id:'Prensas',phases:[phase('A','2026-11-10','2026-11-18',100,{contractor_id:'x'})]},{work_id:'Lacado',phases:[phase('B','2026-11-15','2026-11-20',50,{contractor_id:'x'}),phase('C','2026-11-15','2026-11-20',50,{contractor_id:'x'})]}];
const conflicts=p.capacity(plans,[{id:'x',name:'Ferrallas',capacity:1}]);assert.equal(conflicts.length,1);assert.equal(conflicts[0].days,4);assert.equal(conflicts[0].start,'2026-11-15');assert.equal(conflicts[0].end,'2026-11-18');assert.equal(p.capacity(plans,[{id:'x',name:'Ferrallas',capacity:2}]).length,0);
plans[1].archived=true;assert.equal(p.capacity(plans,[{id:'x',name:'Ferrallas',capacity:1}]).length,0);
const curve=p.curve({phases:shifted,baseline:original},'2026-11-04');assert(curve.filter(x=>x.date>'2026-11-04').every(x=>x.actual===null));
assert.equal(p.requests({confirmed_at:'now',phases:original},{name:'Prensas'},[],'2026-11-01')[0].missing.length,4);
global.ElitePlanning=p;require('./planning-hierarchy.js');const h=global.ElitePlanning;
const hierarchy=h.derive([
 {id:'F',name:'Fase',level:1,start:'2026-11-01',end:'2026-11-20',weight:0,depends_on:[],observations:[]},
 {id:'T',name:'Tarea',level:2,parent_id:'F',start:'2026-11-02',end:'2026-11-19',weight:0,depends_on:[],observations:[]},
 phase('S1','2026-11-02','2026-11-09',40,{level:3,parent_id:'T',observations:[{date:'2026-11-05',percent:50}]}),
 phase('S2','2026-11-10','2026-11-19',60,{level:3,parent_id:'T',observations:[{date:'2026-11-05',percent:25}]})
]);
h.validate(hierarchy);assert.equal(hierarchy[0].start,'2026-11-02');assert.equal(hierarchy[0].end,'2026-11-19');assert.equal(hierarchy[0].weight,0);assert.equal(h.progress(hierarchy,'2026-11-05'),35);assert.equal(h.progress(hierarchy,'2026-11-05',false,'T'),35);
assert.throws(()=>h.validate([phase('Root','2026-11-01','2026-11-20',100),phase('Orphan','2026-11-02','2026-11-03',0,{level:3,parent_id:'missing'})]),/nivel anterior/);
assert.throws(()=>h.validate(hierarchy.map(x=>x.id==='F'?{...x,weight:10}:x)),/contenedora/);
console.log('PASS: immutable baseline, dependency propagation, weighted observations, three-level hierarchy rollup, cycle/date validation, capacity conflicts and no invented future progress.');

const C=require('./work-calendar.js');
const weekday=C.normalize({anchor:'2026-11-20',weekdays:[1,2,3,4,5],exceptions:[]});
const saturday=C.normalize({...weekday,exceptions:[{date:'2026-11-21',working:true,name:'Sábado excepcional'}]});
const make=(work,phases,calendar=weekday,patch={})=>({work_id:work,phases,calendar,...patch});
const x={id:'x',name:'Empresa ficticia',kind:'subcontractor',capacity:5};
const assigned=(id,start='2026-11-20',end='2026-11-23',patch={})=>phase(id,start,end,50,{contractor_id:'x',...patch});
const opts={workingDay:(plan,date)=>C.working(date,plan.calendar)};
const same=make('W1',[assigned('A'),assigned('B')]);
let overlap=p.assignmentOverlaps([same],[x],opts);
assert.deepEqual(overlap.map(c=>[c.start,c.end,c.assignments.length,c.works.length]),[['2026-11-20','2026-11-20',2,1],['2026-11-23','2026-11-23',2,1]]);
assert.deepEqual(p.assignmentOverlaps([make('W1',[assigned('A')]),make('W2',[assigned('B')],weekday,{archived:true})],[x],opts),[]);
const different=[make('W1',[assigned('A')],saturday),make('W2',[assigned('B')],saturday)];
overlap=p.assignmentOverlaps(different,[x],opts);
assert.deepEqual(overlap.map(c=>[c.start,c.end,c.works.length]),[['2026-11-20','2026-11-21',2],['2026-11-23','2026-11-23',2]]);
assert.deepEqual(p.assignmentOverlaps([...different].reverse(),[x],opts).map(c=>c.signature),overlap.map(c=>c.signature));
const moved=[different[0],make('W2',[assigned('B','2026-11-19','2026-11-23')],saturday)];
assert.notEqual(p.assignmentOverlaps(moved,[x],opts)[0].signature,overlap[0].signature);
assert.deepEqual(p.assignmentOverlaps([make('W1',[assigned('Parent','2026-11-20','2026-11-23',{is_group:true}),assigned('Child','2026-11-20','2026-11-23',{parent_id:'Parent'})])],[x],opts),[]);
assert.deepEqual(p.assignmentOverlaps([same],[{...x,kind:'supplier'}],opts),[]);
assert.equal(p.assignmentOverlaps([same],[x],{...opts,from:'2026-11-23'}).length,1);
assert.throws(()=>p.assignmentOverlaps([same],[x]),/calendario laboral/);
console.log('PASS: activity-level overlaps within and across works; per-work holidays and Saturday exceptions; stable signatures and no group double-counting.');
