/**
 * Convierte estructuras de datos de la aplicación en objetos aceptados por
 * Firestore, retirando exclusivamente valores `undefined`.
 *
 * - conserva false, 0, '', null y NaN no se introduce aquí;
 * - filtra elementos undefined en arrays;
 * - solo recorre arrays y objetos planos, para no alterar clases/sentinelas.
 */
export function stripUndefinedForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedForFirestore(item)) as T;
  }

  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;

    const cleaned: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      cleaned[key] = stripUndefinedForFirestore(item);
    }
    return cleaned as T;
  }

  return value;
}
