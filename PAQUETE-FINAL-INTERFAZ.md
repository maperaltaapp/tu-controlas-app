# Paquete final · 25/11/2026

Implementación de los siete puntos de la hoja «Paquete final», Plan de cierre V1.

1. Tareas: buscador de tareas/obras y prioridad; grupos conservados; Completadas y Eliminadas al pie, con recuperación existente.
2. Cabecera: sin campana, título de sección ni desplegable de marca; Calendario con texto y Ajustes. Recordatorios y capacidad accesibles desde Ajustes.
3. Calendario: Mes, Semana y Festivos; derecha avanza e izquierda retrocede; teclado en la cuadrícula para ordenador. Pellizco limitado a la cuadrícula, separado del desplazamiento y el cambio de periodo.
4. Navegación: controles y textos ampliados, ancho de escritorio aprovechado y accesos superiores conservados. Asistente de voz retirado.
5. Panel: OBRAS y Control Económico. Obras en tablas por estado, fechas y avance solo en ejecución. Costes por partidas editables en tabla; documentos y valores calculados son de solo lectura. Cambiar un total manual no vuelve a sumarlo. Curvas S de PV/AC, curva física y tendencia diferenciadas; indicadores sin duplicar importes. Copias en Ajustes. Calendario laboral mensual, nombre y reutilización desde otra obra, con propuesta de fechas antes de aplicar. El motivo de capacidad aparece si hay coincidencias que justificar.
6. Checklist: tipos visibles en varias filas, búsqueda de tarea/obra, tipos adicionales por obra, entrada directa a proveedores, filas y columnas editables, anchos por arrastre o teclado y escala exclusiva de tabla. Eliminar una columna la oculta y conserva sus valores; Recuperar columnas la devuelve. Eliminación de filas confirmada, revisiones y vínculos existentes conservados.
7. Partes: historial directo, búsqueda de obra y fechas; sin botones duplicados de alta o historial. + Parte continúa en cabecera; Incidencias mantiene su acceso.

## Esquema y conservación

`final-package-schema.sql` añade campos JSON nullable a tablas existentes y admite secciones personalizadas. Las tablas mantienen sus políticas RLS. La nueva RPC económica es SECURITY INVOKER, no accesible por anon, y comprueba cuenta, obra, fuentes y versión de importes. No se añaden documentos ni servicios de pago.

Migración `final_package_sheets_manual_costs` aplicada por separado antes de publicar el frontend. Se compararon recuentos y huellas de los campos anteriores: coinciden antes y después; no se reescribieron obras, filas ni proveedores. Los asesores de seguridad no añadieron avisos respecto al estado previo. No se corrigen ni se ocultan en este cambio los avisos de funciones privilegiadas anteriores o la configuración de contraseñas de Auth.

Las copias V3 incluyen los nuevos metadatos en las mismas 22 tablas. Se probó restaurar columnas, valores y nombre de calendario con la función instalada; una cuenta no afecta a otra. Los nuevos campos nullable admiten registros de copias anteriores.

## Evidencia y límites

- `TZ=UTC npm test`: batería completa con PostgreSQL local e identidades ficticias.
- Integración DOM de todos los scripts: arranque, edición de celdas, recuperación de columnas, costes manuales/importados, selección visual de un sábado laborable, propuesta sin escritura, Ajustes y rechazo de respuestas tardías de otra cuenta.
- Construcción comercial y verificación de recursos estáticos. `release-smoke.cjs` compara también los nuevos módulos con lo realmente publicado.
- Calendario y Gantt conservan las regresiones de zona horaria, gestos simulados, dependencias, aislamiento y línea base.

La revisión visual en navegador local no estuvo disponible. La publicación solicitada expresamente después de informar de ese límite se realiza con comprobación automática y DOM; no certifica Android físico ni preparación comercial. No marcar la prueba física como cerrada.

Reversión: revertir el frontend; mantener los campos nullable y la nueva RPC sin invocarla. No eliminar columnas, tipos ni valores guardados para revertir la interfaz.
