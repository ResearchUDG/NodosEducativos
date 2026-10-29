import type { Edge, Node } from '@xyflow/react';
import type { ConceptEdge, ConceptNode } from './types';

export type GuestFigureData = {
  title: string;
  category: 'tesis' | 'idea' | 'fuente' | 'pregunta';
  critical: boolean;
};
export type GuestFigureNode = Node<GuestFigureData, 'guestFigure'>;
export type GuestFigureEdge = Edge<Record<string, never>>;

/**
 * Proyección visual mínima para una figura académica: conserva geometría y
 * conectividad, pero descarta descripciones, bibliografía, numeración de guía
 * y etiquetas argumentativas para no saturar la lámina.
 */
export function buildGuestFigureGraph(nodes: readonly ConceptNode[], edges: readonly ConceptEdge[]) {
  const visible = new Set(nodes.map(node => node.id));
  const figureNodes: GuestFigureNode[] = nodes.map(node => ({
    id: node.id,
    type: 'guestFigure',
    position: { ...node.position },
    data: {
      title: String(node.data.title || ''),
      category: node.data.category,
      critical: node.data.critical === true,
    },
  }));
  const figureEdges: GuestFigureEdge[] = edges
    .filter(edge => visible.has(edge.source) && visible.has(edge.target))
    .map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      animated: false,
      data: {},
      style: { stroke: '#A98E85', strokeWidth: 1.35, opacity: 0.82 },
    }));
  return { nodes: figureNodes, edges: figureEdges };
}
