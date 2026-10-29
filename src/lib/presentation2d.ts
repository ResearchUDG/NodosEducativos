import type { ConceptEdge, ConceptNode } from './types';

export type PresentationFilter = 'all' | 'critical' | string;

export function presentationCategoryLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Concepto';
  const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function presentationInitialNodeId(nodes: readonly ConceptNode[], requested?: string | null): string | null {
  if (!nodes.length) return null;
  if (requested && nodes.some(node => node.id === requested)) return requested;
  return nodes.find(node => node.data.critical === true)?.id ?? nodes[0].id;
}

export function presentationNeighborIds(edges: readonly ConceptEdge[], nodeId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!nodeId) return ids;
  for (const edge of edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return ids;
}

export function presentationCategories(nodes: readonly ConceptNode[]): string[] {
  return [...new Set(nodes.map(node => String(node.data.category ?? '').trim()).filter(Boolean))];
}

export function presentationMatchesFilter(node: ConceptNode, filter: PresentationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'critical') return node.data.critical === true;
  return String(node.data.category ?? '') === filter;
}

export function presentationProgress(index: number, total: number): number {
  if (total <= 0 || index < 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((index + 1) / total) * 100)));
}
