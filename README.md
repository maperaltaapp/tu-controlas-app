# TU CONTROLAS

Aplicación de gestión de obras: https://maperaltaapp.github.io/tu-controlas-app/

Producto profesional independiente de ChatGPT, con datos estructurados en Supabase y acceso por propietario mediante autenticación y RLS. Los documentos del cliente permanecen en su Drive, PC o móvil. La arquitectura y los límites vigentes se describen en [DEVELOPMENT.md](DEVELOPMENT.md).

## Herramientas actuales

- Cabecera con accesos compactos a Tarea, Parte, Incidencia y Empresa; Calendario y campana permanecen visibles.
- Parte diario por actividad con avance acumulado, observaciones, operarios y máquinas; selección prevista por día y guardado conjunto con Gantt/Tareas. Los recursos no calculan costes y los datos anteriores se conservan.
- Partes con accesos compactos a Nuevo parte e Historial, filtros combinados por obra y día o intervalo, y reapertura del parte existente sin duplicarlo.
- Incidencias independientes de Partes, con seguimiento, filtros por obra/estado y conservación de las antiguas.
- Tareas, búsqueda, obra, prioridad y tipo; vistas Activas, Completadas y Archivadas. Checklist con fecha se refleja desde el mismo registro.
- Grupo «Tareas de Gantt» dentro del listado Activas, con filas normales, filtros comunes y fechas canónicas. Las actividades vinculadas no se duplican en los otros grupos activos. Las hojas e hitos se completan con casilla; los contenedores son referencias sin casilla. Las completadas aparecen en Completadas con su vínculo intacto.
- Gantt con tres niveles, dependencias, selección y arrastre explícitos, fechas y tareas sincronizadas, snapshots, línea base y revisiones contractuales con PDF.
- Plan de cliente con fechas independientes del interno, propuestas guardadas sin aprobación y revisiones aprobadas inmutables. Al reabrir una actividad se recupera su avance anterior o se solicita uno explícito; no se inventa 0 %.
- Campana de capacidad basada en obras y fechas, con revisión persistida «Está OK».
- Panel de obra, checklist, directorio, partes e historial existentes. Los indicadores económicos sin fuente identificada se muestran sin datos; no se inventan costes ni ingresos.
- Notificaciones push por dispositivo. El dictado existente no equivale a IA generativa.

La antigua bandeja de aprendizajes ya no forma parte de la interfaz; sus registros históricos no se borran. La IA generativa, la monetización y otras ampliaciones del backlog continúan pendientes.

## Pruebas

`npm test` ejecuta las regresiones de tareas, PostgreSQL/RLS, planificación, panel, sincronización, PDF, sesiones concurrentes y retirada de la bandeja antigua.

`npm run qa:gantt` prepara un entorno aislado con base PostgreSQL/PGlite e identidades ficticias para revisar navegador, escritura/recarga y diseño móvil. La página de prueba se conecta solo a su origen. Los datos de prueba y archivos generados no se suben al repositorio.

Las comprobaciones a ancho móvil y los eventos táctiles simulados no sustituyen una prueba en Android físico. El producto todavía requiere completar y verificar el resto del backlog antes de comercializarse.

## Calendario laboral y duración (TC-014 / TC-063)

Las obras nuevas heredan los festivos comunes. Gantt → Calendario laboral permite cambiar la semana de trabajo y las excepciones de esa obra; Calendario → Festivos edita los días compartidos por todas las obras de la cuenta.

+ Actividad pide nombre y duración laborable y vincula por defecto con la actividad ejecutable anterior mediante Fin–Inicio sin espera. Dependencias permite Fin–Inicio (FI) o Inicio–Inicio (II), con desfase negativo, cero o positivo para cada vínculo, desde Predecesoras o Sucesoras. Ambos extremos editan la misma relación. FI 0 comienza en la siguiente jornada tras el fin inclusivo; II 0 solicita el mismo inicio, sujeto a las demás restricciones. La vista previa advierte si otra predecesora impide esa simultaneidad. Reordenar no crea ni modifica vínculos.

El calendario, los festivos y las dependencias usan días laborables. Las actividades completadas, fechas reales, mediciones, línea base e historial se conservan. Una migración de código no reprograma obras por sí sola. Los guardados comprueban revisión, fechas, permisos y sincronización transaccional con Tareas.

Imprimir / PDF genera el cronograma guardado en A3 o A4 horizontal, completo o para un intervalo, con ajuste de todo el periodo o escala diaria/semanal/mensual. La paginación repite cabeceras y conserva nombres completos, fechas, duraciones, barras, hitos y vínculos. La versión interna puede incluir avance y subcontrata. La contractual utiliza exclusivamente la revisión aprobada, sin datos económicos ni empresas internas. Se genera en el dispositivo; no se envía ningún documento a otro servicio.

`npm test` incluye veintiuna suites. Las comprobaciones en navegador usan PostgreSQL/PGlite con datos ficticios y una vista móvil de 390 × 844. Android físico sigue pendiente.

### Festivos comunes

Calendario muestra los festivos de España aplicables a la Comunidad Valenciana (base oficial 2026 y 2027), sin selector de obra. «Festivos» permite añadir, modificar o quitar un día y revisar el efecto antes de guardar todos los Gantt y tareas de la cuenta en una operación. Cada Gantt mantiene su semana laboral y sus excepciones propias, que prevalecen sobre el calendario común. Las nuevas obras heredan la base sin configuración previa. No se añaden por defecto fiestas municipales ni se adivinan otros años.

Aplicar `gantt-shared-holidays.sql` después de `gantt-working-calendar.sql` y `gantt-dependencies.sql` después de ambos antes de publicar el frontend. La instalación no modifica las fechas de planes existentes; su adopción se hace mediante la RPC con vista previa o al guardar un plan desde el cliente actual. No retirar la migración mientras haya calendarios con metadatos de herencia; volver al frontend anterior requiere conservar sus archivos JS y revisar esta compatibilidad. Ver fuentes, pruebas y límites en `GANTT-REVIEW.md`.
