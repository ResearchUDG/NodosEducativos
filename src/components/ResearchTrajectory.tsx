import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Award, BookOpen, CalendarDays, ExternalLink, FileText, FlaskConical, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { explainError } from '../lib/errors';
import {
  emptyTrajectoryFields, normalizeTrajectoryFields, readTrajectoryMilestone,
  sortTrajectoryMilestones, TRAJECTORY_CATEGORIES, TRAJECTORY_LABELS, trajectoryDateLabel,
  type TrajectoryCategory, type TrajectoryFields, type TrajectoryMilestone,
} from '../lib/researchTrajectory';

const ICONS = { estudio: BookOpen, certificacion: Award, obra: FileText, proyecto: Plus, investigacion: FlaskConical };
type Filter = 'todos' | TrajectoryCategory;

export function ResearchTrajectory({ profileExists }: { profileExists: boolean }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<TrajectoryMilestone[]>([]);
  const [form, setForm] = useState<TrajectoryFields>({ ...emptyTrajectoryFields });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todos');
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setEvents([]);
    setEditingId(null);
    setExpanded(false);
    if (!db || !user || !profileExists) return;
    let active = true;
    setLoading(true); setError('');
    getDocs(collection(db, 'researcherProfiles', user.uid, 'milestones'))
      .then(snapshot => {
        if (!active) return;
        const list = snapshot.docs.map(item => readTrajectoryMilestone(item.id, item.data())).filter((item): item is TrajectoryMilestone => item !== null);
        setEvents(sortTrajectoryMilestones(list));
      })
      .catch(err => { if (active) setError(explainError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.uid, profileExists]);

  const filtered = useMemo(() => events.filter(event => filter === 'todos' || event.category === filter), [events, filter]);
  const grouped = useMemo(() => {
    const groups: { year: string; items: TrajectoryMilestone[] }[] = [];
    for (const event of filtered) {
      const year = event.startDate.slice(0, 4);
      if (groups[groups.length - 1]?.year !== year) groups.push({ year, items: [] });
      groups[groups.length - 1].items.push(event);
    }
    return groups;
  }, [filtered]);

  function change<K extends keyof TrajectoryFields>(field: K, value: TrajectoryFields[K]) {
    setForm(previous => ({ ...previous, [field]: value }));
    setError(''); setMessage('');
  }
  function cancel() { setForm({ ...emptyTrajectoryFields }); setEditingId(null); setExpanded(false); setError(''); }
  function startEdit(item: TrajectoryMilestone) {
    setForm({ category: item.category, title: item.title, institution: item.institution, startDate: item.startDate, endDate: item.endDate, description: item.description, url: item.url });
    setEditingId(item.id); setExpanded(true); setError(''); setMessage('');
    document.getElementById('trajectory-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user || !profileExists || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const normalized = normalizeTrajectoryFields(form);
      if (editingId) {
        await updateDoc(doc(db, 'researcherProfiles', user.uid, 'milestones', editingId), { ...normalized, updatedAt: serverTimestamp() });
        setEvents(previous => sortTrajectoryMilestones(previous.map(item => item.id === editingId ? { id: editingId, ...normalized } : item)));
      } else {
        const newDoc = await addDoc(collection(db, 'researcherProfiles', user.uid, 'milestones'), {
          ...normalized, ownerUid: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        setEvents(previous => sortTrajectoryMilestones([...previous, { id: newDoc.id, ...normalized }]));
      }
      cancel(); setMessage('Acontecimiento guardado en su trayectoria privada.');
    } catch (err) { setError(explainError(err)); }
    finally { setBusy(false); }
  }

  async function remove(item: TrajectoryMilestone) {
    if (!db || !user || busy || !window.confirm(`¿Eliminar «${item.title}» de su trayectoria? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await deleteDoc(doc(db, 'researcherProfiles', user.uid, 'milestones', item.id));
      setEvents(previous => previous.filter(event => event.id !== item.id));
      if (editingId === item.id) cancel();
      setMessage('Acontecimiento eliminado.');
    } catch (err) { setError(explainError(err)); }
    finally { setBusy(false); }
  }

  return <section className="trajectory-section" aria-labelledby="trajectory-heading">
    <div className="trajectory-hero">
      <div><div className="eyebrow">MEMORIA ACADÉMICA / HITOS</div><h2 id="trajectory-heading">Mi línea del tiempo<span className="period">.</span></h2>
        <p>Construya una cronología de lo que ha estudiado, creado, investigado y certificado. Cada acontecimiento lleva sus propias fechas.</p>
        <small>Registros declarados por usted. No equivalen a acreditaciones verificadas ni aparecen en publicaciones estudiantiles.</small>
      </div>
      <div className="trajectory-hero-count"><b>{events.length}</b><span>{events.length === 1 ? 'acontecimiento' : 'acontecimientos'}</span></div>
    </div>
    {message && <div role="status" className="alert alert-success">{message}</div>}
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    {!profileExists ? <div className="trajectory-empty">Guarde primero su ficha académica en «Formación y especialidades» para comenzar su trayectoria.</div> : <>
      <div className="trajectory-toolbar"><div className="trajectory-filters" role="group" aria-label="Filtrar acontecimientos">
        <button type="button" className={filter === 'todos' ? 'trajectory-filter trajectory-filter--active' : 'trajectory-filter'} onClick={() => setFilter('todos')}>Todos</button>
        {TRAJECTORY_CATEGORIES.map(category => <button key={category} type="button" className={filter === category ? 'trajectory-filter trajectory-filter--active' : 'trajectory-filter'} onClick={() => setFilter(category)}>{TRAJECTORY_LABELS[category]}</button>)}
      </div>
      <button type="button" className="button button-primary" disabled={busy} onClick={() => { if (expanded) cancel(); else { setExpanded(true); setError(''); setMessage(''); } }}><Plus size={17}/>{expanded ? 'Cerrar formulario' : 'Añadir acontecimiento'}</button></div>
      {expanded && <form id="trajectory-form" className="trajectory-form governance-form" onSubmit={event => void save(event)}>
        <div className="trajectory-form-header"><div><h3>{editingId ? 'Editar acontecimiento' : 'Nuevo acontecimiento'}</h3><p>Puede registrar una fecha de finalización o dejarla vacía si el proceso continúa.</p></div><button type="button" className="trajectory-icon-button" onClick={cancel} disabled={busy} aria-label="Cerrar formulario"><X size={19}/></button></div>
        <div className="trajectory-form-grid">
          <label>Tipo de acontecimiento<select value={form.category} onChange={event => change('category', event.target.value as TrajectoryCategory)} disabled={busy}>{TRAJECTORY_CATEGORIES.map(category => <option key={category} value={category}>{TRAJECTORY_LABELS[category]}</option>)}</select></label>
          <label>Título del logro, estudio u obra<input required minLength={3} maxLength={120} value={form.title} onChange={event => change('title', event.target.value)} disabled={busy} placeholder="Ej. Licenciatura en Filosofía"/></label>
          <label>Fecha de inicio o realización<input type="date" min="1900-01-01" max="2199-12-31" required value={form.startDate} onChange={event => change('startDate', event.target.value)} disabled={busy}/></label>
          <label>Fecha de finalización (opcional)<input type="date" min={form.startDate || '1900-01-01'} max="2199-12-31" value={form.endDate} onChange={event => change('endDate', event.target.value)} disabled={busy}/></label>
          <label>Institución, editorial o entidad (opcional)<input maxLength={140} value={form.institution} onChange={event => change('institution', event.target.value)} disabled={busy} placeholder="Ej. Universidad de Guadalajara"/></label>
          <label>Enlace a evidencia o trabajo (opcional)<input type="url" maxLength={500} value={form.url} onChange={event => change('url', event.target.value)} disabled={busy} placeholder="https://..."/></label>
        </div>
        <label>Descripción (opcional)<textarea rows={3} maxLength={600} value={form.description} onChange={event => change('description', event.target.value)} disabled={busy} placeholder="Qué aprendió, desarrolló, investigó o publicó"/></label>
        <div className="trajectory-form-actions"><button type="submit" className="button button-primary" disabled={busy}><Save size={17}/>{busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar acontecimiento'}</button><button type="button" className="button button-secondary" disabled={busy} onClick={cancel}>Cancelar</button></div>
      </form>}
      {loading ? <div role="status" className="trajectory-empty">Cargando su trayectoria…</div> : events.length === 0 ? <div className="trajectory-empty"><CalendarDays size={30}/><strong>Su historia académica comienza aquí</strong><span>Agregue un estudio, una certificación, una obra o un proyecto con su fecha real.</span></div>
        : filtered.length === 0 ? <div className="trajectory-empty">Todavía no tiene acontecimientos en esta categoría.</div>
        : <div className="trajectory-years">{grouped.map(group => <section key={group.year} aria-label={`Acontecimientos del año ${group.year}`} className="trajectory-year-group"><h3>{group.year}</h3><ol className="trajectory-list">{group.items.map(item => {
          const Icon = ICONS[item.category];
          return <li className={`trajectory-event trajectory-event--${item.category}`} key={item.id}>
            <div className="trajectory-marker" aria-hidden="true"><Icon size={18}/></div>
            <article className="trajectory-card"><div className="trajectory-card-head"><span className="trajectory-kind">{TRAJECTORY_LABELS[item.category]}</span><time dateTime={item.startDate}>{trajectoryDateLabel(item.startDate)}</time></div>
              <h4>{item.title}</h4>
              {item.endDate && <p className="trajectory-period">Hasta el {trajectoryDateLabel(item.endDate)}</p>}
              {item.institution && <p className="trajectory-institution">{item.institution}</p>}
              {item.description && <p className="trajectory-description">{item.description}</p>}
              {item.url && <a className="trajectory-link" href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Consultar trabajo o evidencia</a>}
              <div className="trajectory-card-actions"><button type="button" disabled={busy} onClick={() => startEdit(item)}><Pencil size={14}/> Editar</button><button type="button" disabled={busy} onClick={() => void remove(item)}><Trash2 size={14}/> Eliminar</button></div>
            </article>
          </li>;
        })}</ol></section>)}</div>}
    </>}
  </section>;
}
