/** El título de cada NODO tiene un límite de palabras; no cambia el título general del esquema. */
export const MAX_NODE_TITLE_WORDS = 100;
export const MAX_NODE_TITLE_CHARACTERS = 1600;
export function nodeTitleWordCount(title: string): number {
  return title.trim() ? title.trim().split(/\s+/u).length : 0;
}
export function isValidNodeTitle(title: string): boolean {
  const count = nodeTitleWordCount(title);
  return count >= 1 && count <= MAX_NODE_TITLE_WORDS && title.length <= MAX_NODE_TITLE_CHARACTERS;
}
