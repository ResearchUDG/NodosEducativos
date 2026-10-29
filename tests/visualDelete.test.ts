import { describe, expect, it } from 'vitest';
import { removeVisualNode } from '../src/lib/visualDesign';
import type { ConceptEdge, ConceptNode } from '../src/lib/types';

const node = (id:string): ConceptNode => ({ id, type:'concept', position:{x:0,y:0}, data:{ title:id, description:'', category:'idea' } });
const edge = (id:string,source:string,target:string): ConceptEdge => ({ id, source, target });

describe('Eliminación de nodos en diseño visual',()=>{
  it('elimina el nodo y todas sus conexiones, conservando el resto',()=>{
    const nodes=[node('a'),node('b'),node('c')];
    const edges=[edge('ab','a','b'),edge('bc','b','c'),edge('ac','a','c')];
    const result=removeVisualNode(nodes,edges,'b');
    expect(result.nodes.map(n=>n.id)).toEqual(['a','c']);
    expect(result.edges.map(e=>e.id)).toEqual(['ac']);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(3);
  });
});
