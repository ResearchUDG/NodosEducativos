/** Política pura de selección: no equiparar títulos iguales con duplicados. */
export type PublicationIdentity = { id: string; groupId: string; ownerUid: string; sourceDiagramId: string; title: string };
export function editionsFromDraft<T extends PublicationIdentity>(publications: T[], uid: string, diagramId: string): T[] {
  const seen = new Set<string>();
  return publications.filter(item => {
    const key = `${item.groupId}/${item.id}`;
    if (item.ownerUid !== uid || item.id !== diagramId || item.sourceDiagramId !== diagramId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
