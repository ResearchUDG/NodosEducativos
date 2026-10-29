import { describe, expect, it } from 'vitest';
import { buildGuestFigureGraph } from '../src/lib/guestFigure';
import type { ConceptEdge, ConceptNode } from '../src/lib/types';

const nodes = [
  { id: 'a', type: 'concept', position: { x: 10, y: 20 }, data: { title: 'Pregunta central', description: 'Texto privado para la figura', category: 'pregunta', critical: true, references: [{ author: 'A', work: 'W', year: '2026', locator: 'p. 1', url: '' }] } },
  { id: 'b', type: 'concept', position: { x: 300, y: 20 }, data: { title: 'Tesis', description: 'Otra descripción', category: 'tesis' } },
] as ConceptNode[];
const edges = [
  { id: 'e1', source: 'a', target: 'b', label: 'fundamenta', data: { relation: 'fundamenta' } },
  { id: 'e2', source: 'a', target: 'oculto', label: 'otra', data: { relation: 'otra' } },
] as ConceptEdge[];

describe('Vista figura pública — proyección mínima', () => {
  it('conserva títulos, posiciones, categoría y criticidad', () => {
    const figure = buildGuestFigureGraph(nodes, edges);
    expect(figure.nodes[0]).toMatchObject({ id: 'a', position: { x: 10, y: 20 }, data: { title: 'Pregunta central', category: 'pregunta', critical: true } });
  });
  it('no arrastra descripción, referencias ni otros metadatos a la figura', () => {
    const figure = buildGuestFigureGraph(nodes, edges);
    expect(figure.nodes[0].data).toEqual({ title: 'Pregunta central', category: 'pregunta', critical: true });
  });
  it('solo conserva conexiones entre nodos visibles y elimina etiquetas argumentativas', () => {
    const figure = buildGuestFigureGraph(nodes, edges);
    expect(figure.edges).toHaveLength(1);
    expect(figure.edges[0]).toMatchObject({ id: 'e1', source: 'a', target: 'b', data: {} });
    expect(figure.edges[0]).not.toHaveProperty('label');
  });
});
