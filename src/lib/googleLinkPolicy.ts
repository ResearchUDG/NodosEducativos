import { normalizeEmail } from './policy';
import { validateGoogleIdentity } from './googleAccess';

/**
 * Guardarraíl DESPUÉS de linkWithPopup. La vinculación ocurre en Firebase
 * antes de que el SDK devuelva la identidad Google; ante discrepancias,
 * el llamador DEBE ejecutar unlink y tratar fallos de reversión como críticos.
 */
export function validateLinkedGoogleAccount(
  originalUid: string,
  linkedUid: string,
  originalEmail: string | null,
  linkedEmail: string | null,
  linkedEmailVerified: boolean,
  googleProviderEmail: string | null,
): string | null {
  if (!originalUid || originalUid !== linkedUid) {
    return 'La cuenta Firebase cambió durante la vinculación. Se rechazó la operación.';
  }
  if (!originalEmail || !linkedEmail || normalizeEmail(originalEmail) !== normalizeEmail(linkedEmail)) {
    return 'El correo de la cuenta cambió durante la vinculación. Se rechazó la operación.';
  }
  return validateGoogleIdentity(linkedEmail, linkedEmailVerified, googleProviderEmail);
}

export function hasProvider(providerIds: string[], id: string): boolean {
  return providerIds.includes(id);
}

/**
 * Recarga y confirma en Firebase qué proveedores pertenecen al MISMO UID.
 * Retorna solo un estado de visualización; no concede permisos ni modifica roles.
 */
export async function refreshGoogleLinkStatus(
  expectedUid: string,
  reload: () => Promise<void>,
  currentIdentity: () => { uid: string; providerIds: string[] } | null,
): Promise<boolean> {
  if (!expectedUid) throw new Error('No hay un UID autenticado para consultar.');
  await reload();
  const identity = currentIdentity();
  if (!identity || identity.uid !== expectedUid) {
    throw new Error('La sesión cambió durante la consulta de proveedores.');
  }
  return hasProvider(identity.providerIds, 'google.com');
}
