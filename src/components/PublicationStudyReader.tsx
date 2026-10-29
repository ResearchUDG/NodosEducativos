import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow,
} from '@xyflow/react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, CircleHelp, Focus, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConceptNode } from './ConceptNode';
import { ImmersiveNodeExplorer } from './ImmersiveNodeExplorer';
import { NodeQABlock } from './NodeQABlock';
import { StyledEdge } from './StyledEdge';
import { safeReferenceUrl } from '../lib/academicGraph';
import { revisionDate } from '../lib/diagramHistory';
import { guideStartIndex, numberedNodes } from '../lib/graphEnhancements';
import { publishedReadingGraph, readingProgress, readingStep, studentConnections } from '../lib/studyReading';
import type { AcademicReference, ConceptEdge, ConceptNode as ConceptNodeType } from '../lib/types';

import { NodePresentation } from './NodePresentation';
const nodeTypes = { concept: ConceptNode };
const edgeTypes = { styled: StyledEdge };

export type StudyPublication = {
  id: string;
  title: string;
  description: string;
  nodes: ConceptNodeType[];
  edges: ConceptEdge[];
  sourceRevisionSavedAt?: unknown;
  publishedAt?: unknown;
};

type PublicationStudyReaderProps = {
  publication: StudyPublication | null;
  loading: boolean;
  error: string;
  backTo: string;
  backLabel: string;
  eyebrow: string;
  banner: string;
  guideEnabled?: boolean;
  guestMode?: boolean;
  headerActions?: ReactNode;
};

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

function ReaderCanvas(props: PublicationStudyReaderProps) {
  const { publication, loading, error, backTo, backLabel, eyebrow, banner, guideEnabled = true, guestMode = false, headerActions } = props;
  const flow = useReactFlow();
  const [guidedIndex, setGuidedIndex] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  const [immersiveOpen, setImmersiveOpen] = useState(false);

  useEffect(() => {
    setGuidedIndex(null);
    setSelectedNodeId(null);
    setStudyMode(false);
  }, [publication?.id]);

  const published = useMemo(() => publishedReadingGraph(publication?.nodes ?? [], publication?.edges ?? []), [publication]);
  const activeNode = guidedIndex === null ? null : published.nodes[guidedIndex] ?? null;
  const selectedNode = published.nodes.find(node => node.id === selectedNodeId) ?? null;
  const shownNode = activeNode ?? selectedNode;
  const connections = useMemo(
    () => shownNode ? studentConnections(published.nodes, published.edges, shownNode?.id) : [],
    [published, shownNode?.id],
  );
  const nodes = useMemo(() => numberedNodes(published.nodes).map(node => ({
    ...node,
    data: { ...node.data, highlight: node.id === shownNode?.id, studyDimmed: studyMode && !!shownNode && node.id !== shownNode?.id },
  })), [published.nodes, shownNode?.id, studyMode]);
  const edges = useMemo(() => published.edges.map(edge => {
    const near = shownNode && (edge.source === shownNode?.id || edge.target === shownNode?.id);
    return {
      ...edge,
      style: { ...edge.style, opacity: studyMode && shownNode && !near ? 0.22 : 1 },
      labelStyle: { ...edge.labelStyle, opacity: studyMode && shownNode && !near ? 0.36 : 1 },
    };
  }), [published.edges, shownNode?.id, studyMode]);

  useEffect(() => {
    if (!activeNode) return;
    void flow.setCenter(activeNode.position.x + 125, activeNode.position.y + 95, { zoom: 0.85, duration: 430 });
  }, [activeNode?.id, flow]);

  const isGuiding = guidedIndex !== null;
  const beginGuide = () => {
    if (!published.nodes.length || !guideEnabled) return;
    setGuidedIndex(guideStartIndex(published.nodes, selectedNodeId));
    setSelectedNodeId(null);
  };
  const stopGuide = () => {
    if (activeNode) setSelectedNodeId(activeNode.id);
    setGuidedIndex(null);
  };
  const inspectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setGuidedIndex(null);
  };

  const editionDate = publication?.sourceRevisionSavedAt ?? publication?.publishedAt;

    return <NodePresentation
    title={publication?.title ?? 'Sistema 2D'}
    description={publication?.description ?? ''}
    nodes={published.nodes}
    edges={published.edges}
  />;

return <div className={`editor-page published-study-page ${guestMode ? 'guest-reader' : ''}`}>
    <div className="editor-header"><div>
      <Link className="back-link" to={backTo}><ArrowLeft size={16}/> {backLabel}</Link>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{publication?.title ?? (loading ? 'Cargando publicación…' : 'Publicación no disponible')}</h1>
      <p>{publication?.description}</p>
      {Boolean(editionDate) && <p className="publication-edition-label">Edición compartida: {revisionDate(editionDate)}</p>}
    </div><div className="editor-header-actions">
      <button className="button button-primary" disabled={!published.nodes.length} onClick={() => setImmersiveOpen(true)}><Maximize2 size={17}/> Explorar mapa</button>
      <button className="button button-secondary" aria-pressed={studyMode} disabled={!published.nodes.length} onClick={() => setStudyMode(value => !value)}>
        <Focus size={17}/> {studyMode ? 'Salir del modo de estudio' : 'Modo de estudio'}
      </button>
      {guideEnabled && <button className="button button-secondary" disabled={!published.nodes.length} onClick={isGuiding ? stopGuide : beginGuide}>
        <CircleHelp size={17}/> {isGuiding ? 'Salir de la guía' : 'Iniciar guía'}
      </button>}
      {headerActions}
    </div></div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading && !publication && !error && <p className="study-loading" role="status">Preparando la lectura…</p>}
    {publication && <>
      <p className="readonly-banner">{banner}</p>
      <div className="publication-canvas study-canvas" aria-label="Mapa conceptual de solo lectura">
        <ReactFlow nodes={nodes} edges={edges}
          onNodeClick={(_, node) => inspectNode(node.id)}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={false}
          elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
          fitView minZoom={0.15} maxZoom={1.7} colorMode="light">
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#DCD7CF"/>
          <Controls showInteractive={false}/><MiniMap zoomable pannable/>
        </ReactFlow>
        {isGuiding && guidedIndex !== null && <div className="study-canvas-hint" aria-live="polite">
          <span>Guía · {(guidedIndex ?? 0) + 1}/{published.nodes.length}</span>
          <button type="button" onClick={() => document.getElementById('lectura-del-concepto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver explicación ↓</button>
        </div>}
      </div>
      <section id="lectura-del-concepto" className="study-reading-panel" aria-label="Guía y documentación del concepto">
        <div className="study-panel-heading">
          <div>
            <div className="eyebrow">LECTURA DEL SISTEMA</div>
            <h2>{isGuiding ? 'Recorrido de lectura' : shownNode ? 'Concepto seleccionado' : 'Explore las ideas del mapa'}</h2>
            <p>{isGuiding ? 'Avance concepto por concepto. El mapa mantiene su distribución original.' : 'Pulse un nodo del mapa para consultar su explicación, bibliografía y relaciones.'}</p>
          </div>
          {studyMode && <span className="study-focus-badge"><Check size={14}/> Modo de estudio activo</span>}
        </div>
        {isGuiding && guidedIndex !== null && <div className="study-progress-block">
          <div className="study-progress-label"><strong>Concepto {(guidedIndex ?? 0) + 1} de {published.nodes.length}</strong><span>{readingProgress(guidedIndex ?? 0, published.nodes.length)}%</span></div>
          <div className="study-progress" role="progressbar" aria-label="Progreso de lectura" aria-valuemin={0} aria-valuemax={published.nodes.length} aria-valuenow={(guidedIndex ?? 0) + 1}>
            <span style={{ width: `${readingProgress(guidedIndex ?? 0, published.nodes.length)}%` }}/>
          </div>
        </div>}
        {shownNode ? <>
          <div className="study-detail-grid">
            <article className="study-idea-detail">
              <div className="eyebrow">NODO {String(published.nodes.findIndex(n => n.id === shownNode?.id) + 1).padStart(2, '0')} · {shownNode?.data.critical === true ? 'NODO CRÍTICO' : 'IDEA CENTRAL'}</div>
              <h3>{shownNode?.data.title}</h3>
              <p>{shownNode?.data.description || 'Este concepto todavía no tiene una explicación desarrollada.'}</p>
              <NodeQABlock items={shownNode?.data.qa}/>
            </article>
            <article className="study-bibliography">
              <div className="eyebrow">BIBLIOGRAFÍA DEL CONCEPTO</div>
              <PublishedSources references={shownNode?.data.references}/>
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
        </> : <div className="study-empty-state"><BookOpen size={24}/><p>La lectura comienza al seleccionar un concepto{guideEnabled ? ' o pulsar «Iniciar guía»' : ''}.</p></div>}
        {isGuiding && guidedIndex !== null && <nav className="study-guide-controls" aria-label="Navegación de la guía">
          <button className="button button-secondary" disabled={guidedIndex === 0} onClick={() => setGuidedIndex(current => current === null ? current : readingStep(current, published.nodes.length, -1))}><ChevronLeft size={16}/> Anterior</button>
          {(guidedIndex ?? 0) < published.nodes.length - 1
            ? <button className="button button-primary" onClick={() => setGuidedIndex(current => current === null ? current : readingStep(current, published.nodes.length, 1))}>Siguiente concepto <ArrowRight size={16}/></button>
            : <button className="button button-primary" onClick={stopGuide}><Check size={16}/> Finalizar guía</button>}
        </nav>}
      </section>
    </>}
  <ImmersiveNodeExplorer
      open={immersiveOpen}
      title={publication?.title ?? ''}
      description={publication?.description}
      nodes={published.nodes}
      edges={published.edges}
      initialNodeId={selectedNodeId}
      onClose={() => setImmersiveOpen(false)}
    />
  </div>;
}

export function PublicationStudyReader(props: PublicationStudyReaderProps) {
  return <ReactFlowProvider><ReaderCanvas {...props}/></ReactFlowProvider>;
}
