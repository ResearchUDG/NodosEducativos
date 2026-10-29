import { useEffect, useMemo, useState } from 'react';
import { ReactFlow } from '@xyflow/react';
import { ArrowLeft, Clipboard, ExternalLink, LayoutGrid } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GuestFigureNode } from '../components/GuestFigureNode';
import { GuestPublicLayout } from '../components/GuestPublicLayout';
import { explainError } from '../lib/errors';
import { buildGuestFigureGraph } from '../lib/guestFigure';
import {
  guestPublicationPath, guestPublicationShareUrl, openGuestPublication, resolveGuestGroup,
  type GuestGroupSettings, type GuestPublication,
} from '../lib/guestGroups';

const nodeTypes = { guestFigure: GuestFigureNode };

export function GuestFigurePage() {
  const { slug = '', id = '' } = useParams();
  const [group, setGroup] = useState<GuestGroupSettings | null>(null);
  const [publication, setPublication] = useState<GuestPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setNotice(''); setGroup(null); setPublication(null);
    resolveGuestGroup(slug).then(async current => {
      const item = await openGuestPublication(current.groupId, id);
      if (!alive) return;
      setGroup(current); setPublication(item);
    }).catch(reason => { if (alive) setError(explainError(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, id]);

  const figure = useMemo(
    () => buildGuestFigureGraph(publication?.nodes ?? [], publication?.edges ?? []),
    [publication],
  );

  async function copySchemeLink() {
    try {
      await navigator.clipboard.writeText(guestPublicationShareUrl(slug, id));
      setNotice('Enlace del esquema completo copiado.');
    } catch { setError('No fue posible copiar el enlace. Puede copiarlo desde la barra del navegador.'); }
  }

  return <GuestPublicLayout>
    <section className="guest-figure-page">
      <div className="guest-figure-page-head">
        <div>
          <Link className="back-link" to={`/invitados/${slug}`}><ArrowLeft size={16}/> TODOS LOS ESQUEMAS</Link>
          <div className="eyebrow">FIGURA ACADÉMICA / VISTA COMPACTA</div>
          <h1>{publication?.title ?? (loading ? 'Preparando figura…' : 'Figura no disponible')}<span className="period">.</span></h1>
          <p>Versión visual limpia: únicamente títulos de nodos y líneas de conexión.</p>
        </div>
        {publication && <div className="guest-figure-actions">
          <Link className="button button-primary" to={guestPublicationPath(slug, id)}><ExternalLink size={16}/> Abrir esquema completo</Link>
          <Link className="button button-secondary" to={`/invitados/${slug}`}><LayoutGrid size={16}/> Todos los esquemas</Link>
          <button type="button" className="button button-secondary" onClick={() => void copySchemeLink()}><Clipboard size={16}/> Copiar enlace</button>
        </div>}
      </div>
      {notice && <p className="alert alert-success" role="status">{notice}</p>}
      {error && <div className="guest-public-unavailable" role="alert"><h2>No fue posible mostrar esta figura</h2><p>{error}</p></div>}
      {!error && loading && <div className="empty-state">Preparando la figura…</div>}
      {publication && <figure className="guest-figure-sheet">
        <div className="guest-figure-sheet-meta"><span>{group?.title || 'Grupo de invitados'}</span><strong>{publication.title}</strong></div>
        <div className="guest-figure-canvas" aria-label={`Figura del esquema ${publication.title}`}>
          <ReactFlow
            nodes={figure.nodes} edges={figure.edges} nodeTypes={nodeTypes}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            nodesFocusable={false} edgesFocusable={false} panOnDrag={false} zoomOnScroll={false}
            zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}
            fitView fitViewOptions={{ padding: 0.18, minZoom: 0.16, maxZoom: 1.15 }}
            minZoom={0.12} maxZoom={1.15} colorMode="light" proOptions={{ hideAttribution: true }}
          />
        </div>
        <figcaption>
          <b>{publication.title}</b>
          <span>Figura pública de Nodos Educativos · Abra el esquema completo para consultar explicaciones, fuentes y guía de lectura.</span>
        </figcaption>
      </figure>}
    </section>
  </GuestPublicLayout>;
}
