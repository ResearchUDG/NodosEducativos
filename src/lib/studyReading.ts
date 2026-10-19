/** Fase 3f: recorrido didáctico derivado únicamente de la edición compartida.
 * Ninguna función consulta borradores, revisiones privadas o perfiles.
 */
import type { ConceptEdge, ConceptNode, ArgumentRelation } from './types';

const relationVerbs: Record<ArgumentRelation, string> = {
  fundamenta: 'fundamenta',
  refuta: 'refuta',
  define: 'define',
  contextualiza: 'contextualiza',
  cuestiona: 'cuestiona',
  deriva: 'se deriva de',
  ejemplifica: 'ejemplifica',
  otra: 'se relaciona con',
};

export type StudentConnection = {
  id: string;
  otherNodeId: string;
  otherTitle: string;
  direction: 'saliente' | 'entrante';
  relation: string;
  explanation: string;
};

/** El orden del recorrido es el de los nodos de la edición; no se infiere un orden autoral inexistente. */
export function publishedReadingGraph(nodes: readonly ConceptNode[], edges: readonly ConceptEdge[]) {
  const visible = new Set(nodes.map(node => node.id));
  return {
    nodes: [...nodes],
    edges: edges.filter(edge => visible.has(edge.source) && visible.has(edge.target)),
  };
}

export function relationPhrase(value: unknown): string {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(relationVerbs, value)) {
    return 'se relaciona con';
  }
  return relationVerbs[value as ArgumentRelation];
}

/** Explicación orientada: nunca nombra nodos que no están en la edición publicada. */
export function studentConnections(nodes: readonly ConceptNode[], edges: readonly ConceptEdge[], nodeId: string): StudentConnection[] {
  const named = new Map(nodes.map(node => [node.id, node.data.title]));
  if (!named.has(nodeId)) return [];
  return edges.flatMap(edge => {
    if (edge.source !== nodeId && edge.target !== nodeId) return [];
    const from = named.get(edge.source);
    const to = named.get(edge.target);
    if (from === undefined || to === undefined) return [];
    const outgoing = edge.source === nodeId;
    const otherNodeId = outgoing ? edge.target : edge.source;
    const verb = relationPhrase(edge.data?.relation);
    return [{
      id: edge.id,
      otherNodeId,
      otherTitle: named.get(otherNodeId) ?? '',
      direction: outgoing ? 'saliente' as const : 'entrante' as const,
      relation: verb,
      explanation: `Según este esquema, «${from}» ${verb} «${to}».`,
    }];
  });
}

/** Navegación acotada: el último paso termina, no reinicia sin aviso. */
export function readingStep(current: number, count: number, delta: -1 | 1): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, current + delta));
}

export function readingProgress(index: number, count: number): number {
  return count > 0 ? Math.round(((Math.min(Math.max(0, index), count - 1) + 1) / count) * 100) : 0;
}
