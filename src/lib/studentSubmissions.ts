import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import type { ConceptEdge, ConceptNode } from './types';
import type { DiagramRevision } from './diagramHistory';

export type ReviewStatus = 'pendiente' | 'revisado' | 'devuelto';
export type StudentSubmission = {
  id: string; groupId: string; studentUid: string; sourceDiagramId: string;
  sourceRevisionId: string; sourceRevisionSavedAt: unknown;
  title: string; description: string; nodes: ConceptNode[]; edges: ConceptEdge[];
  status: ReviewStatus; submittedAt: unknown; reviewerUid?: string; reviewNote?: string; reviewedAt?: unknown;
};
const store = () => { if (!db) throw new Error('Firebase no está configurado.'); return db; };
const path = (groupId: string) => collection(store(), 'groupSubmissions', groupId, 'requests');
export async function submitForReview(studentUid: string, groupId: string, sourceDiagramId: string, revision: DiagramRevision) {
  if (!studentUid || !groupId || !sourceDiagramId || !revision.id || !revision.savedAt || !['baseline','save'].includes(revision.kind)) throw new Error('Guarde primero una versión y elija el programa.');
  if (!revision.nodes.length) throw new Error('El esquema necesita al menos un concepto para enviar a revisión.');
  await addDoc(path(groupId), {
    studentUid, sourceDiagramId, sourceRevisionId: revision.id, sourceRevisionSavedAt: revision.savedAt,
    title: revision.title, description: revision.description,
    nodes: revision.nodes, edges: revision.edges, status: 'pendiente', submittedAt: serverTimestamp(),
  });
}
function rows(groupId: string, docs: QuerySnapshot<DocumentData>) {
  return docs.docs.map(item => ({ ...item.data(), id: item.id, groupId } as StudentSubmission));
}
export async function myStudentSubmissions(uid: string, groupIds: string[]) {
  const all = await Promise.all(groupIds.map(async groupId => rows(groupId, await getDocs(query(path(groupId), where('studentUid', '==', uid))))));
  return all.flat();
}
export async function groupSubmissions(groupIds: string[]) {
  const all = await Promise.all(groupIds.map(async groupId => rows(groupId, await getDocs(path(groupId)))));
  return all.flat();
}
export async function reviewStudentSubmission(groupId: string, requestId: string, status: 'revisado'|'devuelto', reviewerUid: string, reviewNote: string) {
  if (!reviewNote.trim() && status === 'devuelto') throw new Error('Escriba una observación para devolver el trabajo.');
  if (reviewNote.length > 1200) throw new Error('La observación no debe superar 1,200 caracteres.');
  await updateDoc(doc(store(), 'groupSubmissions', groupId, 'requests', requestId), {
    status, reviewNote: reviewNote.trim(), reviewerUid, reviewedAt: serverTimestamp(),
  });
}
