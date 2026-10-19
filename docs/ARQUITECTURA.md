# Arquitectura y fronteras de confianza

## Publicación
- GitHub Pages sirve **solo** `dist/` (HTML/JS/CSS públicos); no es un servidor de autorización.
- `HashRouter` evita errores 404 de rutas profundas en Pages.
- `base: '/NodosEducativos/'` corresponde al nombre exacto del repositorio.
- Ninguna decisión de autorización depende de ocultar rutas o código.

## Identidad
- Firebase Authentication gestiona correo + contraseña, recuperación y verificación.
- En el cliente se realiza validación de conveniencia del dominio.
- En Firestore se requiere **simultáneamente**: ID token válido, `email_verified=true`, dominio explícito del correo y UID del propietario.
- Dominios fuente única: `security/email-domains.json`, de donde se genera `firestore.rules`.
- **Límite:** Firebase Auth de plan base admite altas externas al dominio usando su API pública; esas cuentas no obtienen acceso a Firestore. Para impedir incluso la **creación** de cuentas fuera de dominio hace falta bloqueo de registro en un backend confiable o Identity Platform blocking functions, sujeto a plan y presupuesto.
- Un correo verificado con dominio UdeG **no acredita inscripción activa ni afiliación oficial**.

## Datos
- `users/{uid}`: `{displayName, privacyVersion, createdAt, updatedAt}`.
- `users/{uid}/diagrams/{diagramId}`: `{title, description, nodes, edges, createdAt, updatedAt}`.
- Las lecturas/escrituras de diagramas son **solo del propietario** en la fase inicial.
- No existen esquemas globales, equipos, roles admin o publicaciones compartidas todavía.
- Máximo 80 nodos y 160 conexiones por documento (validación de reglas y cliente); no almacenar datos sensibles.

## Límites de la protección
- Los datos en Firebase están sujetos a cifrado en tránsito y en reposo provisto por la plataforma. **No es cifrado de extremo a extremo**: el proveedor/administradores autorizados pueden tener acceso bajo sus controles.
- La clave web de Firebase es configuración pública; no protege los datos.
- Reglas de Firestore controlan lectura/escritura. App Check puede reducir abuso automatizado, pero no sustituye reglas.
- La captura de correos reales, métricas, copias y eliminación requieren evaluación jurídica adicional.

## Capas futuras
1. Compartición privada con membresía validada en backend y roles granularizados.
2. Edición colaborativa con control de conflictos/revisiones.
3. Exportación a Markdown/Obsidian, JSON y SVG.
4. Administración, borrado integral de cuentas y datos por backend confiable.
5. Auditoría de operaciones sin registrar contenido personal.
