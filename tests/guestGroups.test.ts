import { describe, expect, it } from 'vitest';
import { guestExportPath, guestFigurePath, guestPublicationDocument, guestPublicationPath, normalizeGuestSettings, normalizeGuestSlug } from '../src/lib/guestGroups';

describe('Grupo de invitados — normalización y copia pública mínima', () => {
  it('genera una dirección legible sin acentos ni espacios', () => {
    expect(normalizeGuestSlug(' Filosofía · CUCSH 2026 ')).toBe('filosofia-cucsh-2026');
  });
  it('rechaza direcciones vacías o excesivamente largas', () => {
    expect(() => normalizeGuestSlug('a')).toThrow();
    expect(() => normalizeGuestSlug('x'.repeat(61))).toThrow();
  });
  it('normaliza título, descripción y preferencia de guía', () => {
    expect(normalizeGuestSettings({ slug: ' Seminario Público ', title: ' Grupo   abierto ', description: ' Lecturas compartidas ', guideEnabled: true })).toEqual({
      slug: 'seminario-publico', title: 'Grupo abierto', description: 'Lecturas compartidas', guideEnabled: true,
    });
  });
  it('la copia invitada no expone UID, borrador ni identificador de revisión', () => {
    const publicCopy = guestPublicationDocument({
      title: 'Mapa', description: 'Lectura', nodes: [], edges: [],
      ownerUid: 'privado', sourceDiagramId: 'borrador', sourceRevisionId: 'rev-privada',
      sourceRevisionSavedAt: 'interno', publishedAt: 'publicada', updatedAt: 'actualizada',
    });
    expect(publicCopy).toEqual({
      title: 'Mapa', description: 'Lectura', nodes: [], edges: [], publishedAt: 'publicada', updatedAt: 'actualizada',
    });
    expect('ownerUid' in publicCopy).toBe(false);
    expect('sourceDiagramId' in publicCopy).toBe(false);
    expect('sourceRevisionId' in publicCopy).toBe(false);
  });

  it('genera rutas individuales estables para esquema, figura y exportación', () => {
    expect(guestPublicationPath('filosofia-abierta', 'abc123')).toBe('/invitados/filosofia-abierta/esquema/abc123');
    expect(guestFigurePath('filosofia-abierta', 'abc123')).toBe('/invitados/filosofia-abierta/figura/abc123');
    expect(guestExportPath('filosofia-abierta', 'abc123')).toBe('/invitados/filosofia-abierta/esquema/abc123/exportar');
  });
  it('rechaza identificadores de publicación que intenten alterar la ruta', () => {
    expect(() => guestPublicationPath('filosofia-abierta', '../privado')).toThrow();
    expect(() => guestFigurePath('filosofia-abierta', '')).toThrow();
    expect(() => guestExportPath('filosofia-abierta', '../privado')).toThrow();
  });
  it('rechaza una publicación fuente estructuralmente corrupta', () => {
    expect(() => guestPublicationDocument({ title: 'Mapa', description: 'x', nodes: 'no', edges: [] })).toThrow();
  });
});
