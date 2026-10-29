import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { deleteDraftAndPublishedCopies } from '../src/lib/publicationCascade';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let env: RulesTestEnvironment;
const email = (person: string) => `${person}@alumnos.udg.mx`;
const session = (uid: string, address = email(uid), verified = true) => env.authenticatedContext(uid, { email: address, email_verified: verified }).firestore();
const draft = (db: import('firebase/firestore').Firestore, uid = 'professor', id = 'mapa') => doc(db, 'users', uid, 'diagrams', id);
const publication = (db: import('firebase/firestore').Firestore, group = 'grupo1', id = 'mapa') => doc(db, 'groupPublications', group, 'diagrams', id);
const diagram = () => ({ title: 'Mapa institucional', description: 'Lectura filosófica', nodes: [], edges: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const editionStamp = Timestamp.fromMillis(1760000000000);
const released = (uid = 'professor') => ({ ownerUid: uid, sourceDiagramId: 'mapa', sourceRevisionId: 'rev-a', sourceRevisionSavedAt: editionStamp, title: 'Mapa institucional', description: 'Lectura filosófica', nodes: [], edges: [], publishedAt: serverTimestamp(), updatedAt: serverTimestamp() });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'nodos-educativos-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, role] of [['root', 'admin'], ['professor', 'professor'], ['newprof', 'professor'], ['legacyprof', 'professor'], ['ghostprof', 'professor'], ['student', 'student'], ['visitor', 'student'], ['blocked', 'student']] as const)
      await setDoc(doc(db, 'access', uid), { role, active: uid !== 'blocked' });
    await setDoc(doc(db, 'groups', 'grupo1'), { name: 'Seminario I', active: true, description: '', createdBy: 'root' });
    await setDoc(doc(db, 'groups', 'grupo2'), { name: 'Seminario II', active: true, description: '', createdBy: 'root' });
    await setDoc(doc(db, 'groups', 'suspendido'), { name: 'Grupo suspendido', active: false });
    await setDoc(doc(db, 'memberships', 'student', 'groups', 'suspendido'), { groupId: 'suspendido', active: true });
    for (const uid of ['professor', 'student'])
      await setDoc(doc(db, 'memberships', uid, 'groups', 'grupo1'), { groupId: 'grupo1', active: true });
    await setDoc(doc(db, 'users', 'professor', 'diagrams', 'mapa'), { title: 'Borrador privado', description: '', nodes: [], edges: [] });
    await setDoc(doc(db, 'users', 'professor', 'diagrams', 'mapa', 'revisions', 'rev-a'), { title: 'Mapa institucional', description: 'Lectura filosófica', nodes: [], edges: [], kind: 'save', authorUid: 'professor', savedAt: editionStamp });
    await setDoc(doc(db, 'researcherProfiles', 'professor'), { ownerUid: 'professor', academicTitle: 'Maestría', institution: 'Centro de investigación', researchLines: 'Filosofía', biography: '', createdAt: Timestamp.fromMillis(1760000000000), updatedAt: Timestamp.fromMillis(1760000000000) });
    await setDoc(doc(db, 'researcherProfiles', 'legacyprof'), { ownerUid: 'legacyprof', academicTitle: 'Estudiante de Filosofía', institution: 'CUCSH', researchLines: '', biography: '', createdAt: Timestamp.fromMillis(1760000000000), updatedAt: Timestamp.fromMillis(1760000000000) });
    // La publicación precargada debe cumplir el contrato del dato persistido: publishedAt es obligatorio e inmutable.
    await setDoc(doc(db, 'groupPublications', 'grupo1', 'diagrams', 'mapa'), { ownerUid: 'professor', sourceDiagramId: 'mapa', title: 'Publicación autorizada', description: '', nodes: [], edges: [], publishedAt: Timestamp.fromMillis(1760000000000) });
    await setDoc(doc(db, 'groupPublications', 'suspendido', 'diagrams', 'otro'), { title: 'Contenido desactivado', ownerUid: 'root' });
    await setDoc(doc(db, 'groupPublications', 'grupo2', 'diagrams', 'otro'), { ownerUid: 'root', sourceDiagramId: 'otro', title: 'Secreto otro grupo', description: '', nodes: [], edges: [] });
  });
});
afterAll(async () => { await env?.cleanup(); });

describe('Directorio y aislamiento RBAC/ABAC', () => {
  it('profesor asignado puede leer su propio borrador', async () => assertSucceeds(getDoc(draft(session('professor')))));
  it('estudiante no puede leer el borrador del profesor', async () => assertFails(getDoc(draft(session('student')))));
  it('profesor no puede leer borrador ajeno', async () => assertFails(getDoc(draft(session('root')))));
  it('estudiante puede leer la publicación de su grupo', async () => assertSucceeds(getDoc(publication(session('student')))));
  it('estudiante puede listar únicamente la ruta de publicaciones de su grupo', async () => assertSucceeds(getDocs(collection(session('student'), 'groupPublications', 'grupo1', 'diagrams'))));
  it('estudiante no puede leer ni listar publicaciones de otro grupo', async () => {
    await assertFails(getDoc(publication(session('student'), 'grupo2', 'otro')));
    await assertFails(getDocs(collection(session('student'), 'groupPublications', 'grupo2', 'diagrams')));
  });
  it('un grupo inactivo bloquea la lectura pese a conservar la membresía', async () => assertFails(getDoc(publication(session('student'), 'suspendido', 'otro'))));
  it('un usuario institucional sin asignación no puede leer publicaciones', async () => assertFails(getDoc(publication(session('unassigned')))));
  it('una cuenta suspendida pierde acceso aunque sea institucional', async () => assertFails(getDoc(publication(session('blocked')))));
  it('no acepta correo no verificado aunque tenga roles', async () => assertFails(getDoc(publication(session('student', email('student'), false)))));
  it('no acepta dominio confusamente similar aunque tenga roles', async () => assertFails(getDoc(publication(session('student', 'student@alumnos.udg.mx.example.com')))));
  it('no acepta sesiones anónimas', async () => assertFails(getDoc(publication(env.unauthenticatedContext().firestore()))));
  it('estudiante puede crear un borrador propio, pero no acceder a borradores ajenos', async () => {
    const own = session('student');
    await assertSucceeds(setDoc(draft(own, 'student', 'nuevo'), diagram()));
    await assertSucceeds(getDoc(draft(own, 'student', 'nuevo')));
    await assertFails(setDoc(draft(own, 'professor', 'invasion'), diagram()));
    await assertFails(getDoc(draft(own, 'professor', 'mapa')));
    await assertFails(setDoc(draft(session('blocked'), 'blocked', 'invasion'), diagram()));
  });
  it('estudiante no puede crear una publicación', async () => assertFails(setDoc(publication(session('student'), 'grupo1', 'creado'), { ...released('student'), sourceDiagramId: 'creado' })));
  it('estudiante no puede modificarlas ni borrarlas', async () => {
    await assertFails(updateDoc(publication(session('student')), { title: 'Modificado por alumno' }));
    await assertFails(deleteDoc(publication(session('student'))));
  });
  it('profesor puede crear un borrador propio', async () => assertSucceeds(setDoc(draft(session('professor'), 'professor', 'nuevo'), diagram())));
  it('profesor puede publicar copia de su borrador para grupo asignado', async () => {
    // Evitar colisionar con la publicación precargada 'mapa': setDoc sobre documento
    // existente usa allow update (no allow create). Aquí comprobamos una creación real.
    const db = session('professor');
    const id = 'publicacion-nueva';
    await assertSucceeds(setDoc(draft(db, 'professor', id), diagram()));
    const prior = doc(db, 'users', 'professor', 'diagrams', id, 'revisions', 'rev-b');
    await assertSucceeds(setDoc(prior, { title: 'Mapa institucional', description: 'Lectura filosófica', nodes: [], edges: [], kind: 'save', authorUid: 'professor', savedAt: serverTimestamp() }));
    const timestamp = (await getDoc(prior)).data()?.savedAt;
    await assertSucceeds(setDoc(publication(db, 'grupo1', id), { ...released(), sourceDiagramId: id, sourceRevisionId: 'rev-b', sourceRevisionSavedAt: timestamp }));
  });
  it('profesor puede actualizar el contenido publicado conservando publishedAt', async () => {
    await assertSucceeds(updateDoc(publication(session('professor')), {
      title: 'Mapa institucional', description: 'Lectura filosófica', sourceRevisionId: 'rev-a', sourceRevisionSavedAt: editionStamp, updatedAt: serverTimestamp(),
    }));
  });
  it('profesor no puede alterar publishedAt después de publicar', async () => {
    await assertFails(updateDoc(publication(session('professor')), {
      publishedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });
  it('profesor no puede publicar donde no es miembro', async () => assertFails(setDoc(publication(session('professor'), 'grupo2', 'mapa'), released())));
  it('profesor no puede suplantar al autor', async () => assertFails(setDoc(publication(session('professor'), 'grupo1', 'mapa-falso'), { ...released('root'), sourceDiagramId: 'mapa-falso' })));
  it('no permite atribuir una publicación a una versión inexistente', async () => {
    await assertFails(updateDoc(publication(session('professor')), {
      title: 'Mapa institucional', description: 'Lectura filosófica', sourceRevisionId: 'inventada',
      sourceRevisionSavedAt: editionStamp, updatedAt: serverTimestamp(),
    }));
  });
  it('no permite falsificar la fecha de la versión citada', async () => {
    await assertFails(updateDoc(publication(session('professor')), {
      title: 'Mapa institucional', description: 'Lectura filosófica', sourceRevisionId: 'rev-a',
      sourceRevisionSavedAt: Timestamp.fromMillis(1760001000000), updatedAt: serverTimestamp(),
    }));
  });
  it('no permite asignar a una edición un título distinto al de su revisión', async () => {
    await assertFails(updateDoc(publication(session('professor')), {
      title: 'Título ajeno', description: 'Lectura filosófica', sourceRevisionId: 'rev-a',
      sourceRevisionSavedAt: editionStamp, updatedAt: serverTimestamp(),
    }));
  });
  it('una publicación anterior sigue siendo legible, aunque el nuevo editor exige una edición', async () => {
    await assertSucceeds(getDoc(publication(session('student'))));
    await assertFails(updateDoc(publication(session('professor')), {
      title: 'Sin versión guardada', updatedAt: serverTimestamp(),
      sourceRevisionId: '', sourceRevisionSavedAt: editionStamp,
    }));
  });
  it('ningún usuario puede asignarse a sí mismo el rol admin', async () => assertFails(setDoc(doc(session('student'), 'access', 'student'), { role: 'admin', active: true })));
  it('un profesor tampoco puede elevar sus privilegios', async () => assertFails(updateDoc(doc(session('professor'), 'access', 'professor'), { role: 'admin' })));
  it('ni estudiante ni profesor pueden gestionar membresías', async () => {
    await assertFails(setDoc(doc(session('student'), 'memberships', 'student', 'groups', 'grupo2'), { active: true, groupId: 'grupo2' }));
    await assertFails(deleteDoc(doc(session('professor'), 'memberships', 'student', 'groups', 'grupo1')));
  });
  it('administrador puede conceder un rol subordinado con trazabilidad', async () => assertSucceeds(setDoc(doc(session('root'), 'access', 'newStudent'), { role: 'student', active: true, email: email('newStudent'), grantedBy: 'root', updatedAt: serverTimestamp() })));
  it('el administrador tampoco puede crear otro admin desde la app', async () => assertFails(setDoc(doc(session('root'), 'access', 'hidden-admin'), { role: 'admin', active: true, email: email('hidden-admin'), grantedBy: 'root', updatedAt: serverTimestamp() })));
  it('el administrador puede crear grupos', async () => assertSucceeds(setDoc(doc(session('root'), 'groups', 'grupo3'), { name: 'Nuevo seminario', description: '', active: true, createdBy: 'root', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })));
  it('el estudiante no puede crear grupos', async () => assertFails(setDoc(doc(session('student'), 'groups', 'falso'), { name: 'Grupo falso', description: '', active: true })));
  it('un usuario autorizado puede solicitar acceso sin poder autoproclamarse profesor', async () => {
    await assertSucceeds(setDoc(doc(session('unassigned'), 'accessRequests', 'unassigned'), { email: email('unassigned'), displayName: '', status: 'pending', createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(session('unassigned'), 'accessRequests', 'unassigned'), { status: 'approved' }));
  });
});

describe('Fichas privadas de investigadores — fase 2', () => {
  const academic = (uid = 'professor') => ({
    ownerUid: uid, academicTitle: 'Doctorado en Ciencias Sociales', institution: 'Centro de investigación',
    researchLines: 'Educación y teoría crítica', biography: 'Investiga conexiones conceptuales.',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  it('profesor crea su ficha académica con identidad inmutable', async () =>
    assertSucceeds(setDoc(doc(session('newprof'), 'researcherProfiles', 'newprof'), academic('newprof'))));
  it('profesor actualiza su propia ficha sin alterar la fecha de creación', async () =>
    assertSucceeds(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      researchLines: 'Teoría crítica y epistemología', updatedAt: serverTimestamp(),
    })));
  it('profesor consulta su ficha sin enumerar el directorio', async () => {
    await assertSucceeds(getDoc(doc(session('professor'), 'researcherProfiles', 'professor')));
    await assertFails(getDocs(collection(session('professor'), 'researcherProfiles')));
  });
  it('administrador puede consultar el directorio y una ficha individual', async () => {
    await assertSucceeds(getDocs(collection(session('root'), 'researcherProfiles')));
    await assertSucceeds(getDoc(doc(session('root'), 'researcherProfiles', 'professor')));
  });
  it('estudiante no puede consultar ni enumerar fichas de investigadores', async () => {
    await assertFails(getDoc(doc(session('student'), 'researcherProfiles', 'professor')));
    await assertFails(getDocs(collection(session('student'), 'researcherProfiles')));
  });
  it('profesor no puede consultar ficha ajena', async () =>
    assertFails(getDoc(doc(session('professor'), 'researcherProfiles', 'root'))));
  it('estudiante no puede crear ni modificar ficha académica', async () => {
    await assertFails(setDoc(doc(session('student'), 'researcherProfiles', 'student'), academic('student')));
    await assertFails(updateDoc(doc(session('student'), 'researcherProfiles', 'professor'), { biography: 'Suplantación' }));
  });
  it('profesor no puede alterar propietario ni fecha de origen', async () => {
    await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      ownerUid: 'student', updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });
  it('nadie puede insertar campos administrativos en la ficha académica', async () =>
    assertFails(setDoc(doc(session('ghostprof'), 'researcherProfiles', 'ghostprof'), {
      ...academic('ghostprof'), role: 'admin',
    })));
  it('el administrador no puede editar la ficha de otra persona', async () =>
    assertFails(updateDoc(doc(session('root'), 'researcherProfiles', 'professor'), {
      biography: 'Modificación no autorizada', updatedAt: serverTimestamp(),
    })));
  it('un investigador suspendido no puede acceder a su ficha', async () =>
    assertFails(getDoc(doc(session('blocked'), 'researcherProfiles', 'blocked'))));
  it('ningún usuario puede eliminar fichas académicas desde la aplicación', async () =>
    assertFails(deleteDoc(doc(session('professor'), 'researcherProfiles', 'professor'))));
});


describe('Etiquetas académicas privadas — fase 2b', () => {
  const validTags = () => ({
    careers: ['Licenciatura en Filosofía (en curso)', 'Ingeniería en Informática'],
    degrees: ['Ingeniero en Informática'],
    postgraduate: [],
    certifications: ['Certificación académica'],
  });
  it('profesor agrega cuatro categorías a ficha existente conservando propietario y origen', async () => {
    await assertSucceeds(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      academicTags: validTags(), updatedAt: serverTimestamp(),
    }));
    const record = await getDoc(doc(session('professor'), 'researcherProfiles', 'professor'));
    if (!record.exists()) throw new Error('La ficha debería existir.');
    if (record.data().ownerUid !== 'professor') throw new Error('El UID de propietario cambió.');
  });
  it('acepta el máximo de 40 etiquetas válidas sin agotar evaluaciones', async () => {
    const labels = (category: string) => Array.from({ length: 10 }, (_, index) =>
      `${category} ${index}`.padEnd(90, 'x'));
    const academicTags = {
      careers: labels('Carrera'),
      degrees: labels('Título'),
      postgraduate: labels('Posgrado'),
      certifications: labels('Certificación'),
    };
    await assertSucceeds(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      academicTags, updatedAt: serverTimestamp(),
    }));
    const snapshot = await assertSucceeds(getDoc(doc(session('professor'), 'researcherProfiles', 'professor')));
    if (!snapshot.exists() || snapshot.data().academicTags.degrees.length !== 10) {
      throw new Error('No persistieron las diez etiquetas de título.');
    }
  });
  it('rechaza etiquetas inválidas en la última posición, sin exceder el presupuesto', async () => {
    const invalidLast = (category: keyof ReturnType<typeof validTags>, last: unknown) => {
      const tags = validTags();
      return { ...tags, [category]: [...Array.from({ length: 9 }, (_, i) => `Etiqueta ${i}`), last] };
    };
    for (const category of ['careers', 'degrees', 'postgraduate', 'certifications'] as const) {
      await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
        academicTags: invalidLast(category, 100), updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
        academicTags: invalidLast(category, 'x'.repeat(91)), updatedAt: serverTimestamp(),
      }));
    }
  });
  it('rechaza delimitadores reservados y etiquetas vacías', async () => {
    for (const invalid of ['Filosofía § antigua', '']) {
      await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
        academicTags: { ...validTags(), careers: [invalid] }, updatedAt: serverTimestamp(),
      }));
    }
  });
  it('administrador consulta las etiquetas del investigador', async () =>
    assertSucceeds(getDoc(doc(session('root'), 'researcherProfiles', 'professor'))));
  it('rechaza más de diez etiquetas por categoría', async () =>
    assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      academicTags: { ...validTags(), careers: Array.from({ length: 11 }, (_, i) => `Carrera ${i}`) },
      updatedAt: serverTimestamp(),
    })));
  it('rechaza una etiqueta no textual o que supere noventa caracteres', async () => {
    await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      academicTags: { ...validTags(), certifications: [42] }, updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      academicTags: { ...validTags(), degrees: ['x'.repeat(91)] }, updatedAt: serverTimestamp(),
    }));
  });
  it('rechaza categorías extra no autorizadas', async () =>
    assertFails(updateDoc(doc(session('professor'), 'researcherProfiles', 'professor'), {
      academicTags: { ...validTags(), role: 'admin' }, updatedAt: serverTimestamp(),
    })));
  it('rechaza a un estudiante que intente modificar etiquetas de otra ficha', async () =>
    assertFails(updateDoc(doc(session('student'), 'researcherProfiles', 'professor'), {
      academicTags: validTags(), updatedAt: serverTimestamp(),
    })));
  it('mantiene compatibilidad con perfiles anteriores sin etiquetas', async () => {
    const previous = await getDoc(doc(session('legacyprof'), 'researcherProfiles', 'legacyprof'));
    if (Object.hasOwn(previous.data() || {}, 'academicTags')) throw new Error('El perfil heredado no debería contener etiquetas.');
    await assertSucceeds(updateDoc(doc(session('legacyprof'), 'researcherProfiles', 'legacyprof'), {
      academicTitle: 'Estudiante de Filosofía', updatedAt: serverTimestamp(),
    }));
  });
});

// Fase 3b: historial separado de las publicaciones y protegido por UID/rol.
describe('Historial privado e inmutable del laboratorio 2D — fase 3b', () => {
  const ref = (db: import('firebase/firestore').Firestore, owner = 'professor', diagramId = 'mapa', revisionId = 'rev-test') =>
    doc(db, 'users', owner, 'diagrams', diagramId, 'revisions', revisionId);
  const valid = (kind: 'baseline' | 'save' = 'save', uid = 'professor') => ({
    title: 'Revisión académica', description: 'Documento histórico', nodes: [], edges: [],
    kind, authorUid: uid, savedAt: serverTimestamp(),
  });
  it('el profesor crea una instantánea privada de su propio borrador', async () => {
    await assertSucceeds(setDoc(ref(session('professor')), valid()));
    await assertSucceeds(getDoc(ref(session('professor'))));
  });
  it('el historial puede enumerarse por el profesor propietario', async () => {
    await assertSucceeds(getDocs(collection(session('professor'), 'users', 'professor', 'diagrams', 'mapa', 'revisions')));
  });
  it('un estudiante no puede leer ni enumerar el historial privado', async () => {
    await assertFails(getDoc(ref(session('student'))));
    await assertFails(getDocs(collection(session('student'), 'users', 'professor', 'diagrams', 'mapa', 'revisions')));
  });
  it('otro profesor no puede leer revisiones ajenas', async () =>
    assertFails(getDoc(ref(session('newprof')))));
  it('estudiante y visitante no pueden crear revisiones de profesores', async () => {
    await assertFails(setDoc(ref(session('student'), 'professor', 'mapa', 'rev-student'), valid('save', 'student')));
    await assertFails(setDoc(ref(session('unassigned'), 'professor', 'mapa', 'rev-outsider'), valid('save', 'unassigned')));
  });
  it('las revisiones ya creadas no admiten modificaciones, ni siquiera del autor', async () => {
    await assertFails(updateDoc(ref(session('professor')), { title: 'Alteración del pasado' }));
    await assertFails(deleteDoc(ref(session('professor'))));
  });
  it('no permite insertar roles u otros campos administrativos', async () =>
    assertFails(setDoc(ref(session('professor'), 'professor', 'mapa', 'rev-privilegios'), {
      ...valid(), role: 'admin',
    })));
  it('el identificador baseline solo acepta el tipo baseline', async () => {
    await assertFails(setDoc(ref(session('professor'), 'professor', 'mapa', 'baseline'), valid('save')));
    await assertSucceeds(setDoc(ref(session('professor'), 'professor', 'mapa', 'baseline'), valid('baseline')));
    await assertFails(updateDoc(ref(session('professor'), 'professor', 'mapa', 'baseline'), { title: 'Otro comienzo' }));
  });
  it('no crea historial para un esquema inexistente', async () =>
    assertFails(setDoc(ref(session('professor'), 'professor', 'no-existe', 'fantasma'), valid())));
  it('una transacción crea versión inicial y revisión nueva junto con el guardado', async () => {
    const db = session('professor');
    await assertSucceeds(setDoc(draft(db, 'professor', 'tx-map'), diagram()));
    await assertSucceeds(runTransaction(db, async transaction => {
      const current = draft(db, 'professor', 'tx-map');
      const initial = ref(db, 'professor', 'tx-map', 'baseline');
      const revision = ref(db, 'professor', 'tx-map', 'rev-tx');
      const parent = await transaction.get(current);
      const older = await transaction.get(initial);
      if (!parent.exists() || older.exists()) throw new Error('Estado inicial inesperado');
      transaction.set(initial, valid('baseline'));
      transaction.set(revision, valid());
      transaction.update(current, { title: 'Mapa versionado', updatedAt: serverTimestamp() });
    }));
    const current = await assertSucceeds(getDoc(draft(db, 'professor', 'tx-map')));
    const previous = await assertSucceeds(getDoc(ref(db, 'professor', 'tx-map', 'baseline')));
    if (current.data()?.title !== 'Mapa versionado' || !previous.exists()) throw new Error('Historial y borrador no quedaron consistentes');
  });
  it('la eliminación de un esquema permite purgar después sus revisiones huérfanas', async () => {
    const db = session('professor');
    await assertSucceeds(setDoc(draft(db, 'professor', 'descarte'), diagram()));
    await assertSucceeds(setDoc(ref(db, 'professor', 'descarte', 'rev-descarte'), valid()));
    await assertFails(deleteDoc(ref(db, 'professor', 'descarte', 'rev-descarte')));
    await assertSucceeds(deleteDoc(draft(db, 'professor', 'descarte')));
    await assertSucceeds(deleteDoc(ref(db, 'professor', 'descarte', 'rev-descarte')));
  });
});

/** Fase 3f: asegurar que la guía estudiantil solo pueda leer la copia publicada. */
describe('Visor de estudio — aislamiento de la edición compartida', () => {
  it('un estudiante autorizado puede consultar la edición, pero no el borrador ni una revisión privada', async () => {
    const db = session('student');
    await assertSucceeds(getDoc(publication(db, 'grupo1', 'mapa')));
    await assertFails(getDoc(draft(db, 'professor', 'mapa')));
    await assertFails(getDoc(doc(db, 'users', 'professor', 'diagrams', 'mapa', 'revisions', 'rev-a')));
  });
  it('no permite enumerar las revisiones privadas desde una sesión de estudiante', async () => {
    await assertFails(getDocs(collection(session('student'), 'users', 'professor', 'diagrams', 'mapa', 'revisions')));
  });
  it('un estudiante de otro programa no puede consultar esta edición', async () => {
    await assertFails(getDoc(publication(session('visitor'), 'grupo1', 'mapa')));
  });
});


/** Fase 3g — cronología personal: registros declarativos y privados. */
describe('Trayectoria de investigación — acceso y integridad de hitos', () => {
  const milestone = (db: import('firebase/firestore').Firestore, uid = 'professor', id = 'ejemplo') =>
    doc(db, 'researcherProfiles', uid, 'milestones', id);
  const valid = (uid = 'professor') => ({
    ownerUid: uid, category: 'estudio', title: 'Seminario de filosofía',
    institution: 'Centro universitario', startDate: '2024-08-01', endDate: '',
    description: 'Lectura e investigación', url: '',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  it('el profesor puede crear, consultar y listar sus acontecimientos', async () => {
    await assertSucceeds(setDoc(milestone(session('professor')), valid()));
    await assertSucceeds(getDoc(milestone(session('professor'))));
    await assertSucceeds(getDocs(collection(session('professor'), 'researcherProfiles', 'professor', 'milestones')));
  });
  it('el titular puede editar conservando fecha de creación y eliminar un hito', async () => {
    const ref = milestone(session('professor'), 'professor', 'editable');
    await assertSucceeds(setDoc(ref, valid()));
    await assertSucceeds(updateDoc(ref, { title: 'Seminario actualizado', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });
  it('el estudiante no puede leer ni listar la trayectoria ajena', async () => {
    await assertFails(getDoc(milestone(session('student'))));
    await assertFails(getDocs(collection(session('student'), 'researcherProfiles', 'professor', 'milestones')));
  });
  it('un estudiante no puede crear, modificar ni borrar acontecimientos', async () => {
    await assertFails(setDoc(milestone(session('student'), 'professor', 'ilegitimo'), valid('student')));
    await assertFails(updateDoc(milestone(session('student')), { title: 'Modificado' }));
    await assertFails(deleteDoc(milestone(session('student'))));
  });
  it('un profesor no puede leer ni alterar hitos de otro profesor', async () => {
    await assertFails(getDoc(milestone(session('newprof'))));
    await assertFails(setDoc(milestone(session('newprof'), 'professor', 'falso'), valid('newprof')));
  });
  it('la administración puede consultar una trayectoria sin modificarla', async () => {
    await assertSucceeds(getDoc(milestone(session('root'))));
    await assertFails(updateDoc(milestone(session('root')), { title: 'Cambio administrativo' }));
  });
  it('rechaza suplantación de autor, roles y fecha de creación alterada', async () => {
    const db = session('professor');
    await assertFails(setDoc(milestone(db, 'professor', 'suplantado'), valid('root')));
    await assertFails(setDoc(milestone(db, 'professor', 'roles'), { ...valid(), role: 'admin' }));
    await assertFails(updateDoc(milestone(db), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  it('rechaza categorías, fechas y períodos inválidos', async () => {
    const db = session('professor');
    await assertFails(setDoc(milestone(db, 'professor', 'categoria'), { ...valid(), category: 'administrador' }));
    await assertFails(setDoc(milestone(db, 'professor', 'fecha'), { ...valid(), startDate: '24/08/2024' }));
    await assertFails(setDoc(milestone(db, 'professor', 'periodo'), { ...valid(), endDate: '2023-01-01' }));
  });
  it('no crea hitos para un perfil inexistente o con un enlace no permitido', async () => {
    await assertFails(setDoc(milestone(session('ghostprof'), 'ghostprof', 'fantasma'), valid('ghostprof')));
    await assertFails(setDoc(milestone(session('professor'), 'professor', 'http'), { ...valid(), url: 'http://unsafe.test' }));
  });
  it('no permite consultar hitos con correo ajeno o cuenta bloqueada', async () => {
    await assertFails(getDoc(milestone(session('professor', 'professor@gmail.com'))));
    await assertFails(getDoc(milestone(session('blocked'))));
  });
});


/** Envío para revisión: datos compartidos expresamente, nunca publicación automática. */
describe('Laboratorio estudiantil y solicitudes privadas por programa', () => {
  const requestRef = (db: import('firebase/firestore').Firestore, group='grupo1', id='solicitud-test') => doc(db, 'groupSubmissions', group, 'requests', id);
  const studentDiagram = (db: import('firebase/firestore').Firestore, id='mapa-estudiante') => doc(db, 'users', 'student', 'diagrams', id);
  const studentRevision = (db: import('firebase/firestore').Firestore, id='mapa-estudiante') => doc(db, 'users', 'student', 'diagrams', id, 'revisions', 'rev-1');
  const requestData = (revisionTimestamp: unknown, changes: Record<string, unknown> = {}) => ({
    studentUid: 'student', sourceDiagramId: 'mapa-estudiante', sourceRevisionId: 'rev-1', sourceRevisionSavedAt: revisionTimestamp,
    title: 'Mapa de estudiante', description: 'Análisis académico', nodes: [
      { id: 'n1', type: 'concept', position: {x:0,y:0}, data: { title:'Tesis', description:'Estudio', category:'tesis' } }
    ], edges: [], status: 'pendiente', submittedAt: serverTimestamp(), ...changes,
  });
  it('el estudiante puede crear y revisar versiones de su propio sistema 2D', async () => {
    const studentDb = session('student');
    const diagramRef = studentDiagram(studentDb);
    const node = { id:'n1', type:'concept', position:{x:0,y:0}, data:{title:'Tesis',description:'Estudio',category:'tesis'} };
    await assertSucceeds(setDoc(diagramRef, { title:'Mapa de estudiante', description:'Análisis académico', nodes:[node], edges:[], createdAt:serverTimestamp(), updatedAt:serverTimestamp() }));
    await assertSucceeds(setDoc(studentRevision(studentDb), { title:'Mapa de estudiante', description:'Análisis académico', nodes:[node], edges:[], kind:'save', authorUid:'student', savedAt:serverTimestamp() }));
    await assertSucceeds(getDoc(studentRevision(studentDb)));
    await assertSucceeds(getDocs(collection(studentDb,'users','student','diagrams','mapa-estudiante','revisions')));
    await assertFails(getDoc(studentRevision(session('professor'))));
  });
  it('el estudiante puede solicitar revisión y el investigador puede leer solamente la copia enviada', async () => {
    const studentDb = session('student');
    const date = (await getDoc(studentRevision(studentDb))).data()?.savedAt;
    const ref = requestRef(studentDb);
    await assertSucceeds(setDoc(ref, requestData(date)));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDoc(requestRef(session('professor'))));
    await assertSucceeds(getDocs(collection(session('professor'),'groupSubmissions','grupo1','requests')));
    await assertSucceeds(getDocs(query(collection(studentDb,'groupSubmissions','grupo1','requests'), where('studentUid','==','student'))));
    await assertFails(getDoc(studentDiagram(session('professor'))));
  });
  it('el estudiante no puede ver solicitudes de otras personas ni listar sin su filtro', async () => {
    const outsider = session('visitor');
    await assertFails(getDoc(requestRef(outsider)));
    await assertFails(getDocs(collection(session('student'),'groupSubmissions','grupo1','requests')));
  });
  it('no se puede enviar a otro grupo o inventar versiones o autores', async () => {
    const studentDb = session('student');
    const date = (await getDoc(studentRevision(studentDb))).data()?.savedAt;
    await assertFails(setDoc(requestRef(studentDb,'grupo2','rechazo'), requestData(date)));
    await assertFails(setDoc(requestRef(studentDb,'grupo1','falso1'), requestData(date,{studentUid:'professor'})));
    await assertFails(setDoc(requestRef(studentDb,'grupo1','falso2'), requestData(date,{sourceRevisionId:'inventada'})));
    await assertFails(setDoc(requestRef(studentDb,'grupo1','falso3'), requestData(date,{title:'Título inventado'})));
    await assertFails(setDoc(requestRef(studentDb,'grupo1','falso4'), requestData(date,{nodes:[{id:'espia'}]})));
    await assertFails(setDoc(requestRef(studentDb,'grupo1','falso5'), requestData(date,{status:'revisado'})));
  });
  it('solo el investigador del grupo revisa; nunca publica automáticamente', async () => {
    const profDb = session('professor');
    await assertFails(updateDoc(requestRef(session('student')),{status:'revisado',reviewerUid:'student',reviewNote:'OK',reviewedAt:serverTimestamp()}));
    await assertFails(updateDoc(requestRef(session('newprof')),{status:'revisado',reviewerUid:'newprof',reviewNote:'OK',reviewedAt:serverTimestamp()}));
    await assertSucceeds(updateDoc(requestRef(profDb),{status:'devuelto',reviewerUid:'professor',reviewNote:'Incluya referencias',reviewedAt:serverTimestamp()}));
    await assertFails(updateDoc(requestRef(profDb),{status:'revisado',reviewerUid:'professor',reviewNote:'',reviewedAt:serverTimestamp()}));
    await assertFails(deleteDoc(requestRef(profDb)));
  });
});


// La regresión usa el MISMO método que invoca el editor, contra Firestore emulado.
describe('Eliminación atómica de borrador y publicaciones', () => {
  it('borra origen y dos copias en programas diferentes sin dejar huérfanas', async () => {
    const db = session('root');
    const id = 'eliminar-sin-huerfanas';
    await assertSucceeds(setDoc(draft(db, 'root', id), diagram()));
    await env.withSecurityRulesDisabled(async ctx => {
      for (const groupId of ['grupo1', 'grupo2']) {
        await setDoc(doc(ctx.firestore(), 'groupPublications', groupId, 'diagrams', id), {
          ownerUid: 'root', sourceDiagramId: id, title: 'Dos ediciones', nodes: [], edges: [], description: '',
        });
      }
    });
    const expected = ['grupo1', 'grupo2'].map(groupId => ({groupId, id, ownerUid: 'root', sourceDiagramId: id, title: 'Dos ediciones'}));
    await assertSucceeds(deleteDraftAndPublishedCopies(db, 'root', id, ['grupo1', 'grupo2'], expected));
    const remaining = await Promise.all([getDoc(draft(db, 'root', id)), getDoc(publication(db, 'grupo1', id)), getDoc(publication(db, 'grupo2', id))]);
    expect(remaining.every(item => !item.exists())).toBe(true);
  });
  it('inspecciona y retira ediciones de grupos inactivos desde una cuenta administradora', async () => {
    const db = session('root');
    const id = 'eliminar-del-grupo-inactivo';
    await assertSucceeds(setDoc(draft(db, 'root', id), diagram()));
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'groupPublications', 'suspendido', 'diagrams', id), {
        ownerUid: 'root', sourceDiagramId: id, title: 'Edición histórica', nodes: [], edges: [], description: '',
      });
    });
    await assertSucceeds(getDoc(publication(db, 'suspendido', id)));
    await assertFails(getDoc(publication(session('student'), 'suspendido', id)));
    await assertSucceeds(deleteDraftAndPublishedCopies(db,'root',id,['suspendido'],[
      {groupId: 'suspendido',id,ownerUid:'root',sourceDiagramId:id,title:'Edición histórica'},
    ]));
    expect((await getDoc(publication(db,'suspendido',id))).exists()).toBe(false);
  });
  it('si cambió la lista de ediciones, cancela TODO sin borrar el borrador', async () => {
    const db = session('root');
    const id = 'cancelacion-atoma';
    await assertSucceeds(setDoc(draft(db,'root',id),diagram()));
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(),'groupPublications','grupo1','diagrams',id), {
        ownerUid:'root',sourceDiagramId:id,title:'Copia protegida',nodes:[],edges:[],description:'',
      });
    });
    await expect(deleteDraftAndPublishedCopies(db,'root',id,['grupo1'],[])).rejects.toThrow(/cambiaron/);
    expect((await getDoc(draft(db,'root',id))).exists()).toBe(true);
    expect((await getDoc(publication(db,'grupo1',id))).exists()).toBe(true);
  });
});
// Fase 4A: una superficie pública explícita y separada de las publicaciones académicas internas.
describe('Grupos de invitados — acceso público mínimo y aislamiento', () => {
  const publicStamp = Timestamp.fromMillis(1761000000000);
  const guestCopy = () => ({
    title: 'Mapa público de invitados', description: 'Copia pública controlada',
    nodes: [], edges: [], publishedAt: publicStamp, updatedAt: publicStamp,
  });

  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'guestGroups', 'grupo1'), {
        groupId: 'grupo1', slug: 'seminario-invitados', title: 'Seminario abierto',
        description: 'Lecturas para invitados', guideEnabled: true, active: true, updatedAt: publicStamp,
      });
      await setDoc(doc(db, 'guestGroupSlugs', 'seminario-invitados'), {
        groupId: 'grupo1', slug: 'seminario-invitados', active: true, updatedAt: publicStamp,
      });
      await setDoc(doc(db, 'guestGroups', 'grupo1', 'publications', 'mapa'), guestCopy());
      await setDoc(doc(db, 'guestGroups', 'grupo2'), {
        groupId: 'grupo2', slug: 'grupo-privado', title: 'Grupo privado', description: '',
        guideEnabled: true, active: false, updatedAt: publicStamp,
      });
      await setDoc(doc(db, 'guestGroups', 'suspendido'), {
        groupId: 'suspendido', slug: 'grupo-suspendido', title: 'Grupo suspendido', description: '',
        guideEnabled: true, active: true, updatedAt: publicStamp,
      });
      await setDoc(doc(db, 'groupPublications', 'grupo1', 'diagrams', 'guest-mirror-source'), {
        ownerUid: 'professor', sourceDiagramId: 'guest-mirror-source', title: 'Fuente pública',
        description: 'Edición académica ya publicada', nodes: [], edges: [],
        publishedAt: publicStamp, updatedAt: publicStamp,
      });
    });
  });

  it('una persona sin cuenta resuelve el slug, lee el grupo y enumera solo su copia pública', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'guestGroupSlugs', 'seminario-invitados')));
    await assertSucceeds(getDoc(doc(publicDb, 'guestGroups', 'grupo1')));
    await assertSucceeds(getDocs(collection(publicDb, 'guestGroups', 'grupo1', 'publications')));
  });

  it('el invitado sigue sin poder leer la publicación académica interna, borradores o perfiles', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'groupPublications', 'grupo1', 'diagrams', 'mapa')));
    await assertFails(getDoc(doc(publicDb, 'users', 'professor', 'diagrams', 'mapa')));
    await assertFails(getDoc(doc(publicDb, 'researcherProfiles', 'professor')));
  });

  it('un grupo invitado desactivado o un programa suspendido deja de ser público', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb, 'guestGroups', 'grupo2')));
    await assertFails(getDoc(doc(publicDb, 'guestGroups', 'suspendido')));
  });

  it('una persona anónima no puede escribir configuración ni publicaciones invitadas', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(publicDb, 'guestGroups', 'grupo1', 'publications', 'intruso'), guestCopy()));
    await assertFails(setDoc(doc(publicDb, 'guestGroups', 'grupo2'), {
      groupId: 'grupo2', slug: 'intruso-publico', title: 'Intruso', description: '', guideEnabled: true,
      active: true, updatedAt: serverTimestamp(),
    }));
  });

  it('un profesor autorizado puede reflejar exactamente una publicación académica existente', async () => {
    const db = session('professor');
    await assertSucceeds(setDoc(doc(db, 'guestGroups', 'grupo1', 'publications', 'guest-mirror-source'), {
      title: 'Fuente pública', description: 'Edición académica ya publicada', nodes: [], edges: [],
      publishedAt: publicStamp, updatedAt: publicStamp,
    }));
  });

  it('un profesor no puede falsificar el contenido de la copia invitada', async () => {
    const db = session('professor');
    await assertFails(setDoc(doc(db, 'guestGroups', 'grupo1', 'publications', 'guest-mirror-source'), {
      title: 'Título alterado', description: 'Edición académica ya publicada', nodes: [], edges: [],
      publishedAt: publicStamp, updatedAt: publicStamp,
    }));
  });

  it('solo administración puede configurar el acceso invitado y sus slugs', async () => {
    const professor = session('professor');
    await assertFails(setDoc(doc(professor, 'guestGroups', 'grupo2'), {
      groupId: 'grupo2', slug: 'abierto-por-profesor', title: 'No permitido', description: '', guideEnabled: true,
      active: true, updatedAt: serverTimestamp(),
    }));

    const adminDb = session('root');
    await assertSucceeds(setDoc(doc(adminDb, 'guestGroups', 'grupo2'), {
      groupId: 'grupo2', slug: 'seminario-publico-dos', title: 'Seminario público II', description: '',
      guideEnabled: false, active: true, updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(adminDb, 'guestGroupSlugs', 'seminario-publico-dos'), {
      groupId: 'grupo2', slug: 'seminario-publico-dos', active: true, updatedAt: serverTimestamp(),
    }));
  });

  it('el público no puede enumerar todos los slugs o todos los grupos invitados', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(publicDb, 'guestGroupSlugs')));
    await assertFails(getDocs(collection(publicDb, 'guestGroups')));
  });
});

