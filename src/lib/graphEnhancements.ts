/** Funciones puras: numeración visible, guía contextual y conexión de múltiples nodos. */
import type { ArgumentRelation, ConceptEdge, ConceptNode } from './types';
import { relationLabels } from './academicGraph';

/** La posición del nodo en el arreglo guardado es el orden de creación/lectura.
 * La cifra visible se calcula, sin modificar las instantáneas existentes.
 */
export function numberedNodes(nodes: readonly ConceptNode[]): ConceptNode[] {
  return nodes.map((node, index) => ({ ...node, data: { ...node.data, displayNumber: index + 1 } }));
}

/** La guía comienza por el nodo seleccionado y, si no existe, por el primero. */
export function guideStartIndex(nodes: readonly ConceptNode[], selectedId: string | null): number {
  const index = selectedId ? nodes.findIndex(node => node.id === selectedId) : -1;
  return index >= 0 ? index : 0;
}

export function planMultipleConnections(
  nodes: readonly ConceptNode[],
  edges: readonly ConceptEdge[],
  sourceId: string,
  targets: readonly string[],
  relation: ArgumentRelation,
  makeId: () => string,
): { created: ConceptEdge[]; ignored: number } {
  const ids = new Set(nodes.map(node => node.id));
  if (!ids.has(sourceId)) throw new Error('Seleccione un nodo de origen existente.');
  const present = new Set(edges.map(edge => `${edge.source}\u0000${edge.target}`));
  const seen = new Set<string>();
  const created: ConceptEdge[] = [];
  let ignored = 0;
  for (const targetId of targets) {
    const key = `${sourceId}\u0000${targetId}`;
    if (!ids.has(targetId) || targetId === sourceId || present.has(key) || seen.has(targetId)) {
      ignored++;
      continue;
    }
    if (edges.length + created.length >= 160) throw new Error('El esquema admite como máximo 160 conexiones.');
    seen.add(targetId);
    created.push({
      id: makeId(), source: sourceId, target: targetId,
      type: 'smoothstep', label: relationLabels[relation].toLowerCase(),
      data: { relation },
    });
  }
  return { created, ignored };
}
