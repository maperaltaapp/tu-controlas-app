# TU CONTROLAS — Control de actualizaciones y recuperación

## Regla antes de publicar
1. Trabajar en rama y PR; no hacer cambios directos en `main`.
2. Ejecutar `npm test` en un entorno de prueba con datos **ficticios**. La batería incluye autenticación, cierre de sesión, recuperación de acceso, persistencia de tareas/Gantt, RLS local y verificación estática de archivos.
3. Un merge solo se realiza tras autorización del propietario, QA en verde y evaluación del alcance.
4. Una migración de datos requiere respaldo previo, prueba en clon, validación de RLS y una reversión verificada. **No mezclar una migración con cambios de interfaz en un único despliegue**.
5. Tras cada push a `main`, el flujo `.github/workflows/qa.yml` comprueba los archivos **realmente publicados** en GitHub Pages: `node release-smoke.cjs`. Contrasta SHA-256 del HTML y 13 scripts públicos (14 recursos en total), rechazando archivos antiguos, 404 y contenido diferente; espera un tiempo limitado por la propagación.
6. No declarar un despliegue correcto si falla el control web. La verificación de archivos no significa que el inicio de sesión o la UX móvil funcionen: probar manualmente en un navegador real.
7. Confirmar en Android y PC: acceso con cuenta de prueba, recarga, cambio de cuenta, tareas, partes, Gantt, cierres de sesión, reconexión y restauración de un dato **de prueba**.
8. Registrar en Google Drive el commit de código, resultados QA, comprobación de Pages, pruebas físicas y resultado. No marcar «Verificado» si faltan evidencias.

## Si un cambio rompe el acceso
- No cambiar políticas RLS ni credenciales de producción para arreglar problemas visuales.
- Revisar los registros de Supabase Auth diferenciando `invalid_credentials` de problemas de red, de refresh, y de un recurso JS no desplegado.
- Mantener intacto el almacenamiento antiguo de sesión, no copiar tokens de una cuenta a otra.
- Priorizar un hotfix mínimo y regresión; nunca exponer tokens ni enviarlos a soporte.
- Abrir el PR del cambio problemático, localizar el commit de merge y preparar un **revert** controlado en una nueva rama. El `revert` del código es seguro solo si no dependía de migraciones de datos irreversibles.
- Verificar que `main`, GitHub Pages y las pruebas son coherentes antes de darlo por restablecido.

## Infraestructura y privacidad
- La base de datos actual es un prototipo. Debe inventariarse la relación con otros proyectos antiguos antes de separar la infraestructura.
- Para vender TU CONTROLAS: origen web propio, separación efectiva respecto a aplicaciones laborales, pruebas RLS con dos identidades reales independientes, mecanismo de exportación/restauración por cliente, comprobación de permisos de cada RPC, revisión RGPD y pruebas móviles.
- Las sesiones separadas por nombre en localStorage **no sustituyen** el aislamiento de origen ni el cifrado.
- El administrador técnico de Supabase conserva capacidad potencial de acceso; no prometer anonimato absoluto.
- Nunca introducir contraseñas de usuarios reales en GitHub Actions, ni registros de producción en fixtures o archivos públicos.

## Limites del verificador
`release-smoke.cjs` usa HTTPS público, sin autenticación. Comprueba recursos estáticos, no datos privados ni transacciones. Puede dar fallo transitorio durante la propagación; reintenta hasta el límite y luego deja el despliegue como **no verificado**. No ejecuta rollback automático.

## Control de acceso en GitHub (por configurar en ajustes)
La rama `main` debería exigir PR y el check `Estado de las pruebas automáticas` antes de aceptar merges. Los checks por sí solos **no bloquean** pushes directos sin reglas de protección en GitHub. También hay que comprobar que la fuente de GitHub Pages usa la rama/ruta esperada.
