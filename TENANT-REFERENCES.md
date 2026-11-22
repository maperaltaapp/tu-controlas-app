# Aislamiento entre clientes · refuerzo de claves de relación

**Objetivo:** una tarea predecesora debe pertenecer al mismo propietario que su tarea sucesora; una versión histórica del Gantt debe pertenecer al mismo propietario que la obra.

La migración `tenant-reference-constraints.sql` no elimina ni modifica filas. Introduce restricciones compuestas `(id,user_id)` y `(work_id,user_id)`, y ejecuta preflight dentro de una transacción atómica antes del cambio.

Comprobaciones del 22/11/2026: 208 tareas, 180 versiones de Gantt, cero referencias cruzadas existentes; ninguna de las dos claves de protección estaba presente. La misma migración se ha ejercitado con usuarios ficticios en PGlite. Validar CI en el commit final antes de fusionarla.

**Límites:** la restricción no sustituye las políticas RLS ni una prueba funcional de dos sesiones de Supabase reales. Para certificar multiinquilino hace falta un entorno de ensayo independiente. Aplicar en producción únicamente con preflight actualizado, registro de migración, verificación posterior de constraints y el estado de los datos.
