import { describe, expect, it } from 'vitest';
import { isInstitutionalEmail, normalizeEmail } from '../src/lib/policy';

describe('política de dominios institucionales', () => {
  it('acepta solamente dominios exactos autorizados', () => {
    expect(isInstitutionalEmail('alumno@alumnos.udg.mx')).toBe(true);
    expect(isInstitutionalEmail('Docente@Academicos.UDG.MX')).toBe(true);
    expect(isInstitutionalEmail('usuario@udg.mx')).toBe(true);
  });
  it('rechaza parecidos, subdominios no incluidos, y texto arbitrario', () => {
    for (const email of ['usuario@udg-falso.com', 'udg@correo.com', 'x@udg.mx.atacante.com', 'x@otro.udg.mx', 'x@@udg.mx', 'x@alumnosudg.mx', '', 'x @udg.mx']) {
      expect(isInstitutionalEmail(email)).toBe(false);
    }
  });
  it('normaliza el correo', () => {
    expect(normalizeEmail('  PERSONA@ALUMNOS.UDG.MX ')).toBe('persona@alumnos.udg.mx');
  });
});
