# Desarrollo de TU CONTROLAS

TU CONTROLAS es un producto profesional independiente de ChatGPT, preparado para varios clientes. El prototipo actual y el prefijo SQL histórico `elite_*` no cambian ese objetivo. No reutilizar instrucciones antiguas de uso exclusivamente personal.

## Datos y privacidad

- Una infraestructura Supabase del propietario del servicio; autenticación y RLS por propietario/cliente desde el principio. No usar `user_metadata` para autorizar.
- Usuarios, obras, tareas, Gantt, partes y costes son datos estructurados. Los documentos permanecen en Drive, PC o móvil de cada cliente; guardar únicamente sus referencias cuando corresponda.
- La administración habitual gestiona cuentas, suscripciones, consumo y funcionamiento técnico. No diseñar pantallas para consultar obras ajenas. El acceso técnico excepcional debe justificarse, limitarse y auditarse. El administrador de Supabase conserva capacidad técnica potencial; no prometer inaccesibilidad absoluta sin cifrado adicional.
- Mantener exportación y restauración individual como pendientes hasta implementarlas y probarlas. No afirmar que ya existen copias/restauración por cliente por disponer de snapshots del Gantt.
- Credenciales de servidor y claves OpenAI nunca van al navegador. La clave Supabase publicable del frontend requiere RLS; no equivale a una clave administrativa.

## Infraestructura y aislamiento de pruebas

Repositorio de este producto: `maperaltaapp/tu-controlas-app`. Proyecto Supabase configurado en el frontend: `vyswxgbbqyffnduhhrvz`. No cambiar otros repositorios, proyectos ni la aplicación laboral por asociación con el nombre histórico «Élite».

`npm run qa:gantt` usa PostgreSQL/PGlite local, identidades ficticias y una clave de prueba. La página generada utiliza su propio origen y una política que limita las conexiones a ese origen. Nunca cargar datos reales como fixtures públicos. `.gantt-qa-data` y `.gantt-qa-public` quedan fuera de Git.

No está certificada una separación física entre este proyecto Supabase y cualquier despliegue laboral que no se haya inventariado. No migrar, renombrar tablas ni extraer obras basándose solo en sus nombres. Cotejar titularidad y dependencias antes de una separación de infraestructura.

## Prioridad y cambios

El backlog vigente está en Drive, «TU CONTROLAS — Mejoras pendientes». Seguir sus prioridades, con incidencias críticas de acceso/datos primero y las instrucciones nuevas del propietario por encima de especificaciones anteriores. No marcar Verificado usando solo pruebas estáticas o una simulación táctil.

El botón grande «Tareas de Gantt» está junto a los contadores. Según la corrección del 19/11/2026, las tareas Gantt se excluyen únicamente de Próximas y su contador; Hoy y Vencidas conservan su clasificación por fecha. Las completadas siguen accesibles en Completadas. La vista específica del cronograma incluye contenedores, hojas e hitos y no crea copias al navegar.

La antigua bandeja de aprendizajes se retira de la interfaz y de sus consultas; sus tablas históricas permanecen intactas. La campana muestra avisos operativos reales. No confundirla con el asistente independiente de voz ni con una futura IA generativa.

## Sesiones

`auth-session.js` serializa renovaciones locales y entre pestañas mediante Web Locks cuando está disponible. Los navegadores anteriores disponen de una concesión breve de almacenamiento y recuperación de una rotación más reciente. La renovación tiene un tiempo máximo; no se rebajan las protecciones de reutilización de tokens del proveedor.

Ante una sesión no renovable se vuelve al acceso. Salir limpia primero la sesión y la vista local; la limpieza de notificaciones es posterior y no bloquea el acceso. Las respuestas antiguas no deben recuperar datos después de salir o cambiar de cuenta. No registrar tokens ni cuerpos de autenticación.

## Validación y publicación

1. Cambios reversibles en Git y migraciones controladas cuando hagan falta.
2. Ejecutar pruebas significativas de navegación, guardado/recarga, tareas, checklist, Gantt, aislamiento y sesión; probar el diseño móvil con datos ficticios.
3. Mantener explícito si no se ha comprobado Android físico. No usar producción como banco de pruebas.
4. Preparar y verificar todo antes de las operaciones de GitHub/Supabase. Agrupar al final las autorizaciones nativas necesarias; el propietario pide no formular preguntas de autorización por el chat.
5. Verificar despliegue y contenido publicado. Las notas antiguas de entregas anteriores son históricas, no el estado actual del producto.

## IA y costes

Priorizar herramientas básicas, simplicidad, privacidad y bajo coste. Comenzar con Supabase Free; no contratar Pro ni infraestructura adicional antes de necesitarlos. La IA futura utilizará OpenAI desde servidor, con consumo controlado; los clientes no necesitarán ChatGPT. No contratar créditos, ampliar plugins ni activar IA de pago por una mejora de interfaz. El plugin, el micrófono nuevo y el alquiler siguen la prioridad del backlog.

## Dependencias e impresión · 20/11/2026

`depends_on` conserva los identificadores de predecesoras. `dependency_links`, cuando existe, contiene exactamente un `{id,type,lag}` por identificador; `type` es FS o SS y `lag` un entero de −3660 a 3660 días laborables. Un plan antiguo sin ese campo mantiene FI y su demora común `lag_days`. No imponer metadatos nuevos a planes existentes al desplegar. Los dos extremos de un vínculo editan el mismo registro de la sucesora, sin invertir el signo.

`gantt-dependencies.sql` amplía los helpers privados y el validador canónico después de las migraciones de calendario y festivos. No añade permisos públicos ni modifica registros existentes. Conserva las RPC existentes y sus comprobaciones de autenticación, propiedad, revisión y capacidad. Antes de aplicarlo comparar las funciones desplegadas con la versión fuente para no sustituir cambios ajenos. Las fechas resultantes se validan también en PostgreSQL. La igualdad tras recargar compara los vínculos normalizados; no el orden de claves de JSONB.

`gantt-print.js` genera PDF vectorial local desde el plan guardado o desde una revisión contractual aprobada. No captura el DOM ni depende del scroll, filtros o zoom. La salida contractual toma solo nombre/fechas/hito aprobados y no reutiliza la ejecución interna. Las pruebas cubren cobertura por fila/periodo, páginas A3/A4 y estructura PDF; revisar también las páginas renderizadas y descargar desde la interfaz.

## Accesos rápidos e incidencias

`work-actions.js` toma el contexto de `selectedSection`, no de una obra recordada por otra herramienta. Las lecturas de apertura y guardado están protegidas por época de sesión, navegación y formulario vigente. La cabecera solo muestra la creación durante una sesión.

Aplicar `incidents-schema.sql` antes de publicar esta interfaz. Los partes originales se conservan; la copia de incidencias es idempotente por parte/posición y mantiene el JSON de evidencia. El vínculo opcional al parte usa clave compuesta por propietario y obra y solo anula `report_id` al eliminar el parte. No retirar la tabla al revertir la interfaz. Las incidencias nuevas permanecerían disponibles al volver al cliente compatible.

La ficha general de Empresa y la asignación por obra reutilizan `registry-schema.sql`; no duplicar la tabla del directorio ni confundir la asignación con condiciones contractuales por actividad. El rediseño completo del Parte y los filtros de fecha de su historial continúan pendientes. Ver `WORK-ACTIONS-REVIEW.md`.

## Parte diario por actividad

Aplicar `daily-report-activities.sql` después de Partes y las migraciones vigentes de Gantt, antes de cargar `daily-report.js`. La migración añade columnas con valores neutros, no migra porcentajes globales a actividades y no modifica registros ni planificación. La RPC bloquea por propietario, comprueba revisiones del parte y del plan y permite solo los cuatro datos físicos por actividad. Obtiene nombres/fechas/relaciones del plan bloqueado y reutiliza el guardado canónico; no admite presupuestos ni fechas del cliente. Un fallo posterior al guardado del plan revierte toda la transacción.

Las observaciones se sustituyen solo en la fecha del parte. Para editar porcentajes existentes se exige que su medición original no haya cambiado desde Gantt. Editar solo recursos u observaciones no pisa la medición. El estado actual deriva de la medición más reciente, incluidas las posteriores a un parte atrasado. Una actividad terminada requiere reapertura expresa en Gantt antes de reducir su avance actual; no se retiran fechas reales desde Partes. Se conservan actividades históricas desaparecidas y todos los campos del formato anterior. Obras archivadas se consultan sin edición.

El formulario no calcula costes. Las actividades manuales sin cronograma permanecen en el parte; no se inventan actividades de Gantt ni se atribuye su porcentaje a toda la obra. Las escrituras directas de partes del formato nuevo se rechazan: usar `elite_save_daily_activities`. La cuenta solo puede operar sus propias obras.

Reversión: conservar tabla, nuevas columnas y RPC. Una interfaz anterior puede consultar los registros, pero su guardado directo de partes nuevos será rechazado para evitar desincronización. No retirar las columnas ni volver a habilitar escrituras directas. Usar una revisión compatible para mantener la edición. Ver `DAILY-REPORT-REVIEW.md`.
