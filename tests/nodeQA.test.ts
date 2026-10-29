import { describe, expect, it } from 'vitest';
import {
  MAX_NODE_ANSWER_CHARACTERS, MAX_NODE_QA, MAX_NODE_QUESTION_CHARACTERS,
  moveNodeQA, normalizeNodeQA, validateNodeQA,
} from '../src/lib/nodeQA';

describe('preguntas y respuestas por nodo', () => {
  it('normaliza preguntas y respuestas', () => {
    expect(normalizeNodeQA([{ question: '  ¿Qué es?  ', answer: '  Una respuesta.  ' }]))
      .toEqual([{ question: '¿Qué es?', answer: 'Una respuesta.' }]);
  });

  it('rechaza pares incompletos', () => {
    expect(validateNodeQA([{ question: '¿Por qué?', answer: '' }])).toContain('respuesta');
  });

  it('limita cantidad y longitud', () => {
    expect(validateNodeQA(Array.from({ length: MAX_NODE_QA + 1 }, () => ({ question: 'Q', answer: 'A' })))).toContain('hasta');
    expect(validateNodeQA([{ question: 'x'.repeat(MAX_NODE_QUESTION_CHARACTERS + 1), answer: 'A' }])).toContain('pregunta');
    expect(validateNodeQA([{ question: 'Q', answer: 'x'.repeat(MAX_NODE_ANSWER_CHARACTERS + 1) }])).toContain('respuesta');
  });

  it('reordena sin mutar el arreglo original', () => {
    const input = [{ question: 'A', answer: '1' }, { question: 'B', answer: '2' }];
    const moved = moveNodeQA(input, 1, -1);
    expect(moved.map(item => item.question)).toEqual(['B', 'A']);
    expect(input.map(item => item.question)).toEqual(['A', 'B']);
  });
});
