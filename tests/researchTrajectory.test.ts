import { describe, expect, it } from 'vitest';
import { emptyTrajectoryFields, isRealDate, normalizeTrajectoryFields, readTrajectoryMilestone, sortTrajectoryMilestones, trajectoryDateLabel } from '../src/lib/researchTrajectory';

const record = { ...emptyTrajectoryFields, category: 'certificacion' as const, title: 'Certificación académica', startDate: '2026-10-19' };
describe('Trayectoria del investigador — fechas, hitos y lectura segura', () => {
  it('acepta fecha real, incluso año bisiesto', () => { expect(isRealDate('2024-02-29')).toBe(true); expect(isRealDate('2023-02-29')).toBe(false); });
  it('rechaza meses y días inexistentes', () => { expect(isRealDate('2026-13-01')).toBe(false); expect(isRealDate('2026-04-31')).toBe(false); });
  it('conserva fechas de inicio y fin y datos opcionales', () => { expect(normalizeTrajectoryFields({ ...record, endDate: '2027-02-11' }).endDate).toBe('2027-02-11'); });
  it('no admite fecha final anterior al inicio', () => { expect(() => normalizeTrajectoryFields({ ...record, endDate: '2024-10-01' })).toThrow(); });
  it('impide títulos vacíos y valores superiores al límite', () => { expect(() => normalizeTrajectoryFields({ ...record, title: '' })).toThrow(); expect(() => normalizeTrajectoryFields({ ...record, title: 'x'.repeat(121) })).toThrow(); });
  it('valida categoría y rechaza campos corruptos', () => { expect(() => normalizeTrajectoryFields({ ...record, category: 'admin' as never })).toThrow(); expect(readTrajectoryMilestone('x', { ...record, title: null })).toBe(null); });
  it('acepta únicamente enlaces HTTPS sin credenciales', () => { expect(() => normalizeTrajectoryFields({ ...record, url: 'http://example.org' })).toThrow(); expect(() => normalizeTrajectoryFields({ ...record, url: 'https://person:pwd@example.org' })).toThrow(); expect(normalizeTrajectoryFields({ ...record, url: 'https://example.org/obra' }).url).toBe('https://example.org/obra'); });
  it('ordena los acontecimientos del más reciente al más antiguo sin mutar la fuente', () => { const oldest = { id: '1', ...record, startDate: '2019-07-04' }; const newest = { id: '2', ...record }; const input = [oldest, newest]; expect(sortTrajectoryMilestones(input).map(item => item.id)).toEqual(['2', '1']); expect(input[0].id).toBe('1'); });
  it('muestra la misma fecha en cualquier zona horaria', () => { expect(trajectoryDateLabel('2026-10-19')).toContain('2026'); expect(trajectoryDateLabel('2026-10-19')).toContain('19'); });
  it('no inventa hitos académicos cuando no existe un registro válido', () => { expect(readTrajectoryMilestone('anterior', {})).toBe(null); expect(readTrajectoryMilestone('fecha', { ...record, startDate: '2026-02-30' })).toBe(null); });
});
