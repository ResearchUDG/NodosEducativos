/** Lectura cronológica de revisiones privadas: se deriva de instantáneas inmutables.
 * No escribe datos ni crea un registro administrativo independiente.
 */
import type { ConceptEdge, ConceptNode } from './types';
import type { DiagramRevision, DiagramSnapshot } from './diagramHistory';

export type TimelineCategory = 'conceptos' | 'fuentes' | 'relaciones' | 'esquema';
export type TimelineFilter = 'todas' | TimelineCategory;
export type TimelineEvent = { category: TimelineCategory; description: string };
export type TimelineEntry = {
  revision: DiagramRevision;
  previousId: string | null;
  events: TimelineEvent[];
  /** Si faltan revisiones anteriores, no inferimos cambios inexistentes. */
  isComparable: boolean;
  isInitial: boolean;
};

function timeOf(revision: DiagramRevision): number | null {
  const stamp = revision.savedAt as { seconds?: number; nanoseconds?: number; toDate?: () => Date } | null | undefined;
  if (typeof stamp?.seconds === 'number') return stamp.seconds * 1000 + (stamp.nanoseconds ?? 0) / 1e6;
  if (typeof stamp?.toDate === 'function') {
    const time = stamp.toDate().getTime();
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

/** La revisión base siempre precede a los guardados, aunque compartan fecha. */
export function sortRevisionsChronologically(revisions: DiagramRevision[]): DiagramRevision[] {
  return [...revisions].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'baseline' ? -1 : 1;
    const a = timeOf(left); const b = timeOf(right);
    if (a !== null && b !== null && a !== b) return a - b;
    if (a === null && b !== null) return 1;
    if (b === null && a !== null) return -1;
    return left.id.localeCompare(right.id);
  });
}

function name(node: ConceptNode | undefined): string {
  return (node?.data.title ?? 'Sin título').trim() || 'Sin título';
}
function value(text: unknown): string { return typeof text === 'string' ? text : ''; }
function sortedReferences(node: ConceptNode | undefined): string[] {
  return (node?.data.references ?? []).map(ref => JSON.stringify([
    value(ref.author).trim(), value(ref.work).trim(), value(ref.year).trim(),
    value(ref.locator).trim(), value(ref.url).trim(),
  ])).sort();
}
function connectionLabel(edge: ConceptEdge, nodes: Map<string, ConceptNode>): string {
  const source = name(nodes.get(edge.source));
  const target = name(nodes.get(edge.target));
  return `«${source}» → «${target}»`;
}

/** Describe hechos observables: no asume intenciones ni validez de una fuente. */
export function describeRevisionChanges(before: DiagramSnapshot, after: DiagramSnapshot): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (before.title !== after.title) events.push({ category: 'esquema', description: `Se cambió el título a «${after.title}».` });
  if (before.description !== after.description) events.push({ category: 'esquema', description: 'Se actualizó la descripción del esquema.' });

  const oldNodes = new Map(before.nodes.map(node => [node.id, node]));
  const newNodes = new Map(after.nodes.map(node => [node.id, node]));
  for (const [id, node] of newNodes) {
    const previous = oldNodes.get(id);
    if (!previous) {
      events.push({ category: 'conceptos', description: `Se añadió «${name(node)}».` });
      if (node.data.references?.length) events.push({ category: 'fuentes', description: `Se añadieron ${node.data.references.length} fuente(s) a «${name(node)}».` });
      continue;
    }
    if (previous.data.title !== node.data.title || previous.data.description !== node.data.description || previous.data.category !== node.data.category) {
      events.push({ category: 'conceptos', description: `Se editó «${name(node)}».` });
    } else if (JSON.stringify(previous.position) !== JSON.stringify(node.position)) {
      events.push({ category: 'conceptos', description: `Se cambió la posición de «${name(node)}».` });
    }
    if (JSON.stringify(sortedReferences(previous)) !== JSON.stringify(sortedReferences(node))) {
      const works = (node.data.references ?? []).map(ref => value(ref.work).trim()).filter(Boolean);
      events.push({ category: 'fuentes', description: works.length
        ? `Se actualizó la bibliografía de «${name(node)}»: ${works.slice(0, 2).join('; ')}${works.length > 2 ? '…' : ''}.`
        : `Se quitaron las fuentes de «${name(node)}».` });
    }
  }
  for (const [id, node] of oldNodes) {
    if (!newNodes.has(id)) events.push({ category: 'conceptos', description: `Se quitó «${name(node)}».` });
  }

  const oldEdges = new Map(before.edges.map(edge => [edge.id, edge]));
  const newEdges = new Map(after.edges.map(edge => [edge.id, edge]));
  for (const [id, edge] of newEdges) {
    const previous = oldEdges.get(id);
    if (!previous) events.push({ category: 'relaciones', description: `Nueva conexión: ${connectionLabel(edge, newNodes)}.` });
    else if (JSON.stringify([previous.source, previous.target, previous.label, previous.data?.relation]) !==
      JSON.stringify([edge.source, edge.target, edge.label, edge.data?.relation])) {
      events.push({ category: 'relaciones', description: `Se modificó la relación ${connectionLabel(edge, newNodes)}.` });
    }
  }
  for (const [id, edge] of oldEdges) {
    if (!newEdges.has(id)) events.push({ category: 'relaciones', description: `Se quitó la conexión ${connectionLabel(edge, oldNodes)}.` });
  }
  return events;
}

/**
 * listDiagramRevisions devuelve solo los 50 guardados más recientes (+ baseline).
 * Si hay 50 guardados, el primer salto desde baseline puede ocultar revisiones:
 * no presentamos esa diferencia como si fuera una única edición.
 */
export function buildRevisionTimeline(revisions: DiagramRevision[]): TimelineEntry[] {
  const ordered = sortRevisionsChronologically(revisions);
  const truncated = ordered.filter(item => item.kind === 'save').length >= 50;
  return ordered.map((revision, index) => {
    const previous = ordered[index - 1];
    const uncertainGap = truncated && previous?.kind === 'baseline';
    const isComparable = Boolean(previous) && !uncertainGap;
    return {
      revision,
      previousId: isComparable ? previous.id : null,
      events: isComparable ? describeRevisionChanges(previous, revision) : [],
      isComparable,
      isInitial: revision.kind === 'baseline',
    };
  }).reverse(); // más reciente primero
}

export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  return filter === 'todas' ? entries : entries.filter(entry => entry.events.some(event => event.category === filter));
}
