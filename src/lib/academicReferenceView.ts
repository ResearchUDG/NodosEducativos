import { normalizeReference } from './academicGraph';
import type { AcademicReference, ConceptNode } from './types';

const fields: (keyof AcademicReference)[] = ['author', 'work', 'year', 'locator', 'url'];

/** Compara citas normalizadas para no tratar espacios accidentales como cambios pendientes. */
export function sameAcademicReference(a: AcademicReference, b: AcademicReference): boolean {
  // No saneamos las URL al comparar: una URL inválida editada nunca debe parecer igual
  // a una URL vacía previamente guardada.
  return fields.every(field => String(a[field] ?? '').trim() === String(b[field] ?? '').trim());
}

/** Captura únicamente la bibliografía guardada, sin estados efímeros del editor. */
export function snapshotPersistedReferences(nodes: ConceptNode[]): Record<string, AcademicReference[]> {
  return Object.fromEntries(nodes.map(node => [
    node.id, (node.data.references ?? []).map(reference => ({ ...normalizeReference(reference) })),
  ]));
}

/**
 * Una cita solo está guardada si también aparece en la última instantánea confirmada.
 * Cuenta duplicados: una copia nueva de una cita existente no se marca como guardada.
 * Comparar por contenido, no por posición, evita perder el estado al quitar otra fuente.
 */
export function isReferencePersisted(
  references: AcademicReference[], persisted: AcademicReference[], index: number,
): boolean {
  const current = references[index];
  if (!current) return false;
  const copiesHere = references.slice(0, index + 1)
    .filter(item => sameAcademicReference(item, current)).length;
  const copiesSaved = persisted.filter(item => sameAcademicReference(item, current)).length;
  return copiesHere <= copiesSaved;
}
