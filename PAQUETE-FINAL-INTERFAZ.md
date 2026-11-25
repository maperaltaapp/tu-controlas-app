# Paquete final · Tareas, cabecera, Calendario y Partes

Cambios solicitados el 25/11/2026 en «Paquete final» del Plan de cierre V1.

- Tareas: buscador de tareas/obras con lupa y prioridad en una fila; grupos conservados; Completadas y Eliminadas al pie, con recuperación existente.
- Cabecera: marca sin desplegable ni título de sección; Calendario con texto y Ajustes; campana y asistente de voz retirados de la interfaz. Recordatorios y revisión de capacidad siguen disponibles desde Ajustes.
- Calendario: Mes, Semana y Festivos; gesto hacia la derecha avanza, izquierda retrocede; flechas del teclado en la cuadrícula para ordenador. El pellizco afecta solo a la cuadrícula. Un gesto con desplazamiento horizontal o dos dedos no cambia de periodo.
- Partes: historial directo, búsqueda por nombre de obra y filtros de todas las fechas, día o intervalo. Sin botones duplicados de nuevo parte o historial; + Parte permanece en cabecera. Se conserva el acceso a Incidencias.
- Copias: exportar, verificar, simular y recuperar se trasladan a Ajustes, con las validaciones existentes.

## Alcance y verificación

Cambios de interfaz sin migraciones ni escrituras sobre datos reales. Las pruebas usan identidades ficticias y PostgreSQL local. La batería se ejecuta con `TZ=UTC npm test`, igual que el entorno de CI; la suite del Calendario comprueba además cuatro zonas horarias. El editor rápido de tareas usa fixtures UTC, por lo que su ejecución aislada con otra zona del proceso no es válida.

La revisión visual local no se pudo completar: el navegador no permitió observar el entorno local. Android físico, presentación visual y gestos reales siguen pendientes. No marcar estas filas como cerradas ni publicar este bloque hasta superar la revisión visual indicada en RELEASE.md.

El punto 5 solo incorpora el traslado de copias a Ajustes; el Panel económico, la planilla de obras y los calendarios laborales reutilizables siguen pendientes. El punto 6 (Checklist editable tipo Excel) sigue pendiente. Este bloque no certifica preparación comercial.

Reversión: revertir el PR de interfaz; no requiere cambios de datos ni de esquema.
