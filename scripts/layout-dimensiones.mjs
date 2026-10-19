/** Distribución circular: NO modifica títulos, bibliografía, conexiones ni IDs. */
export const DIMENSIONES = Object.freeze([
  ['ia', 'preg_ia'],
  ['interes_si', 'preg_interes_si'],
  ['aplicacion', 'preg_aplicacion'],
  ['emociones', 'preg_emociones'],
  ['reconocimiento', 'preg_reconocimiento'],
  ['definicion', 'preg_definicion'],
  ['mundo', 'preg_mundo'],
  ['redes', 'preg_redes'],
]);
export const IDS_ESPERADOS = Object.freeze(['marco', 'fuente', ...DIMENSIONES.flat()]);
export const TITULO_ESPERADO = 'Ocho dimensiones de discusión y cuestionario de cotejo';
export const ANCHO = 250;
export const ALTO_ESTIMADO = 300;
export const RADIO_DIMENSIONES = 600;
export const RADIO_PREGUNTAS = 1090;

function comprobar(nodes) {
  if (!Array.isArray(nodes) || nodes.length !== IDS_ESPERADOS.length) {
    throw new Error(`El esquema debe tener exactamente ${IDS_ESPERADOS.length} nodos; el encontrado tiene ${Array.isArray(nodes) ? nodes.length : 'un valor inválido'}. No se modificarán trabajos distintos.`);
  }
  const encontrados = new Set(nodes.map(n => n?.id));
  const faltantes = IDS_ESPERADOS.filter(id => !encontrados.has(id));
  if (faltantes.length || encontrados.size !== IDS_ESPERADOS.length) {
    throw new Error(`Los identificadores no coinciden con el esquema del coloquio (${faltantes.join(', ') || 'duplicados/extra'}).`);
  }
  for (const node of nodes) {
    if (!node || !node.data || !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      throw new Error(`Posición o contenido inválido: ${node?.id ?? '?'}`);
    }
  }
}

export function reacomodarDimensiones(nodes, options = {}) {
  comprobar(nodes);
  const radio = options.radio ?? RADIO_DIMENSIONES;
  const radioExterior = options.radioExterior ?? RADIO_PREGUNTAS;
  if (!Number.isInteger(radio) || radio < 550 || radio > 1500 ||
      !Number.isInteger(radioExterior) || radioExterior - radio < 460 || radioExterior > 2200) {
    throw new Error('Utilice --radio entre 550 y 1500 y --exterior al menos 460 px mayor (máximo 2200).');
  }
  const posiciones = new Map([
    ['marco', {x: -ANCHO / 2, y: -300}],
    ['fuente', {x: -ANCHO / 2, y: 40}],
  ]);
  DIMENSIONES.forEach(([principal, pregunta], i) => {
    // Empezar arriba y recorrer en el sentido de las manecillas del reloj.
    const angulo = -Math.PI / 2 + (Math.PI * 2 * i) / DIMENSIONES.length;
    function posicion(r) {
      return {x: Math.round(Math.cos(angulo) * r - ANCHO / 2),
        y: Math.round(Math.sin(angulo) * r - ALTO_ESTIMADO / 2)};
    }
    posiciones.set(principal, posicion(radio));
    posiciones.set(pregunta, posicion(radioExterior));
  });
  return nodes.map(node => ({...node, position: posiciones.get(node.id)}));
}

export function estimarExtension(nodes) {
  const xs = nodes.map(n => n.position.x), ys = nodes.map(n => n.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + ANCHO;
  const minY = Math.min(...ys), maxY = Math.max(...ys) + ALTO_ESTIMADO;
  return {ancho: Math.round(maxX - minX), alto: Math.round(maxY - minY)};
}

export function contarColisionesEstimadas(nodes) {
  let count = 0;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i].position, b = nodes[j].position;
    if (Math.abs(a.x - b.x) < ANCHO && Math.abs(a.y - b.y) < ALTO_ESTIMADO) count++;
  }
  return count;
}
