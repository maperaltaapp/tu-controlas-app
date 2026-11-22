# Auditoría de referencias entre clientes · 22/11/2026

## Riesgo controlado
Una política RLS que filtra por `user_id` **no garantiza por sí sola** que las claves foráneas referenciadas pertenezcan al mismo cliente. PostgreSQL puede comprobar una FK hacia la tabla de otro cliente sin revelar directamente esa fila.

La base actual ya incluye FKs compuestas `(work_id,user_id)` para obras vinculadas a tareas, partes, incidencias, checklist, asignación de subcontratas y planes. **No cambiarlas.**

Dos vínculos históricos de `public` usan FK simple: `elite_tasks.previous_task_id -> elite_tasks.id` y `elite_plan_versions.work_id -> elite_works.id`. El archivo `tenant-reference-constraints.sql` añade una FK compuesta de propietario para cada uno, evitando asociar registros de dos clientes.

## Comprobaciones sin datos privados
En la infraestructura existente se ejecutaron consultas de agregados (solo recuentos, sin contenido ni IDs de clientes):
- Predecesoras entre dos usuarios distintos: **0**.
- Revisiones de Gantt vinculadas a obra de otro usuario: **0**.
- También se revisaron referencias históricas de IA: **0** discrepancias agregadas; no se alteran esas tablas sin inventariar la aplicación laboral.

Los recuentos no demuestran que no exista un problema futuro: hacen falta las restricciones y pruebas A/B.

## Plan antes de aplicar en producción
1. Copia de seguridad de la base completa y comprobación de restauración en entorno de prueba. Ningún cambio a datos reales.
2. Ejecutar en un clon con datos ficticios `npm test`, incluyendo el nuevo test PGlite.
3. Validar la migración `tenant-reference-constraints.sql` en entorno Supabase de staging, con dos usuarios autenticados A/B; comprobar que rechaza referencias cruzadas y permite vínculos válidos propios.
4. Repetir preflight de conflictos agregados inmediatamente antes de ejecutar sobre producción, con franja de mantenimiento y plan para revertir DDL de forma controlada.
5. Aplicar una sola vez mediante una migración versionada de Supabase tras aprobación y backup; verificar `pg_constraint`, RLS, RPC, inicio de sesión, Gantt y tareas.
6. Si falla una prueba, no publicar modificaciones de frontend que dependan de la migración. La reversión de DDL requiere evaluar dependencias antes de eliminar constraints.

**Estado:** preparado y probado localmente solo cuando el CI esté en verde; **no ejecutado en Supabase real**. La versión comercial sigue bloqueada hasta demostrar aislamiento real y restauración.
