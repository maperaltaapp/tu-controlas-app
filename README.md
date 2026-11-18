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
