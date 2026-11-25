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
function tcCalendarSwipe(dx,dy,elapsed){return elapsed<=900&&Math.abs(dx)>=65&&Math.abs(dx)>Math.abs(dy)*1.6?(dx>0?1:-1):0}
(()=>{const root=document.getElementById('content');let pinch=null,swipe=null,suppressUntil=0;
const hostOf=e=>e.target.closest('.calendar-panel'),gridTarget=e=>e.target.closest('.month,.calhead,.week-calendar-grid');
root.addEventListener('click',e=>{if(Date.now()<suppressUntil&&hostOf(e)){e.preventDefault();e.stopImmediatePropagation();return}const field=e.target.closest('[data-inline-task]');if(field?.closest('.is-delete-selected')&&!field.querySelector('input,select')){e.preventDefault();e.stopPropagation();editHeldField(field,'task',field.dataset.inlineTask)}},true);
root.addEventListener('touchstart',e=>{const host=hostOf(e);if(!host||!gridTarget(e))return;if(e.touches.length===2){swipe=null;pinch={host,zoom:calZoom,distance:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),value:null};e.preventDefault()}else if(e.touches.length===1&&!pinch){const t=e.touches[0];swipe={host,x:t.clientX,y:t.clientY,start:Date.now(),dx:0,dy:0,pan:false};const scroll=e.target.closest('.week-calendar-scroll')||host;swipe.pan=calZoom>1.1&&scroll.scrollWidth>scroll.clientWidth+2;}},{passive:false});
root.addEventListener('touchmove',e=>{if(pinch&&e.touches.length===2){e.preventDefault();pinch.value=Math.max(.5,Math.min(2,pinch.zoom*Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)/Math.max(1,pinch.distance)));pinch.host.style.setProperty('--cal-zoom',pinch.value)}else if(swipe&&e.touches.length===1){swipe.dx=e.touches[0].clientX-swipe.x;swipe.dy=e.touches[0].clientY-swipe.y;if(!swipe.pan&&Math.abs(swipe.dx)>15&&Math.abs(swipe.dx)>Math.abs(swipe.dy)*1.6)e.preventDefault()}},{passive:false});
root.addEventListener('touchend',e=>{if(pinch){if(e.touches.length>=2)return;const p=pinch;pinch=null;swipe=null;suppressUntil=Date.now()+500;if(p.value!==null){calZoom=p.value;localStorage.setItem('tc_calendar_zoom',String(p.value));if(p.host.isConnected!==false&&mode==='calendar')calendar()}return}if(!swipe||e.touches.length)return;const p=swipe;swipe=null;const delta=tcCalendarSwipe(p.dx,p.dy,Date.now()-p.start);if(delta&&!p.pan&&p.host.isConnected!==false&&mode==='calendar'){suppressUntil=Date.now()+500;calNav(delta)}});
root.addEventListener('touchcancel',()=>{if(pinch)pinch.host.style.setProperty('--cal-zoom',pinch.zoom);pinch=swipe=null});
})();
