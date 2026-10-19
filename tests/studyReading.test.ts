import { describe, expect, it } from 'vitest';
import { publishedReadingGraph, readingProgress, readingStep, relationPhrase, studentConnections } from '../src/lib/studyReading';
import type { ConceptEdge, ConceptNode } from '../src/lib/types';

const node = (id: string, title: string, x: number): ConceptNode => ({
  id, type: 'concept', position: { x, y: 80 },
  data: { title, description: `Explicación: ${title}`, category: 'idea' },
});
const shared = [node('a', 'Premisa', 100), node('b', 'Conclusión', 400)];
const privateNode = node('c', 'Nota privada', 750);
const edges: ConceptEdge[] = [
  { id: 'ab', source: 'a', target: 'b', data: { relation: 'fundamenta' } },
  { id: 'bc', source: 'b', target: 'c', data: { relation: 'cuestiona' } },
];

describe('Fase 3f — lectura de una edición publicada', () => {
  it('respeta el orden y las coordenadas originales de los nodos compartidos', () => {
    const graph = publishedReadingGraph(shared, edges);
    expect(graph.nodes.map(n => n.id)).toEqual(['a', 'b']);
    expect(graph.nodes[0].position).toEqual({ x: 100, y: 80 });
    expect(graph.nodes[1].position).toEqual({ x: 400, y: 80 });
    expect(graph.nodes[0]).toBe(shared[0]);
  });
  it('descarta las conexiones cuyos extremos no aparecen en la edición', () => {
    const graph = publishedReadingGraph(shared, edges);
    expect(graph.edges.map(e => e.id)).toEqual(['ab']);
    expect(JSON.stringify(studentConnections(graph.nodes, graph.edges, 'b'))).not.toContain('Nota privada');
  });
  it('explica la dirección argumentativa sin inventar relaciones', () => {
    const outgoing = studentConnections(shared, edges, 'a');
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].explanation).toBe('Según este esquema, «Premisa» fundamenta «Conclusión».');
    expect(outgoing[0].direction).toBe('saliente');
    const incoming = studentConnections(shared, edges, 'b');
    expect(incoming[0].otherNodeId).toBe('a');
    expect(incoming[0].direction).toBe('entrante');
  });
  it('no explica conexiones si el concepto no pertenece a los nodos publicados', () => {
    expect(studentConnections(shared, edges, 'c')).toEqual([]);
  });
  it('ofrece un texto neutral para relaciones antiguas o desconocidas', () => {
    expect(relationPhrase(undefined)).toBe('se relaciona con');
    expect(relationPhrase('relación-inventada')).toBe('se relaciona con');
    expect(relationPhrase('deriva')).toBe('se deriva de');
  });
  it('mantiene el recorrido acotado sin volver automáticamente al inicio', () => {
    expect(readingStep(0, 3, -1)).toBe(0);
    expect(readingStep(1, 3, 1)).toBe(2);
    expect(readingStep(2, 3, 1)).toBe(2);
    expect(readingStep(0, 0, 1)).toBe(0);
  });
  it('calcula el progreso y maneja ediciones vacías', () => {
    expect(readingProgress(0, 4)).toBe(25);
    expect(readingProgress(3, 4)).toBe(100);
    expect(readingProgress(0, 0)).toBe(0);
    expect(readingProgress(200, 4)).toBe(100);
  });
  it('conserva las referencias del nodo compartido, sin recuperar datos privados', () => {
    const withReference = { ...shared[0], data: { ...shared[0].data, references: [{ author: 'A', work: 'Obra publicada', year: '2026', locator: 'p. 1', url: '' }] } };
    const filtered = publishedReadingGraph([withReference, shared[1]], edges);
    expect(filtered.nodes[0].data.references?.[0].work).toBe('Obra publicada');
    expect(JSON.stringify(filtered)).not.toContain(privateNode.data.title);
  });
});
