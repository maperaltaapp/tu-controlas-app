# Parte diario TC-046 · 20/11/2026

Formulario compacto de obra/fecha y múltiples actividades. Una única actividad prevista se propone; varias requieren elección y siempre se pueden elegir otras del Gantt. Sin cronograma se permite introducir el nombre de un trabajo manual, guardado solo en el parte. Una medición inexistente queda vacía y exige entrada. Cada actividad pide porcentaje acumulado, observaciones y número de operarios/máquinas. Sin importes, tarifas, jornales, duraciones, incidencias ni cálculos. El historial TC-020 permanece a un toque.

## Consistencia y conservación

Una RPC autenticada comprueba propiedad y revisiones, valida los campos y guarda parte, medición del día y tareas asociadas en una transacción. Actualiza el Panel a través de sus mediciones canónicas. No cambia nombres, fechas, duraciones, calendarios, línea base ni datos económicos. Una medición posterior prevalece sobre un parte atrasado. Corregir solo notas/recursos no pisa porcentajes cambiados desde Gantt; corregir un porcentaje en conflicto se rechaza. Una actividad terminada se reabre expresamente desde Gantt, sin borrar fin real desde Partes.

El formato anterior permanece íntegro en las mismas filas; su avance global no se atribuye a una actividad. Los datos antiguos se indican como conservados al editar. Las actividades históricas del parte no se retiran silenciosamente; si dejan de ser ejecutables, se consultan sin cambiarlas. Obras archivadas: consulta. Las escrituras directas del formato nuevo se rechazan para evitar medias actualizaciones.

## Validación

21 suites. Pruebas PostgreSQL/PGlite: varias actividades, porcentaje y tarea, línea base/fechas/economía intactas, parte atrasado, modificación posterior en Gantt, notas sin sobrescritura, rechazo de revisión obsoleta, unicidad por obra/día, excepción forzada después de guardar el Gantt con rollback completo, conservación de columnas antiguas, trabajo manual, idempotencia de instalación, denegación de escritura directa y aislamiento entre dos propietarios. Finalización al 100 % y corrección histórica que conserva el estado completado posterior.

Pruebas de interfaz: selección prevista única/múltiple, medición vacía cuando falta, carga obsoleta por navegación/sesión, payload RPC y normalización de timestamp al verificar. Navegador con base local ficticia a 390 px: formulario de cuatro datos, dos actividades en el mismo parte, persistencia y edición tras recargar; Gantt con 35 % y 80 % y Panel con agregado actualizado. Corrección verificada del adaptador QA que enviaba null como texto. Sin cambios de datos reales durante las pruebas. Android físico pendiente.

Inventario real previo a migración: cinco partes, hash de sus campos originales `21ad2d4a9607c334b503477d1469f07f`. Revisiones de planes: 167, 12 y 4. La instalación no reprograma ni modifica partes existentes. Las comprobaciones posteriores deben comparar los campos originales excluyendo las dos columnas nuevas.
