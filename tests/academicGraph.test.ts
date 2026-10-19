import { describe, expect, it } from 'vitest';
import { blankReference, safeReferenceUrl, serializeAcademicGraph, validateAcademicGraph } from '../src/lib/academicGraph';
import { selectPublishedGraph } from '../src/lib/publicationPolicy';
import type { ConceptNode, ConceptEdge } from '../src/lib/types';

const node = (id: string): ConceptNode => ({
  id, type: 'concept', position: { x: 10, y: 20 },
  data: { category: 'idea', title: id, description: 'una idea',
    references: [{ author: 'Kant', work: 'Crítica de la razón pura', year: '1781', locator: 'A51/B75', url: 'https://example.org/texto' }] },
});
const edge: ConceptEdge = { id: 'ab', source: 'a', target: 'b', label: 'fundamenta', type: 'smoothstep', data: { relation: 'fundamenta' } };

describe('Modelo académico del laboratorio 2D', () => {
  it('preserva bibliografía y relaciones argumentativas al guardar', () => {
    const graph = serializeAcademicGraph([node('a'), node('b')], [edge]);
    expect(graph.nodes[0].data.references?.[0].locator).toBe('A51/B75');
    expect(graph.edges[0].data?.relation).toBe('fundamenta');
  });
  it('elimina propiedades efímeras de React Flow', () => {
    const n = { ...node('a'), selected: true, width: 300, data: { ...node('a').data, highlight: true } };
    const graph = serializeAcademicGraph([n], []);
    expect(graph.nodes[0]).not.toHaveProperty('selected');
    expect(graph.nodes[0].data).not.toHaveProperty('highlight');
    expect(graph.nodes[0]).not.toHaveProperty('width');
  });
  it('acepta una referencia sin enlace y conserva sus datos en una lectura posterior', () => {
    const n = node('a');
    n.data.references = [{ author: 'Kant', work: 'Crítica de la razón pura', year: '1781', locator: 'A51/B75', url: '' }];
    const persisted = JSON.parse(JSON.stringify(serializeAcademicGraph([n], [])));
    expect(persisted.nodes[0].data.references[0].work).toBe('Crítica de la razón pura');
    expect(persisted.nodes[0].data.references[0].url).toBe('');
  });
  it('es compatible con sistemas anteriores sin referencias ni relación tipificada', () => {
    const old = node('a'); delete old.data.references;
    const result = serializeAcademicGraph([old], []);
    expect(result.nodes[0].data.references).toBeUndefined();
  });
  it('bloquea bibliografía incompleta o enlaces de protocolo peligroso', () => {
    const n = node('a'); n.data.references = [{ ...blankReference(), author: 'Autor' }];
    expect(validateAcademicGraph([n], [])).toMatch(/Complete la obra/);
    n.data.references = [{ ...blankReference(), work: 'Fuente', url: 'javascript:alert(1)' }];
    expect(validateAcademicGraph([n], [])).toMatch(/URL http/);
    expect(safeReferenceUrl('javascript:alert(1)')).toBe('');
  });
  it('limita el número de referencias y descarta conexiones huérfanas', () => {
    const n = node('a'); n.data.references = Array.from({length: 5}, () => ({...blankReference(), work:'obra'}));
    expect(validateAcademicGraph([n], [])).toMatch(/cuatro referencias/);
    n.data.references = [];
    expect(validateAcademicGraph([n], [edge])).toMatch(/nodos inexistentes/);
  });
  it('la publicación selectiva nunca envía fuentes de nodos ocultos', () => {
    const graph = serializeAcademicGraph([node('a'), node('b')], [edge]);
    const visible = selectPublishedGraph(graph.nodes, graph.edges, ['a']);
    expect(visible.nodes).toHaveLength(1);
    expect(visible.nodes[0].data.references?.[0].author).toBe('Kant');
    expect(visible.edges).toHaveLength(0);
    expect(JSON.stringify(visible)).not.toContain('"id":"b"');
  });
  it('una fuente incompleta de un nodo oculto no bloquea el grafo seleccionado', () => {
    const hidden = node('b'); hidden.data.references = [{ ...blankReference(), author: 'Incompleto' }];
    const selection = selectPublishedGraph([node('a'), hidden], [edge], ['a']);
    expect(() => serializeAcademicGraph(selection.nodes, selection.edges)).not.toThrow();
  });
  it('la publicación con ambos nodos conserva la relación tipificada', () => {
    const graph = serializeAcademicGraph([node('a'), node('b')], [edge]);
    const visible = selectPublishedGraph(graph.nodes, graph.edges, ['a','b']);
    expect(visible.edges[0].data?.relation).toBe('fundamenta');
  });
});
