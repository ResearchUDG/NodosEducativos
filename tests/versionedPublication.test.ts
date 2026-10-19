import { describe, expect, it } from 'vitest';
import { preparePublicationEdition } from '../src/lib/versionedPublication';
import type { DiagramRevision } from '../src/lib/diagramHistory';
import type { ConceptNode } from '../src/lib/types';

const ref = (id: string, work: string): ConceptNode => ({
  id, type: 'concept', position: { x: 0, y: 0 },
  data: { title: id, description: '', category: 'idea', references: [{ author: 'Autor', work, year: '2020', locator: '', url: '' }] },
});
const edition: DiagramRevision = {
  id: 'revision-seleccionada', kind: 'save', authorUid: 'professor',
  savedAt: { seconds: 1, nanoseconds: 0 }, title: 'Versión anterior', description: 'Anterior',
  nodes: [ref('a', 'Obra A'), ref('b', 'Obra B')],
  edges: [{ id: 'ab', source: 'a', target: 'b' }],
};

describe('Compartir una edición guardada', () => {
  it('publica título y fuentes de la revisión seleccionada, no del borrador actual', () => {
    const result = preparePublicationEdition(edition, ['a']);
    expect(result.title).toBe('Versión anterior');
    expect(result.sourceRevisionId).toBe('revision-seleccionada');
    expect(result.sourceRevisionSavedAt).toEqual(edition.savedAt);
    expect(result.nodes.map(item => item.id)).toEqual(['a']);
    expect(result.nodes[0].data.references?.[0].work).toBe('Obra A');
    expect(result.edges).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('Obra B');
  });
  it('rechaza selecciones no pertenecientes a la revisión', () => {
    expect(() => preparePublicationEdition(edition, ['a', 'otro'])).toThrow(/pertenecientes/);
  });
  it('exige una versión previamente guardada y una selección explícita', () => {
    expect(() => preparePublicationEdition({ ...edition, savedAt: null }, ['a'])).toThrow(/guardada/);
    expect(() => preparePublicationEdition(edition, [])).toThrow(/Seleccione/);
  });
  it('solo valida referencias de los conceptos seleccionados', () => {
    const withDraftRef = { ...edition, nodes: [ref('a', 'Obra A'), ref('b', '')] };
    expect(preparePublicationEdition(withDraftRef, ['a']).nodes).toHaveLength(1);
    expect(() => preparePublicationEdition(withDraftRef, ['b'])).toThrow(/obra/);
  });
});
