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

## Activación pendiente de autorización final

La implementación está preparada en esta rama; no se publicaron sus cambios visuales ni sus nuevas funciones durante esta revisión.

1. Aplicar `gantt-task-progress.sql`, `gantt-hierarchy-schema.sql`, `gantt-remove-activity.sql` y `gantt-contract-schema.sql` (esta última una sola vez). Confirmar RPCs, permisos y RLS.
2. Ejecutar la simulación autenticada `elite_reconcile_gantt(true)`, revisar el resultado y después `elite_reconcile_gantt(false)`. Opera solo sobre el usuario autenticado, bloquea revisiones durante la transacción, usa snapshots con copia de las tareas vinculadas, reutiliza candidatos únicos y rechaza coincidencias ambiguas. Si se repite, no vuelve a crear ni clasificar lo ya conciliado.
3. Previsión consultada el 18/11/2026: dos hojas sin vínculo y 25 tareas por clasificar como Gantt. Las dos hojas no tenían candidatos existentes con nombre/obra/fechas coincidentes. Recalcular al ejecutar porque el usuario sigue editando sus planes.
4. Integrar y publicar la interfaz; verificar despliegue y lectura autenticada. Mantener explícita la limitación de prueba en Android físico.
5. Actualizar el estado de los 19 puntos en el Excel solo después de su activación y verificación. El Excel se mantuvo sin modificar.

No se contrataron servicios ni se copiaron documentos de clientes. La única corrección ya aplicada en producción es el hotfix de completar/reabrir descrito arriba.
