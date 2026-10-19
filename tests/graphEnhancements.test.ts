import { describe, expect, it } from 'vitest';
import { guideStartIndex, numberedNodes, planMultipleConnections } from '../src/lib/graphEnhancements';
import { serializeAcademicGraph } from '../src/lib/academicGraph';
import { compareDiagramSnapshots } from '../src/lib/diagramHistory';
import { describeConceptChanges } from '../src/lib/conceptHistory';
import type { ConceptNode, ConceptEdge } from '../src/lib/types';
const node = (id: string): ConceptNode => ({ id, type: 'concept', position: { x: 10, y: 20 }, data: { title: id, category: 'idea', description: '' } });
const nodes = [node('a'), node('b'), node('c')];
const old: ConceptEdge = { id: 'one', source: 'a', target: 'b', type: 'smoothstep', label: 'fundamenta', data: { relation: 'fundamenta' } };

describe('Presentación académica de nodos — fase 3h', () => {
  it('numera en orden y no modifica los datos originales', () => {
    const result = numberedNodes(nodes);
    expect(result.map(n => n.data.displayNumber)).toEqual([1, 2, 3]);
    expect(nodes[0].data.displayNumber).toBeUndefined();
  });
  it('inicia la guía en el nodo seleccionado y cae al primero si no existe', () => {
    expect(guideStartIndex(nodes, 'c')).toBe(2);
    expect(guideStartIndex(nodes, 'inexistente')).toBe(0);
    expect(guideStartIndex(nodes, null)).toBe(0);
  });
  it('conecta varios destinos sin repetir ni modificar conexiones previas', () => {
    let sequence = 0;
    const result = planMultipleConnections(nodes, [old], 'a', ['b','c','c','a','desconocido'], 'refuta', () => `new-${++sequence}`);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({source:'a',target:'c',data:{relation:'refuta'}});
    expect(result.ignored).toBe(4);
    expect(old.data?.relation).toBe('fundamenta');
  });
  it('rechaza un origen inexistente y el límite de conexiones', () => {
    expect(() => planMultipleConnections(nodes, [], 'x', ['a'], 'define', () => 'x')).toThrow(/origen/);
    const full = Array.from({length:160}, (_,i) => ({...old, id:`id-${i}`}));
    expect(() => planMultipleConnections(nodes, full, 'b', ['c'], 'define', () => 'x')).toThrow(/160/);
  });
  it('el historial registra cuándo un nodo se marca como crítico', () => {
    const before = {title:'Prueba',description:'',nodes:[node('a')],edges:[]};
    const after = {...before,nodes:[{...node('a'),data:{...node('a').data,critical:true}}]};
    expect(compareDiagramSnapshots(before,after).nodesChanged).toBe(1);
    expect(describeConceptChanges(before,after,'a').some(change=>change.description.includes('crítico'))).toBe(true);
  });
  it('guarda criticidad, pero nunca la numeración ni el estado de selección', () => {
    const result = serializeAcademicGraph([{...node('a'), data:{ ...node('a').data, critical:true, displayNumber:4, batchSource:true, highlight:true }}], []);
    expect(result.nodes[0].data.critical).toBe(true);
    expect(result.nodes[0].data.displayNumber).toBeUndefined();
    expect(result.nodes[0].data.batchSource).toBeUndefined();
    expect(result.nodes[0].data.highlight).toBeUndefined();
  });
});
