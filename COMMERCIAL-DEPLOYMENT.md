# TU CONTROLAS V1 — Un único Supabase, con datos actuales conservados

**Decisión del propietario (24/11/2026): no crear ningún otro proyecto de Supabase. Mantener la cuenta y todas las obras que utiliza diariamente.**

La app actual `https://maperaltaapp.github.io/tu-controlas-app/` funciona con el proyecto existente, cuya referencia técnica es `vyswxgbbqyffnduhhrvz`. Actualmente figura en Supabase con el nombre visible histórico «App Obras Elite». **Ese nombre no define el producto ni la titularidad de los datos.** Es la única base que seguirá utilizando TU CONTROLAS.

## Qué está acordado

- **Conservar íntegros** cuentas, obras, tareas, Gantt, partes, costes, documentos heredados, políticas y credenciales operativas. No resetear, eliminar, pausar, transferir ni duplicar el proyecto.
- **Identidad comercial TU CONTROLAS.** Cambiar únicamente el nombre visible del proyecto en Supabase Dashboard, si el propietario lo desea, a través de `Settings → General`. El conector usado para el desarrollo **no ofrece una operación de renombrado**. No confundir el nombre visible con el **Project Reference ID**, la URL del API ni las claves.
- Para los futuros clientes, una sola infraestructura Supabase, protegida por RLS y pruebas A/B reales. **Tener RLS activada no certifica todavía el aislamiento de todos los endpoints y funciones.**
- **No renombrar por estética** tablas SQL `elite_*`, funciones RPC, buckets ni identificadores utilizados por la app: cambiar esos nombres sin plan completo rompería el trabajo diario.
- Mantener como datos del cliente los documentos. Existe un adjunto histórico dentro de Storage; no eliminarlo. Antes de comercializar, excluir subidas pesadas nuevas en el frontend comercial y preparar la gestión segura de referencias de archivos externos.
- No retirar por el nombre las Edge Functions heredadas (`elite-mail`, `elite-mcp`, `elite-notifications` y otra función de un proveedor ya retirado). Primero comprobar llamadas externas, permisos y dependencias; eliminarlas es una operación independiente y potencialmente disruptiva.

## Preparación del futuro acceso comercial, SIN otro Supabase

El script `commercial-build.cjs` es **opcional para el lanzamiento comercial posterior**. Construye un frontend estático separado por origen web, **obligatoriamente conectado al MISMO Supabase** existente. Protege las sesiones del nuevo dominio y omite en el paquete de publicación las pantallas y el código antiguo de correo laboral y subida de documentos.

Para ejecutarlo, configurar una URL HTTPS exclusiva y únicamente la **clave publicable** del proyecto actual; no guardar claves en Git ni exponer `service_role`:

```bash
TC_COMMERCIAL_SUPABASE_REF="vyswxgbbqyffnduhhrvz" \
TC_COMMERCIAL_PUBLISHABLE_KEY="<CLAVE_PUBLICABLE_DEL_MISMO_PROYECTO>" \
TC_COMMERCIAL_SITE_URL="https://<DOMINIO_COMERCIAL_INDEPENDIENTE>/" \
npm run build:commercial
```

La compilación **rechaza** otra referencia de Supabase y el origen actual de GitHub Pages. Genera `dist-commercial/` local; no crea tablas, usuarios, proyectos ni despliegues. Las sesiones del dominio actual permanecen intactas.

**No desplegar todavía para clientes reales.** La URL del nuevo frontend, los redireccionamientos Auth, las cabeceras de seguridad, los controles de documentos y el aislamiento multiusuario real deben verificarse antes del lanzamiento. Un dominio independiente aislará el almacenamiento de navegador, pero **no reemplaza** las políticas RLS ni crea una base diferente.

## Evidencias y bloqueos

- Proyecto Supabase actual identificado y saludable; ningún cambio de datos para esta decisión.
- Todas las tablas del esquema `public` tienen RLS activada, pero el asesor de seguridad señala procedimientos `SECURITY DEFINER` ejecutables por usuarios autenticados: requieren auditoría individual en el paso 7.
- El respaldo de exportación del cliente y la restauración segura siguen pendientes de verificarse como mecanismo de recuperación; no confiar en un cambio irreversible sin copia recuperable.
- Renombrado visual pendiente de intervención manual del propietario en el panel Supabase.
- Verificación con dos cuentas A/B, pruebas de navegación en Android físico/PC, RGPD y documentos privados aún bloquean la comercialización.

**Resultado del paso 6:** decisión de una sola base adoptada, código comercial coherente y conservación verificada de datos. No marcar cerrado hasta confirmar el nombre visible y las comprobaciones de no regresión. No ampliar la infraestructura.
