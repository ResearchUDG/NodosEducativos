import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { stripUndefinedForFirestore } from './firestoreSanitize';
import type { OwnedEdition } from './publicationLifecycle';
import { deleteDraftAndPublishedCopies } from './publicationCascade';
import { defaultEdges, defaultNodes } from './templates';
import type { ConceptEdge, ConceptNode, Diagram } from './types';
import { assertNoConcurrentEdit, snapshotFromDiagram, timestampKey, type DiagramRevision, type DiagramSnapshot } from './diagramHistory';

const diagramsCollection = (uid: string) => {
  if (!db) throw new Error('Configure Firebase para utilizar el tablero.');
  return collection(db, 'users', uid, 'diagrams');
};

export async function listDiagrams(uid: string): Promise<Diagram[]> {
  const snap = await getDocs(query(diagramsCollection(uid), orderBy('updatedAt', 'desc')));
  return snap.docs.map((item) => ({ ...item.data(), id: item.id } as Diagram));
}
export async function createDiagram(uid: string, title: string): Promise<string> {
  const reference = doc(diagramsCollection(uid));
  await setDoc(reference, {
    title: title.trim(),
    description: 'Mapa de investigación con relaciones entre ideas.',
    nodes: structuredClone(defaultNodes), edges: structuredClone(defaultEdges),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return reference.id;
}
export async function saveDiagram(uid: string, id: string, value: { title: string; description: string; nodes: ConceptNode[]; edges: ConceptEdge[] }): Promise<void> {
  const reference = doc(diagramsCollection(uid), id);
  const clean = stripUndefinedForFirestore(value);
  await updateDoc(reference, { ...clean, updatedAt: serverTimestamp() });
}
/**
 * Guardado atómico: conserva el borrador previo la primera vez, inserta la
 * nueva revisión inmutable y actualiza el borrador en una sola transacción.
 * Detecta una edición concurrente antes de escribir.
 *
 * Todo snapshot se sanea antes de tocar Firestore porque React Flow y los
 * estilos visuales admiten propiedades opcionales con `undefined`, mientras
 * Firestore las rechaza.
 */
export async function saveDiagramWithHistory(
  uid: string, id: string, value: DiagramSnapshot, expectedUpdatedAt: string,
): Promise<string> {
  if (!db) throw new Error('Firebase no configurado.');
  const current = doc(db, 'users', uid, 'diagrams', id);
  const revisions = collection(db, 'users', uid, 'diagrams', id, 'revisions');
  const baseline = doc(revisions, 'baseline');
  const next = doc(revisions);
  const cleanValue = stripUndefinedForFirestore(value);
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(current);
    if (!existing.exists()) throw new Error('El esquema fue eliminado o no está disponible.');
    assertNoConcurrentEdit(expectedUpdatedAt, existing.data().updatedAt);
    const first = await transaction.get(baseline);
    if (!first.exists()) {
      const previous = stripUndefinedForFirestore(snapshotFromDiagram(existing.data() as Partial<Diagram>));
      transaction.set(baseline, { ...previous, kind: 'baseline', authorUid: uid, savedAt: serverTimestamp() });
    }
    transaction.set(next, { ...cleanValue, kind: 'save', authorUid: uid, savedAt: serverTimestamp() });
    transaction.update(current, { ...cleanValue, updatedAt: serverTimestamp() });
  });
  const saved = await getDoc(current);
  if (!saved.exists()) throw new Error('No se pudo comprobar la versión guardada.');
  return timestampKey(saved.data().updatedAt);
}

export async function listDiagramRevisions(uid: string, id: string): Promise<DiagramRevision[]> {
  if (!db) throw new Error('Firebase no configurado.');
  const revisions = collection(db, 'users', uid, 'diagrams', id, 'revisions');
  const snap = await getDocs(query(revisions, orderBy('savedAt', 'desc'), limit(50)));
  const list = snap.docs.map(item => ({ ...snapshotFromDiagram(item.data()),
    id: item.id, kind: item.data().kind, authorUid: item.data().authorUid, savedAt: item.data().savedAt,
  } as DiagramRevision));
  if (!list.some(item => item.id === 'baseline')) {
    const first = await getDoc(doc(revisions, 'baseline'));
    if (first.exists()) list.push({ ...snapshotFromDiagram(first.data()),
      id: first.id, kind: 'baseline', authorUid: first.data().authorUid, savedAt: first.data().savedAt });
  }
  return list;
}

/** El borrador y sus publicaciones se retiran primero en una transacción atómica.
 * Luego se purga el historial privado, que Firestore no borra al eliminar su padre. */
export async function removeDiagram(uid: string, id: string, programIds: readonly string[], expected: readonly OwnedEdition[]): Promise<void> {
  if (!db) throw new Error('Firebase no configurado.');
  await deleteDraftAndPublishedCopies(db, uid, id, programIds, expected);
  const revisions = collection(db, 'users', uid, 'diagrams', id, 'revisions');
  while (true) {
    const remaining = await getDocs(query(revisions, limit(100)));
    if (remaining.empty) break;
    await Promise.all(remaining.docs.map(item => deleteDoc(item.ref)));
  }
}
