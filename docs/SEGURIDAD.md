# Seguridad del proyecto

**No publique reportes de vulnerabilidades explotables en GitHub Issues.** El propietario deberá habilitar "Private vulnerability reporting" o designar un correo oficial de seguridad ANTES de abrir la plataforma.

## Modelo inicial de amenazas
| Amenaza | Control actual | Pendiente |
| --- | --- | --- |
| Correo con `udg` falsificado | Dominios exactos, reglas de Firestore | Autoridad de afiliación activa si se exige |
| Correo UdeG sin verificar | `email_verified` en Security Rules | Políticas de revocación |
| Lectura de otro usuario | `request.auth.uid == uid` | Tests reales en emulador antes de producción |
| Registro externo por API Auth | Sin lectura/escritura Firestore | Bloqueo de alta del lado servidor |
| Consumo abusivo de cuota | Límites de documentos y reglas | App Check, límites, alertas, presupuesto |
| Cuenta robada | Firebase Auth, HTTPS | MFA admins, monitoreo y recuperación |
| Lectura de código frontend | Sin secretos en frontend | Revisión de dependencias |
| Fuga del vault | Fuera del repo público | Repositorio privado/backup cifrado |
| Borrado de cuenta incompleto | Se evita afirmar eliminación automática | Función backend de cascada + verificación |

## Criptografía
- HTTPS cifra el tránsito. Firebase cifra datos en reposo según su infraestructura.
- La validación no se "encripta": la autorización está basada en **token firmado** y reglas del servidor.
- La contraseña la recibe Firebase Authentication: jamás recopilarla en Firestore/Obsidian/logs. **Advertir que no reutilicen la contraseña de su correo institucional.**
- GitHub advierte que Pages no está destinado a transacciones sensibles; para una implementación más estricta, valorar Firebase Hosting y SSO institucional autorizado.
- No se implementa criptografía casera, hashing casero ni se ocultan valores `VITE_*` como si fueran secretos.
