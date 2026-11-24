# TU CONTROLAS V1 — Expediente de privacidad y RGPD
**24/11/2026 · BORRADOR PARA REVISIÓN LEGAL Y TÉCNICA. NO PUBLICAR COMO AVISO VIGENTE.**
No contiene datos de clientes, secretos ni identidades privadas. No certifica cumplimiento. El servicio no está autorizado para venta.

## 1. Modelo y registro de tratamientos (art. 30 RGPD)
TU CONTROLAS administra el servicio, no las obras. El cliente profesional determina fines y medios del tratamiento de los datos de su obra y normalmente es responsable; TU CONTROLAS actúa como encargado según sus instrucciones. Para cuentas, seguridad del servicio, soporte propio y eventual facturación, TU CONTROLAS es responsable de sus tratamientos propios. Revisar el papel específico de cada cliente y proveedor.

| Tratamiento | Datos/interesados | Finalidad y base o instrucción | Destinatarios | Conservación |
|---|---|---|---|---|
| Alta y autenticación | Email, identificador, credenciales gestionadas por Auth, sesiones; usuarios | Prestación contractual (art. 6.1.b cuando corresponda al interesado); seguridad/interés legítimo documentado | Supabase Auth | Vigencia de cuenta; baja y bloqueo legal aplicable |
| Gestión de obras | Contactos, subcontratas, tareas, Gantt, partes, incidencias, importes y referencias documentales; trabajadores, representantes, proveedores | Instrucción del cliente responsable; no reutilizar para fines propios | Supabase, usuario autorizado | Según contrato e instrucciones del cliente |
| Soporte y seguridad | Ticket, contacto, identificadores técnicos, registros mínimos | Contrato o interés legítimo ponderado; investigación de incidentes | Personal técnico autorizado y proveedores necesarios | Calendario por aprobar |
| Notificaciones | Registro de dispositivo, endpoint push y claves técnicas | Avisos solicitados; permiso del dispositivo; permitir desactivar | Supabase y proveedor push del navegador | Hasta revocación, caducidad o baja; depuración por verificar |
| Facturación futura | Datos fiscales y de contacto | Obligación legal y contrato | Proveedores fiscales/pago por decidir | Plazos legales aplicables; no activo en V1 |
| IA generativa futura | Datos estrictamente necesarios para solicitud explícita | Determinar rol, base e instrucción antes de activar | Proveedor API por contratar | No activo en V1; evaluación independiente |

Evitar información sanitaria, biométrica, sindical, identificadores nacionales o datos de menores que no sean imprescindibles. No diseñar V1 para categorías especiales ni vigilancia de personas. Incidencias deben describirse minimizando nombres y detalles personales. Mantener registro de categorías de encargos, transferencias y medidas, no copiar contenido de obras al registro administrativo.

## 2. Texto base de aviso al usuario (no publicable hasta completar campos)
Responsable del servicio: [titular legal, NIF, domicilio y contacto de privacidad verificados]. Delegado de protección de datos, si resulta exigible: [contacto]. Tratamos los datos necesarios para gestionar tu cuenta, autenticarte, prestar soporte y proteger el servicio. Los datos de las obras se procesan para prestar el servicio conforme a las instrucciones de tu organización; no los usamos para publicidad, entrenamiento de modelos propios ni consulta comercial de obras ajenas.

La base de los tratamientos propios es la ejecución del contrato cuando proceda, las obligaciones legales aplicables y el interés legítimo de seguridad previa ponderación. Los datos identificativos y de acceso imprescindibles son necesarios para utilizar el servicio. Los proveedores y países de tratamiento y las garantías aplicables se especificarán en la lista de encargados aprobada. El proyecto de base de datos está en región UE; esto no garantiza ausencia de transferencias por soporte, telemetría o subencargados. Los documentos originales permanecen en los dispositivos o almacenamiento del cliente en el modelo comercial; se conservan referencias y los datos estructurados que confirme. La versión de uso interno contiene flujos históricos que no se ofrecerán a clientes sin inventario y revisión.

No hay acceso habitual del administrador a las obras. El administrador técnico de la infraestructura conserva capacidad potencial de acceso; todo acceso excepcional debe limitarse, justificarse y auditarse. No se promete cifrado de extremo a extremo. El servicio no incorpora IA generativa en V1; si se activa posteriormente se informará de los proveedores, datos, fines y garantías antes de enviar información. No se adoptan decisiones exclusivamente automatizadas con efectos jurídicos o similares en V1.

Conservación: mientras sea necesaria para la finalidad y conforme al calendario aprobado, las instrucciones del cliente y las obligaciones legales. Puedes solicitar acceso, rectificación, supresión, limitación, oposición, portabilidad cuando corresponda y retirar el consentimiento cuando sea la base aplicable mediante [canal verificado]. Las solicitudes relativas a una obra se canalizan al responsable correspondiente. Puedes reclamar ante la AEPD (https://www.aepd.es/).

## 3. Encargados y transferencias
- Supabase: base de datos, autenticación y componentes técnicos. Región actual eu-central-1. Verificar contrato/DPA, entidad contratada, lista vigente de subencargados, transferencias, SCC/adecuación y evaluación de garantías antes de abrir servicio. https://supabase.com/legal/customer-resources/data-processing-addendum ; https://supabase.com/legal/customer-resources/subprocessor-list ; https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- Hosting: GitHub Pages es prototipo actual; seleccionar y revisar hosting comercial, registros IP, DPA cuando corresponda, países y garantías.
- Push, proveedor de correo de autenticación y CDN: inventariar proveedores efectivos y revisar condiciones, datos, destinos y necesidad. Evitar CDN externo para componentes cuando sea viable; comprobar solicitudes de navegador.
- Drive/PC/móvil del cliente: no conectar su almacenamiento sin instrucción y autorización; el cliente gestiona sus archivos y permisos. No almacenar documentos pesados nuevos en Supabase comercial.
- OpenAI API: fuera de V1; no contratar ni activar por este expediente. Si se añade, revisar DPA, retención, transferencias, minimización y aviso previo.
- Mantener listado de proveedores, servicio, rol, país, DPA/versión, mecanismo de transferencia, fecha revisión y responsable. No afirmar que se han firmado acuerdos que no se han comprobado.

## 4. Acuerdo de encargo (art. 28) — base contractual por revisar
Objeto: alojamiento y tratamiento de datos de gestión de obras por cuenta del cliente; duración del contrato y cierre; naturaleza: recepción, almacenamiento, consulta, actualización, exportación y supresión según instrucciones. Categorías de datos e interesados del registro anterior. Cliente responsable garantiza instrucciones lícitas y atención a interesados; TU CONTROLAS trata únicamente instrucciones documentadas, incluidas transferencias, salvo obligación legal; notifica instrucciones presuntamente contrarias al RGPD; confidencialidad; seguridad art. 32; autorización de subencargados y obligaciones equivalentes; asistencia con derechos, incidentes, evaluación de impacto y consultas previas; devolución o supresión al finalizar a elección del cliente, excepto conservación legal; evidencias y auditorías razonables. Establecer anexos de seguridad, países, plazos, subencargados y contactos. No firmar ni aceptar este borrador en nombre de nadie.

## 5. Retención y bajas — propuesta, no automatizada
| Categoría | Regla propuesta para revisión |
|---|---|
| Datos operativos | Durante la prestación; al finalizar, ofrecer devolución/exportación y supresión según instrucciones y contrato. Proponer 30 días de ventana de exportación solo si acordado, sin impedir una solicitud válida anterior. |
| Soporte | 90 días tras resolución como objetivo de minimización; conservar más únicamente con justificación. |
| Registro de seguridad | 90 días como propuesta, salvo investigación o conservación legal justificada. No incluir contenido de obras ni tokens. |
| Copias de proveedor | Determinar plazo REAL del plan Supabase; no prometer borrado inmediato de respaldos. Restringir acceso y reaplicar supresiones si se restaura. |
| Datos sujetos a bloqueo | Aplicar art. 32 LOPDGDD cuando proceda, acceso estrictamente restringido durante prescripción y destrucción posterior. |
| Exportaciones del usuario | JSON sin cifrar; explicar almacenamiento privado y responsabilidad del cliente. Excluye documentos externos y credenciales. |

No ejecutar borrados de cuentas reales ni cron de purga en esta fase. No confundir archivar tarea con borrar datos personales. Implementar y probar inventario completo de eliminación (Auth, tablas, referencias, push, adjuntos históricos, copias) y recuperación sin resurrectar datos suprimidos. No borrar datos de otro propietario. Aprobar calendario antes de automatizar.

## 6. Procedimiento de derechos
1. Recibir solicitud por contacto verificado, registrar ID, fecha, alcance y tipo, sin duplicar documentos de identidad. Verificar identidad proporcionalmente; pedir datos adicionales solo si hay duda razonable.
2. Clasificar responsable/encargado; si afecta obras, remitir al cliente responsable y ayudar conforme a instrucciones. No revelar datos ajenos.
3. Responder sin dilación indebida y dentro de un mes; si procede ampliar hasta dos meses adicionales por complejidad o número, informar dentro del primer mes y justificar. Gratuito salvo excepciones legales.
4. Entregar exportación por medio privado; comprobar si los derechos de acceso o portabilidad necesitan datos adicionales a V3. Rectificar, restringir, limitar tratamiento o suprimir cuando legalmente proceda. Registrar decisión, evidencia mínima, bloqueo y notificación a destinatarios cuando corresponda.
5. Ensayar con cuentas ficticias: solicitud de acceso, rectificación, portabilidad, oposición, baja y restauración tras supresión; medir plazo, no reutilizar cuenta de trabajo.

## 7. Acceso técnico excepcional e incidentes
Acceso normal: solo gestión de cuentas, estado técnico y consumo; no visor global de obras. Acceso excepcional: ticket identificado, necesidad y proporcionalidad, alcance de cuenta/tiempo, autorización previa del cliente cuando proceda, aprobación documentada, identidad individual/MFA, mínimo privilegio, consulta mínima, expiración y revocación. Registrar quién/cuándo/por qué/qué alcance/resultado sin copiar contenido. En emergencia, documentar motivo y revisión posterior. Custodia separada de claves y registro no editable por quien interviene; revisar periódicamente. Esta política no equivale a una implementación auditada: faltan comprobaciones del mecanismo efectivo.
Ante incidente: contener y preservar evidencias, revocar sesiones/credenciales afectadas, delimitar alcance, documentar incluso si no se notifica, y avisar al cliente responsable sin dilación indebida cuando TU CONTROLAS sea encargado. Como responsable, notificar a autoridad competente cuando proceda dentro de 72 h desde conocimiento; comunicar sin dilación indebida a afectados cuando exista alto riesgo salvo excepción aplicable. Registrar decisión, plazos, acciones y revisión. No probar incidentes con información real.

## 8. Control previo a venta
- [ ] Identidad jurídica/contacto, DPD si obligatorio, aviso art. 13/14 según origen de datos, condiciones y contrato de encargo aprobados.
- [ ] Registro de tratamientos, ponderación de interés legítimo, evaluación de riesgos y necesidad de EIPD; realizar EIPD si alto riesgo.
- [ ] Contratos, subencargados, transferencias y calendario de retención confirmados.
- [ ] Derechos/baja con prueba de extremo a extremo; comprobar copias y supresión, sin afectar otros clientes.
- [ ] A/B real, auditoría de RPC, acceso excepcional y registros verificables, incidentes y seguridad de proveedor.
- [ ] Aviso visible antes del alta comercial, versionado y sin textos ficticios; información de almacenamiento local y notificaciones, consentimiento solo cuando corresponda; revisar LSSI y ausencia/presencia de cookies no necesarias.
- [ ] Validación legal española/europea del expediente; revisión al cambiar proveedor, funciones, datos o arquitectura.

## Fuentes oficiales
RGPD: https://eur-lex.europa.eu/eli/reg/2016/679/oj/spa (arts. 5, 6, 12–22, 25, 28, 30, 32–36, 44–49).
LOPDGDD: https://www.boe.es/eli/es/lo/2018/12/05/3
AEPD: https://www.aepd.es/derechos-y-deberes/cumplimiento-de-las-obligaciones
AEPD brechas: https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/brechas-de-datos-personales-notificacion

**Resultado:** documentación inicial preparada; paso 9 por probar/revisar, no cerrado. No activar altas comerciales, eliminación definitiva ni transferencias nuevas por este documento.
