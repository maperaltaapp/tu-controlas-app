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
// Only a single horizontal swipe changes the period. Vertical and two-finger gestures stay native.
function tcBindPeriodSwipe(root, selector, navigate) {
 let swipe = null;
 root.addEventListener('touchstart', event => {
  const host = event.target.closest(selector);
  swipe = null;
  if (!host || event.touches.length !== 1) return;
  const finger = event.touches[0];
  swipe = {host, x:finger.clientX, y:finger.clientY, left:host.scrollLeft, time:Date.now()};
 }, {passive:true});
 root.addEventListener('touchcancel', () => { swipe = null });
 root.addEventListener('touchend', event => {
  const start = swipe;
  swipe = null;
  if (!start || event.touches.length || !event.changedTouches.length) return;
  const finger = event.changedTouches[0], dx = finger.clientX - start.x, dy = finger.clientY - start.y;
  if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.6 || Date.now() - start.time > 950) return;
  if (Math.abs(start.host.scrollLeft - start.left) > 3) return;
  if (event.cancelable) event.preventDefault();
  navigate(dx < 0 ? 1 : -1);
 }, {passive:false});
}
(() => {
 const root = document.getElementById('content');
 tcBindPeriodSwipe(root, '.tc-calendar-grid', calNav);
 root.addEventListener('keydown', event => {
  if (event.target !== event.target.closest('.tc-calendar-grid')) return;
  if (!['ArrowRight','ArrowLeft'].includes(event.key)) return;
  event.preventDefault();
  calNav(event.key === 'ArrowRight' ? 1 : -1);
 });
 root.addEventListener('click', event => {
  const field = event.target.closest('[data-inline-task]');
  if (field?.closest('.is-delete-selected') && !field.querySelector('input,select')) {
   event.preventDefault();
   event.stopPropagation();
   editHeldField(field,'task',field.dataset.inlineTask);
  }
 }, true);
})();
