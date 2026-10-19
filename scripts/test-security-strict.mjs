import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Se ejecuta DENTRO de firebase emulators:exec, no despliega reglas.
// Vitest assertFails considera éxito cualquier PERMISSION_DENIED, incluso
// el producido por agotamiento de evaluaciones. Este script falla en ese caso.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('npm', ['run', 'test:security'], {
  cwd: appRoot,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const stdout = result.stdout || '';
const stderr = result.stderr || '';
process.stdout.write(stdout);
process.stderr.write(stderr);
const log = `${stdout}\n${stderr}`;
if (result.error) {
  console.error(`No se pudo ejecutar npm run test:security: ${result.error.message}`);
  process.exit(1);
}
if (/maximum of 1,?000 expressions|maximum of 1000 expressions|too many expressions|unable to evaluate the expression as the maximum/i.test(log)) {
  console.error('\nFALLO ESTRICTO: una regla agotó el límite de evaluaciones de Firestore. No desplegar.');
  process.exit(1);
}
if (result.status !== 0) {
  console.error('\nFALLO: no aprobaron las pruebas de reglas de Firestore.');
  process.exit(result.status || 1);
}
console.log('\nOK ESTRICTO: pruebas aprobadas, sin agotamiento de 1,000 expresiones.');
