# Directorio de identidades legibles y programas académicos · v0.2.2

Este cambio es de experiencia de usuario. No modifica `firestore.rules`, las rutas existentes o las asignaciones de rol.

- El valor técnico del `<option>` continúa siendo el UID, pero la etiqueta visible es **nombre · correo · rol**.
- El administrador bootstrap se identifica con `auth.currentUser.email` y, opcionalmente, con el nombre de su perfil en `users/{uid}`.
- Las solicitudes en `accessRequests/{uid}` conservan nombre y correo tras su aprobación; el directorio administrativo las consulta para mostrar identidades, también de solicitudes ya aprobadas.
- Las solicitudes nuevas requieren nombre de presentación (2–90 caracteres), capturado de forma declarativa. Ese campo no acredita identidad legal ni cargo académico.
- Los grupos actuales siguen siendo `groups/{groupId}`; en pantalla representan **carreras y programas académicos** sin una jerarquía adicional.
- Si se creó un acceso manual sin `email` ni solicitud previa, no se muestra UID: aparecerá una etiqueta neutral de falta de perfil. Documentar una forma futura de completar ese directorio desde consola.

## Validación

1. `npm run check`.
2. `npx firebase emulators:exec --project nodos-educativos-rules-test --only firestore "npm run test:security"`.
3. Iniciar Vite y comprobar que las vistas de administrador no muestren un UID como nombre de cuenta.
4. Guardar un nombre en «Mi perfil» y pulsar «Actualizar» en el directorio.
5. Verificar etiquetas y marcadores de las carreras.

No se requiere `firebase deploy` para aplicar estas modificaciones locales. Para publicarlas en Pages más adelante se necesita un PR y el proceso de despliegue aprobado.
