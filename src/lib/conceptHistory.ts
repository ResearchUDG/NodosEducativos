/** Fase 3d: trayectoria privada de un concepto, inferida solo de revisiones disponibles.
 * Conserva el ID estable del nodo; no escribe nuevas colecciones ni modifica revisiones.
 */
import type { AcademicReference, ConceptEdge, ConceptNode } from './types';
import type { DiagramRevision, DiagramSnapshot } from './diagramHistory';
import { buildRevisionTimeline } from './revisionTimeline';

export type ConceptEventCategory = 'concepto' | 'bibliografia' | 'relaciones';
export type ConceptEventFilter = 'todos' | ConceptEventCategory;
export type ConceptHistoryEvent = { category: ConceptEventCategory; description: string };
export type ConceptHistoryEntry = {
  revision: DiagramRevision;
  previousId: string | null;
  nodeTitle: string;
  nodePresent: boolean;
  referencesCount: number;
  relationsCount: number;
  isInitial: boolean;
  isComparable: boolean;
  events: ConceptHistoryEvent[];
};

const label = (node: ConceptNode | undefined) => node?.data.title?.trim() || 'Sin título';
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const refKey = (ref: AcademicReference) => JSON.stringify([
  text(ref.author), text(ref.work), text(ref.year), text(ref.locator), text(ref.url),
]);
const work = (ref: AcademicReference) => text(ref.work) || 'Sin título';
function refGroup(ref: AcademicReference): string {
  return JSON.stringify([text(ref.author).toLocaleLowerCase('es'), text(ref.work).toLocaleLowerCase('es')]);
}
function multiset(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}
function sameReferences(a: AcademicReference[], b: AcademicReference[]): boolean {
  const left = multiset(a.map(refKey));
  const right = multiset(b.map(refKey));
  return left.size === right.size && [...left].every(([key, n]) => right.get(key) === n);
}

/** Detalla altas, bajas y cambios de datos bibliográficos, sin validar su autenticidad. */
export function describeReferenceChanges(before: AcademicReference[], after: AcademicReference[]): ConceptHistoryEvent[] {
  if (sameReferences(before, after)) return [];
  const events: ConceptHistoryEvent[] = [];
  const oldGroups = new Map<string, AcademicReference[]>();
  const newGroups = new Map<string, AcademicReference[]>();
  for (const ref of before) { const key = refGroup(ref); oldGroups.set(key, [...(oldGroups.get(key) ?? []), ref]); }
  for (const ref of after) { const key = refGroup(ref); newGroups.set(key, [...(newGroups.get(key) ?? []), ref]); }
  for (const group of new Set([...oldGroups.keys(), ...newGroups.keys()])) {
    const oldRefs = oldGroups.get(group) ?? [];
    const newRefs = newGroups.get(group) ?? [];
    const unmatchedOld = [...oldRefs];
    const unmatchedNew: AcademicReference[] = [];
    for (const ref of newRefs) {
      const match = unmatchedOld.findIndex(old => refKey(old) === refKey(ref));
      if (match >= 0) unmatchedOld.splice(match, 1);
      else unmatchedNew.push(ref);
    }
    // Mismo autor y obra con información de edición diferente: cambio, no fuente nueva.
    while (unmatchedOld.length && unmatchedNew.length) {
      unmatchedOld.shift();
      const changed = unmatchedNew.shift()!;
      events.push({ category: 'bibliografia', description: `Se corrigieron datos de «${work(changed)}».` });
    }
    for (const ref of unmatchedNew) events.push({ category: 'bibliografia', description: `Se añadió la fuente «${work(ref)}».` });
    for (const ref of unmatchedOld) events.push({ category: 'bibliografia', description: `Se retiró la fuente «${work(ref)}».` });
  }
  return events;
}

const linked = (edge: ConceptEdge, id: string) => edge.source === id || edge.target === id;
function partner(edge: ConceptEdge, id: string, nodes: Map<string, ConceptNode>): string {
  const other = edge.source === id ? edge.target : edge.source;
  return `«${label(nodes.get(other))}»`;
}
const edgeSignature = (edge: ConceptEdge) => JSON.stringify([
  edge.source, edge.target, text(edge.label), edge.data?.relation ?? '',
]);
function relation(edge: ConceptEdge): string {
  return text(edge.label) || text(edge.data?.relation) || 'sin clasificar';
}

/** Una relación se atribuye a un nodo si lo toca antes o después de editarla. */
export function describeConnectionChanges(
  previous: DiagramSnapshot, next: DiagramSnapshot, id: string,
): ConceptHistoryEvent[] {
  const events: ConceptHistoryEvent[] = [];
  const oldEdges = new Map(previous.edges.map(edge => [edge.id, edge]));
  const newEdges = new Map(next.edges.map(edge => [edge.id, edge]));
  const oldNodes = new Map(previous.nodes.map(node => [node.id, node]));
  const newNodes = new Map(next.nodes.map(node => [node.id, node]));
  for (const edgeId of new Set([...oldEdges.keys(), ...newEdges.keys()])) {
    const old = oldEdges.get(edgeId);
    const current = newEdges.get(edgeId);
    const wasLinked = Boolean(old && linked(old, id));
    const nowLinked = Boolean(current && linked(current, id));
    if (!wasLinked && !nowLinked) continue;
    if (!wasLinked && current) events.push({ category: 'relaciones',
      description: `Se añadió la relación «${relation(current)}» con ${partner(current, id, newNodes)}.` });
    else if (!nowLinked && old) events.push({ category: 'relaciones',
      description: `Se retiró la relación «${relation(old)}» con ${partner(old, id, oldNodes)}.` });
    else if (old && current && edgeSignature(old) !== edgeSignature(current)) events.push({ category: 'relaciones',
      description: `Se modificó una relación con ${partner(current, id, newNodes)} (ahora: «${relation(current)}»).` });
  }
  return events;
}

/** El mismo concepto se reconoce por ID aunque se renombre. */
export function describeConceptChanges(
  before: DiagramSnapshot, after: DiagramSnapshot, id: string,
): ConceptHistoryEvent[] {
  const old = before.nodes.find(node => node.id === id);
  const current = after.nodes.find(node => node.id === id);
  if (!old && !current) return [];
  const changes: ConceptHistoryEvent[] = [];
  if (!old && current) {
    changes.push({ category: 'concepto', description: `Se añadió el concepto «${label(current)}».` });
    for (const ref of current.data.references ?? []) {
      changes.push({ category: 'bibliografia', description: `Se añadió la fuente «${work(ref)}».` });
    }
  } else if (old && !current) {
    changes.push({ category: 'concepto', description: `Se retiró el concepto «${label(old)}».` });
    // Las fuentes desaparecieron con el concepto; no inventar ediciones independientes.
  } else if (old && current) {
    if (old.data.title !== current.data.title) changes.push({ category: 'concepto',
      description: `Cambió de «${label(old)}» a «${label(current)}».` });
    if (old.data.description !== current.data.description) changes.push({ category: 'concepto',
      description: 'Se modificó la explicación del concepto.' });
    if (JSON.stringify(old.data.qa ?? []) !== JSON.stringify(current.data.qa ?? [])) changes.push({ category: 'concepto',
      description: 'Se modificaron las preguntas y respuestas del concepto.' });
    if (old.data.category !== current.data.category) changes.push({ category: 'concepto',
      description: 'Se cambió el tipo de concepto.' });
    if ((old.data.critical === true) !== (current.data.critical === true)) changes.push({ category: 'concepto',
      description: current.data.critical === true ? 'Se destacó el nodo como crítico.' : 'Se retiró la marca de nodo crítico.' });
    if (JSON.stringify(old.position) !== JSON.stringify(current.position)) changes.push({ category: 'concepto',
      description: 'Se movió el concepto en el mapa.' });
    changes.push(...describeReferenceChanges(old.data.references ?? [], current.data.references ?? []));
  }
  changes.push(...describeConnectionChanges(before, after, id));
  return changes;
}

/** No infiere eventos a través de revisiones faltantes o de la base a una ventana truncada. */
export function buildConceptHistory(revisions: DiagramRevision[], nodeId: string): ConceptHistoryEntry[] {
  if (!nodeId) return [];
  const byId = new Map(revisions.map(revision => [revision.id, revision]));
  const timeline = buildRevisionTimeline(revisions);
  const entries: ConceptHistoryEntry[] = [];
  for (const item of timeline) {
    const { revision, previousId, isInitial, isComparable } = item;
    const previous = previousId ? byId.get(previousId) : undefined;
    const node = revision.nodes.find(candidate => candidate.id === nodeId);
    const old = previous?.nodes.find(candidate => candidate.id === nodeId);
    if (!node && !old) continue;
    const events = isComparable && previous ? describeConceptChanges(previous, revision, nodeId) : [];
    if (isComparable && events.length === 0) continue; // Solo hechos significativos por concepto.
    entries.push({
      revision, previousId, isInitial, isComparable,
      nodeTitle: label(node ?? old), nodePresent: Boolean(node),
      referencesCount: node?.data.references?.length ?? 0,
      relationsCount: revision.edges.filter(edge => linked(edge, nodeId)).length,
      events,
    });
  }
  return entries;
}

export function filterConceptHistory(entries: ConceptHistoryEntry[], filter: ConceptEventFilter): ConceptHistoryEntry[] {
  return filter === 'todos' ? entries : entries.filter(entry => entry.events.some(event => event.category === filter));
}
