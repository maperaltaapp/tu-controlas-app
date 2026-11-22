# Pruebas de privacidad de TU CONTROLAS con dos cuentas y un solo móvil

**Objetivo:** verificar que una cuenta A no puede leer ni modificar datos de B, y viceversa. Estas pruebas ayudan a detectar errores, pero no certifican por sí solas todas las APIs, RPC y operaciones privilegiadas. La comercialización sigue bloqueada hasta completar el control de seguridad y restauración.

## Preparación
- Utilizar **dos cuentas nuevas y distintas de prueba**, creadas con correos controlados por el propietario, nunca cuentas de clientes.
- En el mismo teléfono, abrir `https://maperaltaapp.github.io/tu-controlas-app/` en **Chrome normal para A** y **Firefox para B** (alternativa: Chrome de incógnito, sin cerrar la pestaña durante las comprobaciones). Las sesiones deben tener almacenamiento separado.
- Cada cuenta crea exclusivamente datos ficticios. No introducir nombres reales, precios confidenciales ni documentos.
- Registrar la fecha, versión/commit publicado, modelo de móvil, navegador y resultado de cada paso.

## Prueba 1 · Visibilidad
1. En A crear una obra `PRIVACIDAD-A-01` y una tarea `TAREA-A-01`; asignar fecha y añadir una nota ficticia.
2. En B crear `PRIVACIDAD-B-01` y `TAREA-B-01`, con fecha distinta.
3. En B comprobar Panel de Control, Tareas, Gantt, calendario, checklist, partes e historial: no debe aparecer **ningún** dato exclusivo de A. Repetir desde A respecto de B.
4. Los festivos oficiales compartidos sí pueden ser iguales; no son datos privados de cliente.

## Prueba 2 · Sesiones y cambios de cuenta
1. Cerrar sesión de A, recargar Chrome: obras/tareas de A deben desaparecer de pantalla hasta iniciar sesión de nuevo.
2. Iniciar sesión como B en el mismo navegador que antes tenía A: no deben quedar datos de A ni completarse peticiones antiguas con datos de la cuenta previa.
3. Abrir/cerrar la aplicación, recargar y comprobar la sesión vigente y el cambio de cuentas. Repetir A/B y comprobar los errores de red si se pierde la conexión.

## Prueba 3 · Exportaciones
1. En A entrar en Panel de Control → **Exportar mis datos** y guardar el JSON de prueba; usar **Verificar copia** sobre ese archivo con A.
2. Con B, seleccionar el archivo exportado por A: **debe rechazarlo por pertenecer a otra cuenta**. No debe subir el archivo ni modificar datos.
3. Hacer el procedimiento inverso con el archivo B. No activar ninguna restauración: aún no se ha implementado ni validado.

## Prueba 4 · Avisos del teléfono
1. Solo si se habilitan notificaciones y hay consentimiento, comprobar un aviso con nombre de tarea ficticio.
2. En la pantalla bloqueada debe verse **solo texto genérico**, nunca el nombre de obra/tarea ni la URL privada.
3. Al tocar el aviso debe abrir la aplicación sin revelar detalles de otra cuenta.

## Requisito de seguridad adicional (pendiente para staging)
Un técnico debe probar las llamadas HTTP directas a PostgREST, RPC de escritura, cambios de `user_id`, referencias entre clientes y archivos usando dos tokens de cuentas de ensayo diferentes. **Una interfaz sin datos ajenos no demuestra que la API no los exponga.** Ejecutar en entorno de staging independiente, con restauración y aislamiento verificables.

## Resultado y bloqueo
Registrar PASS/FAIL por escenario. Ante un solo FAIL de acceso cruzado, bloquear el lanzamiento y no seguir con cuentas reales. Una prueba de la misma persona en dos navegadores **sirve para verificar la separación**, pero no reemplaza una auditoría técnica externa ni la revisión RGPD.

No publicar capturas que incluyan contraseñas, códigos de recuperación ni tokens de autenticación.
