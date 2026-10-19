import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, FolderPlus, GraduationCap, RefreshCw, ShieldCheck, UserPlus, Users, Pencil, PauseCircle, PlayCircle, X, Search } from 'lucide-react';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { explainError } from '../lib/errors';
import { formatDirectoryIdentity, identityOptionLabel } from '../lib/directoryIdentity';
import { listAllProgramsForAdmin, listAccessRequests, type GroupInfo } from '../lib/groups';
import { canAssignNewMember, normalizeProgramInput, visiblePrograms } from '../lib/programs';
import { readAcademicTags, type ResearcherProfileFields } from '../lib/researcherProfile';

type Request = { id: string; email: string; displayName: string; status: string };
type Principal = { id: string; role: string; active: boolean; email: string; displayName: string };
const roleLabel = (role: string) => role === 'admin' ? 'Administrador' : role === 'professor' ? 'Profesor investigador' : role === 'student' ? 'Estudiante' : role;

export function AdminDirectory() {
  const { user } = useAuth();
  const { role } = useAccess();
  const [requests, setRequests] = useState<Request[]>([]);
  const [people, setPeople] = useState<Principal[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [researchers, setResearchers] = useState<Record<string, ResearcherProfileFields>>({});
  const [selectedUser, setSelectedUser] = useState('');
  const [memberships, setMemberships] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [programFilter, setProgramFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [programSearch, setProgramSearch] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!db || !user || role !== 'admin') return;
    // La lista de solicitudes incluye las ya aprobadas: la aprobación no debe borrar
    // el nombre solicitado. El perfil propio permite identificar el admin bootstrap,
    // cuyo documento access/{uid} puede contener exclusivamente role y active.
    const [allRequests, access, assigned, ownProfile, researcherSnapshots] = await Promise.all([
      listAccessRequests(),
      getDocs(collection(db, 'access')),
      listAllProgramsForAdmin(),
      getDoc(doc(db, 'users', user.uid)).catch(() => null),
      getDocs(collection(db, 'researcherProfiles')),
    ]);
    const requestById = new Map(allRequests.map((request) => [request.id, request]));
    setRequests(allRequests.filter((request) => request.status === 'pending'));
    setPeople(access.docs.map((person) => {
      const data = person.data();
      const request = requestById.get(person.id);
      const isSelf = person.id === user.uid;
      return {
        id: person.id,
        role: String(data.role || ''),
        active: data.active === true,
        email: isSelf ? (user.email || '') : String(data.email || request?.email || ''),
        displayName: isSelf
          ? String(ownProfile?.data()?.displayName || user.displayName || request?.displayName || '')
          : String(request?.displayName || ''),
      };
    }));
    setGroups(assigned);
    setResearchers(Object.fromEntries(researcherSnapshots.docs.map(snapshot => {
      const data = snapshot.data();
      return [snapshot.id, {
        academicTitle: String(data.academicTitle || ''),
        institution: String(data.institution || ''),
        researchLines: String(data.researchLines || ''),
        biography: String(data.biography || ''),
        academicTags: readAcademicTags(data.academicTags),
      }];
    })));
  }, [user, role]);

  useEffect(() => { void refresh().catch((e) => setError(explainError(e))); }, [refresh]);
  useEffect(() => {
    if (!db || !selectedUser) { setMemberships([]); return; }
    let valid = true;
    getDocs(collection(db, 'memberships', selectedUser, 'groups')).then((snap) => {
      if (valid) setMemberships(snap.docs.filter((d) => d.data().active === true).map((d) => d.id));
    }).catch((e) => { if (valid) setError(explainError(e)); });
    return () => { valid = false; };
  }, [selectedUser]);

  async function task(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); setNotice(success); }
    catch (e) { setError(explainError(e)); }
    finally { setBusy(false); }
  }
  async function approve(item: Request, accessRole: 'student' | 'professor') {
    if (!db || !user) return;
    await task(async () => {
      await setDoc(doc(db!, 'access', item.id), {
        role: accessRole, active: true, email: item.email,
        grantedBy: user.uid, updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db!, 'accessRequests', item.id), {
        status: 'approved', reviewedBy: user.uid, reviewedAt: serverTimestamp(),
      });
    }, `Acceso concedido como ${accessRole === 'professor' ? 'profesor' : 'estudiante'}.`);
  }
  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (!db || !user) return;
    await task(async () => {
      const values = normalizeProgramInput(name, description);
      const reference = doc(collection(db!, 'groups'));
      await setDoc(reference, {
        ...values, active: true,
        createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setName(''); setDescription('');
    }, 'Carrera o programa creado. Ahora asigne sus integrantes.');
  }
  function startEdit(group: GroupInfo) {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditDescription(group.description || '');
    setError(''); setNotice('');
  }
  async function saveProgram(event: FormEvent) {
    event.preventDefault();
    if (!db || !editingGroupId) return;
    await task(async () => {
      const values = normalizeProgramInput(editName, editDescription);
      await updateDoc(doc(db!, 'groups', editingGroupId), { ...values, updatedAt: serverTimestamp() });
      setEditingGroupId(null);
    }, 'Programa actualizado sin cambiar sus asignaciones.');
  }
  async function toggleProgram(group: GroupInfo) {
    if (!db || busy) return;
    const nextActive = !group.active;
    if (!nextActive && !window.confirm(`¿Desactivar «${group.name}»? Dejará de estar disponible para sus estudiantes y profesores hasta que lo reactive.`)) return;
    await task(async () => {
      await updateDoc(doc(db!, 'groups', group.id), { active: nextActive, updatedAt: serverTimestamp() });
      if (editingGroupId === group.id) setEditingGroupId(null);
    }, nextActive ? 'Programa reactivado.' : 'Programa desactivado. Sus datos y membresías se conservan.');
  }
  async function assign(groupId: string, enabled: boolean) {
    if (!db || !user || !selectedUser) return;
    const group = groups.find((entry) => entry.id === groupId);
    if (enabled && (!group || !canAssignNewMember(group))) {
      setError('No se pueden agregar integrantes a un programa desactivado.');
      return;
    }
    await task(async () => {
      const path = doc(db!, 'memberships', selectedUser, 'groups', groupId);
      if (enabled) await setDoc(path, { groupId, active: true, assignedBy: user.uid, updatedAt: serverTimestamp() });
      else await deleteDoc(path);
      setMemberships((previous) => enabled ? [...new Set([...previous, groupId])] : previous.filter((g) => g !== groupId));
    }, 'Asignación académica actualizada.');
  }
  async function setActive(person: Principal, active: boolean) {
    if (!db || !user || person.role === 'admin') return;
    await task(async () => {
      await setDoc(doc(db!, 'access', person.id), {
        role: person.role, active, email: person.email,
        grantedBy: user.uid, updatedAt: serverTimestamp(),
      });
    }, active ? 'Cuenta reactivada.' : 'Cuenta suspendida.');
  }
  if (role !== 'admin') return <p role="alert">El directorio solo está disponible para administradores.</p>;
  return <div className="admin-directory">
    <div className="page-intro"><div><div className="eyebrow">GOBIERNO / DIRECTORIO ACADÉMICO</div><h1>Administración académica<span className="period">.</span></h1><p>Administre las identidades, los roles y el acceso a carreras y programas de investigación.</p></div><button className="button button-secondary" disabled={busy} onClick={() => void refresh().catch((e) => setError(explainError(e)))}><RefreshCw size={17}/> Actualizar</button></div>
    <div className="role-summary"><ShieldCheck size={22}/><div><b>Control de privilegios</b><p>Ni el correo ni la interfaz asignan permisos por sí solos. Las reglas de Firestore validan cada operación. Los administradores se habilitan únicamente desde Firebase Console.</p></div></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}{notice && <p className="alert" role="status">{notice}</p>}
    <div className="governance-grid">
      <section className="governance-panel"><h2><UserPlus size={21}/> Solicitudes pendientes <span>({requests.length})</span></h2>
        {requests.length === 0 ? <p>Por ahora no hay solicitudes pendientes.</p> : requests.map((request) => {
          const identity = formatDirectoryIdentity(request);
          return <div className="directory-person" key={request.id}><div className="person-details"><b>{identity.primary}</b>{identity.secondary && <small>{identity.secondary}</small>}</div><div className="directory-actions"><button disabled={busy} className="button button-secondary" onClick={() => void approve(request, 'student')}><GraduationCap size={15}/> Estudiante</button><button disabled={busy} className="button button-primary" onClick={() => void approve(request, 'professor')}><Check size={15}/> Profesor</button></div></div>;
        })}
      </section>
      <section className="governance-panel"><h2><FolderPlus size={21}/> Crear carrera o programa académico</h2>
        <p>Organice el acceso por carrera o programa, no por materia. Cada profesor publica nodos únicamente para las personas asignadas al programa correspondiente.</p>
        <form className="governance-form" onSubmit={(e) => void createGroup(e)}><label>Nombre de la carrera o programa<input required minLength={3} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Filosofía, Sociología, Antropología, Matemáticas" /></label><label>Descripción (opcional)<textarea maxLength={400} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Áreas de investigación, enfoque del programa…"/></label><button className="button button-primary" disabled={busy}><FolderPlus size={17}/> Crear programa</button></form>
      </section>
      <section className="governance-panel governance-wide">
        <div className="program-catalog-heading"><div><h2><GraduationCap size={21}/> Catálogo de programas académicos</h2><p>Edite programas sin cambiar los UID ni las membresías. Al desactivar un programa, sus publicaciones dejan de ser accesibles hasta que se reactive.</p></div><div className="program-summary" aria-label="Estado de programas"><span>{groups.filter(g => g.active).length} activos</span><span>{groups.filter(g => !g.active).length} desactivados</span></div></div>
        <div className="program-controls">
          <label className="program-search"><Search size={17}/><span className="sr-only">Buscar programa</span><input value={programSearch} onChange={event => setProgramSearch(event.target.value)} placeholder="Buscar carrera o programa..." /></label>
          <label className="program-filter">Mostrar <select value={programFilter} onChange={event => setProgramFilter(event.target.value as 'all' | 'active' | 'inactive')}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Desactivados</option></select></label>
        </div>
        {groups.length === 0 ? <p>No hay programas. Cree el primero en el formulario superior.</p> : visiblePrograms(groups, programSearch, programFilter).length === 0 ? <p>No se encontraron programas con esos filtros.</p> :
          <div className="program-list">{visiblePrograms(groups, programSearch, programFilter).map(group => <div className="program-row" key={group.id}>
            {editingGroupId === group.id ? <form onSubmit={event => void saveProgram(event)} className="program-edit-form">
              <label>Nombre<input required minLength={3} maxLength={100} value={editName} onChange={event => setEditName(event.target.value)} /></label>
              <label>Descripción<textarea maxLength={400} rows={2} value={editDescription} onChange={event => setEditDescription(event.target.value)} /></label>
              <div className="directory-actions"><button type="submit" className="button button-primary" disabled={busy}><Check size={15}/> Guardar</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => setEditingGroupId(null)}><X size={15}/> Cancelar</button></div>
            </form> : <><div className="person-details"><b>{group.name}</b><small>{group.description || 'Sin descripción'}</small><span className={group.active ? 'program-status program-status-active' : 'program-status program-status-inactive'}>{group.active ? 'Activo' : 'Desactivado'}</span></div><div className="directory-actions"><button type="button" className="button button-secondary" disabled={busy || editingGroupId !== null} onClick={() => startEdit(group)}><Pencil size={15}/> Editar</button><button type="button" className={group.active ? 'button button-danger' : 'button button-secondary'} disabled={busy || editingGroupId !== null} onClick={() => void toggleProgram(group)}>{group.active ? <PauseCircle size={15}/> : <PlayCircle size={15}/>} {group.active ? 'Desactivar' : 'Reactivar'}</button></div></>}
          </div>)}</div>}
      </section>
      <section className="governance-panel governance-wide">
        <div className="program-catalog-heading"><div><h2><Users size={21}/> Profesores investigadores</h2>
          <p>Directorio interno de profesores activos y suspendidos. Las fichas son privadas: solo su titular puede editarlas y la administración puede consultarlas.</p></div>
          <div className="program-summary"><span>{people.filter(person => person.role === 'professor' && person.active).length} investigadores activos</span></div>
        </div>
        {people.filter(person => person.role === 'professor').length === 0 ? <p>Aún no hay profesores investigadores autorizados. Primero apruebe su solicitud institucional.</p> :
        <div className="researcher-roster">{people.filter(person => person.role === 'professor').map(person => {
          const identity = formatDirectoryIdentity(person);
          const profile = researchers[person.id];
          return <article className="researcher-roster-card" key={person.id}>
            <div className="person-details"><b>{identity.primary}</b>{identity.secondary && <small>{identity.secondary}</small>}
              <span className={person.active ? 'program-status program-status-active' : 'program-status program-status-inactive'}>{person.active ? 'Acceso activo' : 'Acceso suspendido'}</span>
              <small>{profile?.academicTitle || 'Grado académico no registrado'}{profile?.institution ? ` · ${profile.institution}` : ''}</small>
              {profile && <div className="researcher-roster-tags" aria-label="Formación académica declarada">
                {([
                  ['careers', 'Carreras'], ['degrees', 'Títulos'],
                  ['postgraduate', 'Posgrados'], ['certifications', 'Certificaciones'],
                ] as const).map(([category, label]) => profile.academicTags[category].length > 0 && <div key={category}>
                  <small>{label}</small><div className="academic-tag-list">
                    {profile.academicTags[category].map(tag => <span className="academic-tag-chip" key={tag}>{tag}</span>)}
                  </div>
                </div>)}
              </div>}
              {profile?.researchLines && <p className="researcher-roster-lines"><strong>Líneas:</strong> {profile.researchLines}</p>}
              {profile?.biography && <p className="researcher-roster-lines">{profile.biography}</p>}
              {!profile && <small>Ficha académica pendiente por completar por el profesor.</small>}
            </div>
            <button type="button" className="button button-secondary" disabled={busy || !person.active} onClick={() => setSelectedUser(person.id)}>Gestionar programas</button>
          </article>;
        })}</div>}
      </section>
      <section className="governance-panel governance-wide"><h2><Users size={21}/> Integrantes y acceso por programa</h2>
        <p>Seleccione una cuenta y marque las carreras o programas que puede consultar. Quitar una asignación revoca su acceso a las publicaciones del programa.</p>
        <div className="governance-form"><label>Cuenta autorizada<select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}><option value="">Seleccione una cuenta…</option>{people.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{identityOptionLabel(person, roleLabel(person.role))}</option>)}</select></label></div>
        {selectedUser && <div className="membership-grid">{groups.length === 0 && <p>Todavía no hay carreras o programas registrados.</p>}{groups.map((group) => <label className={`membership-choice ${!group.active ? 'membership-choice--inactive' : ''}`} key={group.id}><input type="checkbox" checked={memberships.includes(group.id)} disabled={busy || (!group.active && !memberships.includes(group.id))} onChange={(e) => void assign(group.id, e.target.checked)}/><span><b>{group.name}</b><small>{group.description}{!group.active ? ' · Programa desactivado (solo puede revocar asignación)' : ''}</small></span></label>)}</div>}
        <h3>Cuentas registradas ({people.length})</h3>{people.map((person) => {
          const identity = formatDirectoryIdentity(person);
          return <div className="directory-person" key={person.id}><div className="person-details"><b>{identity.primary}</b>{identity.secondary && <small>{identity.secondary}</small>}<small>Rol: {roleLabel(person.role)} · {person.active ? 'Activa' : 'Suspendida'}</small></div>{person.role !== 'admin' && <button className="button button-secondary" disabled={busy} onClick={() => void setActive(person, !person.active)}>{person.active ? 'Suspender' : 'Reactivar'}</button>}</div>;
        })}
      </section>
    </div>
  </div>;
}
