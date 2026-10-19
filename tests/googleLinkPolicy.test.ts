import { describe, expect, it } from 'vitest';
import { hasProvider, refreshGoogleLinkStatus, validateLinkedGoogleAccount } from '../src/lib/googleLinkPolicy';

const check = (uid: string, email: string, verified = true, google = email) =>
  validateLinkedGoogleAccount('admin-test-uid', uid, 'admin@alumnos.udg.mx', email, verified, google);

describe('vinculación de Google a una identidad existente', () => {
  it('autoriza el mismo UID y la misma dirección institucional verificada', () => {
    expect(check('admin-test-uid', 'admin@alumnos.udg.mx')).toBeNull();
    expect(check('admin-test-uid', 'ADMIN@alumnos.udg.mx')).toBeNull();
  });
  it('bloquea reemplazos de UID aunque coincida el correo', () => {
    expect(check('otro-uid', 'admin@alumnos.udg.mx')).not.toBeNull();
  });
  it('rechaza Google personal y correos de otra persona', () => {
    expect(check('admin-test-uid', 'admin@alumnos.udg.mx', true, 'admin@gmail.com')).not.toBeNull();
    expect(check('admin-test-uid', 'admin@alumnos.udg.mx', true, 'otro@alumnos.udg.mx')).not.toBeNull();
  });
  it('bloquea cambios de correo e identidades sin verificación', () => {
    expect(check('admin-test-uid', 'otro@alumnos.udg.mx')).not.toBeNull();
    expect(check('admin-test-uid', 'admin@alumnos.udg.mx', false)).not.toBeNull();
    expect(validateLinkedGoogleAccount('admin-test-uid', 'admin-test-uid', null, 'admin@alumnos.udg.mx', true, 'admin@alumnos.udg.mx')).not.toBeNull();
  });
  it('permite identificar proveedores vinculados', () => {
    expect(hasProvider(['password', 'google.com'], 'google.com')).toBe(true);
    expect(hasProvider(['password'], 'google.com')).toBe(false);
  });
});


describe('restauración del estado de proveedores tras volver a iniciar sesión', () => {
  it('detecta Google aun cuando la sesión se cargó después del primer render', async () => {
    let providers = ['password'];
    const linked = await refreshGoogleLinkStatus(
      'uid-admin',
      async () => { providers = ['password', 'google.com']; },
      () => ({ uid: 'uid-admin', providerIds: providers }),
    );
    expect(linked).toBe(true);
  });
  it('no indica vinculación si Firebase solo confirma contraseña', async () => {
    const linked = await refreshGoogleLinkStatus(
      'uid-usuario',
      async () => undefined,
      () => ({ uid: 'uid-usuario', providerIds: ['password'] }),
    );
    expect(linked).toBe(false);
  });
  it('rechaza un UID diferente al actualizar la identidad', async () => {
    await expect(refreshGoogleLinkStatus(
      'uid-original', async () => undefined,
      () => ({ uid: 'uid-distinto', providerIds: ['google.com'] }),
    )).rejects.toThrow('La sesión cambió');
  });
  it('no interpreta como cuenta sin Google un fallo de actualización', async () => {
    await expect(refreshGoogleLinkStatus(
      'uid-admin', async () => { throw new Error('network'); },
      () => ({ uid: 'uid-admin', providerIds: ['google.com'] }),
    )).rejects.toThrow('network');
  });
});
