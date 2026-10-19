# Política de gobernanza · Nodos Educativos

## Principios
- Código revisable, cambios pequeños, trazabilidad y mínima recopilación de datos.
- Prohibido guardar secretos, datos académicos de personas reales o documentos sensibles en issues, PR, commits, sitios estáticos o vault.
- Identidad de proyecto propia, sin afirmar afiliación oficial con la UdeG.
- Diseños inspirados en *principios generales* de interfaces empresariales, sin copiar marcas, logotipos, bibliotecas visuales o textos de IBM.

## Flujo de trabajo obligatorio
1. Crear Issue con objetivo, criterios de aceptación y riesgos.
2. Antes de implementar, revisar `Vault-Privado/08 - Bugs y lecciones/MOC - Bugs.md`.
3. Cambios de autenticación, permisos o datos: crear ADR en el vault y actualizar modelo de amenazas.
4. Rama `feat/...`, `fix/...` o `docs/...` desde `main`; PR pequeño.
5. Revisión de código, pruebas, pruebas visuales en móvil/tableta y emulador Firebase cuando aplique.
6. Aprobación del propietario y merge; acción de despliegue solo si `LAUNCH_APPROVED=true`.
7. Registrar resultado, documentación y lección aprendida en el vault privado.

## GitHub: activar manualmente por propietario
- Reglas de `main`: prohibir push directo, exigir PR, 1+ revisión, checks `quality` y `firestore-rules`, sin force-push, conversaciones resueltas.
- Exigir aprobación del CODEOWNER en `/security/`, `/firestore.rules`, `/.github/workflows/`.
- Habilitar secret scanning, Dependabot alerts y reportes privados de vulnerabilidades cuando estén disponibles.
- Environments `github-pages` con revisores requeridos si el plan lo permite; no activar `LAUNCH_APPROVED` hasta checklist de publicación.
- Pocas personas con permisos de administración; 2FA para colaboradores.

## Controles de datos
- Roles de Firebase por mínimo privilegio; separar proyecto dev y prod.
- No conectar un servicio account a la interfaz; no almacenar un `serviceAccount.json` en el repositorio.
- Exigir reglas Firestore desplegadas y testeadas ANTES de abrir la aplicación a usuarios.
- Mantener backups bajo control, calendario de retención y eliminación de datos antes del lanzamiento.
- Evaluar App Check, cuotas de consumo, alertas presupuestarias y rate limits.

## Definition of Done
- Función implementada, pruebas y revisión de seguridad pertinentes, despliegue verificable, documentación actualizada, problemas conocidos listados y plan de reversión.
