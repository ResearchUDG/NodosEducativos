import { describe, expect, it } from 'vitest';
import { buildConceptHistory, describeConceptChanges, describeConnectionChanges, describeReferenceChanges, filterConceptHistory } from '../src/lib/conceptHistory';
import type { ConceptNode, ConceptEdge, AcademicReference } from '../src/lib/types';
import type { DiagramRevision, DiagramSnapshot } from '../src/lib/diagramHistory';

const reference = (work: string, locator = 'p. 12', author = 'Kant'): AcademicReference => ({
  author, work, year: '1781', locator, url: '',
});
const node = (id: string, title: string, refs: AcademicReference[] = [], x = 0): ConceptNode => ({
  id, type: 'concept', position: { x, y: 0 },
  data: { title, description: 'Descripción', category: 'idea', references: refs },
});
const edge = (id: string, source: string, target: string, relation = 'fundamenta'): ConceptEdge => ({
  id, source, target, label: relation, data: { relation: relation as 'fundamenta' },
});
const snap = (nodes: ConceptNode[], edges: ConceptEdge[] = []): DiagramSnapshot => ({ title: 'Mapa', description: '', nodes, edges });
const rev = (id: string, time: number, value: DiagramSnapshot, kind: 'baseline' | 'save' = 'save'): DiagramRevision => ({
  ...value, id, kind, authorUid: 'investigador', savedAt: { seconds: time, nanoseconds: 0 },
});

describe('Fase 3d: evolución privada de un concepto', () => {
  it('identifica el mismo nodo tras cambiar de nombre mediante su ID', () => {
    const baseline = rev('baseline', 1, snap([node('a', 'La idea')]), 'baseline');
    const v1 = rev('v1', 2, snap([node('a', 'La tesis')]));
    const events = buildConceptHistory([v1, baseline], 'a');
    expect(events.map(item => item.revision.id)).toEqual(['v1', 'baseline']);
    expect(events[0].events[0].description).toContain('«La idea» a «La tesis»');
  });
  it('solo presenta cambios del concepto solicitado, no de otro nodo', () => {
    const start = snap([node('a', 'A'), node('b', 'B')]);
    const end = snap([node('a', 'A'), node('b', 'B corregido')]);
    expect(describeConceptChanges(start, end, 'a')).toEqual([]);
    const timeline = buildConceptHistory([rev('old', 1, start), rev('new', 2, end)], 'a');
    expect(timeline).toHaveLength(1);
    expect(timeline[0].isComparable).toBe(false);
  });
  it('detecta altas, cambios, eliminaciones y reintroducciones sin reescribir el pasado', () => {
    const base = rev('baseline', 1, snap([]), 'baseline');
    const created = rev('create', 2, snap([node('a', 'A')]));
    const removed = rev('delete', 3, snap([]));
    const restored = rev('restore', 4, snap([node('a', 'A revisado')]));
    const entries = buildConceptHistory([restored, removed, created, base], 'a');
    expect(entries.map(item => item.revision.id)).toEqual(['restore', 'delete', 'create']);
    expect(entries[0].events[0].description).toContain('Se añadió');
    expect(entries[1].events[0].description).toContain('Se retiró');
  });
  it('detalla las fuentes añadidas, retiradas y modificadas', () => {
    const before = [reference('Obra A', 'p. 12'), reference('Obra B')];
    const after = [reference('Obra A', 'p. 15'), reference('Obra C')];
    expect(describeReferenceChanges(before, after).map(item => item.description)).toEqual([
      'Se corrigieron datos de «Obra A».',
      'Se retiró la fuente «Obra B».',
      'Se añadió la fuente «Obra C».',
    ]);
  });
  it('no interpreta un simple cambio de orden de bibliografía como revisión', () => {
    const refs = [reference('A'), reference('B')];
    expect(describeReferenceChanges(refs, refs.toReversed())).toEqual([]);
  });
  it('detecta relaciones añadidas y cambios de tipo solo para el nodo afectado', () => {
    const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C')];
    const a = snap(nodes, [edge('e', 'a', 'b')]);
    const b = snap(nodes, [edge('e', 'a', 'b', 'refuta'), edge('f', 'b', 'c')]);
    expect(describeConnectionChanges(a, b, 'a').map(item => item.description)).toEqual([
      'Se modificó una relación con «B» (ahora: «refuta»).',
    ]);
    expect(describeConnectionChanges(a, b, 'b')).toHaveLength(2);
  });
  it('registra relaciones eliminadas o redirigidas fuera del concepto', () => {
    const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C')];
    const previous = snap(nodes, [edge('e', 'a', 'b')]);
    const current = snap(nodes, [edge('e', 'b', 'c')]);
    expect(describeConnectionChanges(previous, current, 'a')[0].description).toContain('Se retiró');
    expect(describeConnectionChanges(previous, current, 'c')[0].description).toContain('Se añadió');
    expect(describeConnectionChanges(previous, current, 'b')[0].description).toContain('Se modificó');
  });
  it('conserva información del estado inicial sin afirmar cuándo nació el concepto', () => {
    const entries = buildConceptHistory([rev('baseline', 1, snap([node('a', 'A')]), 'baseline')], 'a');
    expect(entries).toHaveLength(1);
    expect(entries[0].isInitial).toBe(true);
    expect(entries[0].events).toEqual([]);
  });
  it('evita atribuir cambios entre baseline y el primer guardado truncado', () => {
    const base = rev('baseline', 0, snap([node('a', 'A')]), 'baseline');
    const saves = Array.from({ length: 50 }, (_, i) => rev(`v${i.toString().padStart(2,'0')}`, i + 1,
      snap([node('a', i === 0 ? 'Renombrado' : `Versión ${i}`)])));
    const entries = buildConceptHistory([base, ...saves], 'a');
    const first = entries.find(item => item.revision.id === 'v00');
    expect(first).toBeDefined();
    expect(first?.isComparable).toBe(false);
    expect(first?.events).toEqual([]);
    expect(entries.find(item => item.revision.id === 'v01')?.isComparable).toBe(true);
  });
  it('filtra por concepto, bibliografía o relaciones y no muta el historial', () => {
    const base = rev('baseline', 1, snap([node('a','A')]), 'baseline');
    const v1 = rev('v1', 2, snap([node('a','A', [reference('Libro')])]));
    const v2 = rev('v2', 3, snap([node('a','A cambiado', [reference('Libro')])]));
    const list = buildConceptHistory([v2, base, v1], 'a');
    expect(filterConceptHistory(list, 'bibliografia').map(item => item.revision.id)).toEqual(['v1']);
    expect(filterConceptHistory(list, 'concepto').map(item => item.revision.id)).toEqual(['v2']);
    expect(filterConceptHistory(list, 'relaciones')).toEqual([]);
    expect(list).toHaveLength(3);
  });
  it('no escribe nuevos documentos ni depende de una consulta adicional', () => {
    const prior = rev('baseline', 1, snap([node('a','A')]), 'baseline');
    const text = JSON.stringify(prior);
    buildConceptHistory([prior], 'a');
    expect(JSON.stringify(prior)).toBe(text);
  });
});
