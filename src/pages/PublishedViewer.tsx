import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PublicationStudyReader, type StudyPublication } from '../components/PublicationStudyReader';
import { explainError } from '../lib/errors';
import { openPublication } from '../lib/groups';

export function PublishedViewer() {
  const { groupId = '', id = '' } = useParams();
  const [publication, setPublication] = useState<StudyPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setPublication(null); setError(''); setLoading(true);
    if (!groupId || !id) { setLoading(false); return; }
    openPublication(groupId, id)
      .then(item => { if (alive) setPublication(item); })
      .catch(reason => { if (alive) setError(explainError(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, id]);

  return <PublicationStudyReader
    publication={publication}
    loading={loading}
    error={error}
    backTo="/biblioteca"
    backLabel="VOLVER A LA BIBLIOTECA"
    eyebrow="SISTEMA 2D / LECTURA ACADÉMICA"
    banner="Material de lectura. Solo contiene los conceptos compartidos para su programa. Seleccione un nodo para estudiarlo o inicie la guía."
  />;
}
