/** Ficha interna: visible para titular y administradores. Las etiquetas son
 * declaraciones descriptivas y NO acreditan títulos ni conceden permisos.
 */
export const ACADEMIC_TAG_CATEGORIES = ['careers', 'degrees', 'postgraduate', 'certifications'] as const;
export type AcademicTagCategory = (typeof ACADEMIC_TAG_CATEGORIES)[number];
export type AcademicTags = Record<AcademicTagCategory, string[]>;
export const MAX_ACADEMIC_TAGS_PER_CATEGORY = 10;
export const MAX_ACADEMIC_TAG_LENGTH = 90;

export type ResearcherProfileFields = {
  /** Campo anterior conservado para no perder perfiles ya registrados. */
  academicTitle: string;
  institution: string;
  researchLines: string;
  biography: string;
  academicTags: AcademicTags;
};

export type ResearcherProfileRecord = ResearcherProfileFields & {
  uid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function emptyAcademicTags(): AcademicTags {
  return { careers: [], degrees: [], postgraduate: [], certifications: [] };
}

export const emptyResearcherProfile: ResearcherProfileFields = {
  academicTitle: '', institution: '', researchLines: '', biography: '',
  academicTags: emptyAcademicTags(),
};

export function normalizeAcademicTag(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error('La etiqueta contiene caracteres de control.');
  if (value.includes('§')) throw new Error('La etiqueta contiene un carácter reservado (§).');
  const tag = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (tag.length < 2 || tag.length > MAX_ACADEMIC_TAG_LENGTH) {
    throw new Error(`Cada etiqueta debe tener entre 2 y ${MAX_ACADEMIC_TAG_LENGTH} caracteres.`);
  }
  return tag;
}

/** Clave solo para detectar duplicados en el cliente, NO es un índice semántico. */
export function academicTagKey(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
}

export function normalizeAcademicTags(raw: AcademicTags): AcademicTags {
  const output = emptyAcademicTags();
  for (const category of ACADEMIC_TAG_CATEGORIES) {
    const tags = raw[category];
    if (!Array.isArray(tags) || tags.length > MAX_ACADEMIC_TAGS_PER_CATEGORY) {
      throw new Error(`Se permiten hasta ${MAX_ACADEMIC_TAGS_PER_CATEGORY} etiquetas por categoría.`);
    }
    const seen = new Set<string>();
    for (const value of tags) {
      if (typeof value !== 'string') throw new Error('Las etiquetas deben ser texto.');
      const tag = normalizeAcademicTag(value);
      const key = academicTagKey(tag);
      if (seen.has(key)) throw new Error(`La etiqueta «${tag}» ya está registrada en esta categoría.`);
      seen.add(key);
      output[category].push(tag);
    }
  }
  return output;
}

/** Lee registros anteriores que todavía no contienen academicTags. Nunca infiere
 * títulos verificados a partir del campo heredado academicTitle. */
export function readAcademicTags(raw: unknown): AcademicTags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyAcademicTags();
  const record = raw as Record<string, unknown>;
  const tags = emptyAcademicTags();
  for (const category of ACADEMIC_TAG_CATEGORIES) {
    const items = record[category];
    if (!Array.isArray(items)) continue;
    const seen = new Set<string>();
    for (const item of items) {
      if (typeof item !== 'string') continue;
      try {
        const normalized = normalizeAcademicTag(item);
        const key = academicTagKey(normalized);
        if (seen.has(key) || tags[category].length >= MAX_ACADEMIC_TAGS_PER_CATEGORY) continue;
        tags[category].push(normalized);
        seen.add(key);
      } catch { /* El lector no propaga datos corruptos a la interfaz. */ }
    }
  }
  return tags;
}

export function addAcademicTag(current: AcademicTags, category: AcademicTagCategory, value: string): AcademicTags {
  const next = { ...current, [category]: [...current[category], normalizeAcademicTag(value)] };
  return normalizeAcademicTags(next);
}

export function removeAcademicTag(current: AcademicTags, category: AcademicTagCategory, index: number): AcademicTags {
  return { ...current, [category]: current[category].filter((_, i) => i !== index) };
}

export function normalizeResearcherProfile(input: ResearcherProfileFields): ResearcherProfileFields {
  const academicTitle = input.academicTitle.trim().replace(/\s+/g, ' ');
  const institution = input.institution.trim().replace(/\s+/g, ' ');
  const researchLines = input.researchLines.trim();
  const biography = input.biography.trim();
  if (academicTitle.length > 100) throw new Error('El título académico no puede superar los 100 caracteres.');
  if (institution.length > 140) throw new Error('La institución no puede superar los 140 caracteres.');
  if (researchLines.length > 450) throw new Error('Las líneas de investigación no pueden superar los 450 caracteres.');
  if (biography.length > 1200) throw new Error('La semblanza no puede superar los 1200 caracteres.');
  return { academicTitle, institution, researchLines, biography, academicTags: normalizeAcademicTags(input.academicTags) };
}

export function canEditResearcherProfile(role: string | null, ownerUid: string, actorUid: string): boolean {
  return (role === 'professor' || role === 'admin') && ownerUid === actorUid;
}
