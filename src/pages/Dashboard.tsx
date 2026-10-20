import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, FolderKanban, Lightbulb, Network, Plus, Search, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { createDiagram, listDiagrams, listDiagramRevisions } from '../lib/diagrams';
import { revisionDate, type DiagramRevision } from '../lib/diagramHistory';
import { assignedGroups, publishToGroup, publicationsInGroups, retractPublication, type GroupInfo, type Publication } from '../lib/groups';
import { explainError } from '../lib/errors';
import type { Diagram } from '../lib/types';
import { DiagramThumbnail } from '../components/DiagramThumbnail';
import { GroupReviewInbox } from '../components/GroupReviewInbox';

export function Dashboard() {
  const { user } = useAuth();
  const { role } = useAccess();
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({});
  const [selectedNodes, setSelectedNodes] = useState<Record<string, string[]>>({});
  const [availableRevisions, setAvailableRevisions] = useState<Record<string, DiagramRevision[]>>({});
  const [selectedRevisions, setSelectedRevisions] = useState<Record<string, string>>({});
  const [loadingRevisions, setLoadingRevisions] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([listDiagrams(user.uid), assignedGroups(user.uid, role === 'admin')]).then(async ([value, memberships]) => {
      const publications = await publicationsInGroups(memberships);
      if (active) { setDiagrams(value); setGroups(memberships); setPublications(publications.filter(p => p.ownerUid === user.uid)); }
    }).catch((reason) => { if (active) setError(explainError(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, role]);
  async function addDiagram() {
    if (!user) return;
    const title = window.prompt('Nombre del esquema (3–100 caracteres)', 'Nuevo sistema de investigación');
    if (title === null) return;
    if (title.trim().length < 3 || title.trim().length > 100) { setError('El título debe tener entre 3 y 100 caracteres.'); return; }
    setBusy(true); setError('');
    try { const id = await createDiagram(user.uid, title); navigate(`/esquema/${id}`); }
    catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }
  async function loadVersions(diagramId: string) {
    if (!user) return;
    setLoadingRevisions(state => ({ ...state, [diagramId]: true }));
    setError('');
    try {
      const versions = await listDiagramRevisions(user.uid, diagramId);
      setAvailableRevisions(state => ({ ...state, [diagramId]: versions }));
      setSelectedRevisions(state => ({ ...state, [diagramId]: '' }));
      setSelectedNodes(state => ({ ...state, [diagramId]: [] }));
    } catch (reason) { setError(explainError(reason)); }
    finally { setLoadingRevisions(state => ({ ...state, [diagramId]: false })); }
  }
  async function publish(diagram: Diagram) {
    const groupId = selectedGroups[diagram.id] || groups[0]?.id;
    if (!user || !groupId) { setError('Seleccione un programa de destino.'); return; }
    const revision = availableRevisions[diagram.id]?.find(item => item.id === selectedRevisions[diagram.id]);
    if (!revision) { setError('Primero elija una versión guardada.'); return; }
    const visible = selectedNodes[diagram.id] ?? [];
    if (!visible.length) { setError('Seleccione los conceptos que desea compartir.'); return; }
    const groupName = groups.find(group => group.id === groupId)?.name ?? 'el programa';
    if (!window.confirm(`Compartirá ${visible.length} de ${revision.nodes.length} conceptos de la versión guardada el ${revisionDate(revision.savedAt)} con «${groupName}». No se compartirá el historial privado. ¿Continuar?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await publishToGroup(user.uid, diagram.id, revision, groupId, visible);
      const all = await publicationsInGroups(groups);
      setPublications(all.filter(p => p.ownerUid === user.uid));
      setMessage(`Se compartió la versión elegida de «${revision.title}» con «${groupName}». Sus próximos cambios seguirán siendo privados hasta que vuelva a publicar.`);
    } catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }
  async function retract(item: Publication) {
    if (!user || item.ownerUid !== user.uid || !window.confirm('Retirar esta publicación del grupo. El borrador privado no se eliminará. ¿Continuar?')) return;
    setBusy(true); setError(''); setMessage('');
    try { await retractPublication(item.groupId, item.id); setPublications((prev) => prev.filter((p) => !(p.id === item.id && p.groupId === item.groupId))); setMessage('Publicación retirada del grupo.'); }
    catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }
  const items = diagrams.filter((diagram) => `${diagram.title} ${diagram.description}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="page-intro"><div><div className="eyebrow">LABORATORIO INVESTIGADOR / CENTRO DE CONOCIMIENTO</div><h1>{role === 'admin' ? 'Centro de investigación y gobierno' : 'Su espacio de investigación'}<span className="period">.</span></h1><p>Construya sistemas complejos. Decida expresamente qué versión publicada visualizará cada grupo.</p></div><div className="header-actions"><button disabled={busy} className="button button-primary" onClick={addDiagram}><Plus size={18}/> Nuevo esquema</button></div></div>
    <div className="dashboard-feature"><div className="feature-copy"><div className="eyebrow eyebrow-light">INVESTIGACIÓN EN RED</div><h2>Piense en conexiones.<br/><em>Construya conocimiento.</em></h2><p>El laboratorio es privado. Solo las publicaciones explícitas se muestran a los grupos autorizados.</p><button onClick={addDiagram} disabled={busy} className="feature-link">Comenzar un sistema <ArrowRight size={17}/></button></div><div className="feature-art" aria-hidden="true"><div className="orb orb-a"/><div className="orb orb-b"/><div className="orb orb-c"/><div className="orb orb-d"/><svg viewBox="0 0 380 250"><path d="M90 130L176 48L292 105L230 216L90 130L145 220L230 216L176 48" stroke="currentColor" fill="none" strokeWidth="1.3" strokeDasharray="5 6" /></svg></div></div>
    <div className="metrics"><div className="metric"><span className="metric-icon"><FolderKanban size={20}/></span><div><strong>{diagrams.length.toString().padStart(2, '0')}</strong><small>Borradores propios</small></div></div><div className="metric"><span className="metric-icon"><Network size={20}/></span><div><strong>{diagrams.reduce((n, d) => n + d.nodes.length, 0).toString().padStart(2, '0')}</strong><small>Nodos en laboratorio</small></div></div><div className="metric"><span className="metric-icon"><ShieldCheck size={20}/></span><div><strong>{groups.length}</strong><small>Grupos de publicación</small></div></div></div>
    <div className="section-heading"><div><div className="eyebrow">BIBLIOTECA DE AUTORÍA</div><h2>Mis sistemas 2D</h2><p>Edite sus borradores y publique instantáneas en grupos autorizados.</p></div><div className="input-icon search-field"><Search size={18}/><input aria-label="Buscar esquemas" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar esquema..."/></div></div>
    {error && <div role="alert" className="alert alert-error">{error}</div>}{message && <div role="status" className="alert">{message}</div>}
    {loading ? <div className="empty-state">Cargando sus sistemas y permisos…</div> : <div className="diagram-grid">
      {items.map((diagram) => <div className="diagram-card" key={diagram.id}>
        <Link to={`/esquema/${diagram.id}`} className="diagram-card-link"><DiagramThumbnail nodes={diagram.nodes}/><div className="diagram-card-content"><div className="eyebrow">BORRADOR PRIVADO · {diagram.nodes.length} NODOS</div><h3>{diagram.title}</h3><p>{diagram.description}</p><div className="card-bottom">Editar sistema 2D <ArrowRight size={17}/></div></div></Link>
        <div className="diagram-publish">
          <label>1. Elegir la versión que desea compartir</label>
          <button type="button" className="button button-secondary" disabled={busy || loadingRevisions[diagram.id]} onClick={() => void loadVersions(diagram.id)}>
            {loadingRevisions[diagram.id] ? 'Buscando versiones…' : availableRevisions[diagram.id] ? 'Actualizar versiones guardadas' : 'Consultar versiones guardadas'}
          </button>
          {availableRevisions[diagram.id] && <>
            {availableRevisions[diagram.id].length ? <select aria-label={`Versión para publicar de ${diagram.title}`}
              value={selectedRevisions[diagram.id] || ''} onChange={(event) => {
                setSelectedRevisions(state => ({ ...state, [diagram.id]: event.target.value }));
                setSelectedNodes(state => ({ ...state, [diagram.id]: [] }));
              }}>
              <option value="">Seleccione una versión guardada…</option>
              {availableRevisions[diagram.id].map(revision => <option key={revision.id} value={revision.id}>
                {revision.kind === 'baseline' ? 'Estado inicial' : 'Versión'} · {revision.title} · {revisionDate(revision.savedAt)}
              </option>)}
            </select> : <p className="publication-version-help">Este esquema aún no tiene versiones guardadas. Ábralo y guárdelo para crear la primera.</p>}
          </>}
          {(() => {
            const revision = availableRevisions[diagram.id]?.find(item => item.id === selectedRevisions[diagram.id]);
            return <>
              <div className="publication-version-step"><strong>2. Seleccionar los conceptos visibles</strong>
                <p>Solo se compartirán los conceptos elegidos y las referencias que les pertenecen.</p></div>
              <details className="node-disclosure"><summary>Elegir conceptos visibles ({(selectedNodes[diagram.id] ?? []).length}/{revision?.nodes.length ?? 0})</summary>
                {!revision ? <p className="publication-version-help">Primero seleccione una versión.</p> : <>
                  <div className="node-disclosure-actions"><button type="button" className="link-button" onClick={() => setSelectedNodes(state => ({ ...state, [diagram.id]: revision.nodes.map(n => n.id) }))}>Seleccionar todos</button><button type="button" className="link-button" onClick={() => setSelectedNodes(state => ({ ...state, [diagram.id]: [] }))}>Quitar selección</button></div>
                  <div className="node-disclosure-list">{revision.nodes.map(node => <label key={node.id}><input type="checkbox" checked={(selectedNodes[diagram.id] ?? []).includes(node.id)} onChange={(e) => setSelectedNodes(state => ({ ...state, [diagram.id]: e.target.checked ? [...(state[diagram.id] ?? []), node.id] : (state[diagram.id] ?? []).filter(id => id !== node.id) }))}/><span>{node.data.title}</span></label>)}</div>
                </>}
              </details>
              <label htmlFor={`group-${diagram.id}`}>3. Programa destinatario</label>
              <select id={`group-${diagram.id}`} value={selectedGroups[diagram.id] || groups[0]?.id || ''} onChange={(e) => setSelectedGroups(state => ({ ...state, [diagram.id]: e.target.value }))} disabled={!groups.length}>
                {groups.length ? groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>) : <option value="">Sin programas autorizados</option>}
              </select>
              <button className="button button-secondary" disabled={busy || !groups.length || !revision || !(selectedNodes[diagram.id] ?? []).length} onClick={() => void publish(diagram)}>Compartir versión seleccionada</button>
            </>;
          })()}
        </div>
      </div>)}
      <button className="diagram-card new-diagram" onClick={addDiagram} disabled={busy}><div className="new-icon"><Plus size={27}/></div><h3>Crear nuevo esquema</h3><p>Inicie un sistema con conceptos conectados, argumentos y fuentes.</p><span>CREAR ESQUEMA <ArrowRight size={16}/></span></button>
    </div>}
    {!loading && search && items.length === 0 && <p>No hay esquemas que coincidan con esa búsqueda.</p>}
    <div className="governance-panel publication-management"><h2>Mis publicaciones vigentes</h2><p>Cada programa tiene su propia copia. Retire desde aquí las ediciones que ya no desea compartir, incluso cuando su borrador haya sido eliminado. Dos títulos iguales en programas distintos no necesariamente son duplicados.</p>
      {publications.length === 0 ? <p>No hay sistemas publicados por esta cuenta.</p> : publications.map((p) => <div className="directory-person" key={`${p.groupId}/${p.id}`}><div className="person-details"><b>{p.title}</b><small>Programa: {groups.find((g) => g.id === p.groupId)?.name || p.groupId}</small>{Boolean(p.sourceRevisionSavedAt) && <small>Edición compartida: {revisionDate(p.sourceRevisionSavedAt)}</small>}{!diagrams.some(d => d.id === p.sourceDiagramId) && <small className="publication-orphan-label">Sin borrador original · puede retirar esta publicación</small>}</div><button disabled={busy} className="button button-secondary" onClick={() => void retract(p)}>Retirar publicación</button></div>)}
    </div>
    <GroupReviewInbox/>
    <div className="getting-started"><div className="getting-icon"><Lightbulb size={23}/></div><div><h3>Un mapa para pensar, no solo para visualizar.</h3><p>La guía de lectura resalta nodos sin modificar sus posiciones. Las publicaciones se controlan por grupo.</p></div><Link to="/biblioteca" className="text-link"><BookOpenText size={16}/> Ver biblioteca publicada</Link></div>
  </>;
}
