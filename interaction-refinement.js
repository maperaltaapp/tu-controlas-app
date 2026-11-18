function tcShortName(name){return String(name).split(/\s+/).filter(w=>!['de','del','la','las','el','los','con','y','en','para','a','al'].includes(w.toLocaleLowerCase('es'))).slice(0,2).join(' ')}
// Move a complete subtree without changing dates, dependencies or parentage.
function tcReorder(rows,id,targetId,after){
 const item=rows.find(r=>r.id===id),target=rows.find(r=>r.id===targetId);
 if(!item||!target||id===targetId)return rows;
 const ids=root=>{const result=new Set([root]);let change=true;while(change){change=false;for(const r of rows)if(result.has(r.parent_id)&&!result.has(r.id)){result.add(r.id);change=true}}return result};
 const moving=ids(id);if(moving.has(targetId))return rows;
 // A nested row stays in its phase; roots may move across sections.
 if((item.parent_id||null)!==(target.parent_id||null))return rows;
 const rest=rows.filter(r=>!moving.has(r.id)),block=rows.filter(r=>moving.has(r.id)),targetTree=ids(targetId);
 let at=rest.findIndex(r=>r.id===targetId);if(after)at=Math.max(...rest.map((r,i)=>targetTree.has(r.id)?i:-1))+1;
 rest.splice(at,0,...block);return rest;
}
const tcSelectRow=selectHeldForDelete;
selectHeldForDelete=function(host,kind,id){tcSelectRow(host,kind,id);document.querySelectorAll('.tc-task-edit').forEach(n=>n.remove());if(kind==='task'&&host){const b=document.createElement('button');b.type='button';b.className='tc-edit-row tc-task-edit';b.textContent='Editar';b.onclick=e=>{e.stopPropagation();showInlineTaskEditor(id)};host.append(b)}};
(()=>{const root=document.getElementById('content');let pinch=null;
root.addEventListener('click',e=>{const field=e.target.closest('[data-inline-task]');if(field?.closest('.is-delete-selected')&&!field.querySelector('input,select')){e.preventDefault();e.stopPropagation();editHeldField(field,'task',field.dataset.inlineTask)}});
root.addEventListener('touchstart',e=>{if(e.touches.length!==2||!e.target.closest('.calendar-panel'))return;pinch={host:e.target.closest('.calendar-panel'),zoom:calZoom,distance:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),value:null};e.preventDefault()},{passive:false});
root.addEventListener('touchmove',e=>{if(!pinch||e.touches.length!==2)return;e.preventDefault();pinch.value=Math.max(.5,Math.min(2,pinch.zoom*Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)/Math.max(1,pinch.distance)));pinch.host.style.setProperty('--cal-zoom',pinch.value)},{passive:false});
root.addEventListener('touchend',e=>{if(!pinch||e.touches.length>=2)return;const p=pinch;pinch=null;if(p.value!==null){calZoom=p.value;localStorage.setItem('tc_calendar_zoom',String(p.value));calendar()}});root.addEventListener('touchcancel',()=>pinch=null);
})();
