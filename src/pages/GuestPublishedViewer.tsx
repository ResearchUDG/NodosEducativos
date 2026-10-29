import { useEffect, useState } from 'react';
import { Clipboard, Image, LayoutGrid } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GuestPublicLayout } from '../components/GuestPublicLayout';
import { PublicationStudyReader, type StudyPublication } from '../components/PublicationStudyReader';
import { explainError } from '../lib/errors';
import {
  guestFigurePath, guestPublicationShareUrl, openGuestPublication, resolveGuestGroup,
  type GuestGroupSettings,
} from '../lib/guestGroups';

export function GuestPublishedViewer() {
  const { slug = '', id = '' } = useParams();
  const [group, setGroup] = useState<GuestGroupSettings | null>(null);
  const [publication, setPublication] = useState<StudyPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    setGroup(null); setPublication(null); setError(''); setNotice(''); setLoading(true);
    resolveGuestGroup(slug).then(async current => {
      const item = await openGuestPublication(current.groupId, id);
      if (!alive) return;
      setGroup(current);
      setPublication(item);
    }).catch(reason => { if (alive) setError(explainError(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(guestPublicationShareUrl(slug, id));
      setNotice('Enlace individual del esquema copiado.');
    } catch { setError('No fue posible copiar el enlace. Puede copiarlo desde la barra del navegador.'); }
  }

  const headerActions = publication ? <>
    <Link className="button button-secondary" to={`/invitados/${slug}`}><LayoutGrid size={16}/> Todos los esquemas</Link>
    <Link className="button button-secondary" to={guestFigurePath(slug, id)}><Image size={16}/> Vista figura</Link>
    <button type="button" className="button button-secondary" onClick={() => void copyLink()}><Clipboard size={16}/> Copiar enlace</button>
  </> : null;

  return <GuestPublicLayout>
    {notice && <p className="alert alert-success guest-reader-notice" role="status">{notice}</p>}
    <PublicationStudyReader
      publication={publication}
      loading={loading}
      error={error}
      backTo={`/invitados/${slug}`}
      backLabel="TODOS LOS ESQUEMAS"
      eyebrow={`SISTEMA 2D / ${group?.title?.toLocaleUpperCase('es') || 'LECTURA PÚBLICA'}`}
      banner="Acceso invitado de solo lectura. Este enlace identifica únicamente este esquema público; puede volver al catálogo para consultar los demás sistemas del grupo."
      guideEnabled={group?.guideEnabled !== false}
      guestMode
      headerActions={headerActions}
    />
  </GuestPublicLayout>;
}
