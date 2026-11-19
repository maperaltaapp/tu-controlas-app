# TU CONTROLAS

Aplicación de gestión de obras: https://maperaltaapp.github.io/tu-controlas-app/

Producto profesional independiente de ChatGPT, con datos estructurados en Supabase y acceso por propietario mediante autenticación y RLS. Los documentos del cliente permanecen en su Drive, PC o móvil. La arquitectura y los límites vigentes se describen en [DEVELOPMENT.md](DEVELOPMENT.md).

## Herramientas actuales

- Tareas, búsqueda, obra, prioridad y tipo; vistas Activas, Completadas y Archivadas. Checklist con fecha se refleja desde el mismo registro.
- Botón grande «Tareas de Gantt» junto a Hoy, Vencidas, Próximas y Sin fecha. Las tareas vinculadas pendientes se agrupan en Próximas con sus fechas originales.
- Gantt con tres niveles, dependencias, selección y arrastre explícitos, fechas y tareas sincronizadas, snapshots, línea base y revisiones contractuales con PDF.
- Campana de capacidad basada en obras y fechas, con revisión persistida «Está OK».
- Panel de obra, checklist, directorio, partes e historial existentes. Los indicadores económicos sin fuente identificada se muestran sin datos; no se inventan costes ni ingresos.
- Notificaciones push por dispositivo. El dictado existente no equivale a IA generativa.

La antigua bandeja de aprendizajes ya no forma parte de la interfaz; sus registros históricos no se borran. La IA generativa, la monetización y otras ampliaciones del backlog continúan pendientes.

## Pruebas

`npm test` ejecuta las regresiones de tareas, PostgreSQL/RLS, planificación, panel, sincronización, PDF, sesiones concurrentes y retirada de la bandeja antigua.

`npm run qa:gantt` prepara un entorno aislado con base PostgreSQL/PGlite e identidades ficticias para revisar navegador, escritura/recarga y diseño móvil. La página de prueba se conecta solo a su origen. Los datos de prueba y archivos generados no se suben al repositorio.

Las comprobaciones a ancho móvil y los eventos táctiles simulados no sustituyen una prueba en Android físico. El producto todavía requiere completar y verificar el resto del backlog antes de comercializarse.

## Calendario laboral y duración (TC-014 / TC-063)

Cada obra puede activar su calendario desde Gantt → Calendario laboral o Calendario → Días laborables y festivos. Se indica una fecha inicial, los días habituales de trabajo y las excepciones fechadas (festivo/no laborable o jornada especial laborable). Los festivos se introducen expresamente; no se supone la localidad ni se descargan calendarios oficiales.

Tras configurarlo, + Actividad pide nombre y duración laborable. Vincula por defecto con la actividad ejecutable anterior (Fin–Inicio); las excepciones permiten trabajo paralelo. El calendario muestra los días por nombre y el Gantt los raya. Cambiar el calendario presenta las fechas afectadas y, al aplicar, sincroniza calendario, Gantt y Tareas en una transacción.

Los planes existentes conservan sus fechas hasta que se activa su calendario con una propuesta revisada. La primera adaptación convierte sus duraciones naturales actuales en duraciones laborables sin imponer nuevos vínculos. Las actividades terminadas, fechas reales, mediciones y líneas base se conservan. La nueva columna no activa ni reprograma obras por el mero despliegue. Las funciones de servidor validan las fechas con el mismo algoritmo, bloquean escrituras directas de fechas vinculadas desde Tareas y mantienen el aislamiento por propietario.

`npm test` incluye trece suites. `test-work-calendar.cjs` contrasta JavaScript con PostgreSQL y prueba festivos, sábados excepcionales, duración, cadenas, paralelos, ciclos, año bisiesto, cambio de año, rollback, snapshots, línea base, completar/reabrir y aislamiento. La comprobación de interfaz usa una base local con datos ficticios. Android físico sigue pendiente.
