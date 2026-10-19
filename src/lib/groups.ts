import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Diagram } from './types';
import type { DiagramRevision } from './diagramHistory';
import { preparePublicationEdition } from './versionedPublication';

export type GroupInfo = { id: string; name: string; description: string; active: boolean };
export type Publication = Diagram & { ownerUid: string; sourceDiagramId: string; groupId: string; sourceRevisionId?: string; sourceRevisionSavedAt?: unknown };
function firestore() { if (!db) throw new Error('Firebase no configurado.'); return db; }
/** Catálogo completo, inclusive programas suspendidos. Exclusivo de la consola admin.
 * La autorización real la imponen las reglas de Firestore sobre /groups (list).
 */
export async function listAllProgramsForAdmin(): Promise<GroupInfo[]> {
  const snap = await getDocs(collection(firestore(), 'groups'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupInfo));
}
export async function assignedGroups(uid: string, isAdmin = false): Promise<GroupInfo[]> {
  const instance = firestore();
  if (isAdmin) {
    const snap = await getDocs(collection(instance, 'groups'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupInfo)).filter((g) => g.active);
  }
  const memberships = await getDocs(collection(instance, 'memberships', uid, 'groups'));
  const ids = memberships.docs.filter((d) => d.data().active === true).map((d) => d.id);
  const groups = await Promise.all(ids.map((id) => getDoc(doc(instance, 'groups', id))));
  return groups.filter((d) => d.exists() && d.data()?.active === true).map((d) => ({ id: d.id, ...d.data() } as GroupInfo));
}
export async function publicationsInGroups(groups: GroupInfo[]): Promise<Publication[]> {
  const instance = firestore();
  const lists = await Promise.all(groups.map(async (group) => {
    const snap = await getDocs(collection(instance, 'groupPublications', group.id, 'diagrams'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), groupId: group.id } as Publication));
  }));
  return lists.flat();
}
export async function publishToGroup(uid: string, diagramId: string, revision: DiagramRevision, groupId: string, selectedNodeIds: string[]) {
  // La edición nace exclusivamente de una revisión privada guardada.
  // El profesor elige los nodos; el resto, incluidas sus fuentes, no se copia.
  const edition = preparePublicationEdition(revision, selectedNodeIds);
  const instance = firestore();
  const ref = doc(instance, 'groupPublications', groupId, 'diagrams', diagramId);
  const previous = await getDoc(ref);
  const document = {
    ownerUid: uid, sourceDiagramId: diagramId, ...edition,
    updatedAt: serverTimestamp(), ...(previous.exists() ? {} : { publishedAt: serverTimestamp() }),
  };
  await setDoc(ref, document, { merge: true });
}
export async function retractPublication(groupId: string, diagramId: string) {
  await deleteDoc(doc(firestore(), 'groupPublications', groupId, 'diagrams', diagramId));
}
export async function openPublication(groupId: string, id: string): Promise<Publication> {
  const snap = await getDoc(doc(firestore(), 'groupPublications', groupId, 'diagrams', id));
  if (!snap.exists()) throw new Error('Publicación inexistente o sin acceso.');
  return { ...snap.data(), id, groupId } as Publication;
}
/** Solo el administrador puede listar solicitudes (incluidas las aprobadas).
 * Se conservan como fuente del nombre mostrado, sin exponer UID en la interfaz.
 */
export async function listAccessRequests() {
  const snap = await getDocs(collection(firestore(), 'accessRequests'));
  return snap.docs.map((d) => ({
    id: d.id,
    email: String(d.data().email || ''),
    displayName: String(d.data().displayName || ''),
    status: String(d.data().status || 'pending'),
  }));
}
