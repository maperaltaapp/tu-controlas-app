// TU CONTROLAS: lock-screen alerts never disclose work names, task details or customer links.
// Notification content is intentionally generic even if a push sender includes detail.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?.json()||{}}catch{/* Invalid push payload still shows a generic alert. */}
 const tag=typeof data?.tag==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(data.tag)
  ?data.tag:'tc-reminder';
 event.waitUntil(self.registration.showNotification('TU CONTROLAS',{
  body:'Tienes un aviso pendiente. Abre la aplicación para consultarlo.',
  tag,
  icon:'./icon-192.png?v=20261128a',
  // The push payload never supplies a deep link for this shared device.
  data:{url:self.registration.scope}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const home=self.registration.scope;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const client of clients){
   let target;
   try{target=new URL(client.url)}catch{continue}
   const scope=new URL(home);
   if(target.origin===scope.origin&&target.pathname.startsWith(scope.pathname)&&typeof client.focus==='function'){
    if(typeof client.navigate==='function')await client.navigate(home);
    return client.focus();
   }
  }
  return self.clients.openWindow(home);
 }));
});
