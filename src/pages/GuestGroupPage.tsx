import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, Clipboard, Image, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { DiagramThumbnail } from '../components/DiagramThumbnail';
import { GuestPublicLayout } from '../components/GuestPublicLayout';
import { explainError } from '../lib/errors';
import {
  guestFigurePath, guestPublicationPath, guestPublicationShareUrl,
  listGuestPublications, resolveGuestGroup,
  type GuestGroupSettings, type GuestPublication,
} from '../lib/guestGroups';
import { revisionDate } from '../lib/diagramHistory';

export function GuestGroupPage() {
  const { slug = '' } = useParams();
  const [group, setGroup] = useState<GuestGroupSettings | null>(null);
  const [items, setItems] = useState<GuestPublication[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setNotice(''); setGroup(null); setItems([]);
    resolveGuestGroup(slug).then(async current => {
      const publications = await listGuestPublications(current.groupId);
      if (!alive) return;
      setGroup(current);
      setItems(publications);
    }).catch(reason => { if (alive) setError(explainError(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase('es');
    return items.filter(item => !needle || `${item.title} ${item.description}`.toLocaleLowerCase('es').includes(needle));
  }, [items, filter]);

  async function copyPublicationLink(item: GuestPublication) {
    try {
      await navigator.clipboard.writeText(guestPublicationShareUrl(slug, item.id));
      setNotice(`Enlace individual de «${item.title}» copiado.`);
    } catch { setError('No fue posible copiar el enlace. Abra el esquema y cópielo desde la barra del navegador.'); }
  }

  return <GuestPublicLayout>
    <section className="guest-group-hero">
      <div>
        <div className="eyebrow">GRUPO DE INVITADOS / ACCESO PÚBLICO</div>
        <h1>{group?.title ?? (loading ? 'Cargando grupo…' : 'Grupo no disponible')}<span className="period">.</span></h1>
        <p>{group?.description || 'Explore sistemas 2D publicados expresamente para lectura pública.'}</p>
      </div>
      <div className="guest-group-badge"><UsersRound size={24}/><div><b>Sin cuenta</b><span>No necesita iniciar sesión</span></div></div>
    </section>

    {notice && <p className="alert alert-success" role="status">{notice}</p>}
    {error && <div className="guest-public-unavailable" role="alert">
      <ShieldCheck size={30}/><h2>Este grupo no está disponible</h2><p>{error}</p>
    </div>}

    {!error && <>
      <div className="role-summary guest-role-summary"><ShieldCheck size={20}/><div><b>Publicaciones seleccionadas · Solo lectura</b><p>Cada esquema tiene un enlace público propio. Puede citarlo desde un artículo y volver desde él a todos los esquemas de este grupo.</p></div></div>
      <div className="section-heading guest-section-heading"><div><div className="eyebrow">BIBLIOTECA DEL GRUPO</div><h2>Sistemas 2D disponibles</h2></div><div className="input-icon search-field"><Search size={18}/><input aria-label="Buscar publicaciones invitadas" placeholder="Buscar en este grupo…" value={filter} onChange={event => setFilter(event.target.value)}/></div></div>
      {loading ? <div className="empty-state">Preparando las publicaciones del grupo…</div> : <div className="diagram-grid guest-diagram-grid">
        {filtered.map((item, index) => <article className="diagram-card guest-share-card" key={item.id}>
          <Link className="diagram-card-link" to={guestPublicationPath(slug, item.id)}>
            <DiagramThumbnail nodes={item.nodes}/>
            <div className="diagram-card-content">
              <div className="eyebrow">ESQUEMA {String(index + 1).padStart(2, '0')} · PUBLICACIÓN PARA INVITADOS</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {Boolean(item.publishedAt) && <small className="publication-edition-label">Publicada: {revisionDate(item.publishedAt)}</small>}
              <div className="card-bottom">Abrir esquema completo <ArrowRight size={17}/></div>
            </div>
          </Link>
          <div className="guest-card-actions">
            <Link className="guest-card-action" to={guestFigurePath(slug, item.id)}><Image size={14}/> Vista figura</Link>
            <button type="button" className="guest-card-action" onClick={() => void copyPublicationLink(item)}><Clipboard size={14}/> Copiar enlace</button>
          </div>
        </article>)}
      </div>}
      {!loading && filtered.length === 0 && <div className="empty-state"><BookOpenText size={28}/><p>No hay publicaciones disponibles con ese criterio.</p></div>}
    </>}
  </GuestPublicLayout>;
}
