import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(resolve(root, 'security/email-domains.json'), 'utf8'));
const domains = source.domains;
if (!Array.isArray(domains) || domains.length === 0 || domains.some((s) => typeof s !== 'string' || !/^[a-z0-9.-]+$/.test(s))) {
  throw new Error('La lista institucional debe ser una lista de dominios explícitos.');
}
const escaped = domains.map((domain) => domain.replaceAll('.', '\\\\.')).join('|');
const baseRules = readFileSync(resolve(root, 'security/rules-body.txt'), 'utf8');
const policy = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Generado desde security/email-domains.json y security/rules-body.txt.
    // No editar firestore.rules directamente.
    function institutionalUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email is string
        && request.auth.token.email.matches('^[^@]+@(${escaped})$');
    }
${baseRules}  }
}
`;
const destination = resolve(root, 'firestore.rules');
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== policy) throw new Error('firestore.rules no coincide con la política de dominios. Ejecute npm run generate:rules');
  process.stdout.write('Reglas sincronizadas con los dominios institucionales.\n');
} else {
  writeFileSync(destination, policy);
  process.stdout.write('Reglas generadas.\n');
}
