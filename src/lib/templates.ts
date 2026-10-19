import type { ConceptNode, ConceptEdge } from './types';

export const defaultNodes: ConceptNode[] = [
  { id: 'n1', type: 'concept', position: { x: 0, y: 130 }, data: { title: 'Pregunta central', description: '¿Qué queremos comprender o explicar?', category: 'pregunta' } },
  { id: 'n2', type: 'concept', position: { x: 365, y: 0 }, data: { title: 'Argumento principal', description: 'Proponga la tesis que estructura su investigación.', category: 'tesis' } },
  { id: 'n3', type: 'concept', position: { x: 365, y: 280 }, data: { title: 'Referencias', description: 'Relacione autores, fuentes y hallazgos verificables.', category: 'fuente' } },
  { id: 'n4', type: 'concept', position: { x: 730, y: 130 }, data: { title: 'Síntesis', description: 'Construya conexiones y registre preguntas abiertas.', category: 'idea' } },
];
export const defaultEdges: ConceptEdge[] = [
  { id: 'e1-2', source: 'n1', target: 'n2', label: 'orienta' },
  { id: 'e1-3', source: 'n1', target: 'n3', label: 'se fundamenta' },
  { id: 'e2-4', source: 'n2', target: 'n4', label: 'conduce a' },
  { id: 'e3-4', source: 'n3', target: 'n4', label: 'documenta' },
];
