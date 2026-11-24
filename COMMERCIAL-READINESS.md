# TU CONTROLAS — Control de lanzamiento comercial

**Estado al 24/11/2026: NO APTO PARA COMERCIALIZACIÓN.** El hecho de incorporar exportación sin escritura no cierra los bloqueos siguientes.

Este registro distingue **código fusionado**, **funciones probadas localmente**, **despliegue público comprobado** y **apto para clientes reales**. Una prueba automatizada en PGlite no certifica que dos usuarios reales no puedan acceder a datos ajenos.

## 1. Infraestructura única TU CONTROLAS: IDENTIDAD VERIFICADA (TC-010)

**Decisión 24/11/2026:** conservar el único proyecto Supabase existente (referencia `vyswxgbbqyffnduhhrvz`) y todos los registros de la cuenta que utiliza TU CONTROLAS diariamente. **NO crear otro proyecto, NO migrar obras, NO borrar datos, NO cambiar las URLs ni las claves del frontend.** El 24/11 se verificó mediante el listado de proyectos que el único proyecto tiene el nombre visible «TU CONTROLAS», conserva la referencia indicada y está ACTIVE_HEALTHY. Un cambio de nombre visible no exige modificar las tablas técnicas `elite_*`.

**Condiciones de aceptación:** comprobar después del renombrado visual que la referencia del proyecto y los datos permanecen iguales, y que la cuenta entra y trabaja con Tareas, Gantt, Partes e Incidencias sin interrupciones. Inventariar por separado las Edge Functions históricas y adjuntos existentes; no eliminarlos por su nombre. Mantener un solo proyecto Supabase para los múltiples clientes y aplicar RLS comprobada, sin confundir prefijos heredados con aislamiento de usuarios.

**Antes de vender:** habilitar un origen HTTPS exclusivo para clientes, independiente de `maperaltaapp.github.io`, usando el **mismo proyecto Supabase**. El paquete `commercial-build.cjs` excluye el código de subidas pesadas y páginas de correo laboral, aísla el almacenamiento de sesiones y rechaza que se configure otra base. No desplegar a clientes hasta probar permisos A/B, OAuth, restauración, documentos, RGPD y servicio técnico. El proyecto actual no cambia mientras tanto.

## 2. Seguridad de clientes: BLOQUEANTE (TC-008, TC-009, TC-023, TC-029)

Los tests SQL ficticios confirman RLS y rechazos de RPC seleccionadas; no equivalen a una prueba real de una cuenta A contra la B. Algunos procedimientos `SECURITY DEFINER` están permitidos para `authenticated` y necesitan revisión funcional completa. No habilitar acceso administrativo normal a obras ajenas. El propietario técnico de Supabase conserva acceso potencial: documentarlo honestamente.

**Aceptar solo si:** dos cuentas reales *de prueba* no comparten ninguna obra, tarea, contrato, parte, Gantt, coste, URL de documento, mensaje, consulta o archivo; pruebas de altas, lectura, modificación, eliminación, RPC, consultas filtradas, restauración y permisos de administrador. Auditoría de excepciones y acciones sensibles, separación de claves de servicio y controles de costes/abuso.

## 3. Datos y copias: EXPORTACIÓN V3 CONSISTENTE PUBLICADA / RESTAURACIÓN CONTROLADA EN PRUEBAS (TC-024, TC-025)

La **exportación V3** ya opera en TU CONTROLAS sobre un único Supabase: una RPC `tc_export_owner_v3` de lectura con `SECURITY INVOKER` y RLS entrega una instantánea SQL coherente de **22 tablas** del usuario, incluyendo costes, obras, tareas, Gantt, partes, contratistas, registros de IA e historiales. No incluye contraseñas, tokens, suscripciones push ni documentos externos (que permanecen en Drive/PC/móvil del cliente). El archivo JSON se descarga **sin cifrar** y su SHA-256 protege contra modificaciones accidentales, no certifica al emisor. Sigue siendo responsabilidad del cliente guardarlo en una ubicación privada. El esquema V2 de 16 tablas se puede inspeccionar como legado, pero es incompleto para recuperación general.

En Obras están **Exportar mis datos, Verificar copia y Simular recuperación**. La simulación lee el JSON, revisa integridad, claves y si existen datos en la cuenta; **no realiza escrituras**. La V3 no se convierte automáticamente en una restauración disponible: recuperar datos necesita controles de claves foráneas, concurrencia, secuencias e historiales.

**Estado comprobado el 24/11:** PR #71 fusionada, QA de GitHub Actions nº 128 correcta; `tc_restore_empty_owner_v3(jsonb)` está instalada y ejecutable por authenticated, no por anon. La UI permite recuperación de una cuenta vacía con confirmaciones. Las pruebas PGlite A/B no equivalen a una prueba real. El SQL instalado comprueba recuentos y regenera cuatro IDs históricos globales. El borrador anterior `restore-empty-owner-v3.sql` no debe desplegarse en su lugar.

**Refuerzo propuesto, no desplegado:** comprobación de igualdad de todos los campos de todas las filas salvo los cuatro IDs históricos regenerados; rollback si un trigger altera el contenido sin variar los recuentos; rechazo de metadatos de propietario ausentes. La rama `qa/step8-exact-restore-verification` incorpora la regresión de modificación de un coste y comprueba que no quede ninguna fila del cliente restaurado. No fusionar ni aplicar SQL en producción hasta QA verde y revisión de la compatibilidad con el esquema real.

**Criterio de cierre:** restauración real individual verificada con dos usuarios A/B y datos de ejemplo, sin pérdida de registros ni interferencia en otro cliente; bloqueo de sobreescritura, aceptación de fallos, idempotencia y rollback exactos; comprobar accesos físicos en PC y Android. Hasta entonces V1 no se comercializa.

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

Consulta el [Plan priorizado de Drive](https://docs.google.com/spreadsheets/d/1bQD7XW5TgsmCUm1sfJwDpaaE6TLEy8KcsHPT4yTAYWA/edit#gid=1462274091). Las pruebas físicas y de dos cuentas distintas en el mismo móvil se documentan en `PRUEBAS-PRIVACIDAD-DOS-CUENTAS.md`; las pruebas de lectura bajo identidad sintética no reemplazan ensayos autenticados reales.

## Regla de decisión

**NO-GO** si falla un bloqueo anterior, aunque GitHub Actions muestre SUCCESS. **GO** únicamente cuando cada punto tenga evidencia, un responsable y una comprobación final reproducible. No usar usuarios u obras reales como banco de pruebas.

Fuentes de referencia: backlog Google Drive «TU CONTROLAS — Mejoras pendientes» y `DEVELOPMENT.md`. Este archivo no contiene secretos ni datos de obras.
