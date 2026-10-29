import { describe, expect, it } from 'vitest';
import { presentationKeyboardAction } from '../src/lib/presentationInteraction';

describe('interacción de presentación 2D', () => {
  it('no captura teclas cuando no hay concepto seleccionado', () => {
    expect(presentationKeyboardAction('ArrowRight', false)).toBeNull();
    expect(presentationKeyboardAction('Escape', false)).toBeNull();
  });

  it('permite recorrer y volver al mapa completo desde teclado', () => {
    expect(presentationKeyboardAction('ArrowLeft', true)).toBe('previous');
    expect(presentationKeyboardAction('ArrowRight', true)).toBe('next');
    expect(presentationKeyboardAction('Escape', true)).toBe('clear');
    expect(presentationKeyboardAction('Home', true)).toBe('first');
    expect(presentationKeyboardAction('End', true)).toBe('last');
  });
});
