/** Presentación de identidades para el directorio. El UID nunca forma parte de la etiqueta visible. */
export type DirectoryIdentity = { displayName?: string | null; email?: string | null };

export function formatDirectoryIdentity(identity: DirectoryIdentity): { primary: string; secondary: string } {
  const displayName = (identity.displayName ?? '').trim();
  const email = (identity.email ?? '').trim();
  if (displayName && email) return { primary: displayName, secondary: email };
  if (email) return { primary: email, secondary: '' };
  if (displayName) return { primary: displayName, secondary: 'Correo no disponible' };
  return { primary: 'Cuenta sin datos de perfil', secondary: 'Complete la identificación de esta cuenta' };
}

export function identityOptionLabel(identity: DirectoryIdentity, role: string): string {
  const { primary, secondary } = formatDirectoryIdentity(identity);
  return `${primary}${secondary && secondary !== 'Correo no disponible' ? ` · ${secondary}` : ''} · ${role}`;
}
