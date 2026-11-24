#!/usr/bin/env node
'use strict';
// Prepares only a separate beta distribution. Does not upload or modify the daily app.
const fs=require('node:fs'),path=require('node:path'),B=require('./commercial-build.cjs');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function settings(env){
 const name=(env.TC_BETA_CONTROLLER||'').trim(),contact=(env.TC_BETA_PRIVACY_EMAIL||'').trim(),version=(env.TC_BETA_NOTICE_VERSION||'').trim();
 if(name.length<3||name.length>200||/[<>\r\n]/.test(name))throw Error('Indica el titular legal real de la prueba.');
 if(!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contact)||contact.length>200||/@(?:example\.(?:com|org|net)|.*\.invalid)$/i.test(contact))throw Error('Indica un correo de privacidad real y verificado.');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(version)||Number.isNaN(Date.parse(version)))throw Error('Indica fecha de la política en YYYY-MM-DD.');
 return {name:escape(name),email:escape(contact),mailto:escape('mailto:'+contact+'?subject='+encodeURIComponent('TU CONTROLAS - Solicitud de privacidad')),deletionMail:escape('mailto:'+contact+'?subject='+encodeURIComponent('TU CONTROLAS - Eliminar mi cuenta')),version:escape(version)};
}
const page=(title,body)=>`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · TU CONTROLAS</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#172033;background:white;max-width:760px;margin:auto;padding:24px}h1{font-size:1.75rem}h2{font-size:1.2rem}a{color:#154f8b;overflow-wrap:anywhere}section{margin:1.4rem 0}</style></head><body><main><h1>TU CONTROLAS · ${title}</h1>${body}<p><a href="./">Volver a la aplicación</a></p></main></body></html>`;
function privacy(c){return page('Privacidad de la prueba cerrada',`
<p>Versión: ${c.version}. Responsable: ${c.name}. Contacto: <a href="${c.mailto}">${c.email}</a>.</p>
<p>Esta versión gratuita está destinada a probadores invitados. Utiliza únicamente datos ficticios de obras. No introduzcas datos de clientes, documentos confidenciales ni datos personales de terceros.</p>
<h2>Qué tratamos y para qué</h2><p>Correo, identificador de cuenta y datos necesarios para autenticarte; obras, tareas, planificación, partes, incidencias, importes y registros que decidas introducir; información técnica de seguridad y soporte. Si activas notificaciones, se tratan los identificadores del dispositivo necesarios para enviarlas. El navegador puede guardar preferencias y la sesión. El tratamiento permite prestar la prueba solicitada y proteger su seguridad; la base es la relación de prueba cuando corresponda y el interés legítimo de seguridad.</p>
<h2>Proveedores y documentos</h2><p>Supabase aloja la base de datos en una región europea y gestiona el acceso. Los proveedores de alojamiento, correo de acceso y notificaciones procesan los datos necesarios para sus funciones. Los proveedores pueden operar desde otros países; la lista de proveedores y garantías se facilita a través del contacto de privacidad. Los originales de documentos no se almacenan en el paquete de prueba; el cliente conserva sus archivos. No se incorpora IA generativa en esta prueba, ni anuncios, ni suscripciones de pago.</p>
<h2>Privacidad de las obras</h2><p>Las cuentas están separadas mediante controles de acceso. El administrador técnico conserva capacidad potencial de intervención en la infraestructura, limitada a necesidades justificadas de seguridad y soporte. No se promete cifrado de extremo a extremo.</p>
<h2>Conservación y derechos</h2><p>Conservamos la cuenta y sus datos mientras participes en la prueba o hasta una solicitud de supresión aplicable. Al cerrar la prueba te informaremos de la exportación y eliminación. Los registros y copias técnicas solo se conservan durante los plazos necesarios o legalmente exigibles; puede existir un periodo residual en copias restringidas. La exportación JSON contiene datos sin cifrar: guárdala de forma privada. Puedes solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad cuando proceda, así como reclamar ante <a href="https://www.aepd.es/">la AEPD</a>.</p><p><a href="eliminar-cuenta.html">Solicitar eliminación de cuenta y datos</a>.</p>`)}
function deletion(c){return page('Eliminar mi cuenta y datos',`
<p>Responsable de TU CONTROLAS: ${c.name}.</p><p>Puedes solicitar la eliminación aunque ya no tengas instalada la aplicación. No es necesario volver a iniciar sesión.</p><ol><li>Si deseas conservar tu información, exporta tus datos desde la aplicación antes de pedir la baja.</li><li>Envía un correo desde la dirección asociada a tu cuenta a <a href="${c.deletionMail}">${c.email}</a> con el asunto «TU CONTROLAS - Eliminar mi cuenta».</li><li>Verificaremos que la cuenta te pertenece. Nunca te pediremos contraseña ni códigos de acceso por correo.</li><li>Una vez verificada la solicitud, eliminaremos la cuenta y los datos asociados, salvo los que debamos conservar legalmente o durante el ciclo necesario de copias restringidas. Te informaremos del resultado y de cualquier excepción aplicable.</li></ol><p>La solicitud se atenderá sin demora indebida y dentro de un mes, salvo ampliación legalmente justificada. Desinstalar la app no elimina la cuenta.</p><p><a href="privacidad.html">Consultar política de privacidad</a>.</p>`)}
function addLinks(html){
 const links='<p class="small" style="padding:12px 4px"><a href="privacidad.html">Privacidad</a> · <a href="eliminar-cuenta.html">Eliminar mi cuenta</a></p>';
 const menu='</nav></header>',login='<div id="loginStatus"';
 if(html.split(menu).length!==2||html.split(login).length!==2)throw Error('No se localiza acceso de privacidad: revisar plantilla.');
 return html.replace(menu,'<a href="privacidad.html">Privacidad</a><a href="eliminar-cuenta.html">Eliminar mi cuenta</a>'+menu).replace(login,links+login);
}
function build({root=__dirname,output=path.join(__dirname,'dist-commercial-play-beta'),env=process.env}={}){
 const c=settings(env);
 const result=B.build({root,output,env});
 const file=path.join(result.directory,'index.html');
 fs.writeFileSync(file,addLinks(fs.readFileSync(file,'utf8')));
 fs.writeFileSync(path.join(result.directory,'privacidad.html'),privacy(c));
 fs.writeFileSync(path.join(result.directory,'eliminar-cuenta.html'),deletion(c));
 return {...result,files:[...result.files,'privacidad.html','eliminar-cuenta.html']};
}
if(require.main===module){try{const r=build();console.log('Paquete web beta preparado. No publicado: '+r.directory)}catch(e){console.error('Beta bloqueada: '+e.message);process.exitCode=1}}
module.exports={settings,privacy,deletion,addLinks,build};
