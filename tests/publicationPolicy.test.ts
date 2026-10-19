import { describe, expect, it } from 'vitest';
import { selectPublishedGraph } from '../src/lib/publicationPolicy';
import type { ConceptEdge, ConceptNode } from '../src/lib/types';
const node = (id: string): ConceptNode => ({ id, type: 'concept', position: { x: 0, y: 0 }, data: { title: id, description: id, category: 'idea' } });
const edges: ConceptEdge[] = [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'bc', source: 'b', target: 'c' },
  { id: 'ac', source: 'a', target: 'c' },
];
describe('Publicación selectiva de nodos', () => {
  it('no expone nodos no elegidos por el profesor', () => {
    const result = selectPublishedGraph([node('a'), node('b'), node('c')], edges, ['a','b']);
    expect(result.nodes.map(n => n.id)).toEqual(['a','b']);
    expect(result.edges.map(e => e.id)).toEqual(['ab']);
  });
  it('nunca conserva una arista hacia un nodo oculto', () => {
    expect(selectPublishedGraph([node('a'), node('b'), node('c')], edges, ['c']).edges).toEqual([]);
  });
});
