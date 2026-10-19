#!/usr/bin/env node
/** Publicación 2D bajo la sesión Firebase del propio usuario. Nunca usa Admin SDK. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function argValue(key) { const at = args.indexOf(key); return at < 0 ? null : args[at + 1] || null; }
function fail(message) { throw new Error(message); }
function normalizeText(v, field, max, required = false) {
  if (v !== undefined && typeof v !== 'string') fail(`«${field}» debe ser texto.`);
  const val = String(v ?? '').trim();
  if ((required && !val) || val.length > max) fail(`«${field}»: ${required ? 'obligatorio; ' : ''}máximo ${max} caracteres.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(val)) fail(`«${field}» contiene caracteres no permitidos.`);
  return val;
}
const words = value => value.trim().split(/\s+/u).filter(Boolean).length;
const categories = new Set(['pregunta', 'tesis', 'idea', 'fuente']);
const relations = new Set(['fundamenta','refuta','define','contextualiza','cuestiona','deriva','ejemplifica','otra']);
function refValue(raw, index, id) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`Referencia ${index} de ${id} incorrecta.`);
  const ref = {
    author: normalizeText(raw.author, 'author', 110),
    work: normalizeText(raw.work, 'work', 180, true),
    year: normalizeText(raw.year, 'year', 35),
    locator: normalizeText(raw.locator, 'locator', 100),
    url: normalizeText(raw.url, 'url', 240),
  };
  if (ref.url) {
    try { const u = new URL(ref.url); if (!['http:', 'https:'].includes(u.protocol)) fail('Protocolo de enlace no permitido.'); }
    catch { fail(`Enlace inválido de ${id}: use http(s).`); }
  }
  return ref;
}
function prepare(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('El archivo debe contener un objeto JSON.');
  const title = normalizeText(raw.title, 'título del sistema', 100, true);
  if (title.length < 3) fail('El título general debe tener al menos 3 caracteres.');
  const description = normalizeText(raw.description, 'descripción del sistema', 500);
  if (!Array.isArray(raw.nodes) || raw.nodes.length < 1 || raw.nodes.length > 80) fail('Incluya entre 1 y 80 nodos.');
  if (!Array.isArray(raw.edges) || raw.edges.length > 160) fail('Se admiten hasta 160 conexiones.');
  const ids = new Set();
  const nodes = raw.nodes.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`Nodo ${index + 1} no válido.`);
    const id = normalizeText(entry.id, `id nodo ${index + 1}`, 80, true);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) fail(`Identificador de nodo duplicado/no válido: ${id}`);
    ids.add(id);
    const text = normalizeText(entry.title, `título de ${id}`, 3000, true);
    if (words(text) > 100) fail(`«${id}» excede el límite de 100 palabras (${words(text)}).`);
    const desc = normalizeText(entry.description, `descripción de ${id}`, 240);
    const category = entry.category ?? 'idea';
    if (!categories.has(category)) fail(`Categoría inválida de ${id}.`);
    const refs = entry.references ?? [];
    if (!Array.isArray(refs) || refs.length > 4) fail(`«${id}» admite hasta cuatro referencias.`);
    const x = entry.x ?? (index % 2) * 650;
    const y = entry.y ?? Math.floor(index / 2) * 520;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) fail(`Coordenadas inválidas de ${id}.`);
    return {
      id, type: 'concept', position: { x, y },
      data: { title: text, description: desc, category,
        ...(refs.length ? { references: refs.map((r, j) => refValue(r, j + 1, id)) } : {}) },
    };
  });
  const edgeIds = new Set();
  const edges = raw.edges.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`Conexión ${index + 1} inválida.`);
    const source = normalizeText(entry.from, 'origen', 80, true);
    const target = normalizeText(entry.to, 'destino', 80, true);
    if (!ids.has(source) || !ids.has(target)) fail(`La relación ${source} → ${target} apunta a un nodo inexistente.`);
    const id = `e${index + 1}`;
    if (edgeIds.has(id)) fail('Identificador de relación duplicado.');
    edgeIds.add(id);
    const relation = entry.relation ?? 'otra';
    if (!relations.has(relation)) fail(`Relación desconocida: ${relation}`);
    return { id, source, target, type: 'smoothstep',
      label: normalizeText(entry.label ?? relation, 'etiqueta de relación', 80), data: { relation } };
  });
  const visibleIds = raw.visibleNodeIds ?? nodes.map(n => n.id);
  if (!Array.isArray(visibleIds) || !visibleIds.length || visibleIds.some(id => typeof id !== 'string' || !ids.has(id)) || new Set(visibleIds).size !== visibleIds.length) {
    fail('«visibleNodeIds» debe seleccionar identificadores únicos de nodos existentes.');
  }
  return { title, description, nodes, edges, visibleIds };
}
function readEnv() {
  const path = resolve(appRoot, '.env.local');
  if (!existsSync(path)) fail(`No se encontró ${path}. Se requiere la configuración de Firebase de su instalación.`);
  const content = readFileSync(path, 'utf8');
  const values = Object.create(null);
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(VITE_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) {
      const val = match[2]; values[match[1]] = val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'") ? val.slice(1, -1) : val;
    }
  }
  for (const key of ['API_KEY','AUTH_DOMAIN','PROJECT_ID','APP_ID','MESSAGING_SENDER_ID']) {
    if (!values[`VITE_FIREBASE_${key}`]) fail(`Falta VITE_FIREBASE_${key} en .env.local.`);
  }
  if (values.VITE_FIREBASE_PROJECT_ID !== 'nodos-educativos-researchudg') fail('El proyecto Firebase no coincide con Nodos Educativos.');
  return values;
}
async function passwordPrompt() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') fail('Necesita una Terminal interactiva para escribir la contraseña sin mostrarla.');
  process.stdout.write('Contraseña de Nodos Educativos (no aparecerá): ');
  return await new Promise((resolve, reject) => {
    let password = '';
    const stdin = process.stdin;
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    function cleanup() { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); process.stdout.write('\n'); }
    function onData(value) {
      for (const ch of value) {
        if (ch === '\u0003') { cleanup(); reject(new Error('Operación cancelada.')); return; }
        if (ch === '\r' || ch === '\n') { cleanup(); resolve(password); return; }
        if (ch === '\u007f' || ch === '\b') { password = password.slice(0, -1); continue; }
        if (ch >= ' ' && password.length < 300) password += ch;
      }
    }
    stdin.on('data', onData);
  });
}
async function question(text) {
  const io = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await io.question(text)).trim(); } finally { io.close(); }
}
async function run() {
  if (args.includes('--help') || args.length === 0) {
    console.log('USO:');
    console.log('  node scripts/crear-sistema-2d.mjs --file ./mi-esquema.json --dry-run');
    console.log('  node scripts/crear-sistema-2d.mjs --groups');
    console.log('  node scripts/crear-sistema-2d.mjs --file ./mi-esquema.json                 # guardar borrador');
    console.log('  node scripts/crear-sistema-2d.mjs --file ./mi-esquema.json --group TEST    # publicar');
    return;
  }
  const isList = args.includes('--groups');
  const dry = args.includes('--dry-run');
  const file = argValue('--file');
  const groupId = argValue('--group');
  if (!isList && !file) fail('Indique --file ruta/al/archivo.json.');
  if (args.includes('--group') && !groupId) fail('--group necesita un identificador de programa.');
  let graph;
  if (file) {
    const source = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
    graph = prepare(source);
    console.log(`\nESQUEMA: ${graph.title}\nConceptos: ${graph.nodes.length}; relaciones: ${graph.edges.length}; referencias: ${graph.nodes.reduce((n, v) => n + (v.data.references?.length ?? 0), 0)}.`);
    graph.nodes.forEach(n => console.log(` · [${n.id}] ${n.data.title.slice(0, 120)}${n.data.title.length > 120 ? '…' : ''} (${words(n.data.title)}/100 palabras)`));
    console.log(`Nodos seleccionados para publicar: ${graph.visibleIds.length}/${graph.nodes.length}.`);
  }
  if (dry) { console.log('VALIDACIÓN CORRECTA: no se autenticó ni se escribió en Firebase.'); return; }
  const env = readEnv();
  const { initializeApp, deleteApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword, signOut } = await import('firebase/auth');
  const { getFirestore, doc, collection, getDoc, getDocs, setDoc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID }, `nodos-cli-${process.pid}`);
  const auth = getAuth(app);
  let logged = false;
  try {
    if (!process.stdin.isTTY) fail('Use Terminal interactiva; este comando no admite contraseñas por redirección.');
    const email = (await question('Correo institucional de Nodos Educativos: ')).toLowerCase();
    const password = await passwordPrompt();
    try { await signInWithEmailAndPassword(auth, email, password); logged = true; }
    catch { fail('No fue posible iniciar sesión. Compruebe correo, contraseña y método de acceso. No se ha escrito nada.'); }
    const user = auth.currentUser;
    if (!user || !user.emailVerified || user.email?.toLowerCase() !== email) fail('Se requiere una cuenta institucional verificada.');
    const allowed = JSON.parse(readFileSync(resolve(appRoot,'security','email-domains.json'), 'utf8')).domains;
    if (!Array.isArray(allowed) || !allowed.some(domain => email.endsWith('@' + domain))) fail('Dominio institucional no autorizado.');
    const db = getFirestore(app);
    const access = await getDoc(doc(db,'access',user.uid));
    if (!access.exists() || access.data().active !== true) fail('Esta cuenta no tiene acceso activo a Nodos Educativos.');
    const role = access.data().role;
    if (!['admin','professor','student'].includes(role)) fail('Rol no admitido.');
    console.log(`\nSesión verificada. Rol: ${role}. El autor será su UID de Firebase (${user.uid}).`);
    let groups = [];
    if (role === 'admin') {
      const snap = await getDocs(collection(db,'groups'));
      groups = snap.docs.filter(d => d.data().active === true).map(d => ({id:d.id,name:d.data().name}));
    } else {
      const snap = await getDocs(collection(db,'memberships',user.uid,'groups'));
      const memberships = snap.docs.filter(d => d.data().active === true);
      const lookups = await Promise.all(memberships.map(d => getDoc(doc(db,'groups',d.id))));
      groups = lookups.filter(d => d.exists() && d.data().active === true).map(d => ({id:d.id,name:d.data().name}));
    }
    if (isList) {
      console.log('\nProgramas activos asignados o administrados:');
      for (const g of groups) console.log(`  ${g.id} — ${g.name}`);
      if (!groups.length) console.log('  Ninguno.');
      return;
    }
    if (groupId && role === 'student') fail('Una cuenta estudiante no puede publicar directamente. Use la solicitud de revisión de la aplicación.');
    if (groupId && !groups.some(g => g.id === groupId)) fail(`No tiene permisos de publicación para el programa «${groupId}».`);
    console.log(groupId ? `Se CREARÁ un borrador, su versión guardada y una publicación para «${groupId}».` : 'Se CREARÁ un borrador privado con su primera revisión, sin publicar.');
    const confirm = await question(groupId ? 'Escriba PUBLICAR para confirmar: ' : 'Escriba GUARDAR para confirmar: ');
    if (confirm !== (groupId ? 'PUBLICAR' : 'GUARDAR')) { console.log('Cancelado. No se escribió nada.'); return; }
    const base = doc(collection(db,'users',user.uid,'diagrams'));
    let stage = 'borrador';
    try {
      await setDoc(base, { title:graph.title, description:graph.description, nodes:graph.nodes, edges:graph.edges,
        createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      console.log(`Borrador privado creado: ${base.id}`);
      const baseline = doc(db,'users',user.uid,'diagrams',base.id,'revisions','baseline');
      const revision = doc(collection(db,'users',user.uid,'diagrams',base.id,'revisions'));
      stage = 'revisión';
      await runTransaction(db, async trx => {
        const parent = await trx.get(base);
        const oldBase = await trx.get(baseline);
        if (!parent.exists() || oldBase.exists()) fail('El estado inicial ya no coincide.');
        const snapshot = { title:graph.title,description:graph.description,nodes:graph.nodes,edges:graph.edges };
        trx.set(baseline, { ...snapshot, kind:'baseline', authorUid:user.uid,savedAt:serverTimestamp() });
        trx.set(revision, { ...snapshot, kind:'save', authorUid:user.uid,savedAt:serverTimestamp() });
        trx.update(base, { updatedAt:serverTimestamp() });
      });
      const saved = await getDoc(revision);
      if (!saved.exists() || !saved.data().savedAt) fail('No se pudo verificar la revisión guardada.');
      console.log(`Primera revisión guardada: ${revision.id}`);
      if (groupId) {
        stage = 'publicación';
        const keep = new Set(graph.visibleIds);
        const nodes = graph.nodes.filter(n => keep.has(n.id));
        const edges = graph.edges.filter(e => keep.has(e.source) && keep.has(e.target));
        const pub = doc(db,'groupPublications',groupId,'diagrams',base.id);
        await setDoc(pub, {ownerUid:user.uid, sourceDiagramId:base.id,sourceRevisionId:revision.id,
          sourceRevisionSavedAt:saved.data().savedAt,title:graph.title,description:graph.description,
          nodes,edges,publishedAt:serverTimestamp(),updatedAt:serverTimestamp()});
        console.log(`PUBLICACIÓN CREADA: ${groupId}/${base.id}`);
      }
      console.log(`\nAbrir editor: https://researchudg.github.io/NodosEducativos/#/esquema/${base.id}`);
      if (groupId) console.log(`Abrir publicación: https://researchudg.github.io/NodosEducativos/#/publicacion/${groupId}/${base.id}`);
    } catch (error) {
      console.error(`Fallo en etapa «${stage}». Si se creó un borrador, NO repita sin comprobarlo en «Mis sistemas 2D»: se podría duplicar.`);
      throw error;
    }
  } finally {
    if (logged) await signOut(auth).catch(() => {});
    await deleteApp(app).catch(() => {});
  }
}
run().catch(err => { console.error(`ERROR: ${err.message}`); process.exitCode = 1; });
