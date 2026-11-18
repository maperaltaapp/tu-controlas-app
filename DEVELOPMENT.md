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

La modificación del 18/11/2026 sitúa el botón grande «Tareas de Gantt» junto a los contadores. Las tareas vinculadas pendientes se agrupan en Próximas conservando sus fechas reales. Las completadas siguen accesibles en Completadas. La vista específica del cronograma incluye contenedores, hojas e hitos y no crea copias al navegar.

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
