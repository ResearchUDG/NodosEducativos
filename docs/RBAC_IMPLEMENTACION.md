# Nodos Educativos · Gobernanza v0.2

**Estado:** actualización preparada; NO DESPLEGADA. No se permiten estudiantes reales hasta validar los tests.

## Definición de roles

- `admin`: directorio, solicitudes, autorizaciones `student/professor`, creación de grupos, membresías y sistemas propios. Nunca se autoprovisiona por email o aplicación.
- `professor`: laboratorio privado de sistemas 2D, publicación explícita hacia grupos a los que pertenece y retiro de sus propias publicaciones.
- `student`: biblioteca académica de los grupos asignados y visor 2D inmutable. Sin acceso a editor, nodos privados ni API de edición.
- Sin `access/{uid}` activo: solicitud pendiente; acceso denegado al contenido privado incluso con correo institucional verificado.

## Modelo mínimo de Firestore

| Ruta | Uso | Administración |
|---|---|---|
| `access/{uid}` | `role`, `active`, metadatos de asignación | Consola (primer admin), después admin desde la app para los demás |
| `accessRequests/{uid}` | Solicitud del usuario autenticado | Usuarios crean su propia solicitud; admin revisa |
| `groups/{groupId}` | Grupos de investigación | Admin |
| `memberships/{uid}/groups/{groupId}` | Acceso a grupos | Admin |
| `users/{uid}/diagrams/{diagramId}` | Sistema privado y editable de su autor | Profesor o admin que sea propietario |
| `groupPublications/{groupId}/diagrams/{diagramId}` | **Instantánea** visible al grupo | Autor profesor miembro del grupo, o admin |

Nunca conceder acceso a `users/{uid}/diagrams` por pertenecer a un grupo: solo puede verse lo expresamente publicado como instantánea independiente. La publicación debe actualizarse voluntariamente si cambia el borrador.

## Procedimiento de activación (orden obligatorio)

1. Copiar/respaldar código actual en local. Conservar `.env.local`, nunca adjuntarlo ni publicarlo.
2. Instalar el parche sin desplegar: extraer en `~/Projects/ResearchUDG/NodosEducativos-entrega`.
3. Ejecutar `cd app && npm run check`. Corregir cualquier fallo.
4. Ejecutar `npx firebase emulators:exec --project nodos-educativos-rules-test --only firestore 'npm run test:security'`. **Exigir todos los casos aprobados.**
5. En Firebase Console > Authentication > Usuarios, copiar el **UID exacto** de la cuenta que será administradora. No es la dirección de correo ni el nombre mostrado.
6. En Firebase Console > Firestore > Datos, crear la colección `access`; documento con identificador **UID exacto** y dos campos: `role` (string) = `admin` y `active` (boolean) = `true`. Esta creación debe realizarse desde el panel con permisos del dueño del proyecto, no desde el cliente.
7. Verificar en consola que el documento `access/{uid}` sea el correcto, sin conceder admin a otra cuenta.
8. Recién entonces, ejecutar `npx firebase deploy --only firestore:rules --project nodos-educativos-researchudg`. Esto **cambia los permisos de la base real**; hacerlo solamente con autorización y pruebas completas.
9. Reiniciar `npm run dev` y comprobar: admin ve el directorio; usuario nuevo hace solicitud; admin lo aprueba como estudiante; estudiante carece de editor; profesor publica un esquema a su grupo.
10. Mantener sitio sin publicar hasta verificar escenarios de revocación, error, recuperación de cuenta, privacidad, rendimiento y pruebas adicionales.

No compartir contraseñas, tokens, archivos `.env.local`, credenciales de service account ni códigos OAuth.

## Pruebas mínimas de aceptación

- Correo verificado sin rol = acceso pendiente, no acceso al tablero.
- Estudiante con rol, pero sin grupo = biblioteca vacía.
- Estudiante con grupo A no puede leer publicaciones del grupo B.
- Estudiante no puede escribir un documento de borrador ni una publicación, incluso mediante SDK directo.
- Profesor puede editar **solo sus propios** borradores, publicar solo a grupos asignados y retirar sus publicaciones.
- Profesor no puede concederse admin, ni editar roles, ni administrar grupos.
- Admin no puede crear un nuevo admin desde el navegador. Administradores adicionales solo vía proceso manual privilegiado.
- Suspender `access/{uid}` o revocar membresía bloquea lectura de grupos y publicaciones para esa persona.

## Riesgos restantes

- La interfaz no sustituye las reglas del servidor; se requiere una **auditoría de escritura**, pruebas de límites/tamaños, lectura de documentos maliciosos y revisión del modelo de privacidad antes de producción.
- El primer admin es provisionado manualmente, evitando secretos de servidor en GitHub Pages.
- Firebase Auth permite registrar una cuenta que aún no está autorizada: no obtiene acceso a datos privados por esa sola operación. Para impedir también la creación de cuentas sería necesario un backend privilegiado/Identity Platform.
- El campo `grantedBy` es trazabilidad funcional, **no bitácora de auditoría inmutable**. Una bitácora inmutable exige infraestructura adicional bajo control del servidor.
- Almacenar grandes sistemas como arrays en un documento tiene límites de Firestore; el diseño futuro debe dividir nodos/aristas en subcolecciones para sistemas masivos, no aumentar indiscriminadamente el máximo.
- `dev` sigue apuntando al proyecto real; crear proyectos **desarrollo y producción distintos** antes de incorporar terceros.
- GitHub Pages sirve públicamente el JavaScript y HTML; nunca aloje información confidencial dentro del bundle.
