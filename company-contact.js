/* Import only the contact selected by the user into an unsaved company form. */
(function(root){
'use strict';
root.tcCompanyContact=function(form){
 const button=document.createElement('button');
 button.type='button';button.className='light';button.textContent='Elegir contacto del móvil';
 const message=document.createElement('p');message.className='small';message.setAttribute('role','status');
 form.querySelector('.top').after(button,message);
 const fields={name:'contractorName',tel:'contractorPhone',email:'contractorEmail'};
 const epoch=sessionEpoch,owner=session?.user?.id;
 const active=()=>!!owner&&epoch===sessionEpoch&&owner===session?.user?.id&&form.isConnected;
 button.onclick=async()=>{
  if(button.disabled||!active())return;
  message.textContent='';
  if(!navigator.contacts||typeof navigator.contacts.select!=='function'){
   message.textContent='Abre TU CONTROLAS en Chrome para Android para elegir un contacto. También puedes completar los datos aquí.';
   return;
  }
  const original=Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,document.getElementById(id).value]));
  button.disabled=true;
  try{
   const chosen=await navigator.contacts.select(['name','tel','email'],{multiple:false});
   if(!active()||!chosen?.length)return;
   const contact=chosen[0];
   const phone=value=>String(value||'').replace(/[^0-9]/g,'');
   const email=value=>String(value||'').trim().toLowerCase();
   const existing=CONTRACTORS.find(company=>
    (contact.tel||[]).some(value=>phone(value)&&phone(value)===phone(company.phone))||
    (contact.email||[]).some(value=>email(value)&&email(value)===email(company.email)));
   if(existing){
    message.textContent='Este contacto ya figura en '+existing.name+'. ';
    const open=document.createElement('button');open.type='button';open.className='light';open.textContent='Abrir empresa existente';
    open.onclick=()=>{if(active())editContractor(existing.id)};message.append(open);
    return;
   }
   for(const [key,id] of Object.entries(fields)){
    const field=document.getElementById(id),value=contact[key]?.find(v=>typeof v==='string'&&v.trim());
    if(value&&!original[key]&&field.value===original[key])field.value=value.trim().slice(0,key==='name'?160:500);
   }
   message.textContent='Contacto incorporado a la ficha. Revisa el nombre de la empresa y pulsa Guardar contacto.';
   document.getElementById('contractorName').focus();
  }catch(error){
   if(active())message.textContent=error.name==='AbortError'?'Selección cancelada.':error.name==='NotAllowedError'?'Acceso al contacto denegado. Puedes completar la ficha aquí.':'No se pudo abrir la agenda. Abre TU CONTROLAS en Chrome para Android o completa los datos aquí.';
  }finally{if(active())button.disabled=false}
 };
};
})(window);
