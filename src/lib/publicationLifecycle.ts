/** Distingue una edición publicada del borrador que le dio origen.
 * Los títulos NO son identificadores: una misma obra puede estar en varios programas. */
import { assignedGroups, publicationsInGroups, type Publication } from './groups';
import { editionsFromDraft } from './publicationLifecyclePolicy';

export type OwnedEdition = Pick<Publication, 'id' | 'groupId' | 'ownerUid' | 'sourceDiagramId' | 'title'>;
export { editionsFromDraft } from './publicationLifecyclePolicy';

/** Las reglas de Firestore permiten inspeccionar únicamente programas activos y autorizados.
 * No pretende enumerar programas inactivos ni aquellos cuyos permisos se revocaron. */
export async function inspectOwnedEditions(uid: string, diagramId: string, isAdmin: boolean): Promise<OwnedEdition[]> {
  const programs = await assignedGroups(uid, isAdmin);
  return editionsFromDraft(await publicationsInGroups(programs), uid, diagramId);
}
