import { describe, expect, it } from 'vitest';
import {
  addAcademicTag, academicTagKey, canEditResearcherProfile,
  emptyAcademicTags, normalizeResearcherProfile, readAcademicTags,
  removeAcademicTag,
} from '../src/lib/researcherProfile';

describe('Ficha académica con etiquetas', () => {
  const valid = {
    academicTitle: '  Estudiante   de Filosofía ', institution: ' Universidad pública ',
    researchLines: ' Historia y filosofía ', biography: ' Investiga sistemas conceptuales. ',
    academicTags: emptyAcademicTags(),
  };
  it('normaliza campos existentes sin inferir titulaciones', () => {
    expect(normalizeResearcherProfile(valid)).toEqual({
      academicTitle: 'Estudiante de Filosofía', institution: 'Universidad pública',
      researchLines: 'Historia y filosofía', biography: 'Investiga sistemas conceptuales.',
      academicTags: emptyAcademicTags(),
    });
  });
  it('rechaza textos heredados mayores a los límites fijados', () => {
    expect(() => normalizeResearcherProfile({ ...valid, academicTitle: 'a'.repeat(101) })).toThrow();
    expect(() => normalizeResearcherProfile({ ...valid, researchLines: 'x'.repeat(451) })).toThrow();
    expect(() => normalizeResearcherProfile({ ...valid, biography: 'x'.repeat(1201) })).toThrow();
  });
  it('admite fichas en blanco para ser completadas después', () => {
    expect(normalizeResearcherProfile({ ...valid, academicTitle: '' }).academicTitle).toBe('');
  });
  it('permite varias carreras, títulos, posgrados y certificaciones', () => {
    let tags = emptyAcademicTags();
    tags = addAcademicTag(tags, 'careers', ' Licenciatura   en Filosofía (en curso) ');
    tags = addAcademicTag(tags, 'careers', 'Ingeniería en Informática');
    tags = addAcademicTag(tags, 'degrees', 'Ingeniero en Informática');
    tags = addAcademicTag(tags, 'postgraduate', 'Maestría en Educación (en curso)');
    tags = addAcademicTag(tags, 'certifications', 'Certificación en Metodología');
    expect(tags.careers).toHaveLength(2);
    expect(tags.degrees).toEqual(['Ingeniero en Informática']);
    expect(tags.postgraduate).toHaveLength(1);
    expect(tags.certifications).toHaveLength(1);
    expect(tags.careers[0]).toBe('Licenciatura en Filosofía (en curso)');
    expect(removeAcademicTag(tags, 'careers', 1).careers).toHaveLength(1);
  });
  it('no permite duplicados por diferencias en acento, espacios o mayúsculas', () => {
    const tags = addAcademicTag(emptyAcademicTags(), 'postgraduate', 'MAESTRÍA  EN FILOSOFÍA');
    expect(academicTagKey('Maestria en Filosofia')).toBe(academicTagKey('MAESTRÍA  EN FILOSOFÍA'));
    expect(() => addAcademicTag(tags, 'postgraduate', 'Maestria en Filosofia')).toThrow(/ya está registrada/);
    // La misma expresión puede estar en dos categorías distintas sin fusionarlas.
    expect(addAcademicTag(tags, 'careers', 'Maestría en Filosofía').careers).toHaveLength(1);
  });
  it('rechaza etiquetas ilegítimas y más de diez por categoría', () => {
    expect(() => addAcademicTag(emptyAcademicTags(), 'degrees', 'x')).toThrow();
    expect(() => addAcademicTag(emptyAcademicTags(), 'degrees', 'x'.repeat(91))).toThrow();
    expect(() => addAcademicTag(emptyAcademicTags(), 'degrees', 'AB\nC')).toThrow();
    expect(() => addAcademicTag(emptyAcademicTags(), 'degrees', 'Sección § 1')).toThrow(/reservado/);
    const full = { ...emptyAcademicTags(), certifications: Array.from({ length: 10 }, (_, i) => `Certificación ${i}`) };
    expect(() => addAcademicTag(full, 'certifications', 'Otra certificación')).toThrow();
  });
  it('lee fichas antiguas sin inventar etiquetas a partir del título anterior', () => {
    expect(readAcademicTags(undefined)).toEqual(emptyAcademicTags());
    expect(readAcademicTags({})).toEqual(emptyAcademicTags());
    expect(readAcademicTags({ careers: ['   Filosofía   ', 'filosofia', 0, '', 'Informática'] })).toEqual({
      careers: ['Filosofía', 'Informática'], degrees: [], postgraduate: [], certifications: [],
    });
  });
  it('no acepta propiedades o listas malformadas en la normalización', () => {
    const malformed = { ...valid, academicTags: { ...emptyAcademicTags(), certifications: 'Doctorado' } };
    expect(() => normalizeResearcherProfile(malformed as unknown as typeof valid)).toThrow();
  });
  it('solo habilita la edición para titulares con rol de autor', () => {
    expect(canEditResearcherProfile('professor', 'professor', 'professor')).toBe(true);
    expect(canEditResearcherProfile('admin', 'root', 'root')).toBe(true);
    expect(canEditResearcherProfile('student', 'student', 'student')).toBe(false);
    expect(canEditResearcherProfile('admin', 'professor', 'root')).toBe(false);
  });
});
