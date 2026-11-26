// Real Chromium CSS regression; no login, network or customer data.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=__dirname,html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const head=html.slice(0,html.indexOf('</head>'));
const styles=[...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)].map(m=>m[1]??fs.readFileSync(path.join(root,m[2].split('?')[0]),'utf8')).join('\n');
const widths=[360,390,768,850,1366,1920,2560,3440],temp=fs.mkdtempSync(path.join(os.tmpdir(),'tc-responsive-'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const markup='<header class="elite-header"><div class="elite-header-inner"><div class="elite-brand"><span class="helmet-mark">T</span><span>TU CONTROLAS</span></div><div class="tc-head-actions"><button>Calendario</button><button>Ajustes</button></div></div><div class="tc-create-actions"><button>+ Tarea</button><button>+ Parte</button><button>+ Incidencia</button><button>+ Empresa</button></div></header><div class="wrap"><section id="app"><div id="content"><div class="tc-filter-bar"><label class="tc-search"><input placeholder="Buscar tarea"></label><select><option>Prioridad</option></select></div><section class="home-group today"><h2>Hoy <span>1</span></h2><div class="home-row"><input type="checkbox"><button class="home-open"><span class="home-copy"><span class="home-name">Actividad ficticia de prueba con descripción extensa</span><span class="home-work">Obra ficticia de prueba</span></span><span class="home-date">26/11/26</span><span class="home-state">Pendiente</span><span class="home-chevron">›</span></button></div></section><section class="ec-panel-root"><div class="ec-card">Economía</div></section><section class="evm-dashboard"><div class="evm-panel">Panel</div></section><section class="tc-sheet"><div class="control-scroll tc-sheet-scroll"><table class="control-table tc-sheet-table" style="width:3500px"><tbody><tr><td>Planilla ancha con desplazamiento propio</td></tr></tbody></table></div></section></div><nav class="tc-nav"><button>Tareas</button><button>Panel de Control</button><button>Gantt</button><button>Checklist</button><button>Partes</button></nav></section></div>';
const frame='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body>'+markup+'</body></html>';
const document='<!doctype html><html><body><pre id="result">PENDING</pre>'+widths.map(w=>'<iframe data-width="'+w+'" style="display:block;width:'+w+'px;height:720px;border:0" srcdoc="'+escape(frame)+'"></iframe>').join('')+'<script>window.addEventListener("load",()=>{const result=[...document.querySelectorAll("iframe")].map(f=>{const d=f.contentDocument,w=f.contentWindow,rect=s=>{const r=d.querySelector(s).getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}},viewport=d.documentElement.clientWidth;const result={requested:Number(f.dataset.width),viewport,scroll:d.documentElement.scrollWidth,wrap:rect(".wrap"),content:rect("#content"),tasks:rect(".home-group"),economy:rect(".ec-panel-root"),dashboard:rect(".evm-dashboard"),brand:rect(".elite-brand"),actions:rect(".tc-head-actions"),create:rect(".tc-create-actions"),sheetScroll:d.querySelector(".tc-sheet-scroll").scrollWidth,sheetWidth:d.querySelector(".tc-sheet-scroll").clientWidth,loginMax:w.getComputedStyle(d.querySelector(".wrap")).maxWidth};return result});document.querySelector("#result").textContent=JSON.stringify(result)});<\/script></body></html>';
try{
 const file=path.join(temp,'test.html');fs.writeFileSync(file,document);
 const browser=process.env.CHROME_BIN||['google-chrome','chromium','chromium-browser'].find(x=>spawnSync(x,['--version'],{encoding:'utf8'}).status===0);
 assert.ok(browser,'Chromium is required for the responsive regression');
 const run=spawnSync(browser,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--user-data-dir='+path.join(temp,'profile'),'--dump-dom','--virtual-time-budget=10000','--window-size=3600,900','file://'+file],{encoding:'utf8',timeout:90000,maxBuffer:24*1024*1024});
 assert.equal(run.status,0,run.error?.message||run.stderr?.slice(-1200));
 const raw=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];assert.ok(raw&&raw!=='PENDING','Browser did not return measurements');
 const results=JSON.parse(raw.replaceAll('&amp;','&'));assert.equal(results.length,widths.length);
 for(const r of results){
  assert.ok(Math.abs(r.requested-r.viewport)<=18,'Unexpected iframe width '+JSON.stringify(r));
  assert.ok(r.scroll<=r.viewport+1,'Page has horizontal overflow: '+JSON.stringify(r));
  assert.ok(r.content.width>=r.viewport-66,'Content is artificially constrained: '+JSON.stringify(r));
  for(const k of ['tasks','economy','dashboard'])assert.ok(r[k].width>=r.content.width-2,k+' does not fill available width: '+JSON.stringify(r));
  assert.ok(r.actions.right<=r.viewport+1&&r.brand.x>=0,'Header clipped: '+JSON.stringify(r));
  assert.ok(r.sheetScroll>r.sheetWidth,'Wide checklist lost independent scroll: '+JSON.stringify(r));
  if(r.requested>=850)assert.ok(r.brand.x<=35&&r.actions.right>=r.viewport-35,'Header not aligned to responsive margins: '+JSON.stringify(r));
  console.log('PASS responsive '+r.requested+'px: viewport '+r.viewport+', content '+Math.round(r.content.width)+', horizontal page overflow '+(r.scroll-r.viewport)+'px');
 }
}finally{fs.rmSync(temp,{recursive:true,force:true})}
