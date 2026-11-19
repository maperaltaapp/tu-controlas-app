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

## Comprobaciones terminadas

- `npm test`: nueve suites de tareas, PostgreSQL/RLS, planificación, panel, interacciones, sincronización, completar/reabrir y PDF.
- Navegador PC conectado a PostgreSQL/PGlite mediante HTTP: 35 actividades + contenedor, edición, guardado/lectura posterior, recarga y versión contractual. Se conserva el motor y las funciones SQL del servicio; no se simula el guardado con arrays.
- Campana: conflicto real entre dos obras de prueba, revisión «Está OK» escrita y leída en PostgreSQL.
- Vista de 390 × 844 y eventos táctiles simulados: selección larga sin escritura, Escape, pellizco sin cambios de datos y arrastre con desplazamiento automático de última a primera. La RPC guardó el orden y se comprobaron jerarquía, fechas, dependencias, importes y mediciones conservados.
- PDF descargado desde la interfaz: texto extraído y comprobado. Incluye obra, revisión, aprobación, fechas aprobadas/actuales, avance y desviación. Prueba adicional de varias páginas y offsets PDF.
- Conciliación: simulación sin escritura, recuperación de un vínculo existente único, clasificación de tareas preservando notas/etiquetas, repetición sin nuevos cambios y aislamiento entre usuarios.
- Revisiones contractuales: no editables individualmente; la eliminación expresa de la obra puede eliminar también sus registros dependientes. El borrado de una actividad conserva las revisiones.
- Recursos: un cambio de orden o título no exige justificar otra vez la capacidad ya programada. Los cambios en fechas/asignaciones con conflicto siguen requiriendo justificación y quedan auditados. La clave de revisión de la campana cambia con los datos relevantes.

Los helpers reproducibles son `qa-gantt-server.cjs`, `qa-gantt-prepare.cjs` y `qa-gantt-mobile.html`. `npm run qa:gantt` prepara la página y levanta una base aislada con identidades ficticias. Los datos y el HTML generado están excluidos de Git. El ancho móvil y los eventos simulados no equivalen a un dispositivo Android físico. El entorno no permite esa comprobación física.

## Estado histórico de preparación · 18/11/2026

Los puntos siguientes describen la preparación inicial. La activación y publicación se completaron después, como se aclara al final.

1. Aplicar `gantt-task-progress.sql`, `gantt-hierarchy-schema.sql`, `gantt-remove-activity.sql` y `gantt-contract-schema.sql` (esta última una sola vez). Confirmar RPCs, permisos y RLS.
2. Ejecutar la simulación autenticada `elite_reconcile_gantt(true)`, revisar el resultado y después `elite_reconcile_gantt(false)`. Opera solo sobre el usuario autenticado, bloquea revisiones durante la transacción, usa snapshots con copia de las tareas vinculadas, reutiliza candidatos únicos y rechaza coincidencias ambiguas. Si se repite, no vuelve a crear ni clasificar lo ya conciliado.
3. Previsión consultada el 18/11/2026: dos hojas sin vínculo y 25 tareas por clasificar como Gantt. Las dos hojas no tenían candidatos existentes con nombre/obra/fechas coincidentes. Recalcular al ejecutar porque el usuario sigue editando sus planes.
4. Integrar y publicar la interfaz; verificar despliegue y lectura autenticada. Mantener explícita la limitación de prueba en Android físico.
5. Actualizar el estado de los 19 puntos en el Excel solo después de su activación y verificación. El Excel se mantuvo sin modificar.

No se contrataron servicios ni se copiaron documentos de clientes.

## Seguimiento · 19/11/2026

La entrega anterior está publicada en main (b39c7af, PR #15). Las funciones Gantt y las versiones contractuales se activaron el 18/11 y la conciliación del propietario quedó completada. El botón grande Tareas de Gantt y la agrupación en Próximas están publicados. Los estados del Excel siguen siendo anteriores a estas entregas: no interpretarlos como ausencia de implementación ni como verificación física Android.

Correcciones de esta revisión (TC-045, TC-049, TC-014 y regresiones):

- La campana se añade junto al Calendario, en lugar de sustituirlo.
- Actualizar un Gantt con borrador pide confirmar el descarte; cancelar o fallar la red conserva el borrador. Se ignoran lecturas de otra obra/sesión y lecturas anteriores a una edición o guardado concurrente. Una actualización válida descarta el historial Deshacer de una revisión anterior.
- Las versiones contractuales tardías no abren diálogos sobre otra obra, otra sesión o después de salir del Gantt.
- Abrir una actividad desde Tareas de Gantt quita filtros de búsqueda anteriores, selecciona la actividad y la desplaza hasta quedar visible.
- En edición completa, cambiar Inicio con dependencias ajusta la demora automáticamente si no se modificó explícitamente. El inicio anterior a las predecesoras se rechaza; la reprogramación de sucesoras sigue mostrando su confirmación.

Pruebas: doce suites, incluidos casos diferidos de carrera entre obras/sesiones/ediciones. En navegador con PostgreSQL local se comprobó Calendario, apertura de última actividad, rechazo por capacidad, cancelación del descarte y fecha manual guardada/recargada con su nueva demora. Las pruebas usan identidades y datos ficticios; no se prueban escrituras sobre obras reales.

No se requiere migración SQL ni modificación de registros de Supabase para este bloque. Android físico continúa sin comprobarse. La prueba de gestos simulados y el ancho móvil no certifican ese punto del Excel.

El arrastre usa tiempo transcurrido para el desplazamiento automático, con paso acotado al equivalente de 250 ms, evitando que un navegador lento avance solo 12 px por fotograma. El ensayo táctil informa la posición si falla y cancela su arrastre de prueba incluso ante una excepción. La cabecera móvil se compacta para conservar marca, Calendario y campana en una línea.

## TC-014 y TC-063 · calendario laboral compartido

Lectura actual de Drive del 19/11: TC-014 incorpora una sola fecha de inicio y actividades por duración, con Fin–Inicio por defecto; TC-063 incorpora calendario por obra. La instrucción directa añade visibilidad de festivos en el calendario y recalcular el Gantt al cambiarlo.

Implementación: `work-calendar.js` (motor puro), `gantt-calendar.js` (formularios/calendario/Gantt), `gantt-working-calendar.sql` (columna, validación, RPC atómica, guardia y sincronización de tareas). No se modifican datos por instalar la migración. No se activan automáticamente calendarios de obras existentes; requieren revisar y aplicar la propuesta. Los festivos son manuales, con nombre y excepciones por obra.

Evidencia local: actividad creada solo con nombre y dos días laborables, del 27/11 al 30/11. Al añadir 30/11 como no laborable desde Calendario se mostró propuesta y el final pasó a 01/12, con duración, vínculo y Tareas conservados tras actualizar. Festivo 23/11 visible por nombre en mes y rayado en Gantt. Trece suites completas aprobadas, incluida creación de Gantt vacío con ancla única, regresión de planes legacy, aislamiento entre cuentas y protección de línea base/snapshots.

Reversión: revertir el commit de frontend; la columna nullable puede mantenerse, sin borrar calendarios ni versiones. Un plan ya activado debe seguir usando un cliente compatible con días laborables; el servidor rechaza fechas incompatibles de clientes antiguos. No borrar la columna ni desactivar la guardia para forzar guardados.

## Corrección solicitada: festivos comunes y excepciones de obra

El Calendario principal ya no selecciona obra ni presenta configuración laboral. Muestra los festivos comunes y el botón «Festivos», con edición del mismo día desde su etiqueta. La base 2026 tiene los 12 festivos del Decreto 100/2025; la base 2027, los 12 de BOE-A-2026-21254 para la Comunitat Valenciana. No se incluyen fiestas municipales de Valencia ni se proyectan fechas no verificadas a otros años.

Fuentes verificadas el 19/11/2026:
- https://dogv.gva.es/datos/2025/07/07/pdf/2025_24690_es.pdf
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-21254

`shared-holidays.js` combina los festivos de la cuenta con `local_exceptions` de cada obra. Las excepciones de obra prevalecen para esa obra. La configuración de semana, inicio y excepciones particulares permanece dentro del Gantt. Las actividades nuevas heredan los festivos sin configurar previamente el calendario. Los planes anteriores a esta función se adaptan al guardar; al incorporar festivos comunes a un plan sin calendario se conserva su semana de siete días, su duración y sus dependencias; la semana se puede ajustar específicamente dentro del Gantt.

`gantt-shared-holidays.sql` añade una tabla con SELECT y RLS por propietario, y una RPC que genera una vista previa o actualiza todos los planes activos de la cuenta en una única transacción. Compara revisión de festivos y conjunto completo de revisiones de planes; comprueba la capacidad sobre el resultado combinado y exige motivo si introduce coincidencias. Conserva las líneas base, fechas reales, tareas completadas, identidades de tareas e historial. Los planes archivados conservan su registro histórico. Los helpers y el núcleo anterior de sincronización quedan privados, sin EXECUTE para clientes. La RPC pública conserva las verificaciones de autenticación, propiedad y revisión.

Validación: catorce suites, incluyendo herencia oficial, edición/eliminación global, excepciones por obra, creación sin configuración manual, fechas de tareas, línea base/historial, tareas completadas, reversión total ante fallo intermedio, revisiones obsoletas, aislamiento entre cuentas, permisos y capacidad final (incluido motivo nulo). Prueba del flujo en vista móvil con dos obras ficticias; no equivale a Android físico.

## Cabecera fija, nombres adaptables y tareas separadas

El Gantt ocupa el alto disponible entre la marca superior y la navegación inferior. Sus controles permanecen fuera del desplazamiento; solo se desplazan las filas y la cabecera de columnas queda fija dentro del cronograma. Se elimina la barra horizontal duplicada y el cálculo de alto basado en una posición de página que podía ser negativa.

Actividad conserva el nombre completo en el DOM y lo recorta visualmente según el ancho disponible, sin limitarlo a dos palabras. Se puede ampliar también en móvil, con preferencia independiente y espacio reservado para el cronograma. El ancho se puede cambiar también con teclado y el foco se conserva en su separador.

Las tareas vinculadas al Gantt no aparecen ni se cuentan en Próximas. Se conservan en su botón propio y el filtro por tipo abre esa vista; Completadas y Archivadas mantienen su comportamiento. No hay migración ni escrituras sobre obras o tareas para estos cambios.
