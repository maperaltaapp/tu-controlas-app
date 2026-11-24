/* TU CONTROLAS economic file interpretation. No file is uploaded automatically. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TCEconomicImport=api})(typeof window==='undefined'?this:window,function(){
'use strict';
const MAX_BYTES=8*1024*1024,MAX_ROWS=250;
const clean=s=>String(s??'').replace(/\u00a0/g,' ').trim();
function number(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=0?Math.round(value*100)/100:null;
 let s=clean(value).replace(/(?:EUR|€)/ig,'').replace(/\s/g,'');
 if(!s||/[()\-]/.test(s)||!/^[\d.,]+$/.test(s))return null;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0){const decimal=comma>dot?',':'.';s=s.replace(new RegExp('\\'+(decimal===','?'.':','),'g'),'').replace(decimal,'.')}
 else if(comma>=0){const parts=s.split(',');s=parts.length===2&&parts[1].length<=2?parts.join('.'):parts.join('')}
 else if(dot>=0){const parts=s.split('.');s=parts.length===2&&parts[1].length<=2?s:parts.join('')}
 const n=Number(s);return Number.isFinite(n)&&n>=0&&n<=1e10?Math.round(n*100)/100:null;
}
const key=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES').replace(/[^a-z0-9]+/g,' ').trim();
function csvRows(text){
 text=text.replace(/^\uFEFF/,'');const sample=text.slice(0,2000),delimiter=[';',',','\t'].map(v=>({v,n:(sample.match(new RegExp(v==='\t'?'\\t':v===';'?';':',','g'))||[]).length})).sort((a,b)=>b.n-a.n)[0].v;
 const rows=[];let row=[],current='',quote=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quote&&text[i+1]==='"'){current+='"';i++}else quote=!quote;}else if(ch===delimiter&&!quote){row.push(current);current=''}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(current);if(row.some(x=>clean(x)))rows.push(row);row=[];current='';if(rows.length>MAX_ROWS+25)break}else current+=ch}
 row.push(current);if(row.some(x=>clean(x)))rows.push(row);return rows;
}
async function zipEntries(buffer){
 const view=new DataView(buffer),bytes=new Uint8Array(buffer),decode=new TextDecoder();
 let end=-1;for(let n=bytes.length-22;n>=Math.max(0,bytes.length-65557);n--)if(view.getUint32(n,true)===0x06054b50){end=n;break}
 if(end<0)throw Error('No es un archivo XLSX válido.');
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);if(count>300||offset>=bytes.length)throw Error('Planilla demasiado grande o no compatible.');
 let pos=offset;const entries=new Map();
 for(let i=0;i<count;i++){
  if(view.getUint32(pos,true)!==0x02014b50)throw Error('Estructura XLSX no válida.');
  const method=view.getUint16(pos+10,true),compressed=view.getUint32(pos+20,true),plain=view.getUint32(pos+24,true),nLen=view.getUint16(pos+28,true),eLen=view.getUint16(pos+30,true),cLen=view.getUint16(pos+32,true),at=view.getUint32(pos+42,true);
  const name=decode.decode(bytes.slice(pos+46,pos+46+nLen));pos+=46+nLen+eLen+cLen;
  if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name))continue;
  if(plain>5e6||compressed>MAX_BYTES||at+30>bytes.length)throw Error('Hoja demasiado grande.');
  const dataAt=at+30+view.getUint16(at+26,true)+view.getUint16(at+28,true),part=bytes.slice(dataAt,dataAt+compressed);
  if(part.length!==compressed)throw Error('Archivo XLSX incompleto.');
  let raw;
  if(method===0)raw=part;
  else if(method===8){if(typeof DecompressionStream==='undefined')throw Error('Este navegador no permite leer XLSX. Guarda como CSV.');const stream=new Blob([part]).stream().pipeThrough(new DecompressionStream('deflate-raw'));raw=new Uint8Array(await new Response(stream).arrayBuffer())}
  else throw Error('Compresión XLSX no admitida.');
  if(raw.length>5e6)throw Error('Hoja XLSX demasiado grande.');
  entries.set(name,decode.decode(raw));
 }
 return entries;
}
async function xlsxRows(buffer,DOM){
 const entries=await zipEntries(buffer);
 const sheets=[...entries.keys()].filter(k=>/xl\/worksheets\/sheet\d+\.xml/.test(k)).sort();
 if(!sheets.length)throw Error('No se encontraron celdas en la planilla.');
 const parse=source=>{const xml=new DOM().parseFromString(source,'application/xml');if(xml.getElementsByTagName('parsererror').length)throw Error('XML de planilla no válido.');return xml};
 const shared=entries.has('xl/sharedStrings.xml')?[...parse(entries.get('xl/sharedStrings.xml')).getElementsByTagName('si')].map(x=>[...x.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
 const xml=parse(entries.get(sheets[0])),out=[];
 for(const row of xml.getElementsByTagName('row')){
  const values=[];for(const c of row.getElementsByTagName('c')){
   const address=c.getAttribute('r')||'',letters=address.match(/^[A-Z]+/)?.[0]||'A';let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;col--;
   if(col>70)continue;
   const kind=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent??'',inline=c.getElementsByTagName('is')[0];
   values[col]=kind==='s'?shared[Number(v)]??'':kind==='inlineStr'?inline?.textContent??'':v;
  }
  if(values.some(x=>clean(x)))out.push(Array.from({length:Math.min(values.length,70)},(_,i)=>values[i]??''));
  if(out.length>MAX_ROWS+25)break;
 }
 return out;
}
function detect(rows,kind='budget',names=[]){
 const list=[],warnings=[],normalized=new Map(names.map(a=>[key(a.name),a.id]));
 let header=-1,labelCol=0,amountCol=-1,actualKind=kind;
 for(let i=0;i<Math.min(rows.length,12);i++){
  const cells=rows[i].map(key),description=cells.findIndex(v=>/(partida|descripcion|concepto|actividad|trabajo|capitulo|denominacion)/.test(v));
  const amount=cells.findLastIndex(v=>/(coste real|importe|total|presupuesto|coste previsto|cantidad monetaria|base imponible)/.test(v));
  if(description>=0&&amount>=0&&description!==amount){header=i;labelCol=description;amountCol=amount;if(/coste real|coste ejecutado/.test(cells[amount]))actualKind='actual';break}
 }
 const start=header>=0?header+1:0;
 for(let i=start;i<Math.min(rows.length,start+MAX_ROWS);i++){
  const row=rows[i],description=clean(row[labelCol]||row[0]);if(!description||/^(total|subtotal|iva|base imponible|suma)(\s|$)/i.test(key(description)))continue;
  let amount=amountCol>=0?number(row[amountCol]):null;
  if(amount===null&&row.length>1){for(let j=row.length-1;j>0;j--){amount=number(row[j]);if(amount!==null)break}}
  if(amount===null&&row.length===1){
   const match=description.match(/^(.*?)\s+([0-9][0-9\s.,]*[,.][0-9]{2})\s*(?:EUR|€)?$/i);
   if(match){amount=number(match[2]);if(amount!==null)row[0]=match[1]}
  }
  const concept=clean(row[labelCol]||row[0]);if(amount===null||!concept)continue;
  list.push({line:i+1,description:concept.slice(0,160),amount,kind:actualKind,activity_id:normalized.get(key(concept))||null});
 }
 if(header<0)warnings.push('No se detectaron columnas de concepto e importe. Verifica cada fila.');
 if(!list.length)warnings.push('No se detectaron partidas e importes interpretables; revisa el formato.');
 if(list.some(x=>!x.activity_id))warnings.push('Hay partidas sin actividad asignada: debes vincularlas manualmente antes de guardar.');
 warnings.push('Comprueba moneda, IVA, descuentos, subtotales y duplicados. No se aceptan importes automáticamente.');
 return {entries:list,warnings,header:header>=0?rows[header]:null};
}
async function pdfRows(file){
 const url='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
 const module=await import(url);
 module.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 const document=await module.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 if(document.numPages>30)throw Error('PDF demasiado extenso (máximo 30 páginas).');
 const lines=[];
 for(let pageIndex=1;pageIndex<=document.numPages;pageIndex++){
  const page=await document.getPage(pageIndex),content=await page.getTextContent();
  const grouped=new Map();
  for(const item of content.items){if(!item.str||!item.transform)continue;const y=Math.round(item.transform[5]/4)*4;const arr=grouped.get(y)||[];arr.push({x:item.transform[4],str:item.str});grouped.set(y,arr)}
  for(const [,items] of [...grouped.entries()].sort((a,b)=>b[0]-a[0]))lines.push([items.sort((a,b)=>a.x-b.x).map(v=>v.str).join(' ')]);
 }
 await document.destroy();return lines;
}
async function read(file,kind='budget',names=[],consent=false){
 if(!file||file.size>MAX_BYTES)throw Error('Archivo no válido o mayor de 8 MB.');
 const name=file.name.toLowerCase();let rows;
 if(name.endsWith('.csv')||name.endsWith('.tsv')||name.endsWith('.txt'))rows=csvRows(await file.text());
 else if(name.endsWith('.xlsx'))rows=await xlsxRows(await file.arrayBuffer(),DOMParser);
 else if(name.endsWith('.pdf')){if(!consent)throw Error('Para interpretar PDF debes autorizar la carga de PDF.js desde cdnjs. El archivo se procesa en el navegador, no se almacena.');rows=await pdfRows(file);}
 else throw Error('Formatos admitidos: PDF con texto, CSV y XLSX. Guarda XLS como XLSX o CSV.');
 const out=detect(rows,kind,names);
 if(name.endsWith('.pdf'))out.warnings.push('PDF con texto: la extracción puede alterar columnas. PDF escaneados no cuentan con OCR.');
 return {...out,filename:file.name};
}
return {number,key,csvRows,detect,zipEntries,xlsxRows,read};
});
