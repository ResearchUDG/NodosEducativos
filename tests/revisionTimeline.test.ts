import { describe, expect, it } from 'vitest';
import { buildRevisionTimeline, describeRevisionChanges, filterTimeline, sortRevisionsChronologically } from '../src/lib/revisionTimeline';
import type { DiagramRevision, DiagramSnapshot } from '../src/lib/diagramHistory';
import type { ConceptNode, ConceptEdge } from '../src/lib/types';
const ref = (work: string) => ({ author: 'Kant', work, year: '1781', locator: 'A51', url: '' });
const node = (id: string, title: string, works: string[] = [], x = 0): ConceptNode => ({
  id, type: 'concept', position: { x, y: 0 },
  data: { title, description: '', category: 'idea', references: works.map(ref) },
});
const edge = (id: string, source: string, target: string, relation = 'fundamenta'): ConceptEdge => ({
  id, source, target, type: 'smoothstep', label: relation, data: { relation: relation as 'fundamenta' },
});
const snap = (title: string, nodes: ConceptNode[], edges: ConceptEdge[] = []): DiagramSnapshot => ({ title, description: '', nodes, edges });
const revision = (id: string, seconds: number, value: DiagramSnapshot, kind: 'save'|'baseline' = 'save'): DiagramRevision => ({
  ...value, id, authorUid: 'prof', kind, savedAt: { seconds, nanoseconds: 0 },
});

describe('Línea de tiempo de versiones académicas', () => {
  it('ordena por fecha, pero sitúa la base primero aun si comparte marca de tiempo', () => {
    const base = revision('baseline', 100, snap('Inicial', []), 'baseline');
    const first = revision('a', 100, snap('Inicial', [node('n', 'Kant')]));
    const second = revision('b', 101, snap('Actual', [node('n', 'Kant')]));
    expect(sortRevisionsChronologically([second, first, base]).map(item => item.id)).toEqual(['baseline', 'a', 'b']);
    const timeline = buildRevisionTimeline([second, base, first]);
    expect(timeline.map(item => item.revision.id)).toEqual(['b', 'a', 'baseline']);
    expect(timeline[1].previousId).toBe('baseline');
  });
  it('explica adiciones, edición de conceptos y fuentes, y relaciones', () => {
    const before = snap('Mi mapa', [node('a','Ontología'), node('b','Ética')]);
    const after = snap('El ser', [node('a','Ontología kantiana',['Crítica de la razón pura']), node('b','Ética')], [edge('e','a','b')]);
    const changes = describeRevisionChanges(before, after);
    expect(changes.map(item => item.category)).toEqual(['esquema','conceptos','fuentes','relaciones']);
    expect(changes.some(item => item.description.includes('Crítica de la razón pura'))).toBe(true);
  });
  it('detecta modificación y retiro de referencias sin inventar nuevos títulos', () => {
    const before = snap('Mapa', [node('n', 'Idea', ['Obra A'])]);
    const after = snap('Mapa', [node('n', 'Idea', [])]);
    expect(describeRevisionChanges(before, after)).toContainEqual({ category:'fuentes', description:'Se quitaron las fuentes de «Idea».' });
  });
  it('ignora reordenamiento de referencias, pero detecta cambios de posición', () => {
    const before = snap('Mapa', [node('n','Idea',['A','B'])]);
    const after = snap('Mapa', [node('n','Idea',['B','A'], 25)]);
    expect(describeRevisionChanges(before, after)).toEqual([{category:'conceptos',description:'Se cambió la posición de «Idea».'}]);
  });
  it('reconoce eliminación de nodos y conexiones', () => {
    const before = snap('Mapa',[node('a','A'),node('b','B')],[edge('e','a','b')]);
    const result = describeRevisionChanges(before,snap('Mapa',[node('a','A')]));
    expect(result.map(event => event.category)).toEqual(['conceptos','relaciones']);
  });
  it('filtra cambios por su categoría sin escribir o modificar revisiones', () => {
    const base = revision('baseline', 10, snap('Mapa',[]),'baseline');
    const next = revision('s1', 11, snap('Mapa',[node('a','Idea')]));
    const timeline = buildRevisionTimeline([next,base]);
    expect(filterTimeline(timeline,'conceptos').map(item => item.revision.id)).toEqual(['s1']);
    expect(filterTimeline(timeline,'fuentes')).toEqual([]);
    expect(filterTimeline(timeline,'todas')).toHaveLength(2);
  });
  it('evita inferir cambios consecutivos si los 50 guardados visibles pueden omitir revisiones', () => {
    const baseline = revision('baseline',0,snap('Inicial',[]),'baseline');
    const saves = Array.from({length:50},(_,i) => revision(`s${i}`,i+1,snap(`Versión ${i}`,[node('a',`Nodo ${i}`)])));
    const timeline = buildRevisionTimeline([baseline,...saves]);
    expect(timeline.find(item => item.revision.id === 's0')?.isComparable).toBe(false);
    expect(timeline.find(item => item.revision.id === 's1')?.previousId).toBe('s0');
  });
  it('admite versiones heredadas sin fecha ni estado inicial', () => {
    const old = {...revision('a',1,snap('Mapa',[])),savedAt:undefined};
    expect(buildRevisionTimeline([old])).toMatchObject([{previousId:null,isComparable:false,isInitial:false}]);
  });
});
