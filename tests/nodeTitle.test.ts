import { describe, expect, it } from 'vitest';
import { isValidNodeTitle, nodeTitleWordCount } from '../src/lib/nodeTitle';
describe('Título de cada nodo: 100 palabras', () => {
  it('cuenta espacios y saltos de línea como separadores', () => expect(nodeTitleWordCount('  Ontología  \n del   ser  ')).toBe(3));
  it('admite exactamente 100 palabras', () => expect(isValidNodeTitle(Array(100).fill('idea').join(' '))).toBe(true));
  it('rechaza 101 palabras, un título vacío y textos enormes', () => {
    expect(isValidNodeTitle(Array(101).fill('idea').join(' '))).toBe(false);
    expect(isValidNodeTitle('   ')).toBe(false);
    expect(isValidNodeTitle('x'.repeat(1601))).toBe(false);
  });
});
