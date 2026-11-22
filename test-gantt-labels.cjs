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
console.log('OK: nombres íntegros en el DOM, el ancho controla su visualización');
