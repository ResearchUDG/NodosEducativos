import type { ConceptEdge, ConceptNode } from './types';

/** Publica únicamente nodos seleccionados; nunca referencias a conceptos ocultos. */
export function selectPublishedGraph(nodes: ConceptNode[], edges: ConceptEdge[], selectedIds: readonly string[]) {
  const allowed = new Set(selectedIds);
  const visible = nodes.filter((node) => allowed.has(node.id));
  const visibleIds = new Set(visible.map((node) => node.id));
  return {
    nodes: visible,
    edges: edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
  };
}
