import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, Clipboard, ExternalLink, Globe2, LockKeyhole, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assignedGroups, publicationsInGroups, retractPublication, type GroupInfo, type Publication } from '../lib/groups';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { explainError } from '../lib/errors';
import { DiagramThumbnail } from '../components/DiagramThumbnail';
import { revisionDate } from '../lib/diagramHistory';
import {
  guestGroupShareUrl, guestPublicationShareUrl, listGuestGroupSettingsForGroups,
  type GuestGroupSettings,
} from '../lib/guestGroups';

export function AcademicLibrary() {
  const { user } = useAuth();
  const { role } = useAccess();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [items, setItems] = useState<Publication[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [retiringKey, setRetiringKey] = useState('');
  const [copyingKey, setCopyingKey] = useState('');
  const [guestSettings, setGuestSettings] = useState<Record<string, GuestGroupSettings>>({});

  useEffect(() => {
    if (!user) return;
    let running = true;
    assignedGroups(user.uid, role === 'admin').then(async (result) => {
      const [pubs, guestList] = await Promise.all([
        publicationsInGroups(result),
        listGuestGroupSettingsForGroups(result.map(group => group.id)),
      ]);
      if (running) {
        setGroups(result);
        setItems(pubs);
        setGuestSettings(Object.fromEntries(guestList.map(setting => [setting.groupId, setting])));
      }
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

  async function copyPublicLink(label: string, url: string, key: string) {
    if (!url || copyingKey) return;
    setCopyingKey(key); setError(''); setNotice('');
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`Enlace público de «${label}» copiado.`);
    } catch {
      setError('No fue posible copiar el enlace público. Puede abrirlo y copiarlo desde la barra del navegador.');
    } finally { setCopyingKey(''); }
  }

  const filtered = items.filter((i) => `${i.title} ${i.description}`.toLowerCase().includes(filter.toLowerCase()));
  const publicGroups = groups.filter(group => guestSettings[group.id]?.active === true);

  return <>
    <div className="page-intro"><div><div className="eyebrow">BIBLIOTECA ACADÉMICA / SISTEMAS COMPARTIDOS</div><h1>{role === 'student' ? 'Explorar conocimiento' : 'Biblioteca de investigación'}<span className="period">.</span></h1><p>Únicamente se presentan los sistemas publicados para sus grupos académicos.</p></div></div>
    <div className="role-summary"><ShieldCheck size={20}/><div><b>{role === 'student' ? 'Vista de estudiante · Solo lectura' : 'Publicaciones por grupo'}</b><p>{groups.length} grupos autorizados. El visor no permite alterar nodos ni conexiones.</p></div></div>

    <section className="library-public-access" aria-label="Grupos con acceso público">
      <div className="library-public-access__heading">
        <div><div className="eyebrow">COMPARTIR / ACCESO INVITADO</div><h2>Grupos públicos</h2><p>{publicGroups.length > 0 ? `${publicGroups.length} ${publicGroups.length === 1 ? 'grupo permite' : 'grupos permiten'} compartir sus publicaciones sin iniciar sesión.` : 'Ninguno de sus grupos visibles tiene acceso público habilitado.'}</p></div>
        <span className={`library-public-count${publicGroups.length ? ' library-public-count--active' : ''}`}><Globe2 size={14}/> {publicGroups.length} públicos</span>
      </div>
      {publicGroups.length > 0 && <div className="library-public-group-list">
        {publicGroups.map(group => {
          const guest = guestSettings[group.id];
          const url = guestGroupShareUrl(guest.slug);
          const key = `group:${group.id}`;
          return <div className="library-public-group" key={group.id}>
            <div><Globe2 size={17}/><span><b>{guest.title || group.name}</b><small>/invitados/{guest.slug}</small></span></div>
            <div className="library-public-actions">
              <a className="button button-secondary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Abrir</a>
              <button type="button" className="button button-secondary" disabled={Boolean(copyingKey)} onClick={() => void copyPublicLink(guest.title || group.name, url, key)}><Clipboard size={14}/> {copyingKey === key ? 'Copiando…' : 'Copiar enlace'}</button>
            </div>
          </div>;
        })}
      </div>}
    </section>

    <div className="section-heading"><div><div className="eyebrow">CATÁLOGO CONTROLADO</div><h2>Sistemas 2D disponibles</h2></div><div className="input-icon search-field"><Search size={18}/><input aria-label="Buscar publicaciones" placeholder="Buscar esquemas publicados…" value={filter} onChange={(e) => setFilter(e.target.value)}/></div></div>
    {notice && <p className="alert alert-success" role="status">{notice}</p>}
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading ? <div className="empty-state">Comprobando sus permisos y grupos…</div> : <div className="diagram-grid">
      {filtered.map((item) => {
        const group = groups.find(candidate => candidate.id === item.groupId);
        const guest = guestSettings[item.groupId];
        const isPublic = guest?.active === true;
        const publicUrl = isPublic ? guestPublicationShareUrl(guest.slug, item.id) : '';
        const shareKey = `publication:${item.groupId}/${item.id}`;
        return <article key={`${item.groupId}/${item.id}`} className="diagram-card publication-library-card">
          <Link className="diagram-card-link" to={`/publicacion/${item.groupId}/${item.id}`}>
            <DiagramThumbnail nodes={item.nodes}/>
            <div className="diagram-card-content">
              <div className="publication-library-meta"><div className="eyebrow">PUBLICACIÓN · {group?.name ?? 'GRUPO'}</div><span className={`publication-access-badge${isPublic ? ' publication-access-badge--public' : ''}`}>{isPublic ? <Globe2 size={12}/> : <LockKeyhole size={12}/>} {isPublic ? 'Público' : 'Solo miembros'}</span></div>
              <h3>{item.title}</h3><p>{item.description}</p>
              {Boolean(item.sourceRevisionSavedAt) && <small className="publication-edition-label">Edición: {revisionDate(item.sourceRevisionSavedAt)}</small>}
              <div className="card-bottom">Consultar sistema <ArrowRight size={17}/></div>
            </div>
          </Link>
          {isPublic && <div className="publication-share-actions">
            <div><Globe2 size={15}/><span><b>Versión pública disponible</b><small>Se puede compartir sin cuenta.</small></span></div>
            <div className="publication-share-actions__buttons">
              <a className="button button-secondary" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Abrir público</a>
              <button type="button" className="button button-secondary" disabled={Boolean(copyingKey)} onClick={() => void copyPublicLink(item.title, publicUrl, shareKey)}><Clipboard size={14}/> {copyingKey === shareKey ? 'Copiando…' : 'Copiar enlace'}</button>
            </div>
          </div>}
          {role !== 'student' && item.ownerUid === user?.uid && <div className="diagram-publish"><button type="button" className="button button-secondary" disabled={Boolean(retiringKey)} onClick={() => void retire(item)}>{retiringKey === `${item.groupId}/${item.id}` ? 'Retirando…' : 'Retirar de este programa'}</button></div>}
        </article>;
      })}
    </div>}
    {!loading && filtered.length === 0 && <div className="empty-state"><BookOpenText size={28}/><p>Aún no hay sistemas publicados para sus grupos.</p></div>}
  </>;
}
