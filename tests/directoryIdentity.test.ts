import { describe, expect, it } from 'vitest';
import { formatDirectoryIdentity, identityOptionLabel } from '../src/lib/directoryIdentity';

describe('identidad legible sin UID', () => {
  it('presenta nombre y correo cuando ambos existen', () => {
    expect(formatDirectoryIdentity({ displayName: 'Ana Pérez', email: 'ana@alumnos.udg.mx' }))
      .toEqual({ primary: 'Ana Pérez', secondary: 'ana@alumnos.udg.mx' });
  });
  it('presenta correo si no hay nombre, sin inventarlo', () => {
    expect(formatDirectoryIdentity({ email: 'ana@alumnos.udg.mx' }).primary).toBe('ana@alumnos.udg.mx');
  });
  it('no muestra identificadores internos en el estado sin perfil', () => {
    const label = identityOptionLabel({}, 'admin');
    expect(label).toContain('Cuenta sin datos de perfil');
    expect(label).not.toContain('UID');
  });
  it('incluye nombre, correo y rol en el selector', () => {
    const label = identityOptionLabel({ displayName: 'Ana Pérez', email: 'ana@alumnos.udg.mx' }, 'profesor');
    expect(label).toBe('Ana Pérez · ana@alumnos.udg.mx · profesor');
  });
});
