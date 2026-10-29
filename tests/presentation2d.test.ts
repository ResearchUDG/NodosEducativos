import { describe, expect, it } from 'vitest';
import type { ConceptEdge, ConceptNode } from '../src/lib/types';
import {
  presentationCategories, presentationCategoryLabel, presentationInitialNodeId,
  presentationMatchesFilter, presentationNeighborIds, presentationProgress,
} from '../src/lib/presentation2d';

const node = (id: string, category = 'idea', critical = false) => ({
  id, type: 'concept', position: { x: 0, y: 0 },
  data: { title: id, description: '', category, ...(critical ? { critical: true } : {}) },
}) as ConceptNode;

describe('presentación 2D editorial', () => {
  it('elige primero el nodo solicitado y después uno crítico', () => {
    const nodes = [node('a'), node('b', 'idea', true), node('c')];
    expect(presentationInitialNodeId(nodes, 'c')).toBe('c');
    expect(presentationInitialNodeId(nodes)).toBe('b');
  });

  it('calcula vecinos sin inventar relaciones', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'c', target: 'a' },
    ] as ConceptEdge[];
    expect([...presentationNeighborIds(edges, 'a')].sort()).toEqual(['b', 'c']);
  });

  it('crea filtros de categoría y de criticidad', () => {
    const nodes = [node('a', 'pregunta'), node('b', 'idea', true), node('c', 'pregunta')];
    expect(presentationCategories(nodes)).toEqual(['pregunta', 'idea']);
    expect(presentationMatchesFilter(nodes[1], 'critical')).toBe(true);
    expect(presentationMatchesFilter(nodes[0], 'idea')).toBe(false);
  });

  it('genera etiquetas legibles y progreso acotado', () => {
    expect(presentationCategoryLabel('idea_central')).toBe('Idea central');
    expect(presentationProgress(0, 9)).toBe(11);
    expect(presentationProgress(8, 9)).toBe(100);
  });
});
