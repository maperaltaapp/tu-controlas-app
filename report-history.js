/* Daily-report history. Filtering never changes stored reports. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
let filters={kind:'all',day:'',from:'',to:''},query='',generation=0,navigation=0;
function bounds(f){
 const start=f.kind==='day'?f.day:f.kind==='range'?f.from:'',end=f.kind==='day'?f.day:f.kind==='range'?f.to:'';
 if(start&&end&&start>end)return {error:'La fecha Desde debe ser anterior o igual a Hasta.'};
 return {start,end};
}
function filterReports(rows,work,f){const b=bounds(f);if(b.error)return [];return rows.filter(r=>(!work||r.work_id===work)&&(!b.start||r.report_date>=b.start)&&(!b.end||r.report_date<=b.end)).slice().sort((a,b)=>b.report_date.localeCompare(a.report_date)||String(b.created_at||'').localeCompare(String(a.created_at||''))||a.id.localeCompare(b.id));}
root.TCReportHistory={bounds,filter:filterReports};
const previousSelect=selectSection;selectSection=function(...args){navigation++;return previousSelect(...args)};
const previousEnd=sessionViewEnded;sessionViewEnded=function(...args){generation++;query='';filters={kind:'all',day:'',from:'',to:''};return previousEnd(...args)};
openFollowup=async function(){
 if(!session?.access_token||!nativeReady)return;
 const epoch=sessionEpoch,owner=session?.user?.id||null,request=++generation;
 mode='followup';workDetailId=null;selectSection('followup');
 followWork='';const nav=navigation,current=()=>!!owner&&!!session?.access_token&&owner===session?.user?.id&&epoch===sessionEpoch&&request===generation&&nav===navigation&&mode==='followup'&&selectedSection==='followup';
 $('title').textContent='Partes';$('content').innerHTML='<section class="panel"><p role="status">Cargando partes…</p></section>';
 try{const reports=await readAll('elite_daily_reports','order=report_date.desc,id.asc');if(!current())return;DAILY_REPORTS=reports;renderFollowup();}
 catch(error){if(!current())return;$('content').innerHTML=`<section class="panel"><p class="err" role="alert">No se pudieron cargar los partes: ${esc(error.message)}</p><button id="reportRetry" class="light">Reintentar</button></section>`;$('reportRetry').onclick=()=>openFollowup();}
};
root.tcNewDailyReport=function(){
 const day=filters.kind==='day'&&filters.day?filters.day:planningToday();
 const existing=DAILY_REPORTS.find(r=>r.work_id===followWork&&r.report_date===day);
 editDailyReport(existing?.id||null,followWork,day);
};
renderFollowup=function(){
 selectSection('followup');
 const works=NATIVE_WORKS.filter(w=>!w.archived_at||DAILY_REPORTS.some(r=>r.work_id===w.id)),shown=filterReports(DAILY_REPORTS,followWork,filters).filter(r=>(NATIVE_WORKS.find(w=>w.id===r.work_id)?.name||'Obra').toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))),error=bounds(filters).error;
 $('content').innerHTML=`<section class="panel tc-parts tc-parts-history"><div id="reportHistoryContent" tabindex="-1"><div class="tc-searchbar"><label class="tc-searchbox"><span aria-hidden="true">⌕</span><input id="reportSearch" type="search" aria-label="Buscar obra en partes" placeholder="Buscar obra…" value="${esc(query)}"></label><label>Fecha<select id="reportDateKind"><option value="all">Todas las fechas</option><option value="day">Un día</option><option value="range">Intervalo</option></select></label></div><div class="tc-date-range">${filters.kind==='day'?`<label>Día<input id="reportDay" type="date" value="${filters.day}"></label>`:filters.kind==='range'?`<label>Desde<input id="reportFrom" type="date" value="${filters.from}"></label><label>Hasta<input id="reportTo" type="date" value="${filters.to}"></label>`:''}</div><div id="followError" role="status" class="status ${error?'err':''}">${error?esc(error):shown.length+' '+(shown.length===1?'parte':'partes')}</div><div class="tc-report-history">${shown.map(r=>{const work=works.find(w=>w.id===r.work_id),summary=(r.notes||r.progress_note||r.activities?.map(a=>a.activity_name).filter(Boolean).join(' · ')||'Parte de obra').trim();return `<button class="tc-report-item" data-hold-kind="report" data-hold-id="${r.id}" data-report-id="${r.id}"><b>${esc(work?.name||'Obra')}</b><time>${workDateLabel(r.report_date)}</time><span>${esc(summary.slice(0,120))}</span><i aria-hidden="true">›</i></button>`}).join('')||(!error?'<p class="small">No hay partes para estos filtros.</p>':'')}</div></div></section>`;
 $('reportDateKind').value=filters.kind;
 $('reportSearch').oninput=e=>{query=e.target.value;const input=e.target,start=input.selectionStart;renderFollowup();$('reportSearch').focus();$('reportSearch').setSelectionRange?.(start,start)};
 $('reportDateKind').onchange=e=>{filters.kind=e.target.value;renderFollowup()};
 for(const [id,key]of [['reportDay','day'],['reportFrom','from'],['reportTo','to']])if($(id))$(id).onchange=e=>{filters[key]=e.target.value;renderFollowup()};
 document.querySelectorAll('[data-report-id]').forEach(button=>button.onclick=()=>editDailyReport(button.dataset.reportId));
};
})(window);
