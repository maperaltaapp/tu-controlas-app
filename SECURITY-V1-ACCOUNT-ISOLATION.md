# TU CONTROLAS — Seguridad multiusuario V1 (paso 7)

Auditoría técnica del 24/11/2026. Estado PARCIAL: todavía NO APTO para comercialización.

## Entorno comprobado

- Supabase: TU CONTROLAS, único proyecto existente y ACTIVE_HEALTHY. Misma referencia, sin migraciones.
- Datos iniciales: 1 cuenta, 8 obras, 217 tareas, 3 Gantt, 6 partes diarios.
- Solo SQL de lectura dentro de transacciones READ ONLY, con identidad original y otra identidad simulada. No se crearon usuarios, ni se modificaron datos, claves, funciones, tablas o sesiones de producción.

## Aislamiento RLS probado en producción, solo lectura

1. Rol authenticated sin identidad JWT: 0 obras, 0 tareas, 0 Gantt, 0 partes y 0 costes visibles.
2. Rol authenticated con identidad de la cuenta propietaria: 8 obras, 217 tareas, 3 Gantt y 6 partes visibles.
3. Rol authenticated con UUID ficticio que no existe en Auth: 0 filas en las 23 tablas de lectura directa, incluidas obras, tareas, Gantt, partes, incidencias, costes, subcontratas, calendario, historial y aprendizaje.
4. Inventario de esquema: 24 tablas public con RLS activada. Las 23 accesibles directamente a authenticated tienen predicados de propietario. La tabla de entregas push no concede SELECT a authenticated. Ninguna tabla pública concede SELECT directo al rol anon.

Estas pruebas NO sustituyen el inicio de sesión real de una segunda cuenta. Tampoco verifican escritura, JWT emitidos, RPC/Edge, rutas Storage, restauración o dispositivos.

## SECURITY DEFINER

El asesor de Supabase detecta 11 RPC ejecutables por authenticated como SECURITY DEFINER. Las once contienen auth.uid(), referencias user_id y search_path explícito; no prueba ausencia de defectos lógicos. Los procedimientos Gantt, partes, borrado, calendario y contratos son utilizados por la aplicación y no se deben revocar sin pruebas.

La prueba test-client-isolation.cjs ahora inspecciona dinámicamente todas las tablas públicas con permisos SELECT autenticados; sus fixtures de PostgreSQL local prueban A/B, referencias cruzadas y RPC de obra ajena. No escriben datos reales.

## Funciones Edge y advertencias

- El gateway MCP usa OAuth propio y contexto RLS. Aunque la plataforma no valida JWT automáticamente en ese endpoint, sí tiene middleware de autenticación; auditar su configuración antes de ofrecerlo a clientes.
- Avisos push: backend con acceso administrativo restringido para entregas y cron; requiere prueba de autorización y destinatarios.
- Correo heredado: conexión de cuenta específica, no ofrecer como función de clientes comerciales.
- Un endpoint del proveedor de tareas retirado devuelve 410; no desactivar sin revisar dependencias.
- Supabase recomienda activar protección contra contraseñas filtradas. Esta opción requiere revisión en Auth Settings y no se ha cambiado mediante este conector.

## Bloqueantes del paso 7

- Crear dos cuentas reales de prueba A/B, autenticar por separado y verificar lectura, escritura, borrado, RPC, sesiones expiradas, cambios de cuenta y documentos sobre una única infraestructura.
- Auditar funcionalmente las 11 RPC elevadas, las funciones Edge y cualquier excepción de administración técnica.
- Comprobar no divulgación de datos tras logout, refresco de tokens, restauración y acceso directo a API.
- Completar las pruebas Android/PC, RGPD y recuperación individual antes de comercializar.

El mismo móvil se puede usar con dos cuentas en perfiles/sesiones independientes, pero conviene también disponer de PC u otro dispositivo. Mantener estado POR PROBAR; la cuenta operativa y todos los datos actuales se conservan.
