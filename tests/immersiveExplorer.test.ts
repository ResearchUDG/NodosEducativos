import { describe, expect, it } from 'vitest';
import { explorerInitialNodeId, explorerStep } from '../src/lib/immersiveExplorer';
import type { ConceptNode } from '../src/lib/types';

const node = (id: string, critical = false) => ({
  id, type: 'concept', position: { x: 0, y: 0 },
  data: { title: id, description: '', category: 'idea', ...(critical ? { critical: true } : {}) },
}) as ConceptNode;

describe('explorador inmersivo', () => {
  it('prioriza el nodo solicitado y después un nodo crítico', () => {
    const nodes = [node('a'), node('b', true), node('c')];
    expect(explorerInitialNodeId(nodes, 'c')).toBe('c');
    expect(explorerInitialNodeId(nodes)).toBe('b');
  });

  it('acota la navegación anterior/siguiente', () => {
    expect(explorerStep(0, 4, -1)).toBe(0);
    expect(explorerStep(1, 4, 1)).toBe(2);
    expect(explorerStep(3, 4, 1)).toBe(3);
  });
});
