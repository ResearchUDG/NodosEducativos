/** Identifica las publicaciones de un borrador por programa e ID, nunca por título.
 * El administrador revisa también los programas inactivos. */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { assignedGroups, listAllProgramsForAdmin, type Publication } from './groups';
import { editionsFromDraft } from './publicationLifecyclePolicy';

export type OwnedEdition = Pick<Publication, 'id' | 'groupId' | 'ownerUid' | 'sourceDiagramId' | 'title'>;
export { editionsFromDraft } from './publicationLifecyclePolicy';

export async function deletionProgramIds(uid: string, isAdmin: boolean): Promise<string[]> {
  if (!db) throw new Error('Firebase no configurado.');
  if (isAdmin) {
    // Un programa inactivo también puede contener una edición antigua.
    const all = await listAllProgramsForAdmin();
    return [...new Set(all.map(group => group.id))].sort();
  }
  // Nunca borrar a ciegas si el profesor conserva una membresía inactiva:
  // puede haber publicaciones antiguas inaccesibles con sus permisos actuales.
  const memberships = await getDocs(collection(db, 'memberships', uid, 'groups'));
  const active = await assignedGroups(uid, false);
  const accessible = new Set(active.map(group => group.id));
  if (memberships.docs.some(item => !accessible.has(item.id))) {
    throw new Error('Hay programas antiguos o inactivos que no pueden verificarse. La eliminación se detuvo para no dejar publicaciones huérfanas. Solicite a la administración que revise el esquema.');
  }
  return [...accessible].sort();
}

export async function inspectOwnedEditions(uid: string, diagramId: string, programIds: readonly string[]): Promise<OwnedEdition[]> {
  if (!db) throw new Error('Firebase no configurado.');
  const snapshots = await Promise.all(programIds.map(groupId => getDoc(doc(db!, 'groupPublications', groupId, 'diagrams', diagramId))));
  return editionsFromDraft(snapshots.filter(s => s.exists()).map(s => ({
    ...s.data(), id: s.id, groupId: s.ref.parent.parent!.id,
  } as Publication)), uid, diagramId);
}
