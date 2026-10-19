import { useEffect, useMemo, useState } from 'react';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, CircleHelp, Focus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ConceptNode } from '../components/ConceptNode';
import { openPublication, type Publication } from '../lib/groups';
import { explainError } from '../lib/errors';
import { safeReferenceUrl } from '../lib/academicGraph';
import { revisionDate } from '../lib/diagramHistory';
import { publishedReadingGraph, readingProgress, readingStep, studentConnections } from '../lib/studyReading';
import type { AcademicReference } from '../lib/types';

const nodeTypes = { concept: ConceptNode };

function PublishedSources({ references }: { references?: AcademicReference[] }) {
  if (!references?.length) return <p className="study-empty">No se registraron fuentes para este concepto.</p>;
  return <div className="study-source-list">
    {references.map((reference, index) => <div className="study-source-card" key={`${index}-${reference.work}`}>
      <BookOpen size={17} aria-hidden="true" />
      <div>
        <b>{reference.work}</b>
        {reference.author && <span>{reference.author}</span>}
        {(reference.year || reference.locator) && <small>{[reference.year, reference.locator].filter(Boolean).join(' · ')}</small>}
        {safeReferenceUrl(reference.url) && <a href={safeReferenceUrl(reference.url)} target="_blank" rel="noopener noreferrer">Consultar fuente ↗</a>}
      </div>
    </div>)}
    <p className="study-disclaimer">Las referencias corresponden a la edición compartida; su autenticidad no se comprueba automáticamente.</p>
  </div>;
}

function ReadOnlyCanvas() {
  const { groupId, id } = useParams();
  const [publication, setPublication] = useState<Publication | null>(null);
  const [error, setError] = useState('');
  const [guidedIndex, setGuidedIndex] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState(false);

  useEffect(() => {
    // Evita que un cambio de publicación deje visible el contenido de la anterior.
    setPublication(null);
    setError('');
    setGuidedIndex(null);
    setSelectedNodeId(null);
    setStudyMode(false);
    if (!groupId || !id) return;
    let alive = true;
    openPublication(groupId, id)
      .then(p => { if (alive) setPublication(p); })
      .catch(e => { if (alive) setError(explainError(e)); });
    return () => { alive = false; };
  }, [groupId, id]);

  // La única fuente del visor es la copia publicada y sus relaciones internas.
  const published = useMemo(() => publishedReadingGraph(publication?.nodes ?? [], publication?.edges ?? []), [publication]);
  const activeNode = guidedIndex === null ? null : published.nodes[guidedIndex] ?? null;
  const selectedNode = published.nodes.find(node => node.id === selectedNodeId) ?? null;
  const shownNode = activeNode ?? selectedNode;
  const connections = useMemo(
    () => shownNode ? studentConnections(published.nodes, published.edges, shownNode.id) : [],
    [published, shownNode?.id],
  );
  const nodes = useMemo(() => published.nodes.map(node => ({
    ...node,
    data: { ...node.data, highlight: node.id === shownNode?.id, studyDimmed: studyMode && !!shownNode && node.id !== shownNode.id },
  })), [published.nodes, shownNode?.id, studyMode]);
  const edges = useMemo(() => published.edges.map(edge => {
    const near = shownNode && (edge.source === shownNode.id || edge.target === shownNode.id);
    return {
      ...edge,
      style: { ...edge.style, opacity: studyMode && shownNode && !near ? 0.22 : 1 },
      labelStyle: { ...edge.labelStyle, opacity: studyMode && shownNode && !near ? 0.36 : 1 },
    };
  }), [published.edges, shownNode?.id, studyMode]);

  const isGuiding = guidedIndex !== null;
  const beginGuide = () => {
    if (!published.nodes.length) return;
    setGuidedIndex(0);
    setSelectedNodeId(null);
  };
  const stopGuide = () => {
    if (activeNode) setSelectedNodeId(activeNode.id);
    setGuidedIndex(null);
  };
  const inspectNode = (nodeId: string) => {
    // El cambio de foco nunca modifica posiciones, conexiones ni datos publicados.
    setSelectedNodeId(nodeId);
    setGuidedIndex(null);
  };

  return <div className="editor-page published-study-page">
    <div className="editor-header"><div>
      <Link className="back-link" to="/biblioteca"><ArrowLeft size={16}/> VOLVER A LA BIBLIOTECA</Link>
      <div className="eyebrow">SISTEMA 2D / LECTURA ACADÉMICA</div>
      <h1>{publication?.title ?? 'Cargando publicación…'}</h1>
      <p>{publication?.description}</p>
      {publication !== null && Boolean(publication.sourceRevisionSavedAt) && <p className="publication-edition-label">Edición compartida: {revisionDate(publication.sourceRevisionSavedAt)}</p>}
    </div><div className="editor-header-actions">
      <button className="button button-secondary" aria-pressed={studyMode} disabled={!published.nodes.length} onClick={() => setStudyMode(value => !value)}>
        <Focus size={17}/> {studyMode ? 'Salir del modo de estudio' : 'Modo de estudio'}
      </button>
      <button className="button button-secondary" disabled={!published.nodes.length} onClick={isGuiding ? stopGuide : beginGuide}>
        <CircleHelp size={17}/> {isGuiding ? 'Salir de la guía' : 'Iniciar guía'}
      </button>
    </div></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {!publication && !error && <p className="study-loading" role="status">Preparando su lectura…</p>}
    {publication && <>
      <p className="readonly-banner">Material de lectura. Solo contiene los conceptos compartidos para su programa. Seleccione un nodo para estudiarlo o inicie la guía.</p>
      <div className="publication-canvas study-canvas" aria-label="Mapa conceptual de solo lectura">
        <ReactFlow nodes={nodes} edges={edges}
          onNodeClick={(_, node) => inspectNode(node.id)}
          nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false}
          elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
          fitView minZoom={0.15} maxZoom={1.7} colorMode="light">
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#DCD7CF"/>
          <Controls showInteractive={false}/><MiniMap zoomable pannable/>
        </ReactFlow>
        {isGuiding && guidedIndex !== null && <div className="study-canvas-hint" aria-live="polite">
          <span>Guía · {guidedIndex + 1}/{published.nodes.length}</span>
          <button type="button" onClick={() => document.getElementById('lectura-del-concepto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver explicación ↓</button>
        </div>}
      </div>
      <section id="lectura-del-concepto" className="study-reading-panel" aria-label="Guía y documentación del concepto">
        <div className="study-panel-heading">
          <div>
            <div className="eyebrow">MI LECTURA DEL SISTEMA</div>
            <h2>{isGuiding ? 'Recorrido de lectura' : shownNode ? 'Concepto seleccionado' : 'Explore las ideas del mapa'}</h2>
            <p>{isGuiding ? 'Avance concepto por concepto. El mapa mantiene su distribución original.' : 'Pulse un nodo del mapa para consultar su explicación, bibliografía y relaciones.'}</p>
          </div>
          {studyMode && <span className="study-focus-badge"><Check size={14}/> Modo de estudio activo</span>}
        </div>
        {isGuiding && guidedIndex !== null && <div className="study-progress-block">
          <div className="study-progress-label"><strong>Concepto {guidedIndex + 1} de {published.nodes.length}</strong><span>{readingProgress(guidedIndex, published.nodes.length)}%</span></div>
          <div className="study-progress" role="progressbar" aria-label="Progreso de lectura" aria-valuemin={0} aria-valuemax={published.nodes.length} aria-valuenow={guidedIndex + 1}>
            <span style={{ width: `${readingProgress(guidedIndex, published.nodes.length)}%` }}/>
          </div>
        </div>}
        {shownNode ? <>
          <div className="study-detail-grid">
            <article className="study-idea-detail">
              <div className="eyebrow">IDEA CENTRAL</div>
              <h3>{shownNode.data.title}</h3>
              <p>{shownNode.data.description || 'Este concepto todavía no tiene una explicación desarrollada.'}</p>
            </article>
            <article className="study-bibliography">
              <div className="eyebrow">BIBLIOGRAFÍA DEL CONCEPTO</div>
              <PublishedSources references={shownNode.data.references}/>
            </article>
          </div>
          <div className="study-relations-block">
            <div className="eyebrow">CÓMO SE CONECTA CON OTRAS IDEAS</div>
            {connections.length ? <div className="study-connection-grid">
              {connections.map(connection => <div className="study-connection" key={connection.id}>
                <p>{connection.explanation}</p>
                <button type="button" className="study-related-link" onClick={() => inspectNode(connection.otherNodeId)}>
                  Explorar «{connection.otherTitle}» <ArrowRight size={14}/>
                </button>
              </div>)}
            </div> : <p className="study-empty">Este concepto no tiene conexiones con otros nodos de la edición.</p>}
            <small>Las relaciones expresan cómo el autor vinculó estas ideas en el esquema; no constituyen una verificación automática de sus argumentos.</small>
          </div>
        </> : <div className="study-empty-state"><BookOpen size={24}/><p>Su lectura comienza al seleccionar un concepto o pulsar «Iniciar guía».</p></div>}
        {isGuiding && guidedIndex !== null && <nav className="study-guide-controls" aria-label="Navegación de la guía">
          <button className="button button-secondary" disabled={guidedIndex === 0} onClick={() => setGuidedIndex(current => current === null ? current : readingStep(current, published.nodes.length, -1))}><ChevronLeft size={16}/> Anterior</button>
          {guidedIndex < published.nodes.length - 1
            ? <button className="button button-primary" onClick={() => setGuidedIndex(current => current === null ? current : readingStep(current, published.nodes.length, 1))}>Siguiente concepto <ArrowRight size={16}/></button>
            : <button className="button button-primary" onClick={stopGuide}><Check size={16}/> Finalizar guía</button>}
        </nav>}
      </section>
    </>}
  </div>;
}

export function PublishedViewer() { return <ReactFlowProvider><ReadOnlyCanvas/></ReactFlowProvider>; }
