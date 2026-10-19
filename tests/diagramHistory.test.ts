import { describe, expect, it } from 'vitest';
import { assertNoConcurrentEdit, compareDiagramSnapshots, snapshotFromDiagram, timestampKey, type DiagramSnapshot } from '../src/lib/diagramHistory';
import type { ConceptEdge, ConceptNode } from '../src/lib/types';
const node = (id: string, title: string, refs = []) => ({
  id, type: 'concept', position: { x: 0, y: 50 }, data: { title, description: '', category: 'idea', references: refs },
}) as ConceptNode;
const edge = (id: string, source: string, target: string, label = 'fundamenta') => ({
  id, source, target, label, data: { relation: 'fundamenta' }, type: 'smoothstep',
}) as ConceptEdge;
const snapshot = (nodes: ConceptNode[], edges: ConceptEdge[] = [], title = 'Mapa'): DiagramSnapshot =>
  ({ title, description: '', nodes, edges });
describe('Diferencias entre revisiones 2D', () => {
  it('reconoce altas, bajas y cambios de conceptos por ID', () => {
    const result = compareDiagramSnapshots(snapshot([node('a', 'A'), node('b', 'B')]), snapshot([node('a', 'A editado'), node('c', 'C')]));
    expect(result).toMatchObject({ nodesAdded: 1, nodesRemoved: 1, nodesChanged: 1 });
    expect(result.changedConcepts).toHaveLength(3);
  });
  it('identifica cambios bibliográficos como modificaciones académicas', () => {
    const a = node('a', 'Kant');
    const b = node('a', 'Kant', [{ author: 'Kant', work: 'Crítica de la razón pura', year: '1781', locator: 'A51', url: '' }]);
    expect(compareDiagramSnapshots(snapshot([a]), snapshot([b]))).toMatchObject({ nodesChanged: 1, referencesChanged: 1 });
  });
  it('cuenta conexiones añadidas, eliminadas y reclasificadas', () => {
    const result = compareDiagramSnapshots(
      snapshot([node('a', 'A'), node('b', 'B')], [edge('vieja', 'a', 'b'), edge('cambio', 'a', 'b')]),
      snapshot([node('a', 'A'), node('b', 'B')], [edge('nueva', 'a', 'b'), edge('cambio', 'a', 'b', 'refuta')]));
    expect(result).toMatchObject({ edgesAdded: 1, edgesRemoved: 1, edgesChanged: 1 });
  });
  it('compara correctamente aunque cambie el orden de los nodos', () => {
    const result = compareDiagramSnapshots(snapshot([node('a', 'A'), node('b', 'B')]), snapshot([node('b', 'B'), node('a', 'A')]));
    expect(result).toMatchObject({ nodesAdded: 0, nodesRemoved: 0, nodesChanged: 0 });
  });
  it('marca el cambio de título aunque el grafo no cambie', () => {
    expect(compareDiagramSnapshots(snapshot([], [], 'Primero'), snapshot([], [], 'Segundo')).titleChanged).toBe(true);
  });
  it('bloquea guardar desde una copia obsoleta', () => {
    expect(() => assertNoConcurrentEdit('10:20', { seconds: 11, nanoseconds: 0 })).toThrow(/Otra sesión/);
    expect(() => assertNoConcurrentEdit('10:20', { seconds: 10, nanoseconds: 20 })).not.toThrow();
  });
  it('mantiene compatibilidad con esquemas heredados sin nodos ni tiempos', () => {
    expect(snapshotFromDiagram({ title: 'Legado' })).toMatchObject({ title: 'Legado', nodes: [], edges: [] });
    expect(timestampKey(undefined)).toBe('');
    expect(timestampKey({ seconds: 10, nanoseconds: 20 })).toBe('10:20');
  });
});
