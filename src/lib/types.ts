import type { Edge, Node } from '@xyflow/react';

/** Metadatos bibliográficos declarativos; no certifican autenticidad ni DOI. */
export type AcademicReference = {
  author: string;
  work: string;
  year: string;
  locator: string;
  url: string;
};
export type ArgumentRelation = 'fundamenta' | 'refuta' | 'define' | 'contextualiza' | 'cuestiona' | 'deriva' | 'ejemplifica' | 'otra';
export type ConceptData = {
  title: string;
  description: string;
  category: 'tesis' | 'idea' | 'fuente' | 'pregunta';
  references?: AcademicReference[];
  /** Marca académica explícita del autor, no una valoración automática. */
  critical?: boolean;
  /** Propiedad de presentación, nunca persistida. */
  displayNumber?: number;
  [key: string]: unknown;
};
export type ConceptNode = Node<ConceptData, 'concept'>;
export type ConceptEdge = Edge<{ relation?: ArgumentRelation }>;
export interface Diagram {
  id: string;
  title: string;
  description: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  createdAt?: unknown;
  updatedAt?: unknown;
}
