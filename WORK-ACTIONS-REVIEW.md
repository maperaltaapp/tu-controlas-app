# Accesos rápidos e incidencias · 20/11/2026

Fuente de prioridad: TC-031, TC-032 y TC-044 del listado vigente en Drive, leído sin modificar sus estados.

## Cambios

Cuatro botones compactos de creación en la cabecera: Tarea, Parte, Incidencia y Empresa. Permanecen Calendario, campana y navegación inferior. La obra se toma de la pantalla visible, sin reutilizar accidentalmente la última obra de otra herramienta. Parte carga los registros actuales y abre el de hoy si ya existe para esa obra; el filtro de obra se conserva después de guardar. Las respuestas antiguas se ignoran al navegar, cambiar de acción o terminar la sesión.

Empresa permite elegir Subcontrata o Proveedor y abre su ficha general. Tras guardar y volver a leer, permite asignarla a la obra actual con empresa y obra preseleccionadas. Reutiliza el directorio y la relación existente por `contractor_id`; no crea otra ficha general al asignar. Las condiciones contractuales específicas por obra (TC-018) siguen pendientes.

Incidencias tiene registro y consulta propios, con obra, fecha, gravedad, estado, descripción, seguimiento y vínculo opcional a un parte. El guardado comprueba revisión y lectura posterior. No se ofrece borrado irreversible desde la interfaz. El formulario Parte deja de mostrar Incidencias y conserva los arrays antiguos al editar registros anteriores.

## Persistencia

`incidents-schema.sql` se aplica después de los esquemas de partes y registro existentes. Añade `elite_incidents`, con RLS por propietario y SELECT/INSERT/UPDATE autenticados; sin acceso anónimo ni DELETE del cliente. Las claves compuestas impiden relacionar obras o partes de otra cuenta. El historial usa los triggers ya existentes.

Las incidencias anteriores se copian de forma idempotente con el JSON original y un identificador de origen. No se modifica ningún parte original ni se borra su array. Eliminar un parte deja sus incidencias independientes y su evidencia original, anulando solo el vínculo al parte; eliminar expresamente la obra conserva la semántica de borrado de sus registros dependientes.

Inventario real previo: cinco partes y cero incidencias antiguas. No se han usado estos datos como fixtures de las pruebas ni se han modificado partes reales durante la preparación.

## Validación

Dieciocho suites incluyen ahora las incidencias y los accesos rápidos. PostgreSQL/PGlite: copia histórica idempotente, originales intactos, persistencia tras retirar parte de origen, restricciones de campos, guardados obsoletos, historial, ausencia de DELETE, claves y aislamiento entre cuentas. Se usa también el esquema de directorio real para comprobar la relación de empresa por obra.

Pruebas de navegación: obra de la pantalla actual, ausencia de contexto archivado, parte ya existente, navegación durante carga, acciones que compiten y cierre de sesión; los arrays históricos no se alteran al recoger el formulario.

Navegador con datos ficticios: incidencia creada, resuelta y recargada con el mismo identificador; ficha de proveedor guardada y asignada a obra; Parte de hoy reutilizado sin duplicarlo y sin campos de incidencia. A 390 × 844, los cuatro botones caben, Calendario/campana siguen visibles y la prueba de zoom/columna del Gantt pasa. No equivale a Android físico.

TC-046 y TC-020 (nuevo Parte diario e historial con filtros de fechas) son el siguiente bloque. Este cambio todavía conserva los datos y controles de recursos del Parte anterior, excepto Incidencias; no lo presenta como un Parte inteligente terminado.

## Historial TC-020 · publicado por separado

`report-history.js` añade accesos compactos a Nuevo parte e Historial, filtro de obra combinado con todas las fechas, un día o intervalo inclusivo. Admite límites abiertos, avisa de intervalos invertidos y mantiene disponibles obras archivadas con partes. No modifica filas al filtrar. El día concreto seleccionado se propone al crear; si hay un parte de esa obra/día, lo abre para editar. Los filtros se conservan al guardar y volver al historial y se limpian al cerrar sesión. Las respuestas obsoletas por navegación, cuenta o petición posterior no cambian la pantalla ni el caché.

Validación: 19 suites, filtros combinados y límites, orden estable, originales sin cambios, reutilización de partes, concurrencia de lectura y cierre de sesión. Navegador QA aislado: parte del 19/11 creado, reabierto con el mismo contexto, editado, recargado y consultado por día e intervalo. A 390 px, controles dentro de pantalla, contenido aprovecha el ancho y acceso Historial enfoca sin ocultarlo bajo la cabecera. No se han modificado partes reales ni esquema de base de datos. Android físico pendiente.

TC-046 (nuevo formulario inteligente y transacción con Gantt) continúa pendiente.

TC-046 queda desarrollado en `daily-report.js` y `daily-report-activities.sql`, con validación separada en `DAILY-REPORT-REVIEW.md`; las menciones anteriores a pendiente describen el alcance de las publicaciones previas.
