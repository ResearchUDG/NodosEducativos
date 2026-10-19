import { describe, expect, it } from 'vitest';
import { validateGoogleIdentity } from '../src/lib/googleAccess';

describe('Google: política de acceso sin envío de verificación', () => {
  it('admite un Google institucional con dirección verificada y coincidente', () => {
    expect(validateGoogleIdentity('profesor@academicos.udg.mx', true, 'profesor@academicos.udg.mx')).toBeNull();
    expect(validateGoogleIdentity('ALUMNO@alumnos.udg.mx', true, 'alumno@alumnos.udg.mx')).toBeNull();
  });
  it('rechaza Gmail aunque el propietario tenga nombre UdeG', () => {
    expect(validateGoogleIdentity('estudiante.udg@gmail.com', true, 'estudiante.udg@gmail.com')).not.toBeNull();
  });
  it('rechaza parecidos engañosos de dominios institucionales', () => {
    expect(validateGoogleIdentity('a@alumnos.udg.mx.falso.com', true, 'a@alumnos.udg.mx.falso.com')).not.toBeNull();
    expect(validateGoogleIdentity('a@udg-falso.mx', true, 'a@udg-falso.mx')).not.toBeNull();
  });
  it('rechaza el correo no verificado', () => {
    expect(validateGoogleIdentity('a@alumnos.udg.mx', false, 'a@alumnos.udg.mx')).not.toBeNull();
  });
  it('rechaza identidades Google externas aunque la identidad Firebase sea institucional', () => {
    expect(validateGoogleIdentity('a@alumnos.udg.mx', true, 'a@gmail.com')).not.toBeNull();
  });
  it('rechaza cuentas Google distintas y respuestas sin correo', () => {
    expect(validateGoogleIdentity('a@alumnos.udg.mx', true, 'b@alumnos.udg.mx')).not.toBeNull();
    expect(validateGoogleIdentity('a@alumnos.udg.mx', true, null)).not.toBeNull();
    expect(validateGoogleIdentity(null, true, 'a@alumnos.udg.mx')).not.toBeNull();
  });
});
