import type { NodeQAItem } from './types';

export const MAX_NODE_QA = 8;
export const MAX_NODE_QUESTION_CHARACTERS = 220;
export const MAX_NODE_ANSWER_CHARACTERS = 700;

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

export function blankNodeQA(): NodeQAItem {
  return { question: '', answer: '' };
}

export function normalizeNodeQA(value: unknown): NodeQAItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_NODE_QA).map(item => {
    const candidate = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      question: clean(candidate.question, MAX_NODE_QUESTION_CHARACTERS),
      answer: clean(candidate.answer, MAX_NODE_ANSWER_CHARACTERS),
    };
  });
}

export function validateNodeQA(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return 'Las preguntas y respuestas del nodo tienen un formato inválido.';
  if (value.length > MAX_NODE_QA) return `Cada nodo admite hasta ${MAX_NODE_QA} preguntas y respuestas.`;

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== 'object') return `La pregunta ${index + 1} tiene un formato inválido.`;
    const candidate = item as Record<string, unknown>;
    const question = String(candidate.question ?? '').trim();
    const answer = String(candidate.answer ?? '').trim();

    if (!question) return `Complete la pregunta ${index + 1} o elimínela.`;
    if (!answer) return `Complete la respuesta de la pregunta ${index + 1} o elimínela.`;
    if (question.length > MAX_NODE_QUESTION_CHARACTERS) {
      return `La pregunta ${index + 1} supera ${MAX_NODE_QUESTION_CHARACTERS} caracteres.`;
    }
    if (answer.length > MAX_NODE_ANSWER_CHARACTERS) {
      return `La respuesta ${index + 1} supera ${MAX_NODE_ANSWER_CHARACTERS} caracteres.`;
    }
  }
  return null;
}

export function moveNodeQA(items: readonly NodeQAItem[], index: number, delta: -1 | 1): NodeQAItem[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = items.map(item => ({ ...item }));
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
