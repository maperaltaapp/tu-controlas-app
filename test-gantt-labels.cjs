// Regression: mobile labels retain the full value; CSS determines what fits.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/gantt-workbench.js','utf8');
const css=fs.readFileSync(__dirname+'/gantt-workbench.css','utf8');
const match=source.match(/function label\(p\)\{[^\n]*\}/);
assert.ok(match,'Debe existir la función label() en el Gantt');
assert.match(css,/\.g-clean \.g-name b\{[^}]*overflow:hidden;[^}]*text-overflow:ellipsis/);
function displayName(item,rows){
  const context={gRows:()=>rows,mobileColumns:()=>true,activityWidth:()=>120,
    tcShortName:()=>{throw Error('No se debe recortar el nombre en JavaScript')}};
  return vm.runInNewContext(match[0]+';label(p)',{...context,p:item});
}
const name='Hormigonado de limpieza de cimentación y zanjas – zona de prensas';
const item={id:'child',name,parent_id:'root'};
assert.equal(displayName(item,[{id:'root',name:'Otra fase'}]),name);
assert.equal(displayName(item,[{id:'root',name}]),'Ejecución principal');
assert.match(source,/title="\$\{esc\(p\.name\)\}"/,'El nombre íntegro está disponible como tooltip');
// TC-047: activity width is responsive on desktop and its touch drag is bound
// to the original pointer. Hidden columns never replace the original name.
assert.match(source,/function columnWidths\(\)\{const base=Math\.max\(230,Math\.min\(360/);
assert.match(source,/resize=\{pointer:e\.pointerId,index:/);
assert.match(source,/if\(e\.pointerId!==resize\.pointer\)return/);
assert.match(source,/savePref\('mobile-activity-width',activityWidth\(\)\)/);
assert.match(css,/\.g-clean \.g-name b\{[^}]*overflow:hidden;[^}]*text-overflow:ellipsis/);

// TC-048: the board is the only scroller and doesn't render an auxiliary scrollbar.
assert.match(css,/\.g-clean \.g-board\{[^}]*overflow-x:auto;overflow-y:auto;overscroll-behavior:contain/);
assert.match(css,/body:has\(\.g-clean\)\{[^}]*overflow:hidden;overscroll-behavior:none/);
assert.doesNotMatch(css,/\.g-clean \.g-horizontal\{/);
assert.match(source,/id="gBoard" class="g-desktop g-board"/);

// TC-053: the date axis is inside the same sticky grid head as the activity
// headers. A scale/zoom change keeps the same date in view, not the same pixel.
assert.match(css,/\.g-clean \.g-grid-head\{position:sticky;top:0;height:38px;z-index:40/);
assert.match(source,/data-start-day="\$\{lo\}"/);
assert.match(source,/visibleDate!=null&&sheet\?timelineOffset\(/);
const model={};model.window=model;
vm.runInNewContext(source,model,{filename:'gantt-workbench.js'});
const {timelineAnchor,timelineOffset}=model.TCGantt;
for(const width of [360,820,1440]){
 for(const fixed of [130,220,510]){
  for(const px of [3,12,32,64]){
   const viewport=width,day=21000.25,start=20000;
   const scroll=timelineOffset(day,viewport,fixed,px,start);
   const restored=timelineAnchor(scroll,viewport,fixed,px,start);
   assert.ok(Math.abs(restored-day)<.001,'The calendar day must survive changing zoom/column width');
  }
 }
}
const before=timelineAnchor(250,360,132,12,20000);
const after=timelineOffset(before,360,212,24,20000);
assert.ok(Math.abs(timelineAnchor(after,360,212,24,20000)-before)<.001,'Resizing activity panel must not move the centered date');
assert.equal(timelineAnchor(0,360,132,0,20000),null);
assert.equal(timelineOffset(NaN,360,132,12,20000),0);

console.log('OK: nombres completos, columnas táctiles, scroll único y fechas fijas con zoom conservando el día visible');
