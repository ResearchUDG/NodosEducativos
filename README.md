# Nodos Educativos · ResearchUDG

> **Estado:** prototipo preparado, todavía sin desplegar.

Plataforma de investigación con tablero de **esquemas conceptuales 2D**, React/TypeScript y Firebase. Estética propia en vino, arcilla y dorado, inspirada en estándares generales de legibilidad de interfaces corporativas. **No está afiliada oficialmente con la Universidad de Guadalajara ni con IBM.**

## Funciones implementadas en el código

- Registro e inicio de sesión mediante **correo y contraseña** gestionados por Firebase Authentication.
- Envío de verificación de correo y recuperación de contraseña.
- Lista explícita de dominios institucionales y reglas de Firestore generadas desde una única política.
- Acceso al perfil y esquemas **exclusivamente del dueño verificado**.
- Tablero de esquemas con cards que muestran vista de nodos, métricas y búsqueda.
- Editor 2D con drag-and-drop, conexiones, inspector de nodos, guardar, borrar y guía de lectura no destructiva.
- Interfaz responsive para escritorio, tableta y móvil; GitHub Pages mediante GitHub Actions.
- CI, pruebas de dominios, pruebas de reglas mediante emulador, Dependabot y plantillas de gobierno.

> **Estado:** los archivos están preparados, pero Firebase no está configurado, las pruebas completas requieren instalar dependencias y el repositorio de destino todavía no permite escritura desde la integración conectada. No se ha publicado ni hay autenticación real operativa hasta configurar Firebase y desplegar reglas.

## Comenzar

```bash
npm install
cp .env.example .env.local
# completar exclusivamente configuración pública VITE_FIREBASE_*
npm run check:rules
npm run test
npm run build
npm run dev
```

Para probar reglas con el emulador:

```bash
npx firebase emulators:exec --project nodos-educativos-rules-test --only firestore "npm run test:security"
```

## Seguridad y privacidad

**GitHub Pages es un hosting estático público** (salvo capacidades específicas de acceso empresarial). El código y los activos publicados son visibles para cualquier visitante; los perfiles y esquemas residen en Firestore y se protegen por reglas verificadas en el servicio. Un correo que simplemente contenga la palabra `udg` **no** es suficiente. El control actual tampoco garantiza matrícula activa.

**La aplicación SÍ procesa correo y metadatos necesarios.** El aviso provisional explica los límites; necesita representante/contacto legal, conservación y eliminación antes de abrir a usuarios.

## Documentación

- [Arquitectura y límites](docs/ARQUITECTURA.md)
- [Gobernanza y revisiones](docs/GOBERNANZA.md)
- [Modelo de amenazas](docs/SEGURIDAD.md)
- [Checklist para publicar](docs/LANZAMIENTO.md)
- [Contribuir](CONTRIBUTING.md)

## Obsidian

El vault de trabajo se entrega **separado del repositorio público**. No subirlo a este repositorio ni integrarlo en el build de GitHub Pages. Puede sincronizarse más adelante con un repositorio GitHub **privado** creado al efecto.
