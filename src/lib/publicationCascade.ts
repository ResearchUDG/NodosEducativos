/** Elimina en una sola transacción el borrador y TODAS sus copias verificadas.
 * No acepta una lista de publicaciones como sustituto del catálogo de programas.
 * Componente con Firestore inyectado para probar reglas reales en emulador. */
import { doc, type Firestore, runTransaction } from 'firebase/firestore';
import type { OwnedEdition } from './publicationLifecycle';

/** Elimina el borrador y sus publicaciones verificadas en una misma transacción.
 * La lista de grupos procede del catálogo, NO de las copias detectadas en pantalla.
 * Se vuelve a consultar Firestore al confirmar; cualquier diferencia cancela todo.
 */
export async function deleteDraftAndPublishedCopies(instance: Firestore, uid: string, id: string, programIds: readonly string[], expected: readonly OwnedEdition[]): Promise<void> {
  const groups = [...new Set(programIds)];
  if (groups.length > 300 || groups.some(g => !/^[a-zA-Z0-9_-]+$/.test(g))) {
    throw new Error('Catálogo de programas inválido o demasiado grande; no se eliminó nada.');
  }
  if (expected.some(item => item.id !== id || item.ownerUid !== uid || item.sourceDiagramId !== id || !groups.includes(item.groupId))) {
    throw new Error('Los datos de publicación no pertenecen al borrador. No se eliminó nada.');
  }
  const current = doc(instance, 'users', uid, 'diagrams', id);
  const refs = groups.map(groupId => doc(instance, 'groupPublications', groupId, 'diagrams', id));
  const expectedKeys = expected.map(p => p.groupId + '/' + p.id).sort().join('|');
  await runTransaction(instance, async transaction => {
    const draft = await transaction.get(current);
    if (!draft.exists()) throw new Error('El borrador ya no existe; no se modificaron otras publicaciones.');
    // Todas las lecturas ocurren antes de las escrituras: transacción atómica.
    const copies = await Promise.all(refs.map(ref => transaction.get(ref)));
    const selected: typeof refs = [];
    copies.forEach((copy, i) => {
      if (!copy.exists()) return;
      const data = copy.data();
      if (data.ownerUid === uid && data.sourceDiagramId === id) selected.push(refs[i]);
    });
    const actualKeys = selected.map(ref => ref.parent.parent!.id + '/' + ref.id).sort().join('|');
    if (actualKeys !== expectedKeys) {
      throw new Error('Las publicaciones cambiaron desde la confirmación. No se eliminó nada. Vuelva a intentarlo.');
    }
    selected.forEach(ref => transaction.delete(ref));
    transaction.delete(current);
  });
}
