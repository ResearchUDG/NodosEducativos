/** Historial de borradores 2D: las revisiones no se mezclan con publicaciones estudiantiles. */
import type { ConceptEdge, ConceptNode, Diagram } from './types';

export type DiagramSnapshot = Pick<Diagram, 'title' | 'description' | 'nodes' | 'edges'>;
export type DiagramRevision = DiagramSnapshot & {
  id: string;
  kind: 'baseline' | 'save';
  authorUid: string;
  savedAt?: unknown;
};

export function timestampKey(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const stamp = value as { seconds?: number; nanoseconds?: number };
  return typeof stamp.seconds === 'number' && typeof stamp.nanoseconds === 'number'
    ? `${stamp.seconds}:${stamp.nanoseconds}` : '';
}

export function assertNoConcurrentEdit(expectedUpdatedAt: string, actualUpdatedAt: unknown): void {
  if (expectedUpdatedAt !== timestampKey(actualUpdatedAt)) {
    throw new Error('Otra sesión modificó este esquema. Sus cambios no se guardaron. Copie su trabajo antes de recargar para evitar perderlo.');
  }
}

export function snapshotFromDiagram(value: Partial<Diagram>): DiagramSnapshot {
  return {
    title: String(value.title ?? 'Sin título'),
    description: String(value.description ?? ''),
    nodes: Array.isArray(value.nodes) ? value.nodes as ConceptNode[] : [],
    edges: Array.isArray(value.edges) ? value.edges as ConceptEdge[] : [],
  };
}

export type DiagramDiff = {
  titleChanged: boolean;
  descriptionChanged: boolean;
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
  edgesAdded: number;
  edgesRemoved: number;
  edgesChanged: number;
  referencesChanged: number;
  changedConcepts: string[];
};

/** Comparación por ID y contenido de investigación, independiente del orden en arrays. */
export function compareDiagramSnapshots(previous: DiagramSnapshot, next: DiagramSnapshot): DiagramDiff {
  const oldNodes = new Map(previous.nodes.map(node => [node.id, node]));
  const newNodes = new Map(next.nodes.map(node => [node.id, node]));
  const oldEdges = new Map(previous.edges.map(edge => [edge.id, edge]));
  const newEdges = new Map(next.edges.map(edge => [edge.id, edge]));
  const refs = (node: ConceptNode) => JSON.stringify(node.data.references ?? []);
  let nodesAdded = 0; let nodesRemoved = 0; let nodesChanged = 0; let referencesChanged = 0;
  const changedConcepts: string[] = [];
  for (const [id, node] of newNodes) {
    const old = oldNodes.get(id);
    if (!old) { nodesAdded++; changedConcepts.push(`Añadido: ${node.data.title}`); continue; }
    const oldCore = { title: old.data.title, description: old.data.description, category: old.data.category, critical: old.data.critical === true, position: old.position };
    const newCore = { title: node.data.title, description: node.data.description, category: node.data.category, critical: node.data.critical === true, position: node.position };
    const bibliographyChanged = refs(old) !== refs(node);
    if (bibliographyChanged) referencesChanged++;
    if (bibliographyChanged || JSON.stringify(oldCore) !== JSON.stringify(newCore)) {
      nodesChanged++; changedConcepts.push(`Modificado: ${node.data.title}`);
    }
  }
  for (const [id, node] of oldNodes) if (!newNodes.has(id)) {
    nodesRemoved++; changedConcepts.push(`Quitado: ${node.data.title}`);
  }
  let edgesChanged = 0;
  for (const [id, edge] of newEdges) {
    const old = oldEdges.get(id);
    if (old && JSON.stringify({ source: old.source, target: old.target, label: old.label, relation: old.data?.relation })
      !== JSON.stringify({ source: edge.source, target: edge.target, label: edge.label, relation: edge.data?.relation })) edgesChanged++;
  }
  return {
    titleChanged: previous.title !== next.title,
    descriptionChanged: previous.description !== next.description,
    nodesAdded, nodesRemoved,
    nodesChanged, referencesChanged,
    edgesAdded: [...newEdges.keys()].filter(id => !oldEdges.has(id)).length,
    edgesRemoved: [...oldEdges.keys()].filter(id => !newEdges.has(id)).length,
    edgesChanged, changedConcepts,
  };
}

export function revisionDate(value: unknown): string {
  if (!value || typeof value !== 'object') return 'Sin fecha';
  const stamp = value as { toDate?: () => Date };
  if (typeof stamp.toDate !== 'function') return 'Sin fecha';
  return stamp.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}
