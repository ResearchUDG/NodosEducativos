import { isInstitutionalEmail, normalizeEmail } from './policy';

/**
 * Filtrado de interfaz, NO un sustituto de las reglas de Firestore ni de
 * funciones de bloqueo de Identity Platform. Nunca concede roles.
 *
 * Un inicio Google no necesita sendEmailVerification: el proveedor informa
 * si la dirección ya fue verificada.
 */
export function validateGoogleIdentity(
  firebaseEmail: string | null,
  firebaseVerified: boolean,
  googleProviderEmail: string | null,
): string | null {
  if (!firebaseEmail || !isInstitutionalEmail(firebaseEmail)) {
    return 'Acceso rechazado: utilice una cuenta Google con un dominio institucional UdeG autorizado.';
  }
  if (!firebaseVerified) {
    return 'Google no confirmó la verificación de ese correo institucional. No se ha concedido acceso.';
  }
  if (!googleProviderEmail || !isInstitutionalEmail(googleProviderEmail)) {
    return 'Acceso rechazado: el correo de la identidad Google no es institucional.';
  }
  if (normalizeEmail(firebaseEmail) !== normalizeEmail(googleProviderEmail)) {
    return 'La dirección autenticada no coincide con la identidad Google seleccionada.';
  }
  return null;
}
