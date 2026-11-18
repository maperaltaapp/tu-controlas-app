# Gantt: revisión del 18/11/2026

Fuente: Google Sheets «TU CONTROLAS — Mejoras pendientes», pestaña Pendientes, leída sin modificar.

## Corrección aplicada al servicio

`gantt-completion-fix.sql` se aplicó en Supabase con la migración `fix_gantt_schedule_alias_and_task_reopening`.
Corrige el alias ausente de `gantt_schedule` y restaura el avance anterior al reabrir una tarea completada.
Se probó con la versión publicada del guardado, y en la base real con completar/reabrir dentro de una transacción revertida. El plan de comprobación conservó revisión 27 y su checksum original.

## Cambios preparados en esta rama

- TC011, TC049, TC050: selección explícita, menú de fila, asa de arrastre con umbral y previsualización, cancelación y eliminación con confirmación, conservación de descendientes e historial y archivo de tarea vinculada.
- TC012, TC013, TC014, TC047–TC048, TC051–TC053: escala legible, nombres abreviados, editor de predecesoras/sucesoras, columnas ajustables por usuario, cabecera fija, barra horizontal sincronizada, subtítulo de subcontrata y progreso de fila, cabecera compacta.
- TC042, TC045: vista solo de cronograma y última obra por usuario; cambio de obra protege cambios sin guardar.
- TC057–TC059: proyección «Tareas de Gantt» incluyendo grupos y hojas; sincronización transaccional; vinculación idempotente en guardado sin duplicar tareas ni modificar sus descripciones y etiquetas.
- TC035–TC036: versiones contractuales inmutables, con RLS, referencias fijas a hojas y comparación de ejecución sin doble cómputo. Vista de impresión/PDF.
- TC043: campana de avisos de capacidad basada en fechas/obras reales; «Está OK» persistido en la tabla existente; SHA-256 del contenido relevante invalida revisiones si cambia la planificación.

## Comprobaciones

`npm test` incluye las pruebas existentes de tareas, base de datos, planificación, panel e interacciones, más `test-gantt-sync.cjs` y `test-gantt-completion.cjs`.
Se verificaron en navegador de PC, sobre datos ficticios aislados: 35 actividades + contenedor, selección de fila, edición y lectura después de guardar, recarga, ajuste de columna y cuarta pestaña con 36 elementos y fechas de inicio/fin. Cabecera de fechas visible al llegar a las últimas filas y barra horizontal accesible.
La prueba de navegador usa un simulador de persistencia. La transacción real y RLS se verifican por separado con PostgreSQL/PGlite; esto no equivale a una prueba integral de la nueva interfaz contra Supabase.

## Pendientes antes de publicar esta interfaz

1. Probar arrastre continuo y cambio de posición final→primera, cancelación, zoom con dos dedos y desplazamiento en Android real; no hay dispositivo Android disponible en este entorno.
2. Verificar en navegador la aprobación/impresión contractual y campana con conflictos; las pruebas SQL cubren inmutabilidad, solapamiento y aislamiento de versiones.
3. Aplicar después de esa validación `gantt-task-progress.sql`, `gantt-hierarchy-schema.sql`, `gantt-remove-activity.sql` y la nueva `gantt-contract-schema.sql`. Las tres primeras sustituyen funciones; la contractual se ejecuta una sola vez.
4. Simular y revisar la reconciliación de las planificaciones existentes y después guardarlas mediante la RPC autenticada para clasificar tareas ya vinculadas y crear únicamente hojas sin vínculo. Preservar snapshots, baseline, contenido, mediciones y conteos. No se ejecutó esa migración de datos en producción.
5. Completar prueba integral de guardado/recarga/permisos de la nueva interfaz antes de merge/publicación. No marcar los 19 puntos como verificados en el Excel todavía.

La interfaz pública no se cambió en este trabajo. No se contrataron servicios ni se copiaron documentos de clientes.
