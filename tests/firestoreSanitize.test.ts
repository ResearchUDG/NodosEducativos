import { describe, expect, it } from 'vitest';
import { stripUndefinedForFirestore } from '../src/lib/firestoreSanitize';

describe('stripUndefinedForFirestore', () => {
  it('retira undefined recursivamente sin borrar valores válidos', () => {
    const input = {
      title: 'Mapa',
      optional: undefined,
      zero: 0,
      empty: '',
      no: false,
      nil: null,
      nodes: [
        { id: 'a', measured: { width: 250, height: undefined }, data: { critical: false } },
        undefined,
      ],
      edges: [
        { id: 'e', style: { stroke: '#000', strokeDasharray: undefined } },
      ],
    };

    const cleaned = stripUndefinedForFirestore(input) as any;
    expect(cleaned).toEqual({
      title: 'Mapa',
      zero: 0,
      empty: '',
      no: false,
      nil: null,
      nodes: [{ id: 'a', measured: { width: 250 }, data: { critical: false } }],
      edges: [{ id: 'e', style: { stroke: '#000' } }],
    });
  });
});
