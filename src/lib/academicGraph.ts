import type { AcademicReference, ArgumentRelation, ConceptEdge, ConceptNode } from './types';
import { isValidNodeTitle, MAX_NODE_TITLE_CHARACTERS } from './nodeTitle';

export const MAX_NODE_REFERENCES = 4;
export const relationLabels: Record<ArgumentRelation, string> = {
  fundamenta: 'Fundamenta', refuta: 'Refuta', define: 'Define',
  contextualiza: 'Contextualiza', cuestiona: 'Cuestiona',
  deriva: 'Se deriva de', ejemplifica: 'Ejemplifica', otra: 'Otra relación',
};
export const relationKeys = Object.keys(relationLabels) as ArgumentRelation[];
const categories = new Set(['tesis', 'idea', 'fuente', 'pregunta']);
const relations = new Set<string>(relationKeys);
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

export function safeReferenceUrl(value: unknown): string {
  const url = text(value, 240);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? url : '';
  } catch { return ''; }
}

export function blankReference(): AcademicReference {
  return { author: '', work: '', year: '', locator: '', url: '' };
}

export function normalizeReference(reference: AcademicReference): AcademicReference {
  return {
    author: text(reference.author, 110), work: text(reference.work, 180),
    year: text(reference.year, 35), locator: text(reference.locator, 100),
    url: safeReferenceUrl(reference.url),
  };
}

/** No descartamos citas parcialmente escritas en silencio: el editor exige obra y URL segura. */
export function validateAcademicGraph(nodes: ConceptNode[], edges: ConceptEdge[]): string | null {
  if (nodes.length > 80 || edges.length > 160) return 'El esquema supera el máximo de 80 nodos o 160 conexiones.';
  const ids = new Set(nodes.map(node => node.id));
  for (const node of nodes) {
    if (!isValidNodeTitle(node.data.title)) return 'Cada título de nodo debe tener entre 1 y 100 palabras y como máximo 1600 caracteres.';
    const refs = node.data.references ?? [];
    if (!Array.isArray(refs) || refs.length > MAX_NODE_REFERENCES) return 'Cada nodo admite hasta cuatro referencias.';
    for (const ref of refs) {
      if (!ref.work.trim()) return `Complete la obra en una referencia del nodo «${node.data.title}» o elimínela.`;
      if (ref.url?.trim() && !safeReferenceUrl(ref.url)) return `La referencia de «${node.data.title}» necesita una URL http(s) válida.`;
    }
  }
  if (edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target))) return 'Hay conexiones que apuntan a nodos inexistentes.';
  return null;
}

/** Instantánea de solo campos académicos: elimina propiedades internas de React Flow. */
export function serializeAcademicGraph(nodes: ConceptNode[], edges: ConceptEdge[]): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
  const problem = validateAcademicGraph(nodes, edges);
  if (problem) throw new Error(problem);
  return {
    nodes: nodes.map(node => ({
      id: node.id, type: 'concept' as const,
      position: { x: Number.isFinite(node.position.x) ? node.position.x : 0, y: Number.isFinite(node.position.y) ? node.position.y : 0 },
      data: {
        title: text(node.data.title, MAX_NODE_TITLE_CHARACTERS), description: text(node.data.description, 240),
        category: (categories.has(node.data.category) ? node.data.category : 'idea') as ConceptNode['data']['category'],
        ...(node.data.references?.length ? { references: node.data.references.map(normalizeReference) } : {}),
      },
    })),
    edges: edges.map(edge => ({
      id: edge.id, source: edge.source, target: edge.target,
      type: 'smoothstep', label: text(edge.label ?? '', 80),
      ...(edge.data?.relation && relations.has(edge.data.relation)
        ? { data: { relation: edge.data.relation } } : {}),
    })),
  };
}
