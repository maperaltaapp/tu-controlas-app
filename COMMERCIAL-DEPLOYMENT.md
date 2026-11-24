# TU CONTROLAS V1 — Separación de infraestructura comercial

**Estado: preparada la compilación aislada, sin activar aún el proyecto comercial ni desplegar un sitio público para clientes.**

El 24/11/2026 se verificó que el prototipo publicado `maperaltaapp.github.io/tu-controlas-app` usa un Supabase existente llamado «App Obras Elite». **No transferir, copiar ni borrar ninguna obra, parte, usuario, adjunto o coste de ese proyecto.** Las coincidencias de nombres de tablas no prueban titularidad de los datos.

## Decisiones técnicas

- Un **solo proyecto Supabase comercial**, vacío al comenzar, para todos los clientes de TU CONTROLAS. Aislamiento por cuenta/cliente con RLS y pruebas de permisos; no un proyecto por cliente.
- El proyecto comercial debe ser **distinto** del proyecto actual del prototipo/laboral; la app existente seguirá funcionando sin modificarse.
- El sitio comercial debe tener **origen HTTPS distinto** de `https://maperaltaapp.github.io`; usar otra ruta del mismo origen no aísla localStorage, Service Workers o políticas de navegador.
- Documentos en Drive/PC/móvil del cliente, no en Storage de Supabase. El compilador comercial **retira por completo** el código de subir/abrir/borrar adjuntos heredados; por ahora muestra un aviso. Los enlaces a documentos propios requieren diseño posterior con validación de propiedad.
- El código puede incluir en cliente la **clave publicable** (no es una contraseña de administrador); una clave service_role, secret o de OpenAI nunca debe entrar en el frontend.
- La app comercial se genera desde el mismo código fuente con `commercial-build.cjs` para facilitar actualizaciones; **no se publica en GitHub Pages actual**. El resultado generado no se sube a Git.

## Coste y elección de organización

La única organización conectada hoy es «Elite Eutomotive Proyects», plan Supabase **Free**, con un proyecto activo. La consulta de precio del 24/11/2026 devolvió **0 USD/mes** por crear otro proyecto en esa organización; la cotización puede variar. Supabase documenta hasta dos proyectos Free activos entre organizaciones donde el usuario es propietario o administrador.

**No se crea el segundo proyecto sin elegir expresamente la organización de destino.** Se puede usar la existente, si el propietario así lo prefiere, o preparar una organización comercial propia si está disponible. Un proyecto en organización distinta puede favorecer la administración separada, pero no elimina el acceso técnico del propietario del backend.

## Procedimiento técnico reproducible

1. Seleccionar la organización donde residirá TU CONTROLAS comercial, sin reutilizar la BD antigua. Consultar coste nuevamente; no asumir 0 € para decisiones futuras.
2. Crear **un proyecto comercial nuevo y vacío**, de preferencia en la región UE apropiada. Verificar estado saludable. Registrar su referencia y solo su clave publicable.
3. Desplegar el esquema base vigente del repositorio **en orden de dependencias**, revisar vistas/RPC/SECURITY DEFINER, políticas RLS, permisos, claves foráneas, triggers e índices, sin exportar registros laborales. Ejecutar advisor de seguridad y pruebas con cuentas ficticias A/B.
4. Generar el sitio estático comercial, sin grabar claves en Git:
   ```bash
   TC_COMMERCIAL_SUPABASE_REF="<REF_COMERCIAL>" \
   TC_COMMERCIAL_PUBLISHABLE_KEY="<SB_PUBLISHABLE_COMERCIAL>" \
   TC_COMMERCIAL_SITE_URL="https://<DOMINIO_COMERCIAL>/" \
   npm run build:commercial
   ```
   El comando crea `dist-commercial/` sin credenciales privadas. **Falla** si apunta al Supabase del prototipo, si el origen es GitHub Pages actual o si todavía conserva código de subida de archivos a Storage.
5. Desplegar el contenido de `dist-commercial/` con un hosting estático HTTPS de **origen independiente** (p. ej. Cloudflare Pages en un subdominio exclusivo; verificar condiciones actuales antes de usar). Configurar la URL del sitio y las redirecciones Auth **en el nuevo Supabase**. No exponer al cliente el OAuth de correo laboral ni la app antigua.
6. Validar sin datos reales: inicio y cierre de sesión, recuperación de contraseña, Tareas ↔ Gantt, Partes, Incidencias, Panel de Control, importación económica, exportación, permisos de referencias y caducidad de sesión. Probar cuentas A/B y teléfonos/PC, así como accesos directos a la API que intenten leer o modificar recursos ajenos.
7. Mantener **NO APTO PARA VENTA** hasta completar restauración individual, seguridad multi-tenant, documentos privados, RGPD y pruebas reales Android/PC. Conservar un procedimiento de rollback y copia recuperable.

## Límites

La compilación separa código desplegable, sesiones y origen esperado, **pero no configura servicios DNS, Hosting ni una BD por sí sola**. La tabla económica existente en el prototipo no demuestra que el comercial esté preparado. La facturación, los servicios de IA, push y documentos no deben habilitarse sin su evaluación y pruebas.

El plan activo sigue siendo solo la pestaña «Plan V1» de [Drive](https://docs.google.com/spreadsheets/d/13fnzMwmsr6D_sbq9igPaqkXHhBn6SmrGZwSv42YlL1Y/edit); las mejoras no bloqueantes están en «Después de V1».
