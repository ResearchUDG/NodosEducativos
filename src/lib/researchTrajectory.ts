/** Hitos académicos autodeclarados, privados para el titular y la administración.
 * No acreditan estudios ni generan permisos o publicaciones automáticamente.
 */
export const TRAJECTORY_CATEGORIES = ['estudio', 'certificacion', 'obra', 'proyecto', 'investigacion'] as const;
export type TrajectoryCategory = (typeof TRAJECTORY_CATEGORIES)[number];
export const TRAJECTORY_LABELS: Record<TrajectoryCategory, string> = {
  estudio: 'Estudios', certificacion: 'Certificaciones', obra: 'Obras y creaciones',
  proyecto: 'Proyectos', investigacion: 'Investigación',
};
export type TrajectoryFields = {
  category: TrajectoryCategory;
  title: string;
  institution: string;
  startDate: string;
  endDate: string;
  description: string;
  url: string;
};
export type TrajectoryMilestone = TrajectoryFields & { id: string };
export const emptyTrajectoryFields: TrajectoryFields = {
  category: 'estudio', title: '', institution: '', startDate: '', endDate: '', description: '', url: '',
};

/** Valida día real (incluidos años bisiestos); no confunde las fechas con marcas de guardado. */
export function isRealDate(value: string): boolean {
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;
}

function clean(value: string, name: string, limit: number, required = false): string {
  if (typeof value !== 'string') throw new Error(`${name}: introduzca texto válido.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`${name}: contiene caracteres no permitidos.`);
  const text = value.trim();
  if (text.length > limit || (required && text.length < 3)) {
    throw new Error(`${name}: ${required ? 'introduzca entre 3 y' : 'máximo'} ${limit} caracteres.`);
  }
  return text;
}

export function normalizeTrajectoryFields(fields: TrajectoryFields): TrajectoryFields {
  if (!TRAJECTORY_CATEGORIES.includes(fields.category)) throw new Error('Elija un tipo de acontecimiento válido.');
  const title = clean(fields.title, 'Título', 120, true);
  const institution = clean(fields.institution, 'Institución o entidad', 140);
  const description = clean(fields.description, 'Descripción', 600);
  const startDate = fields.startDate;
  const endDate = fields.endDate || '';
  if (!isRealDate(startDate)) throw new Error('Seleccione una fecha de inicio válida (día, mes y año).');
  if (endDate && (!isRealDate(endDate) || endDate < startDate)) {
    throw new Error('La fecha de finalización debe ser real y no anterior al inicio.');
  }
  const url = clean(fields.url, 'Enlace', 500);
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) throw new Error();
    } catch { throw new Error('El enlace debe ser una dirección HTTPS válida, sin credenciales.'); }
  }
  return { category: fields.category, title, institution, description, startDate, endDate, url };
}

export function readTrajectoryMilestone(id: string, data: unknown): TrajectoryMilestone | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  try {
    const fields = normalizeTrajectoryFields({
      category: record.category as TrajectoryCategory,
      title: record.title as string,
      institution: record.institution as string,
      startDate: record.startDate as string,
      endDate: record.endDate as string,
      description: record.description as string,
      url: record.url as string,
    });
    return { id, ...fields };
  } catch { return null; }
}

export function sortTrajectoryMilestones(items: TrajectoryMilestone[]): TrajectoryMilestone[] {
  return [...items].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate) || a.title.localeCompare(b.title, 'es'));
}

export function trajectoryDateLabel(date: string): string {
  if (!isRealDate(date)) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
