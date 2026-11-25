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
(()=>{const root=document.getElementById('content');let pinch=null,swipe=null,blockedUntil=0;
root.addEventListener('click',e=>{if(Date.now()<blockedUntil&&e.target.closest('.tc-calendar-grid')){e.preventDefault();e.stopImmediatePropagation();return}const field=e.target.closest('[data-inline-task]');if(field?.closest('.is-delete-selected')&&!field.querySelector('input,select')){e.preventDefault();e.stopPropagation();editHeldField(field,'task',field.dataset.inlineTask)}},true);
root.addEventListener('keydown',e=>{if(e.target!==e.target.closest('.tc-calendar-grid'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();calNav(e.key==='ArrowRight'?1:-1)}});
root.addEventListener('touchstart',e=>{
 const host=e.target.closest('.tc-calendar-grid');if(!host)return;
 if(e.touches.length===2){swipe=null;const points=[...e.touches];if(document.elementFromPoint&&points.some(t=>!host.contains(document.elementFromPoint(t.clientX,t.clientY))))return;pinch={host,zoom:calZoom,distance:Math.hypot(points[0].clientX-points[1].clientX,points[0].clientY-points[1].clientY),value:null};e.preventDefault();blockedUntil=Date.now()+600}
 else if(e.touches.length===1&&!pinch)swipe={host,x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now(),left:host.scrollLeft||0};
},{passive:false});
root.addEventListener('touchmove',e=>{if(!pinch||e.touches.length!==2)return;e.preventDefault();pinch.value=Math.max(.5,Math.min(2,pinch.zoom*Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)/Math.max(1,pinch.distance)));pinch.host.style.setProperty('--cal-zoom',pinch.value)},{passive:false});
root.addEventListener('touchend',e=>{
 if(pinch){if(e.touches.length>=2)return;const p=pinch;pinch=null;swipe=null;blockedUntil=Date.now()+600;if(p.value!==null){calZoom=p.value;localStorage.setItem('tc_calendar_zoom',String(p.value));calendar()}return}
 if(!swipe||e.touches.length)return;const s=swipe;swipe=null;const end=e.changedTouches?.[0];if(!end)return;const dx=end.clientX-s.x,dy=end.clientY-s.y;
 // Horizontal scroll and period navigation are separate gestures.
 if(Math.abs(dx)>64&&Math.abs(dx)>Math.abs(dy)*1.8&&Date.now()-s.time<900&&Math.abs((s.host.scrollLeft||0)-s.left)<4){blockedUntil=Date.now()+600;calNav(dx>0?1:-1)}
});root.addEventListener('touchcancel',()=>{if(pinch)pinch.host.style.setProperty('--cal-zoom',pinch.zoom);pinch=swipe=null});
})();
