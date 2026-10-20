import { describe, expect, it } from 'vitest';
import { editionsFromDraft } from '../src/lib/publicationLifecyclePolicy';
import type { Publication } from '../src/lib/groups';
const item = (ownerUid: string, sourceDiagramId: string, id: string, groupId: string, title='Una obra') =>
  ({ownerUid,sourceDiagramId,id,groupId,title,nodes:[],edges:[]} as Publication);
describe('Ciclo de vida de publicaciones y borradores', () => {
  it('identifica copias de un mismo esquema en dos programas, por ID y autor', () => {
    expect(editionsFromDraft([item('autor','a','a','filosofia'),item('autor','a','a','seminario')], 'autor','a')).toHaveLength(2);
  });
  it('no elimina otra investigación que simplemente tenga el mismo título', () => {
    expect(editionsFromDraft([item('autor','b','b','filosofia'),item('autor','a','a','filosofia')], 'autor','a').map(p=>p.id)).toEqual(['a']);
  });
  it('no incluye publicaciones ajenas aunque coincidan el título y el identificador', () => {
    expect(editionsFromDraft([item('otro','a','a','filosofia')], 'autor','a')).toEqual([]);
  });
  it('no admite suplantación del origen ni entradas duplicadas', () => {
    const input=[item('autor','otro','a','f'),item('autor','a','a','f'),item('autor','a','a','f')];
    expect(editionsFromDraft(input,'autor','a')).toHaveLength(1);
  });
});
