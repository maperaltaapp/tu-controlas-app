# TU CONTROLAS — Control de lanzamiento comercial

**Estado al 22/11/2026: NO APTO PARA COMERCIALIZACIÓN.** El hecho de incorporar exportación sin escritura no cierra los bloqueos siguientes.

Este registro distingue **código fusionado**, **funciones probadas localmente**, **despliegue público comprobado** y **apto para clientes reales**. Una prueba automatizada en PGlite no certifica que dos usuarios reales no puedan acceder a datos ajenos.

## 1. Separación de infraestructura: BLOQUEANTE (TC-010)

La aplicación actual apunta a Supabase `vyswxgbbqyffnduhhrvz`, cuyo nombre registrado es «App Obras Elite». La denominación histórica de tablas `elite_*` tampoco demuestra por sí sola que los datos sean compartidos, pero **la separación física respecto a sistemas laborales no ha sido certificada**.

**Aceptar solo si:** se identifica el proyecto comercial exclusivo, sus esquemas y titularidad; se reproducen tablas, políticas, funciones, índices y despliegues en entorno separado; se migran únicamente registros identificados como propios y con autorización; se prueba con cuentas ficticias y se verifica que ningún otro producto deja de funcionar. No reutilizar ni copiar datos laborales por asociación de nombres. La arquitectura mantiene **una sola infraestructura comercial multi-cliente**, no una por cliente.

El origen GitHub Pages `maperaltaapp.github.io` comparte almacenamiento de navegador entre rutas del mismo origen. `tc_session_v1` evita una colisión accidental de clave, pero no proporciona aislamiento de origen. **Para vender se exige origen/dominio exclusivo**, HTTPS, comprobación de cabeceras, recuperación de contraseña y renovación segura de sesión.

## 2. Seguridad de clientes: BLOQUEANTE (TC-008, TC-009, TC-023, TC-029)

Los tests SQL ficticios confirman RLS y rechazos de RPC seleccionadas; no equivalen a una prueba real de una cuenta A contra la B. Algunos procedimientos `SECURITY DEFINER` están permitidos para `authenticated` y necesitan revisión funcional completa. No habilitar acceso administrativo normal a obras ajenas. El propietario técnico de Supabase conserva acceso potencial: documentarlo honestamente.

**Aceptar solo si:** dos cuentas reales *de prueba* no comparten ninguna obra, tarea, contrato, parte, Gantt, coste, URL de documento, mensaje, consulta o archivo; pruebas de altas, lectura, modificación, eliminación, RPC, consultas filtradas, restauración y permisos de administrador. Auditoría de excepciones y acciones sensibles, separación de claves de servicio y controles de costes/abuso.

## 3. Datos y copias: EN DESARROLLO (TC-024, TC-025)

El desarrollo de exportación v2 utiliza 16 tablas estructuradas relacionadas con obras, tareas, Gantt, partes, subcontratas, calendarios e historial operativo. Excluye explícitamente tablas históricas de IA, push, credenciales y binarios. Las lecturas llevan filtro `user_id` más RLS y se abortan si cambia la cuenta. El JSON incluye SHA-256 para detectar alteración **accidental** (no autenticidad) y permite comprobar el archivo **localmente** antes de futuras restauraciones. La comprobación local revisa claves y referencias, sin enviar el archivo a servidores. **No es restaurable ni una copia transaccional certificada**. La función requiere pruebas reales de A/B y Android antes de marcarse verificada.

**Aceptar solo si:** exportación paginada en dos cuentas de prueba, cobertura y coherencia de datos, validación de tamaño; guardar el archivo en PC/Drive del cliente; diseñar e implementar un importador restaurador con vista previa, integridad, claves relacionadas, idempotencia, aislamiento, rollback, control de conflictos y ensayos reales de recuperación. No prometer restauración sin demostrarla.

## 4. Documentos: BLOQUEANTE

El código aún contiene lógica heredada para almacenar/descargar archivos desde un bucket Supabase `elite-work-files`. Esto **no coincide con la arquitectura comercial aprobada**: documentos de cada cliente en su Drive/PC/móvil, mientras Supabase mantiene solo referencias. No borrar archivos existentes ni deshabilitar flujos utilizados sin inventario y estrategia de migración.

**Aceptar solo si:** no se cargan documentos pesados en la infraestructura comercial, referencias privadas se comprueban con el propietario, y un cliente no puede acceder a enlaces ajenos. Aclarar límites de integración con Drive y permisos OAuth si se implementa.

## 5. Operación y producto: BLOQUEANTE

- Acceso estable: comprobar **en navegador y Android físico** credenciales válidas, recuperación por email, cierre de sesión, multi-pestaña, sesiones vencidas y conectividad. Los tests de PR #35 no sustituyen esa prueba.
- Contratación: registrar planes Free/Pago, facturación, impuestos, cancelación, cuotas y límites; sin pasarelas o costes de IA hasta necesitarse. La IA, si llega, pasa por backend con credenciales ocultas y control de consumo.
- Seguridad operativa: límite de uso por cliente, alertas, backups del plan contratado, procedimiento de incidentes, monitorización mínima y restauración comprobada.
- Calidad: escritorio y Android, Gantt, tareas, subcontratas, partes, impresión, conflictos, errores, tiempos de carga y recuperación ante fallos.
- Publicación: prueba de despliegue real, versión y procedimiento de reversión; autorización del propietario tras superar el control TC-054.

## 6. RGPD y condiciones: BLOQUEANTE

Elaborar y revisar aviso de privacidad, base jurídica, derechos de los clientes, plazos de conservación, seguridad, comunicación de incidentes, condiciones de servicio, encargados/subencargados (Supabase, eventual IA y hosting), transferencias internacionales aplicables y contratos pertinentes. Preparar los flujos de baja, exportación y supresión. La revisión legal debe ser específica al tratamiento real y no se sustituye por un texto genérico.

## Regla de decisión

**NO-GO** si falla un bloqueo anterior, aunque GitHub Actions muestre SUCCESS. **GO** únicamente cuando cada punto tenga evidencia, un responsable y una comprobación final reproducible. No usar usuarios u obras reales como banco de pruebas.

Fuentes de referencia: backlog Google Drive «TU CONTROLAS — Mejoras pendientes» y `DEVELOPMENT.md`. Este archivo no contiene secretos ni datos de obras.
