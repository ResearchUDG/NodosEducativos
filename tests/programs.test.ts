import { describe, expect, it } from 'vitest';
import { canAssignNewMember, normalizeProgramInput, visiblePrograms } from '../src/lib/programs';
const catalog = [
  { id:'a', name:'Filosofía', description:'Humanidades', active:true },
  { id:'b', name:'Matemáticas', description:'Ciencias exactas', active:false },
  { id:'c', name:'Antropología', description:'Humanidades', active:true },
];
describe('Catálogo de programas académicos', () => {
  it('normaliza nombres y preserva descripciones', () => {
    expect(normalizeProgramInput('  Filosofía   política  ', '  Ciencias humanas  '))
      .toEqual({ name:'Filosofía política', description:'Ciencias humanas' });
  });
  it('impide nombres vacíos o descripciones excesivas', () => {
    expect(() => normalizeProgramInput(' a ', '')).toThrow();
    expect(() => normalizeProgramInput('Matemáticas', 'x'.repeat(401))).toThrow();
  });
  it('filtra carreras de todas las áreas y distingue programas desactivados', () => {
    expect(visiblePrograms(catalog,'ciencias','all').map(p=>p.name)).toEqual(['Matemáticas']);
    expect(visiblePrograms(catalog,'','inactive').map(p=>p.name)).toEqual(['Matemáticas']);
    expect(visiblePrograms(catalog,'','active')).toHaveLength(2);
  });
  it('no permite asignar nuevas membresías a programas desactivados', () => {
    expect(canAssignNewMember({active:false})).toBe(false);
    expect(canAssignNewMember({active:true})).toBe(true);
  });
});
