import type { ConceptNode } from './types';

export function explorerInitialNodeId(nodes: readonly ConceptNode[], requested?: string | null): string | null {
  if (!nodes.length) return null;
  if (requested && nodes.some(node => node.id === requested)) return requested;
  return nodes.find(node => node.data.critical === true)?.id ?? nodes[0].id;
}

export function explorerStep(current: number, count: number, delta: -1 | 1): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, current + delta));
}
