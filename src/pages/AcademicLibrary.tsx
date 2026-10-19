import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assignedGroups, publicationsInGroups, type GroupInfo, type Publication } from '../lib/groups';
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
  useEffect(() => {
    if (!user) return;
    let running = true;
    assignedGroups(user.uid, role === 'admin').then(async (result) => {
      const pubs = await publicationsInGroups(result);
      if (running) { setGroups(result); setItems(pubs); }
    }).catch((reason) => { if (running) setError(explainError(reason)); }).finally(() => { if (running) setLoading(false); });
    return () => { running = false; };
  }, [user, role]);
  const filtered = items.filter((i) => `${i.title} ${i.description}`.toLowerCase().includes(filter.toLowerCase()));
  return <>
    <div className="page-intro"><div><div className="eyebrow">BIBLIOTECA ACADÉMICA / SISTEMAS COMPARTIDOS</div><h1>{role === 'student' ? 'Explorar conocimiento' : 'Biblioteca de investigación'}<span className="period">.</span></h1><p>Únicamente se presentan los sistemas publicados para sus grupos académicos.</p></div></div>
    <div className="role-summary"><ShieldCheck size={20}/><div><b>{role === 'student' ? 'Vista de estudiante · Solo lectura' : 'Publicaciones por grupo'}</b><p>{groups.length} grupos autorizados. El visor no permite alterar nodos ni conexiones.</p></div></div>
    <div className="section-heading"><div><div className="eyebrow">CATÁLOGO CONTROLADO</div><h2>Sistemas 2D disponibles</h2></div><div className="input-icon search-field"><Search size={18}/><input aria-label="Buscar publicaciones" placeholder="Buscar esquemas publicados…" value={filter} onChange={(e) => setFilter(e.target.value)}/></div></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading ? <div className="empty-state">Comprobando sus permisos y grupos…</div> : <div className="diagram-grid">
      {filtered.map((item) => <Link key={`${item.groupId}/${item.id}`} className="diagram-card" to={`/publicacion/${item.groupId}/${item.id}`}><DiagramThumbnail nodes={item.nodes}/><div className="diagram-card-content"><div className="eyebrow">PUBLICACIÓN · {groups.find(g => g.id === item.groupId)?.name ?? 'GRUPO'}</div><h3>{item.title}</h3><p>{item.description}</p>{Boolean(item.sourceRevisionSavedAt) && <small className="publication-edition-label">Edición: {revisionDate(item.sourceRevisionSavedAt)}</small>}<div className="card-bottom">Consultar sistema <ArrowRight size={17}/></div></div></Link>)}
    </div>}
    {!loading && filtered.length === 0 && <div className="empty-state"><BookOpenText size={28}/><p>Aún no hay sistemas publicados para sus grupos.</p></div>}
  </>;
}
