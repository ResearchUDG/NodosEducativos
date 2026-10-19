# Checklist de activación de producción (bloqueante)

**Estado actual: NO AUTORIZADO PARA PUBLICACIÓN CON USUARIOS.** El workflow está inhibido mientras `LAUNCH_APPROVED` no sea `true`.

- [ ] `ResearchUDG` otorga permisos `write` a la integración GitHub apropiada o importa los archivos manualmente.
- [ ] Crear proyecto Firebase dedicado y registrar app web.
- [ ] Activar Authentication > Email/Password y plantilla de verificación y recuperación.
- [ ] Agregar el dominio `researchudg.github.io` a dominios autorizados en Authentication, cuando corresponda.
- [ ] Activar Cloud Firestore en modo producción y desplegar `firestore.rules` en proyecto CORRECTO (nunca con reglas abiertas).
- [ ] Correr `npm run check:rules` y emulador `npm run test:security`.
- [ ] Confirmar con la comunidad los dominios permitidos de `security/email-domains.json`.
- [ ] Configurar nombre/domicilio/contacto legal del responsable, periodo de conservación, ARCO y bases jurídicas para México.
- [ ] Definir y probar procedimiento de borrado total de cuenta + subcolecciones y retención.
- [ ] Definir si se permite auto-registro externo o se instala backend/Identity Platform para vetar altas.
- [ ] Decidir si se requiere verificación de matrícula activa y, si es así, integrar control institucional autorizado.
- [ ] Configurar App Check, alertas de presupuesto, límites y monitoreo de errores sin PII.
- [ ] Establecer permisos mínimos, 2FA, CODEOWNERS y reglas de protección de `main`.
- [ ] Guardar notas sensibles cero: Obsidian privado, sin credenciales ni datos personales.
- [ ] Generar y subir `package-lock.json`; sustituir `npm install` por `npm ci` en CI y deploy.
- [ ] Probar en iPad, móvil, escritorio y accesibilidad de teclado.
- [ ] En GitHub Settings > Pages establecer publicación con **GitHub Actions**.
- [ ] Añadir las `VITE_FIREBASE_*` como GitHub Actions **Variables** (config pública, no secretos).
- [ ] Crear el Environment `github-pages`, idealmente con aprobación para despliegues.
- [ ] Fijar variable `LAUNCH_APPROVED=true` **solo después** de todos los pasos.
- [ ] Verificar URL `https://researchudg.github.io/NodosEducativos/`.

## Para validar localmente (sin datos reales)
```bash
cp .env.example .env.local
npm install
npm run generate:rules
npm run check
npm run dev
```
La aplicación mostrará "Configuración pendiente" mientras `VITE_FIREBASE_*` estén vacías. **No simula un inicio de sesión funcional.**

## Primer despliegue de reglas
```bash
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore:rules --project ID_FIREBASE_REAL
```
No se provee ningún `projectId` real en el paquete; el administrador debe confirmar el destino.
