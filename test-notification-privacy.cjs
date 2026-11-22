const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const listeners=new Map(),shown=[],navigation=[];
const home='https://maperaltaapp.github.io/tu-controlas-app/';
let clients=[];
const self={
  registration:{
    scope:home,
    showNotification:async(title,options)=>{shown.push({title,options});}
  },
  clients:{
    claim:async()=>{},
    matchAll:async()=>clients,
    openWindow:async url=>{navigation.push({type:'open',url});return{url}}
  },
  skipWaiting(){},
  addEventListener:(name,callback)=>listeners.set(name,callback)
};
vm.runInNewContext(fs.readFileSync(__dirname+'/sw.js','utf8'),{self,URL});
assert.ok(listeners.has('push')&&listeners.has('notificationclick'),'Worker must handle push and notification click');

async function push(payload){
 let pending;
 listeners.get('push')({
  data:{json:()=>payload},
  waitUntil:value=>{pending=Promise.resolve(value)}
 });
 await pending;
 return shown.at(-1);
}
(async()=>{
 const confidential={title:'Cliente A: obra confidencial',body:'Tarea privada de A',url:'https://malicious.invalid/steal?token=secret-fixture',tag:'task-123'};
 const notification=await push(confidential);
 assert.equal(notification.title,'TU CONTROLAS');
 assert.match(notification.options.body,/aviso pendiente/);
 assert.ok(!JSON.stringify(notification).includes('confidencial'));
 assert.ok(!JSON.stringify(notification).includes('Tarea privada'));
 assert.ok(!JSON.stringify(notification).includes('malicious.invalid'));
 assert.equal(notification.options.data.url,home);
 assert.equal(notification.options.tag,'task-123','Safe internal tag is kept so reminders do not collapse');

 const malformed=await push({title:{unexpected:true},body:'PRIVADO',tag:'<img onerror=alert(1)>'});
 assert.equal(malformed.title,'TU CONTROLAS');
 assert.equal(malformed.options.tag,'tc-reminder');
 assert.equal(malformed.options.data.url,home);
 assert.ok(!JSON.stringify(malformed).includes('PRIVADO'));

 let closed=false,pending;
 clients=[];
 listeners.get('notificationclick')({
  notification:{data:{url:'https://malicious.invalid/steal'},close:()=>closed=true},
  waitUntil:value=>{pending=Promise.resolve(value)}
 });
 await pending;
 assert.equal(closed,true);
 assert.deepEqual(navigation.at(-1),{type:'open',url:home});

 let focused=false;
 clients=[{url:home+'?task=private-task-id',navigate:async url=>{navigation.push({type:'navigate',url})},focus:async()=>{focused=true}}];
 listeners.get('notificationclick')({
  notification:{data:{url:home+'?task=someone-elses-task'},close(){}},
  waitUntil:value=>{pending=Promise.resolve(value)}
 });
 await pending;
 assert.equal(focused,true);
 assert.deepEqual(navigation.at(-1),{type:'navigate',url:home},'A push must not deep-link a possibly different customer session');
 console.log('PASS: private lock-screen content, unsafe tag and URL rejection, neutral same-origin navigation, shared-device safety.');
})().catch(e=>{console.error(e);process.exitCode=1});
