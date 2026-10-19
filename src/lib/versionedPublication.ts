/** Contrato editorial: solamente instantáneas guardadas, nunca el borrador en edición. */
import { selectPublishedGraph } from './publicationPolicy';
import { serializeAcademicGraph } from './academicGraph';
import type { DiagramRevision } from './diagramHistory';

export function preparePublicationEdition(revision: DiagramRevision, selectedNodeIds: readonly string[]) {
  if (!revision.id || !['baseline', 'save'].includes(revision.kind) || !revision.savedAt) {
    throw new Error('Seleccione una versión guardada para compartir.');
  }
  const eligible = new Set(revision.nodes.map(node => node.id));
  if (!selectedNodeIds.length || selectedNodeIds.some(id => !eligible.has(id))) {
    throw new Error('Seleccione conceptos pertenecientes a la versión elegida.');
  }
  const selection = selectPublishedGraph(revision.nodes, revision.edges, selectedNodeIds);
  const graph = serializeAcademicGraph(selection.nodes, selection.edges);
  if (!graph.nodes.length) throw new Error('Seleccione al menos un concepto para compartir.');
  return {
    title: revision.title,
    description: revision.description,
    nodes: graph.nodes,
    edges: graph.edges,
    sourceRevisionId: revision.id,
    sourceRevisionSavedAt: revision.savedAt,
  };
}
