import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addEdge, Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow, type Connection,
} from '@xyflow/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp, ExternalLink, GitCompareArrows, History, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { explainError } from '../lib/errors';
import { saveDiagramWithHistory, listDiagramRevisions, removeDiagram } from '../lib/diagrams';
import { compareDiagramSnapshots, revisionDate, snapshotFromDiagram, timestampKey, type DiagramRevision } from '../lib/diagramHistory';
import { buildRevisionTimeline, filterTimeline, type TimelineFilter } from '../lib/revisionTimeline';
import { buildConceptHistory, describeConceptChanges, filterConceptHistory, type ConceptEventFilter } from '../lib/conceptHistory';
import { useAuth } from '../lib/useAuth';
import { useAccess } from '../lib/access';
import { inspectOwnedEditions } from '../lib/publicationLifecycle';
import { isValidNodeTitle, MAX_NODE_TITLE_CHARACTERS, MAX_NODE_TITLE_WORDS, nodeTitleWordCount } from '../lib/nodeTitle';
import { guideStartIndex, numberedNodes, planMultipleConnections } from '../lib/graphEnhancements';
import { ConceptNode } from '../components/ConceptNode';
import { blankReference, MAX_NODE_REFERENCES, relationKeys, relationLabels, safeReferenceUrl, serializeAcademicGraph } from '../lib/academicGraph';
import { isReferencePersisted, snapshotPersistedReferences } from '../lib/academicReferenceView';
import type { AcademicReference, ArgumentRelation, ConceptEdge, ConceptNode as ConceptNodeType } from '../lib/types';

const nodeTypes = { concept: ConceptNode };
const categories = [
  { id: 'pregunta', label: 'Pregunta' }, { id: 'tesis', label: 'Tesis' },
  { id: 'idea', label: 'Concepto' }, { id: 'fuente', label: 'Fuente' },
] as const;

function ReferenceList({ references }: { references?: AcademicReference[] }) {
  if (!references?.length) return null;
  return <div className="academic-reference-list">
    <b>REFERENCIAS VINCULADAS</b>
    {references.map((reference, index) => <div className="academic-reference-preview" key={index}>
      <span>{reference.author ? `${reference.author}. ` : ''}<i>{reference.work}</i>{reference.year ? ` (${reference.year})` : ''}{reference.locator ? `, ${reference.locator}` : ''}.</span>
      {safeReferenceUrl(reference.url) && <a href={safeReferenceUrl(reference.url)} rel="noopener noreferrer" target="_blank">Consultar fuente ↗</a>}
    </div>)}
  </div>;
}

function EditorContent() {
  const { id } = useParams();
  const { user } = useAuth();
  const { role } = useAccess();
  const navigate = useNavigate();
  const flow = useReactFlow<ConceptNodeType, ConceptEdge>();
  const [title, setTitle] = useState('Cargando esquema…');
  const [description, setDescription] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ConceptEdge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [guiding, setGuiding] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSourceId, setBatchSourceId] = useState<string | null>(null);
  const [batchTargetIds, setBatchTargetIds] = useState<string[]>([]);
  const [batchRelation, setBatchRelation] = useState<ArgumentRelation>('fundamenta');
  const [batchFeedback, setBatchFeedback] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadedStamp, setLoadedStamp] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('todas');
  const [historyScope, setHistoryScope] = useState<'esquema' | 'concepto'>('esquema');
  const [historyNodeId, setHistoryNodeId] = useState<string | null>(null);
  const [conceptFilter, setConceptFilter] = useState<ConceptEventFilter>('todos');
  const [revisions, setRevisions] = useState<DiagramRevision[]>([]);
  const [compareFrom, setCompareFrom] = useState('baseline');
  const [compareTo, setCompareTo] = useState('__current__');
  const [restorePending, setRestorePending] = useState('');
  // La instantánea solo se modifica al cargar del servidor o tras confirmar saveDiagram.
  const [persistedReferences, setPersistedReferences] = useState<Record<string, AcademicReference[]>>({});
  const [editingReference, setEditingReference] = useState<{ nodeId: string; index: number; original: AcademicReference | null } | null>(null);
  const selected = nodes.find(node => node.id === selectedId);
  const selectedEdge = edges.find(edge => edge.id === selectedEdgeId);
  // Una URL incompleta no puede guardarse; mostrar el motivo junto al campo.
  const invalidUrlCount = (selected?.data.references ?? []).filter(reference =>
    Boolean(reference.url?.trim()) && !safeReferenceUrl(reference.url)
  ).length;

  useEffect(() => {
    if (!user || !id || !db) return;
    let active = true;
    getDoc(doc(db, 'users', user.uid, 'diagrams', id))
      .then(document => {
        if (!active) return;
        if (!document.exists()) throw new Error('El esquema no existe o usted no tiene acceso.');
        const value = document.data();
        setTitle(String(value.title ?? 'Sin título'));
        setLoadedStamp(timestampKey(value.updatedAt));
        setDescription(String(value.description ?? ''));
        const loadedNodes: ConceptNodeType[] = Array.isArray(value.nodes) ? value.nodes : [];
        setNodes(loadedNodes);
        setPersistedReferences(snapshotPersistedReferences(loadedNodes));
        setEditingReference(null);
        setSaved(true);
        setRestorePending('');
        setEdges(Array.isArray(value.edges) ? value.edges : []);
      })
      .catch(reason => { if (active) setError(explainError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, id, setNodes, setEdges]);

  async function refreshHistory() {
    if (!user || !id) return;
    setHistoryLoading(true); setHistoryError('');
    try {
      const found = await listDiagramRevisions(user.uid, id);
      setRevisions(found);
      if (found.length) {
        setCompareFrom(current => found.some(rev => rev.id === current)
          ? current : (found.find(rev => rev.kind === 'baseline')?.id ?? found[found.length - 1].id));
        setCompareTo(current => current === '__current__' || found.some(rev => rev.id === current)
          ? current : '__current__');
      }
    } catch (reason) { setHistoryError(explainError(reason)); }
    finally { setHistoryLoading(false); }
  }

  function openConceptHistory(nodeId: string) {
    setHistoryNodeId(nodeId);
    setConceptFilter('todos');
    setHistoryScope('concepto');
    setHistoryOpen(true);
    void refreshHistory();
    // El historial está por encima del lienzo: hacerlo visible sin mover los nodos.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() =>
      document.getElementById('diagram-history-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    ));
  }

  function restoreRevision(revision: DiagramRevision) {
    if (busy || !window.confirm(`¿Cargar «${revision.title}» en el editor? Los cambios locales sin guardar se descartarán. Su versión guardada no cambiará hasta que pulse Guardar.`)) return;
    const restored = snapshotFromDiagram(revision);
    setTitle(restored.title); setDescription(restored.description);
    setNodes(structuredClone(restored.nodes)); setEdges(structuredClone(restored.edges));
    setSelectedId(null); setSelectedEdgeId(null); setEditingReference(null);
    setGuiding(false); setStep(0); setBatchMode(false); setBatchSourceId(null); setBatchTargetIds([]); setSaved(false);
    setRestorePending(revision.id); setHistoryOpen(false); setError('');
  }

  const currentSnapshot = useMemo(() => ({ title, description, nodes, edges }), [title, description, nodes, edges]);
  const timeline = useMemo(() => buildRevisionTimeline(revisions), [revisions]);
  const visibleTimeline = useMemo(() => filterTimeline(timeline, timelineFilter), [timeline, timelineFilter]);
  const conceptTimeline = useMemo(() => historyNodeId ? buildConceptHistory(revisions, historyNodeId) : [], [revisions, historyNodeId]);
  const visibleConceptTimeline = useMemo(() => filterConceptHistory(conceptTimeline, conceptFilter), [conceptTimeline, conceptFilter]);
  const historyNodeTitle = nodes.find(node => node.id === historyNodeId)?.data.title
    ?? conceptTimeline.find(entry => entry.nodePresent)?.nodeTitle
    ?? conceptTimeline[0]?.nodeTitle ?? 'Concepto';
  const comparison = useMemo(() => {
    const resolve = (value: string) => value === '__current__' ? currentSnapshot : revisions.find(item => item.id === value);
    const before = resolve(compareFrom); const after = resolve(compareTo);
    return before && after ? compareDiagramSnapshots(before, after) : null;
  }, [revisions, compareFrom, compareTo, currentSnapshot]);
  const conceptComparison = useMemo(() => {
    if (!historyNodeId) return null;
    const resolve = (value: string) => value === '__current__' ? currentSnapshot : revisions.find(item => item.id === value);
    const before = resolve(compareFrom); const after = resolve(compareTo);
    if (!before || !after) return null;
    return {
      beforePresent: before.nodes.some(node => node.id === historyNodeId),
      afterPresent: after.nodes.some(node => node.id === historyNodeId),
      events: describeConceptChanges(before, after, historyNodeId),
    };
  }, [historyNodeId, revisions, compareFrom, compareTo, currentSnapshot]);

  const connect = useCallback((connection: Connection) => {
    setEdges(existing => addEdge({
      ...connection, type: 'smoothstep', data: { relation: 'fundamenta' }, label: 'fundamenta',
    }, existing));
    setSaved(false);
  }, [setEdges]);

  function updateNode(patch: Partial<ConceptNodeType['data']>) {
    if (!selectedId) return;
    setNodes(existing => existing.map(node => node.id === selectedId
      ? { ...node, data: { ...node.data, ...patch } } : node));
    setSaved(false);
    setError('');
  }

  function addReference() {
    if (!selected || (selected.data.references?.length ?? 0) >= MAX_NODE_REFERENCES) return;
    const index = selected.data.references?.length ?? 0;
    updateNode({ references: [...(selected.data.references ?? []), blankReference()] });
    setEditingReference({ nodeId: selected.id, index, original: null });
  }

  function editReference(index: number) {
    if (!selected) return;
    const reference = selected.data.references?.[index];
    if (!reference) return;
    setEditingReference({ nodeId: selected.id, index, original: { ...reference } });
  }

  function cancelReferenceEdit(index: number) {
    if (!selected || editingReference?.nodeId !== selected.id || editingReference.index !== index) return;
    if (editingReference.original === null) {
      removeReference(index); // Descarta una fuente recién añadida.
    } else {
      updateReferenceValues(index, editingReference.original);
    }
    setEditingReference(null);
  }

  function updateReferenceValues(index: number, reference: AcademicReference) {
    if (!selected) return;
    updateNode({ references: (selected.data.references ?? []).map((item, idx) => idx === index
      ? { ...reference } : item) });
  }

  function updateReference(index: number, field: keyof AcademicReference, value: string) {
    if (!selected) return;
    updateNode({ references: (selected.data.references ?? []).map((ref, idx) => idx === index
      ? { ...ref, [field]: value } : ref) });
  }

  function removeReference(index: number) {
    if (!selected) return;
    updateNode({ references: (selected.data.references ?? []).filter((_, idx) => idx !== index) });
    // La edición se identifica por el nodo y la posición; reajustar al eliminar.
    setEditingReference(current => {
      if (!current || current.nodeId !== selected.id) return current;
      if (current.index === index) return null;
      if (current.index > index) return { ...current, index: current.index - 1 };
      return current;
    });
  }

  function updateEdge(patch: Partial<ConceptEdge>) {
    if (!selectedEdgeId) return;
    setEdges(existing => existing.map(edge => edge.id === selectedEdgeId
      ? { ...edge, ...patch } : edge));
    setSaved(false);
  }

  function updateRelation(relation: ArgumentRelation) {
    if (!selectedEdge) return;
    updateEdge({
      data: { ...selectedEdge.data, relation },
      label: relation === 'otra' ? String(selectedEdge.label ?? '') : relationLabels[relation].toLowerCase(),
    });
  }

  function beginBatch() {
    setBatchMode(true); setBatchSourceId(selectedId); setBatchTargetIds([]);
    setGuiding(false); setBatchFeedback(''); setSelectedEdgeId(null);
  }

  function cancelBatch() {
    setBatchMode(false); setBatchSourceId(null); setBatchTargetIds([]);
  }

  function clickBatchNode(nodeId: string) {
    if (!batchSourceId) {
      setBatchSourceId(nodeId); setSelectedId(nodeId); return;
    }
    if (nodeId === batchSourceId) return;
    setBatchTargetIds(old => old.includes(nodeId) ? old.filter(id => id !== nodeId) : [...old, nodeId]);
  }

  function commitBatch() {
    if (!batchSourceId || !batchTargetIds.length) return;
    try {
      const { created, ignored } = planMultipleConnections(nodes, edges, batchSourceId, batchTargetIds, batchRelation, () => crypto.randomUUID());
      if (created.length) {
        setEdges(old => [...old, ...created]);
        setSaved(false); setError('');
      }
      setBatchFeedback(`${created.length} conexiones creadas${ignored ? `; ${ignored} repetidas o inválidas omitidas` : ''}. ${created.length ? 'Pulse «Guardar esquema» para conservarlas.' : 'No hay relaciones nuevas que añadir.'}`);
      cancelBatch();
    } catch (reason) { setError(explainError(reason)); }
  }

  function focusConcept(node: ConceptNodeType) {
    // Mueve únicamente la cámara. Nunca modifica la coordenada guardada.
    void flow.setCenter(node.position.x + 125, node.position.y + 95, { zoom: 0.85, duration: 430 });
  }

  function beginGuide() {
    if (!nodes.length) return;
    setStep(guideStartIndex(nodes, selectedId));
    setGuiding(true);
    cancelBatch();
  }

  function addConcept() {
    const number = nodes.length;
    if (number >= 80) { setError('Por seguridad, un esquema admite un máximo de 80 nodos.'); return; }
    const nextId = crypto.randomUUID();
    const next: ConceptNodeType = {
      id: nextId, type: 'concept',
      position: { x: (number % 3) * 365, y: Math.floor(number / 3) * 250 },
      data: { title: `Concepto ${number + 1}`, description: 'Describa la idea que desea conectar.', category: 'idea' },
    };
    setNodes(existing => [...existing, next]);
    setSelectedId(nextId);
    setSelectedEdgeId(null);
    setSaved(false);
    window.requestAnimationFrame(() => {
      flow.setCenter(next.position.x + 125, next.position.y + 80, { zoom: 0.8, duration: 350 });
    });
  }

  function removeConcept() {
    if (!selectedId) return;
    setNodes(existing => existing.filter(node => node.id !== selectedId));
    setEdges(existing => existing.filter(edge => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId(null);
    setGuiding(false);
    if (selectedId === batchSourceId) cancelBatch();
    setBatchTargetIds(old => old.filter(id => id !== selectedId));
    setSaved(false);
  }

  function removeConnection() {
    if (!selectedEdgeId) return;
    setEdges(existing => existing.filter(edge => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setSaved(false);
  }

  const highlightedId = guiding ? nodes[step % Math.max(nodes.length, 1)]?.id : undefined;
  const renderedNodes = useMemo(() => numberedNodes(nodes).map(node => ({
    ...node, data: {
      ...node.data, highlight: node.id === highlightedId,
      batchSource: batchMode && node.id === batchSourceId,
      batchTarget: batchMode && batchTargetIds.includes(node.id),
    },
  })), [nodes, highlightedId, batchMode, batchSourceId, batchTargetIds]);

  useEffect(() => {
    if (!guiding || !nodes.length) return;
    const current = nodes[step % nodes.length];
    if (current) focusConcept(current);
    // Solo cambia la vista al variar el paso; no sigue cada arrastre del lienzo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guiding, step]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!user || !id) return;
    if (title.trim().length < 3 || title.trim().length > 100) {
      setError('El título debe tener entre 3 y 100 caracteres.'); return;
    }
    if (nodes.some(node => !isValidNodeTitle(node.data.title))) {
      setError(`Cada título de nodo debe tener entre 1 y ${MAX_NODE_TITLE_WORDS} palabras y un máximo de ${MAX_NODE_TITLE_CHARACTERS} caracteres.`); return;
    }
    setBusy(true); setError('');
    try {
      // Solo se guardan datos académicos explícitos, nunca el estado interno de React Flow.
      const graph = serializeAcademicGraph(nodes, edges);
      const stamp = await saveDiagramWithHistory(user.uid, id, {
        title: title.trim(), description: description.trim().slice(0, 500), ...graph,
      }, loadedStamp);
      setLoadedStamp(stamp);
      setPersistedReferences(snapshotPersistedReferences(graph.nodes));
      setEditingReference(null);
      setSaved(true);
      setRestorePending('');
      if (historyOpen) await refreshHistory();
    } catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!user || !id || busy) return;
    setBusy(true); setError('');
    try {
      const copies = await inspectOwnedEditions(user.uid, id, role === 'admin');
      const programs = [...new Set(copies.map(item => item.groupId))].length;
      const notice = copies.length
        ? `También se retirarán ${copies.length} publicación(es) de ${programs} programa(s) activo(s).`
        : 'No se encontraron publicaciones suyas en los programas activos a los que tiene acceso.';
      if (!window.confirm(`¿Eliminar «${title}» permanentemente?\n\n${notice}\n\nEsto borrará su borrador e historial y retirará esas publicaciones. No se puede deshacer.`)) return;
      await removeDiagram(user.uid, id, copies);
      navigate('/esquemas');
    } catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }

  const guidedNode = guiding && nodes.length ? nodes[step % nodes.length] : null;
  return <div className="editor-page">
    <div className="editor-header">
      <div><Link className="back-link" to="/esquemas"><ArrowLeft size={16}/> VOLVER A MIS ESQUEMAS</Link>
        <div className="eyebrow">LABORATORIO ACADÉMICO / SISTEMA 2D</div>
        <div className="diagram-title-row"><h1>{loading ? 'Cargando…' : title}</h1>
          {!loading && <button type="button" className="diagram-rename-button" onClick={() => { setSelectedId(null); setSelectedEdgeId(null); }}><Pencil size={13}/> Cambiar título</button>}
        </div>
        <p>Relacione conceptos, argumentos y bibliografía en su borrador privado.</p>
        {!loading && <div className="diagram-save-status" role="status">
          <span className={saved ? 'diagram-save-dot diagram-save-dot--ok' : 'diagram-save-dot'}/>
          {busy ? 'Guardando revisión…' : restorePending ? 'Revisión recuperada · pendiente de guardar'
            : saved ? 'Borrador guardado' : 'Cambios sin guardar'}
        </div>}
      </div>
      <div className="editor-header-actions">
        <button className="button button-secondary" disabled={busy || loading} aria-expanded={historyOpen} onClick={() => {
          if (historyOpen) setHistoryOpen(false);
          else { setHistoryScope('esquema'); setHistoryOpen(true); void refreshHistory(); }
        }}><History size={17}/> Historial</button>
        <button className="button button-secondary" disabled={busy || loading} onClick={beginGuide}><CircleHelp size={17}/> Iniciar guía</button>
        <button className="button button-primary" disabled={busy || loading} onClick={() => void save()}><Save size={17}/> {busy ? 'Guardando…' : saved ? 'Guardado' : 'Guardar esquema'}</button>
      </div>
    </div>
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    {historyOpen && <section id="diagram-history-panel" className="diagram-history-panel" aria-label="Historial privado de versiones">
      <div className="diagram-history-heading">
        <div><div className="eyebrow">MI INVESTIGACIÓN · HISTORIAL PRIVADO</div><h2><History size={19}/> Evolución del esquema</h2>
          <p>Cada guardado conserva una versión de su trabajo. Este historial es privado.</p></div>
        <button className="button button-secondary" onClick={() => setHistoryOpen(false)} aria-label="Cerrar historial"><X size={16}/></button>
      </div>
      {historyError && <div className="alert alert-error" role="alert">{historyError}. Revise que las reglas nuevas estén publicadas antes de utilizar el historial.</div>}
      {historyLoading ? <p>Cargando revisiones…</p> : revisions.length === 0
        ? <p className="diagram-history-empty">Todavía no hay revisiones. El próximo guardado conservará una copia del estado actual y registrará el nuevo.</p>
        : <>
          <div className="diagram-history-scope" role="tablist" aria-label="Alcance del historial">
            <button type="button" role="tab" aria-selected={historyScope === 'esquema'} className={`diagram-history-scope-tab${historyScope === 'esquema' ? ' diagram-history-scope-tab--active' : ''}`}
              onClick={() => setHistoryScope('esquema')}>Esquema completo</button>
            <button type="button" role="tab" aria-selected={historyScope === 'concepto'} disabled={!selectedId && !historyNodeId}
              className={`diagram-history-scope-tab${historyScope === 'concepto' ? ' diagram-history-scope-tab--active' : ''}`}
              onClick={() => { setHistoryNodeId(selectedId ?? historyNodeId); setHistoryScope('concepto'); }}>
              <History size={14}/> Concepto seleccionado
            </button>
          </div>
          <div className="diagram-history-grid">
          <div className="diagram-history-revisions">
            {historyScope === 'concepto' && historyNodeId ? <>
              <h3>Evolución de «{historyNodeTitle}»</h3>
              <p className="diagram-timeline-intro">Siga este concepto por su identidad, incluso si ha cambiado de nombre. Se muestran sus cambios guardados, fuentes y relaciones.</p>
              <div className="diagram-timeline-filters" role="group" aria-label="Filtrar evolución del concepto">
                {([['todos', 'Todos'], ['concepto', 'Contenido'], ['bibliografia', 'Bibliografía'], ['relaciones', 'Relaciones']] as const)
                  .map(([key, title]) => <button type="button" key={key}
                    className={`diagram-timeline-filter${conceptFilter === key ? ' diagram-timeline-filter--active' : ''}`}
                    aria-pressed={conceptFilter === key} onClick={() => setConceptFilter(key)}>{title}</button>)}
              </div>
              <ol className="diagram-timeline-list" aria-label="Cambios guardados de este concepto">
                {visibleConceptTimeline.map(entry => <li className={`diagram-timeline-item${entry.isInitial ? ' diagram-timeline-item--initial' : ''}`} key={entry.revision.id}>
                  <article className="diagram-timeline-card">
                    <div className="diagram-timeline-card-top">
                      <span className="diagram-timeline-kind">{entry.isInitial ? 'Punto de partida' : 'Versión guardada'}</span>
                      <small>{revisionDate(entry.revision.savedAt)}</small>
                    </div>
                    <strong className="diagram-timeline-title">{entry.nodeTitle}</strong>
                    <p className="diagram-timeline-owner">Autor: {entry.revision.authorUid === user?.uid ? 'Usted' : 'Investigador'} · {entry.nodePresent ? `${entry.referencesCount} fuentes · ${entry.relationsCount} relaciones` : 'Concepto retirado en esta versión'}</p>
                    {!entry.isComparable ? <p className="diagram-timeline-summary">{entry.isInitial
                      ? 'El concepto ya estaba presente en el primer estado conservado.'
                      : 'No hay versiones consecutivas suficientes para determinar qué cambió antes de este guardado.'}</p>
                      : <ul className="diagram-timeline-events">{entry.events.map((event, i) => <li key={i}>
                        <span className={`diagram-timeline-tag diagram-timeline-tag--${event.category}`}>
                          {{concepto:'Concepto',bibliografia:'Fuente',relaciones:'Relación'}[event.category]}
                        </span><span>{event.description}</span></li>)}</ul>}
                    {entry.previousId && <div className="diagram-timeline-actions">
                      <button type="button" className="button button-secondary" onClick={() => { setCompareFrom(entry.previousId!); setCompareTo(entry.revision.id); }}>
                        <GitCompareArrows size={14}/> Comparar este cambio
                      </button>
                    </div>}
                  </article>
                </li>)}
              </ol>
              {visibleConceptTimeline.length === 0 && <p className="diagram-history-empty">No hay cambios de este tipo en las versiones disponibles.</p>}
              <p className="diagram-timeline-footer">Solo se registran cambios que quedaron guardados. El historial es privado. Si faltan revisiones antiguas, no se atribuyen cambios que no podemos comprobar.</p>
            </> : <>
            <h3>Línea de tiempo de investigación</h3>
            <p className="diagram-timeline-intro">Explore qué cambió en cada versión. Su historial es privado.</p>
            <div className="diagram-timeline-filters" role="group" aria-label="Filtrar cambios del historial">
              {([
                ['todas', 'Todos'], ['conceptos', 'Conceptos'], ['fuentes', 'Bibliografía'],
                ['relaciones', 'Relaciones'], ['esquema', 'Datos generales'],
              ] as const).map(([key, label]) => <button type="button" key={key}
                className={`diagram-timeline-filter${timelineFilter === key ? ' diagram-timeline-filter--active' : ''}`}
                aria-pressed={timelineFilter === key} onClick={() => setTimelineFilter(key)}>{label}</button>)}
            </div>
            <ol className="diagram-timeline-list">
              {visibleTimeline.map(({ revision, previousId, events, isComparable, isInitial }) => <li key={revision.id}
                className={`diagram-timeline-item${isInitial ? ' diagram-timeline-item--initial' : ''}`}>
                <div className="diagram-timeline-card">
                  <div className="diagram-timeline-card-top"><span className="diagram-timeline-kind">{isInitial ? 'Punto de partida' : 'Versión guardada'}</span>
                    <small>{revisionDate(revision.savedAt)}</small></div>
                  <strong className="diagram-timeline-title">{isInitial ? 'Estado inicial conservado' : revision.title}</strong>
                  <p className="diagram-timeline-owner">Autor: {revision.authorUid === user?.uid ? 'Usted' : 'Investigador'} · {revision.nodes.length} conceptos · {revision.edges.length} relaciones</p>
                  {isInitial ? <p className="diagram-timeline-summary">Primer estado conservado para comparar sus avances posteriores.</p>
                    : !isComparable ? <p className="diagram-timeline-summary">{previousId === null ? 'No hay una versión anterior consecutiva disponible para comparar.' : 'Sin comparación disponible.'}</p>
                    : events.length === 0 ? <p className="diagram-timeline-summary">Se guardó esta versión sin cambios en el contenido académico.</p>
                    : <><ul className="diagram-timeline-events">
                      {events.slice(0, 5).map((event, index) => <li key={index}>
                        <span className={`diagram-timeline-tag diagram-timeline-tag--${event.category}`}>
                          {{ conceptos: 'Concepto', fuentes: 'Fuente', relaciones: 'Relación', esquema: 'Esquema' }[event.category]}
                        </span><span>{event.description}</span>
                      </li>)}
                    </ul>{events.length > 5 && <p className="diagram-timeline-summary">Y {events.length - 5} cambios más. Consulte la comparación para ver el detalle.</p>}</>}
                  <div className="diagram-timeline-actions">
                    {previousId && <button className="button button-secondary" type="button"
                      onClick={() => { setCompareFrom(previousId); setCompareTo(revision.id); }}><GitCompareArrows size={14}/> Comparar</button>}
                    <button className="button button-secondary" type="button" disabled={busy}
                      onClick={() => restoreRevision(revision)}><RotateCcw size={14}/> Recuperar</button>
                  </div>
                </div>
              </li>)}
            </ol>
            {visibleTimeline.length === 0 && <p className="diagram-history-empty">No hay cambios de ese tipo en las versiones disponibles.</p>}
            <p className="diagram-timeline-footer">Se muestran las últimas 50 versiones disponibles y, cuando existe, el estado inicial. La línea de tiempo se construye a partir de sus versiones guardadas.</p>
            </>}
          </div>
          <div className="diagram-history-compare">
            <h3><GitCompareArrows size={17}/> Comparar versiones</h3>
            <label>DESDE<select value={compareFrom} onChange={event => setCompareFrom(event.target.value)}>
              <option value="__current__">Borrador abierto</option>
              {revisions.map(rev => <option value={rev.id} key={rev.id}>{rev.kind === 'baseline' ? 'Estado inicial' : revisionDate(rev.savedAt)} · {rev.title}</option>)}
            </select></label>
            <label>HASTA<select value={compareTo} onChange={event => setCompareTo(event.target.value)}>
              <option value="__current__">Borrador abierto</option>
              {revisions.map(rev => <option value={rev.id} key={rev.id}>{rev.kind === 'baseline' ? 'Estado inicial' : revisionDate(rev.savedAt)} · {rev.title}</option>)}
            </select></label>
            {historyScope === 'concepto' && historyNodeId ? <div className="diagram-history-diff" aria-live="polite">
              <strong>Cambios de «{historyNodeTitle}»</strong>
              {!conceptComparison ? <p>Seleccione dos versiones para comparar.</p> : conceptComparison.events.length === 0
                ? <p>{!conceptComparison.beforePresent && !conceptComparison.afterPresent
                  ? 'Este concepto no aparece en ninguna de las dos versiones.'
                  : 'No hay cambios de este concepto entre las versiones seleccionadas.'}</p>
                : <ul>{conceptComparison.events.map((item, index) => <li key={index}>{item.description}</li>)}</ul>}
            </div> : comparison && <div className="diagram-history-diff" aria-live="polite">
              <div className="diagram-history-metrics">
                <span><b>+{comparison.nodesAdded}</b> nodos</span><span><b>−{comparison.nodesRemoved}</b> nodos</span>
                <span><b>{comparison.nodesChanged}</b> nodos editados</span><span><b>{comparison.referencesChanged}</b> bibliografías modificadas</span>
                <span><b>+{comparison.edgesAdded} / −{comparison.edgesRemoved}</b> conexiones</span><span><b>{comparison.edgesChanged}</b> relaciones editadas</span>
              </div>
              {(comparison.titleChanged || comparison.descriptionChanged) && <p>{comparison.titleChanged && 'Cambió el título. '}{comparison.descriptionChanged && 'Cambió la descripción general.'}</p>}
              {comparison.changedConcepts.length > 0 && <div><strong>Conceptos afectados</strong><ul>{comparison.changedConcepts.slice(0, 12).map((label, i) => <li key={i}>{label}</li>)}</ul></div>}
              {!comparison.titleChanged && !comparison.descriptionChanged && comparison.nodesAdded + comparison.nodesRemoved + comparison.nodesChanged + comparison.edgesAdded + comparison.edgesRemoved + comparison.edgesChanged === 0 && <p>Sin diferencias entre las versiones seleccionadas.</p>}
            </div>}
            <p className="diagram-history-note">Recuperar permite revisar una versión anterior sin reemplazar la que ya guardó. Para conservarla, pulse «Guardar esquema»; se creará una nueva revisión.</p>
          </div>
        </div></>}
    </section>}
    <div className="editor-layout">
      <div className="graph-region">
        <div className="graph-toolbar"><span><span className="live-dot"/> LIENZO 2D PRIVADO</span><span>{nodes.length} NODOS · {edges.length} CONEXIONES</span><button onClick={addConcept} disabled={loading || batchMode}><Plus size={16}/> Añadir concepto</button><button type="button" className={`button batch-connect-launch${batchMode ? ' batch-connect-launch--active' : ''}`} disabled={loading || !nodes.length} aria-pressed={batchMode} onClick={batchMode ? cancelBatch : beginBatch}><GitCompareArrows size={16}/> {batchMode ? 'Salir de conexiones múltiples' : 'Conectar varios'}</button></div>
        {batchMode && <section className="batch-connect-panel" aria-label="Conectar varios nodos desde el mapa">
          <div className="batch-connect-intro"><strong>{batchSourceId ? `Origen: #${String(nodes.findIndex(n => n.id === batchSourceId) + 1).padStart(2, '0')} ${nodes.find(n => n.id === batchSourceId)?.data.title ?? ''}` : '1. Pulse en el mapa el nodo de origen'}</strong><p>{batchSourceId ? '2. Pulse cada destino en el mapa (puede seleccionar varios). Pulse otra vez para quitarlo.' : 'Puede elegir cualquier nodo como origen. Sus posiciones no cambiarán.'}</p></div>
          <label>Tipo de relación<select value={batchRelation} onChange={event => setBatchRelation(event.target.value as ArgumentRelation)}>{relationKeys.map(key => <option key={key} value={key}>{relationLabels[key]}</option>)}</select></label>
          <div className="batch-connect-actions"><span>{batchTargetIds.length} destinos</span><button type="button" className="button button-secondary" onClick={() => { setBatchSourceId(null); setBatchTargetIds([]); }}>Cambiar origen</button><button type="button" className="button button-primary" disabled={!batchSourceId || !batchTargetIds.length} onClick={commitBatch}>Conectar {batchTargetIds.length} nodos</button><button type="button" className="button button-secondary" onClick={cancelBatch}>Cancelar</button></div>
        </section>}
        {batchFeedback && !batchMode && <p className="batch-connect-feedback" role="status">{batchFeedback}</p>}
        {loading ? <div className="graph-loading">Preparando el mapa conceptual…</div>
          : <div className="graph-canvas">
            <ReactFlow nodes={renderedNodes} edges={edges} nodesDraggable={!batchMode} nodesConnectable={!batchMode}
              onNodesChange={changes => { onNodesChange(changes); if (changes.some(change => ['position', 'add', 'remove', 'replace'].includes(change.type))) setSaved(false); }}
              onEdgesChange={changes => { onEdgesChange(changes); if (changes.some(change => ['add', 'remove', 'replace'].includes(change.type))) setSaved(false); }}
              onConnect={connection => { if (!batchMode) connect(connection); }}
              onNodeClick={(_, node) => { if (batchMode) { clickBatchNode(node.id); return; } setSelectedId(node.id); setSelectedEdgeId(null); }}
              onEdgeClick={(_, edge) => { if (batchMode) return; setSelectedEdgeId(edge.id); setSelectedId(null); }}
              onPaneClick={() => { if (!batchMode) { setSelectedId(null); setSelectedEdgeId(null); } }}
              nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.6}
              defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#977b65', strokeWidth: 2 } }} colorMode="light">
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#DCD7CF"/>
              <Controls showInteractive={false}/>
              <MiniMap zoomable pannable nodeColor={node => node.data.category === 'tesis' ? '#7D2944' : '#B9A185'}/>
            </ReactFlow>
          </div>}
        {guiding && <div className="guide-overlay">
          <button className="guide-close" aria-label="Cerrar guía" onClick={() => setGuiding(false)}><X size={17}/></button>
          <small>GUÍA DE LECTURA · {step % Math.max(nodes.length, 1) + 1}/{nodes.length || 1}</small>
          <h3>{guidedNode?.data.title || 'No hay nodos'}</h3><p>{guidedNode?.data.description || 'Añada un concepto para comenzar.'}</p>
          <ReferenceList references={guidedNode?.data.references}/>
          <button onClick={() => setStep(s => (s + 1) % Math.max(nodes.length, 1))} disabled={!nodes.length}>Siguiente concepto <ArrowRight size={16}/></button>
        </div>}
        <div className="graph-help">Arrastre nodos, conecte sus extremos y seleccione una línea para clasificar su relación argumentativa.</div>
      </div>
      <aside className="inspector">
        <div className="inspector-heading"><div className="eyebrow">PANEL DE PROPIEDADES</div><h2>{selected ? 'Editar concepto' : selectedEdge ? 'Relación argumentativa' : 'Información del esquema'}</h2></div>
        {selected ? <div className="inspector-fields">
          <div className="concept-number-caption">NODO {String(nodes.findIndex(node => node.id === selected.id) + 1).padStart(2, '0')} DE {nodes.length}</div>
          <label>TIPO DE CONCEPTO<select value={selected.data.category} onChange={event => updateNode({ category: event.target.value as ConceptNodeType['data']['category'] })}>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="critical-toggle"><input type="checkbox" checked={selected.data.critical === true} onChange={event => updateNode({ critical: event.target.checked })}/><span><b>Marcar como nodo crítico</b><small>Destacado con borde y brillo especial también en las ediciones compartidas.</small></span></label>
          <label>TÍTULO DEL NODO<textarea className="concept-title-large" rows={3} maxLength={MAX_NODE_TITLE_CHARACTERS} value={selected.data.title} onChange={event => updateNode({ title: event.target.value })} aria-describedby="node-title-count"/></label>
           <small id="node-title-count" className={`concept-title-word-caption${!isValidNodeTitle(selected.data.title) ? ' concept-title-word-caption--invalid' : ''}`} role="status">{nodeTitleWordCount(selected.data.title)} / {MAX_NODE_TITLE_WORDS} palabras · máximo {MAX_NODE_TITLE_CHARACTERS} caracteres. {nodeTitleWordCount(selected.data.title) > MAX_NODE_TITLE_WORDS ? 'Ha superado el límite: acorte el título antes de guardar.' : 'Fin del límite: 100 palabras.'}</small>
          <label>DESCRIPCIÓN<textarea maxLength={240} rows={6} value={selected.data.description} onChange={event => updateNode({ description: event.target.value })}/></label>
          <div className="concept-history-launch">
            <button type="button" className="button button-secondary" disabled={busy || loading} onClick={() => openConceptHistory(selected.id)}>
              <History size={15}/> Ver evolución de este concepto
            </button>
            <span>Consulte sus cambios, fuentes y relaciones a través del tiempo.</span>
          </div>
          <section className="academic-reference-editor" aria-label="Referencias bibliográficas del nodo">
            <div className="academic-reference-header"><div><BookOpen size={16}/><b>REFERENCIAS</b></div><span>{selected.data.references?.length ?? 0}/{MAX_NODE_REFERENCES}</span></div>
            {(selected.data.references ?? []).map((reference, index) => {
              const isStored = isReferencePersisted(
                selected.data.references ?? [], persistedReferences[selected.id] ?? [], index,
              );
              const isEditing = editingReference?.nodeId === selected.id && editingReference.index === index;
              const showCard = isStored && !isEditing;
              const url = safeReferenceUrl(reference.url);
              return showCard ? <article className="academic-reference-saved" key={`${selected.id}-${index}`}>
                <div className="academic-reference-saved-top">
                  <span className="academic-reference-saved-number"><BookOpen size={15}/> Referencia {index + 1}</span>
                  <span className="academic-reference-saved-badge"><Check size={13}/> Guardada</span>
                </div>
                <h3 className="academic-reference-saved-work">{reference.work}</h3>
                <p className="academic-reference-saved-author">{reference.author || 'Sin autor especificado'}</p>
                {(reference.year || reference.locator) && <p className="academic-reference-saved-meta">
                  {reference.year && <span>{reference.year}</span>}
                  {reference.year && reference.locator && <span aria-hidden="true">·</span>}
                  {reference.locator && <span>{reference.locator}</span>}
                </p>}
                {url && <a className="academic-reference-saved-link" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Consultar fuente</a>}
                <div className="academic-reference-saved-actions">
                  <button type="button" onClick={() => editReference(index)}><Pencil size={14}/> Editar</button>
                  <button type="button" onClick={() => removeReference(index)}><X size={14}/> Quitar</button>
                </div>
              </article> : <div className="academic-reference-form" key={`${selected.id}-${index}`}>
                <div className="academic-reference-form-title">
                  <div className="academic-reference-edit-title"><b>Fuente {index + 1}</b><span className="academic-reference-unsaved-badge">{isStored ? 'En edición' : 'Sin guardar'}</span></div>
                  <div className="academic-reference-edit-actions">
                    {isEditing && <button type="button" onClick={() => cancelReferenceEdit(index)}><ArrowLeft size={14}/> Cancelar</button>}
                    <button type="button" onClick={() => removeReference(index)} aria-label={`Quitar fuente ${index + 1}`}><X size={14}/> Quitar</button>
                  </div>
                </div>
                <label>AUTOR O INSTITUCIÓN<input maxLength={110} value={reference.author} placeholder="Ej. Immanuel Kant" onChange={event => updateReference(index, 'author', event.target.value)}/></label>
                <label>OBRA O DOCUMENTO *<input maxLength={180} value={reference.work} placeholder="Ej. Crítica de la razón pura" onChange={event => updateReference(index, 'work', event.target.value)}/></label>
                <div className="academic-reference-two"><label>AÑO<input maxLength={35} value={reference.year} placeholder="1781" onChange={event => updateReference(index, 'year', event.target.value)}/></label><label>PÁGINA / SECCIÓN<input maxLength={100} value={reference.locator} placeholder="A51/B75" onChange={event => updateReference(index, 'locator', event.target.value)}/></label></div>
                <label>ENLACE (OPCIONAL)<input type="url" maxLength={240} value={reference.url} placeholder="https://doi.org/…" aria-invalid={Boolean(reference.url?.trim()) && !safeReferenceUrl(reference.url)} aria-describedby={`reference-url-help-${selected.id}-${index}`} onChange={event => updateReference(index, 'url', event.target.value)}/></label>
                {reference.url?.trim() && !safeReferenceUrl(reference.url) &&
                  <p id={`reference-url-help-${selected.id}-${index}`} className="academic-reference-field-error" role="alert">El enlace debe comenzar con https:// o http://. Si no tiene uno, deje el campo vacío. Esta referencia no se guardará mientras el enlace sea inválido.</p>}
              </div>;
            })}
            <button type="button" className="button button-secondary academic-add-reference" disabled={(selected.data.references?.length ?? 0) >= MAX_NODE_REFERENCES} onClick={addReference}><Plus size={15}/> Añadir referencia</button>
            <p className="academic-reference-disclaimer">Las referencias guardadas se muestran como fichas de lectura. Al editar, añadir o quitar una fuente, pulse «Guardar esquema y referencias» para conservar los cambios. No se verifica automáticamente la autenticidad de las fuentes.</p>
            {invalidUrlCount > 0 && <p className="academic-reference-field-error" role="alert">Hay {invalidUrlCount} enlace(s) inválido(s). Corríjalos o bórrelos antes de guardar.</p>}
            {error && <div role="alert" className="alert alert-error academic-reference-save-error">{error}</div>}
            {saved && <div role="status" className="academic-reference-save-success"><Check size={15}/> Cambios guardados. Puede continuar o volver más tarde.</div>}
            <button type="button" className="button button-primary academic-reference-save" disabled={busy || loading || invalidUrlCount > 0} onClick={() => void save()}><Save size={16}/> {busy ? 'Guardando…' : 'Guardar esquema y referencias'}</button>
          </section>
          <div className="inspector-tip">La guía resalta nodos sin moverlos. Solo se publica lo que elija posteriormente para cada grupo.</div>
          <button className="button button-danger" onClick={removeConcept}><Trash2 size={16}/> Eliminar concepto</button>
        </div> : selectedEdge ? <div className="inspector-fields">
          <div className="inspector-tip">Clasifique qué tipo de argumento conecta los conceptos. Esta relación aparecerá en la versión publicada cuando ambos nodos sean visibles.</div>
          <label>TIPO DE RELACIÓN<select value={selectedEdge.data?.relation ?? 'otra'} onChange={event => updateRelation(event.target.value as ArgumentRelation)}>{relationKeys.map(key => <option key={key} value={key}>{relationLabels[key]}</option>)}</select></label>
          <label>ETIQUETA VISIBLE<input maxLength={80} value={String(selectedEdge.label ?? '')} onChange={event => updateEdge({ label: event.target.value })}/></label>
          <button className="button button-danger" onClick={removeConnection}><Trash2 size={16}/> Eliminar conexión</button>
        </div> : <form className="inspector-fields" onSubmit={event => void save(event)}>
          <label>TÍTULO DEL ESQUEMA<input maxLength={100} value={title} onChange={event => { setTitle(event.target.value); setSaved(false); }}/></label>
          <label>DESCRIPCIÓN<textarea rows={5} maxLength={500} value={description} onChange={event => { setDescription(event.target.value); setSaved(false); }}/></label>
          <div className="inspector-tip">Seleccione un nodo para añadir bibliografía o una conexión para clasificar el argumento. Los cambios solo se guardan cuando pulsa «Guardar esquema».</div>
          <button className="button button-secondary" disabled={busy} type="submit"><Check size={16}/> Aplicar cambios</button>
        </form>}
        <div className="inspector-bottom"><button className="link-button delete-diagram" disabled={busy} onClick={remove}><Trash2 size={16}/> Eliminar todo el esquema</button></div>
      </aside>
    </div>
  </div>;
}
export function DiagramEditor() { return <ReactFlowProvider><EditorContent/></ReactFlowProvider>; }
