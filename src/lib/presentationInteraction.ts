export type PresentationKeyboardAction = 'previous' | 'next' | 'clear' | 'first' | 'last';

export function presentationKeyboardAction(key: string, hasSelection: boolean): PresentationKeyboardAction | null {
  if (!hasSelection) return null;
  if (key === 'Escape') return 'clear';
  if (key === 'ArrowLeft') return 'previous';
  if (key === 'ArrowRight') return 'next';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}
