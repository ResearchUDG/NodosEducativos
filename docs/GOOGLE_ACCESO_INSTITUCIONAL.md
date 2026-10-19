# Google Sign-In: ingreso institucional por dominios exactos

Estado: v0.2.3, propuesta de parche local, pendiente de compilación e2e en el equipo del propietario.

## Contrato de seguridad

1. Google está habilitado en Firebase Console. El botón se implementa en `AuthPage.tsx` mediante `signInWithPopup`.
2. La aplicación valida tres señales tras la respuesta OAuth: `user.email` pertenece a `security/email-domains.json`, `user.emailVerified === true` y el email del proveedor `google.com` existe, pertenece a la misma lista exacta y coincide con el correo principal.
3. Si alguna comprobación falla, se ejecuta `signOut` y no se muestra el tablero ni el flujo de solicitud de acceso. Se almacena **solo un mensaje genérico** durante el cambio de sesión. `sendEmailVerification` **nunca** se invoca durante el flujo Google.
4. La verificación del dominio **no otorga** membresía ni rol; `access/{uid}` y las reglas de Firestore gobiernan el acceso final.
5. El formulario tradicional de correo y contraseña conserva su validación antes de crear la cuenta o enviar verificación o restablecimiento.
6. No se modifican `firestore.rules` ni colecciones en este parche.

## Limitación del plan Firebase Spark

`signInWithPopup` inicia autenticación **antes** de que el cliente pueda conocer el correo elegido. Por tanto, el rechazo en el navegador no garantiza evitar la creación de un registro sin rol en Firebase Authentication. No es un filtro preventivo del proveedor. El usuario rechazado no recibe permisos, contenido ni correos de verificación **emitidos por Nodos Educativos**. Un agente externo que invoque Firebase Auth directamente puede evitar comprobaciones del frontend: para bloquear cuentas ajenas **antes de su creación**, evaluar `beforeCreate`/`beforeSignIn` de Identity Platform con costes y gobernanza correspondientes.

## Cuenta administradora existente

**No** pulsar Google para entrar con la cuenta admin preexistente basada en contraseña hasta completar una vinculación deliberada y probada de identidades. No intentar solucionar duplicados manualmente editando UID. Es posible que los proveedores coincidan en una misma cuenta según la configuración Firebase, pero no se garantiza. La futura vinculación debe comprobar mismo correo institucional y misma identidad proveedora, preservar UID y documentar recuperación.

## Pruebas de aceptación

- [ ] Gmail personal → rechazo, sesión cerrada, sin publicación, sin correo de verificación enviado por la app.
- [ ] `usuario@alumnos.udg.mx.falso.com` → rechazo.
- [ ] Cuenta Google con UdeG autorizada y email verificado → solicita aprobación si no tiene rol.
- [ ] Cuenta sin email confirmado → rechazo sin enviar otro mensaje.
- [ ] Usuario con rol suspendido → sigue suspendido.
- [ ] Misma cuenta de contraseña admin → conserva UID; no activar Google hasta vinculación segura.
- [ ] Comprobar dominios autorizados en Firebase Authentication para desarrollo (`localhost`) y futuro Pages (`researchudg.github.io`).
- [ ] Comprobar que el popup es accesible, los errores se anuncian y no se crean perfiles Firestore para usuarios rechazados.

## Privacidad

Google/Firebase procesan datos de identidad, nombre y correo cuando la persona elige este método. Actualizar aviso antes de publicación, explicar proveedor, finalidad y retención.

Documentación técnica: https://firebase.google.com/docs/auth/web/google-signin y https://firebase.google.com/docs/auth/extend-with-blocking-functions
