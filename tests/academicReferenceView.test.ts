import { describe, expect, it } from 'vitest';
import {
  isReferencePersisted, sameAcademicReference, snapshotPersistedReferences,
} from '../src/lib/academicReferenceView';
import type { AcademicReference, ConceptNode } from '../src/lib/types';

const ref = (work: string): AcademicReference => ({
  author: 'Autora', work, year: '2024', locator: 'p. 12', url: 'https://example.edu/libro',
});
const node = (id: string, references: AcademicReference[]): ConceptNode => ({
  id, type: 'concept', position: {x: 0,y: 0},
  data: { title: 'Idea', description: '', category: 'idea', references },
});

describe('Estado visual de las referencias en el inspector', () => {
  it('muestra como guardada una cita reconstruida desde Firestore', () => {
    const refs = [ref('Crítica de la razón pura')];
    const persisted = snapshotPersistedReferences([node('n1', refs)]);
    expect(isReferencePersisted(structuredClone(refs), persisted.n1, 0)).toBe(true);
  });
  it('una nueva cita no es guardada hasta confirmar la escritura', () => {
    const persisted = snapshotPersistedReferences([node('n1', [ref('Obra 1')])]);
    const current = [ref('Obra 1'), ref('Obra 2')];
    expect(isReferencePersisted(current, persisted.n1, 0)).toBe(true);
    expect(isReferencePersisted(current, persisted.n1, 1)).toBe(false);
    expect(isReferencePersisted(current, snapshotPersistedReferences([node('n1', current)]).n1, 1)).toBe(true);
  });
  it('ediciones pendientes no se presentan como guardadas', () => {
    const original = ref('Obra original');
    expect(isReferencePersisted([{...original, work:'Obra modificada'}], [original], 0)).toBe(false);
    expect(sameAcademicReference({...original, author:' Autora '}, original)).toBe(true);
    expect(sameAcademicReference({...original, url:'javascript:invalid'}, {...original, url:''})).toBe(false);
  });
  it('elimina una referencia anterior sin perder el estado de las que permanecen', () => {
    const original = [ref('A'), ref('B')];
    expect(isReferencePersisted([original[1]], original, 0)).toBe(true);
  });
  it('no confunde copias añadidas con referencias guardadas', () => {
    const a = ref('Misma obra');
    expect(isReferencePersisted([a, {...a}], [a], 0)).toBe(true);
    expect(isReferencePersisted([a, {...a}], [a], 1)).toBe(false);
  });
  it('la instantánea es independiente y aislada por nodo', () => {
    const source = [ref('A')];
    const records = snapshotPersistedReferences([node('n1', source), node('n2', [])]);
    source[0].work = 'Modificada';
    expect(records.n1[0].work).toBe('A');
    expect(records.n2).toEqual([]);
  });
});
