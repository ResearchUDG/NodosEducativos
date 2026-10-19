export function explainError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code.includes('auth/credential-already-in-use')) return 'Esta cuenta Google ya está vinculada a otra identidad Firebase. No se fusionarán cuentas automáticamente; solicite una revisión administrativa.';
  if (code.includes('auth/provider-already-linked')) return 'Esta cuenta ya tiene un acceso Google vinculado.';
  if (code.includes('auth/requires-recent-login')) return 'Por seguridad, cierre sesión e ingrese de nuevo con su contraseña antes de vincular Google.';
  if (code.includes('auth/wrong-password')) return 'La contraseña actual es incorrecta.';
  if (code.includes('auth/user-mismatch')) return 'La sesión cambió. Vuelva a iniciar sesión antes de continuar.';
  if (code.includes('auth/invalid-credential')) return 'Correo o contraseña incorrectos.';
  if (code.includes('auth/email-already-in-use')) return 'Ya existe una cuenta con ese correo.';
  if (code.includes('auth/weak-password')) return 'Utilice una contraseña más segura.';
  if (code.includes('auth/too-many-requests')) return 'Demasiados intentos. Espere e inténtelo más tarde.';
  if (code.includes('auth/invalid-email')) return 'La dirección de correo no es válida.';
  if (code.includes('auth/account-exists-with-different-credential')) return 'Esta dirección ya tiene otro método de acceso. Inicie sesión con su contraseña habitual; no cree una cuenta duplicada.';
  if (code.includes('auth/popup-blocked')) return 'El navegador bloqueó la ventana de Google. Permita las ventanas emergentes para este sitio.';
  if (code.includes('auth/operation-not-allowed')) return 'Este método de ingreso no está habilitado en Firebase Authentication.';
  if (code.includes('auth/unauthorized-domain')) return 'El dominio del sitio no está autorizado en Firebase Authentication.';
  if (code.includes('permission-denied')) return 'Acceso denegado. Verifique el correo y los permisos.';
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}
