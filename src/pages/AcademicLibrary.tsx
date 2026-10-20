import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assignedGroups, publicationsInGroups, retractPublication, type GroupInfo, type Publication } from '../lib/groups';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { explainError } from '../lib/errors';
import { DiagramThumbnail } from '../components/DiagramThumbnail';
import { revisionDate } from '../lib/diagramHistory';

export function AcademicLibrary() {
  const { user } = useAuth();
  const { role } = useAccess();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [items, setItems] = useState<Publication[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retiringKey, setRetiringKey] = useState('');
  useEffect(() => {
    if (!user) return;
    let running = true;
    assignedGroups(user.uid, role === 'admin').then(async (result) => {
      const pubs = await publicationsInGroups(result);
      if (running) { setGroups(result); setItems(pubs); }
    }).catch((reason) => { if (running) setError(explainError(reason)); }).finally(() => { if (running) setLoading(false); });
    return () => { running = false; };
  }, [user, role]);
  async function retire(item: Publication) {
    if (!user || item.ownerUid !== user.uid || retiringKey) return;
    const groupName = groups.find(g => g.id === item.groupId)?.name ?? item.groupId;
    if (!window.confirm(`¿Retirar «${item.title}» de «${groupName}»?\nNo se eliminará su borrador ni otras publicaciones con ese título.`)) return;
    setRetiringKey(`${item.groupId}/${item.id}`); setError('');
    try {
      await retractPublication(item.groupId, item.id);
      setItems(previous => previous.filter(p => !(p.groupId === item.groupId && p.id === item.id)));
    } catch (reason) { setError(explainError(reason)); }
    finally { setRetiringKey(''); }
  }
  const filtered = items.filter((i) => `${i.title} ${i.description}`.toLowerCase().includes(filter.toLowerCase()));
  return <>
    <div className="page-intro"><div><div className="eyebrow">BIBLIOTECA ACADÉMICA / SISTEMAS COMPARTIDOS</div><h1>{role === 'student' ? 'Explorar conocimiento' : 'Biblioteca de investigación'}<span className="period">.</span></h1><p>Únicamente se presentan los sistemas publicados para sus grupos académicos.</p></div></div>
    <div className="role-summary"><ShieldCheck size={20}/><div><b>{role === 'student' ? 'Vista de estudiante · Solo lectura' : 'Publicaciones por grupo'}</b><p>{groups.length} grupos autorizados. El visor no permite alterar nodos ni conexiones.</p></div></div>
    <div className="section-heading"><div><div className="eyebrow">CATÁLOGO CONTROLADO</div><h2>Sistemas 2D disponibles</h2></div><div className="input-icon search-field"><Search size={18}/><input aria-label="Buscar publicaciones" placeholder="Buscar esquemas publicados…" value={filter} onChange={(e) => setFilter(e.target.value)}/></div></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading ? <div className="empty-state">Comprobando sus permisos y grupos…</div> : <div className="diagram-grid">
      {filtered.map((item) => <article key={`${item.groupId}/${item.id}`} className="diagram-card">
        <Link className="diagram-card-link" to={`/publicacion/${item.groupId}/${item.id}`}><DiagramThumbnail nodes={item.nodes}/><div className="diagram-card-content"><div className="eyebrow">PUBLICACIÓN · {groups.find(g => g.id === item.groupId)?.name ?? 'GRUPO'}</div><h3>{item.title}</h3><p>{item.description}</p>{Boolean(item.sourceRevisionSavedAt) && <small className="publication-edition-label">Edición: {revisionDate(item.sourceRevisionSavedAt)}</small>}<div className="card-bottom">Consultar sistema <ArrowRight size={17}/></div></div></Link>
        {role !== 'student' && item.ownerUid === user?.uid && <div className="diagram-publish"><button type="button" className="button button-secondary" disabled={Boolean(retiringKey)} onClick={() => void retire(item)}>{retiringKey === `${item.groupId}/${item.id}` ? 'Retirando…' : 'Retirar de este programa'}</button></div>}
      </article>)}
    </div>}
    {!loading && filtered.length === 0 && <div className="empty-state"><BookOpenText size={28}/><p>Aún no hay sistemas publicados para sus grupos.</p></div>}
  </>;
}
