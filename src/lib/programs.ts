/** Modelo ligero de catálogo académico: no establece permisos por sí mismo. */
export type ProgramRecord = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};
export function normalizeProgramInput(name: string, description: string) {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  const normalizedDescription = description.trim();
  if (normalizedName.length < 3 || normalizedName.length > 100) {
    throw new Error('El nombre del programa debe tener entre 3 y 100 caracteres.');
  }
  if (normalizedDescription.length > 400) {
    throw new Error('La descripción no puede superar los 400 caracteres.');
  }
  return { name: normalizedName, description: normalizedDescription };
}
export function canAssignNewMember(program: Pick<ProgramRecord, 'active'>) {
  return program.active === true;
}
export function visiblePrograms<T extends ProgramRecord>(programs: T[], query: string, filter: 'all' | 'active' | 'inactive'): T[] {
  const needle = query.trim().toLocaleLowerCase('es');
  return programs.filter(p =>
    (filter === 'all' || p.active === (filter === 'active')) &&
    (!needle || `${p.name} ${p.description}`.toLocaleLowerCase('es').includes(needle))
  ).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
