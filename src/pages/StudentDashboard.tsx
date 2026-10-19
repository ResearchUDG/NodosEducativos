import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, Plus, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { createDiagram, listDiagrams, listDiagramRevisions } from '../lib/diagrams';
import { revisionDate, type DiagramRevision } from '../lib/diagramHistory';
import { assignedGroups, type GroupInfo } from '../lib/groups';
import { myStudentSubmissions, submitForReview, type StudentSubmission } from '../lib/studentSubmissions';
import { explainError } from '../lib/errors';
import { DiagramThumbnail } from '../components/DiagramThumbnail';
import type { Diagram } from '../lib/types';

export function StudentDashboard() {
  const { user } = useAuth();
  const { role } = useAccess();
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [requests, setRequests] = useState<StudentSubmission[]>([]);
  const [revisions, setRevisions] = useState<Record<string, DiagramRevision[]>>({});
  const [selectedRevisions, setSelectedRevisions] = useState<Record<string,string>>({});
  const [selectedGroups, setSelectedGroups] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!user || role !== 'student') { setLoading(false); return; }
    let active = true;
    Promise.all([listDiagrams(user.uid), assignedGroups(user.uid)]).then(async ([own, programs]) => {
      const sent = await myStudentSubmissions(user.uid, programs.map(g => g.id));
      if (active) { setDiagrams(own); setGroups(programs); setRequests(sent); }
    }).catch(e => { if (active) setError(explainError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.uid, role]);
  async function create() {
    if (!user || busy) return;
    const name = window.prompt('Nombre del esquema (3 a 100 caracteres)', 'Mi investigación');
    if (name === null) return;
    if (name.trim().length < 3 || name.trim().length > 100) { setError('El título del esquema debe tener entre 3 y 100 caracteres.'); return; }
    setBusy(true); setError('');
    try { const id = await createDiagram(user.uid, name); navigate(`/esquema/${id}`); }
    catch(e) { setError(explainError(e)); } finally { setBusy(false); }
  }
  async function loadRevisions(id: string) {
    if (!user || busy) return;
    setBusy(true); setError('');
    try { const versions = await listDiagramRevisions(user.uid, id); setRevisions(old => ({ ...old, [id]: versions })); setSelectedRevisions(old => ({ ...old, [id]: '' })); }
    catch(e) { setError(explainError(e)); } finally { setBusy(false); }
  }
  async function submit(diagram: Diagram) {
    if (!user || busy) return;
    const groupId = selectedGroups[diagram.id] || groups[0]?.id;
    const revision = revisions[diagram.id]?.find(r => r.id === selectedRevisions[diagram.id]);
    if (!groupId || !revision) { setError('Seleccione un programa y una versión guardada.'); return; }
    if (!window.confirm(`Enviar «${revision.title}» a revisión del programa ${groups.find(g=>g.id===groupId)?.name||''}. No se publicará automáticamente. ¿Continuar?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await submitForReview(user.uid, groupId, diagram.id, revision);
      setRequests(await myStudentSubmissions(user.uid, groups.map(g=>g.id)));
      setNotice('Solicitud enviada. Un investigador del programa podrá revisar esta versión sin abrir su borrador privado.');
    } catch(e) { setError(explainError(e)); } finally { setBusy(false); }
  }
  return <div className="student-workspace">
    <div className="page-intro"><div><div className="eyebrow">ESTUDIO / LABORATORIO PERSONAL</div><h1>Mis sistemas 2D<span className="period">.</span></h1><p>Investigue con conceptos, fuentes, conexiones y versiones privadas. Envíe una edición guardada a revisión cuando esté lista.</p></div><button className="button button-primary" disabled={busy} onClick={() => void create()}><Plus size={17}/> Nuevo sistema</button></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    {loading ? <p>Cargando sus esquemas…</p> : <div className="student-diagram-grid">{diagrams.map(diagram => <article className="student-diagram-card" key={diagram.id}>
      <Link className="student-card-link" to={`/esquema/${diagram.id}`}><DiagramThumbnail nodes={diagram.nodes}/><div className="student-card-body"><small>BORRADOR PRIVADO · {diagram.nodes.length} CONCEPTOS</small><h2>{diagram.title}</h2><p>{diagram.description}</p><span>Editar sistema <ArrowRight size={15}/></span></div></Link>
      <div className="student-submit"><h3>Solicitar revisión de un investigador</h3><p>Elija una versión guardada. Su historial y los cambios posteriores seguirán siendo privados.</p>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void loadRevisions(diagram.id)}>{revisions[diagram.id] ? 'Actualizar versiones' : 'Consultar versiones guardadas'}</button>
        {revisions[diagram.id] && <label>Versión<select value={selectedRevisions[diagram.id] || ''} onChange={e=>setSelectedRevisions(s=>({...s,[diagram.id]:e.target.value}))}><option value="">Elija una versión</option>{revisions[diagram.id].map(r=><option key={r.id} value={r.id}>{r.title} · {revisionDate(r.savedAt)}</option>)}</select></label>}
        <label>Programa académico<select disabled={!groups.length} value={selectedGroups[diagram.id] || groups[0]?.id || ''} onChange={e=>setSelectedGroups(s=>({...s,[diagram.id]:e.target.value}))}>{groups.length ? groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>) : <option value="">Sin programas asignados</option>}</select></label>
        <button className="button button-primary" disabled={busy || !groups.length || !selectedRevisions[diagram.id]} onClick={()=>void submit(diagram)}><Send size={16}/> Enviar a revisión</button>
      </div>
    </article>)}<button className="student-new-card" disabled={busy} onClick={()=>void create()}><Plus size={24}/>Crear otro esquema</button></div>}
    <section className="governance-panel student-sent"><h2><BookOpenText size={19}/> Solicitudes enviadas</h2><p>La revisión no implica publicación. El investigador puede dejarle observaciones.</p>
      {!requests.length ? <p>No tiene solicitudes todavía.</p> : <div className="student-review-list">{requests.map(r=><article key={r.id}><b>{r.title}</b><span>{groups.find(g=>g.id===r.groupId)?.name || r.groupId} · {r.status}</span>{r.reviewNote && <p>Observaciones: {r.reviewNote}</p>}</article>)}</div>}
    </section>
  </div>;
}
