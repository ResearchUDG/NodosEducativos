import { useEffect, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, Handle, Position, ReactFlow, ReactFlowProvider,
  useReactFlow, type Edge, type NodeProps,
} from '@xyflow/react';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronRight, CircleDot, ListTree,
  Maximize2, Minimize2, Network, RotateCcw, X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../lib/theme';
import { NodeQABlock } from './NodeQABlock';
import { safeReferenceUrl } from '../lib/academicGraph';
import { numberedNodes } from '../lib/graphEnhancements';
import {
  presentationCategories, presentationCategoryLabel, presentationMatchesFilter,
  presentationNeighborIds, presentationProgress, type PresentationFilter,
} from '../lib/presentation2d';
import { studentConnections } from '../lib/studyReading';
import { presentationKeyboardAction } from '../lib/presentationInteraction';
import type { AcademicReference, ConceptEdge, ConceptNode } from '../lib/types';

type Props = {
  title: string;
  description?: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  onClose?: () => void;
  overlay?: boolean;
};

type PresentationNode = Omit<ConceptNode, 'type'> & { type: 'presentation' };

function NodeCard({ data, selected }: NodeProps<PresentationNode>) {
  const presentationData = data as typeof data & {
    presentationDimmed?: boolean;
    presentationNearby?: boolean;
  };
  return <div className={[
    'p2d-node',
    `p2d-node--${String(data.category ?? 'concepto')}`,
    data.critical ? 'p2d-node--critical' : '',
    selected ? 'p2d-node--selected' : '',
    presentationData.presentationNearby ? 'p2d-node--nearby' : '',
    presentationData.presentationDimmed ? 'p2d-node--dimmed' : '',
  ].filter(Boolean).join(' ')}>
    <Handle type="target" position={Position.Left} className="p2d-handle"/>
    <div className="p2d-node-kicker">
      <span>{typeof data.displayNumber === 'number' ? String(data.displayNumber).padStart(2, '0') : '·'}</span>
      <span>{presentationCategoryLabel(data.category)}</span>
      {data.critical === true && <b>CRÍTICO ✦</b>}
    </div>
    <strong>{data.title}</strong>
    <div className="p2d-node-meta">
      {(data.qa?.length ?? 0) > 0 && <span>{data.qa?.length} {data.qa?.length === 1 ? 'pregunta' : 'preguntas'}</span>}
      {(data.references?.length ?? 0) > 0 && <span>{data.references?.length} {data.references?.length === 1 ? 'fuente' : 'fuentes'}</span>}
    </div>
    <Handle type="source" position={Position.Right} className="p2d-handle"/>
  </div>;
}

const nodeTypes = { presentation: NodeCard };

function ReferenceList({ references }: { references?: AcademicReference[] }) {
  if (!references?.length) return <p className="p2d-empty">Este concepto no tiene fuentes registradas en esta edición.</p>;
  return <div className="p2d-reference-list">
    {references.map((ref, index) => {
      const url = safeReferenceUrl(ref.url);
      return <article key={`${index}-${ref.work}`}>
        <BookOpen size={17}/>
        <div>
          <strong>{ref.work}</strong>
          {ref.author && <span>{ref.author}</span>}
          {(ref.year || ref.locator) && <small>{[ref.year, ref.locator].filter(Boolean).join(' · ')}</small>}
          {url && <a href={url} target="_blank" rel="noopener noreferrer">Consultar fuente ↗</a>}
        </div>
      </article>;
    })}
  </div>;
}

function PresentationInner({ title, description = '', nodes, edges, onClose, overlay = false }: Props) {
  const flow = useReactFlow();
  const location = useLocation();
  const { theme } = useTheme();
  const academicNodes = useMemo(() => numberedNodes(nodes), [nodes]);
  const categories = useMemo(() => presentationCategories(academicNodes), [academicNodes]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PresentationFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);

  useEffect(() => {
    if (selectedId && !academicNodes.some(node => node.id === selectedId)) setSelectedId(null);
  }, [academicNodes, selectedId]);

  const selected = academicNodes.find(node => node.id === selectedId) ?? null;
  const selectedIndex = selected ? academicNodes.findIndex(node => node.id === selected.id) : -1;
  const neighborIds = useMemo(() => presentationNeighborIds(edges, selectedId), [edges, selectedId]);
  const connections = useMemo(
    () => selected ? studentConnections(academicNodes, edges, selected.id) : [],
    [academicNodes, edges, selected?.id],
  );

  const flowNodes = useMemo<PresentationNode[]>(() => academicNodes.map(node => {
    const matches = presentationMatchesFilter(node, filter);
    const isSelected = node.id === selectedId;
    const isNearby = neighborIds.has(node.id);
    const dimmedByFocus = Boolean(selectedId) && !isSelected && !isNearby;
    return {
      ...node,
      type: 'presentation',
      selected: isSelected,
      data: {
        ...node.data,
        presentationNearby: isNearby,
        presentationDimmed: !matches || dimmedByFocus,
      },
    };
  }), [academicNodes, filter, selectedId, neighborIds]);

  const flowEdges = useMemo<Edge[]>(() => edges.map(edge => {
    const active = Boolean(selectedId) && (edge.source === selectedId || edge.target === selectedId);
    const focused = Boolean(selectedId);
    const activeStroke = theme === 'dark' ? '#78a9ff' : '#0f62fe';
    const idleStroke = theme === 'dark' ? '#6f6f6f' : '#8d8d8d';
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      // En foco de lectura el panel lateral ya explica las relaciones. Ocultar
      // las etiquetas evita que el texto invada el nodo y el inspector.
      label: focused ? undefined : edge.label,
      markerEnd: edge.markerEnd,
      style: {
        stroke: active ? activeStroke : idleStroke,
        strokeWidth: active ? 2.25 : 1.05,
        opacity: focused ? (active ? .90 : .30) : .72,
      },
      labelStyle: {
        fill: theme === 'dark' ? '#c6c6c6' : '#525252',
        fontSize: 9,
        fontWeight: 650,
        opacity: .84,
      },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      labelBgStyle: {
        fill: theme === 'dark' ? '#262626' : '#FFFFFF',
        fillOpacity: .96,
      },
      className: active ? 'p2d-edge--active' : 'p2d-edge--idle',
    };
  }), [edges, selectedId, theme]);

  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(() => {
      void flow.setCenter(selected.position.x + 120, selected.position.y + 75, { zoom: 1.08, duration: 380 });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [selected?.id, flow]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selected) {
        void flow.setCenter(selected.position.x + 120, selected.position.y + 75, { zoom: 1.08, duration: 280 });
      } else {
        void flow.fitView({ padding: .16, duration: 280 });
      }
    }, 140);
    return () => window.clearTimeout(timer);
  }, [expanded, overlay, flow]);

  const showWholeMap = () => {
    setSelectedId(null);
    setFilter('all');
    window.setTimeout(() => void flow.fitView({ padding: .16, duration: 320 }), 20);
  };

  const select = (id: string) => {
    setSelectedId(id);
    setFilter('all');
  };

  const step = (delta: -1 | 1) => {
    if (!academicNodes.length) return;
    const base = selectedIndex < 0 ? (delta > 0 ? -1 : 1) : selectedIndex;
    const next = Math.max(0, Math.min(academicNodes.length - 1, base + delta));
    setSelectedId(academicNodes[next]?.id ?? null);
    setFilter('all');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const action = presentationKeyboardAction(event.key, Boolean(selectedId));
      if (!action) return;
      event.preventDefault();
      if (action === 'clear') showWholeMap();
      if (action === 'previous') step(-1);
      if (action === 'next') step(1);
      if (action === 'first' && academicNodes.length) select(academicNodes[0].id);
      if (action === 'last' && academicNodes.length) select(academicNodes[academicNodes.length - 1].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, selectedIndex, academicNodes.length]);

  const guestMatch = location.pathname.match(/\/invitados\/([^/]+)/);
  const backTo = guestMatch ? `/invitados/${guestMatch[1]}` : '/biblioteca';
  const backLabel = guestMatch ? 'Todos los esquemas' : 'Volver a publicaciones';

  return <section className={[
    'p2d-presentation',
    overlay ? 'p2d-presentation--overlay' : '',
    expanded ? 'p2d-presentation--expanded' : '',
    routeOpen ? 'p2d-presentation--route-open' : '',
    selected ? 'p2d-presentation--focused' : '',
  ].filter(Boolean).join(' ')}>
    <header className="p2d-header">
      <div className="p2d-header-copy">
        {!overlay && <Link className="p2d-back" to={backTo}><ArrowLeft size={15}/>{backLabel}</Link>}
        <div className="p2d-eyebrow">SISTEMA 2D · CARTOGRAFÍA CONCEPTUAL</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        <div className="p2d-stats">
          <span>{academicNodes.length} conceptos</span>
          <span>{edges.length} relaciones</span>
          <span>{academicNodes.filter(node => node.data.critical === true).length} críticos</span>
        </div>
      </div>
      <div className="p2d-header-actions">
        <button type="button" className="button button-secondary" onClick={showWholeMap}><RotateCcw size={16}/> Mapa completo</button>
        {!overlay && <button type="button" className="button button-secondary" onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>} {expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>}
        {onClose && <button type="button" className="button button-secondary" onClick={onClose}><X size={17}/> Cerrar</button>}
      </div>
    </header>

    <div className="p2d-contextbar">
      <div className="p2d-filter-row" role="group" aria-label="Filtrar conceptos">
        <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => { setFilter('all'); setSelectedId(null); window.setTimeout(() => void flow.fitView({ padding: .16, duration: 260 }), 20); }}>Todo el sistema</button>
        {academicNodes.some(node => node.data.critical === true) && <button type="button" className={filter === 'critical' ? 'is-active' : ''} onClick={() => { setFilter('critical'); setSelectedId(null); window.setTimeout(() => void flow.fitView({ padding: .16, duration: 260 }), 20); }}>Nodos críticos</button>}
        {categories.map(category => <button type="button" key={category} className={filter === category ? 'is-active' : ''} onClick={() => { setFilter(category); setSelectedId(null); window.setTimeout(() => void flow.fitView({ padding: .16, duration: 260 }), 20); }}>{presentationCategoryLabel(category)}</button>)}
      </div>
      <div className="p2d-legend">
        <span><i className="p2d-legend-selected"/>seleccionado</span>
        <span><i className="p2d-legend-critical"/>crítico</span>
        <span><i className="p2d-legend-link"/>relación</span>
      </div>
    </div>

    <div className="p2d-stage">
      <div className="p2d-map">
        <div className="p2d-map-hint"><CircleDot size={15}/><span>{selected ? 'Concepto en foco · conexiones resaltadas. Clic en el fondo para volver.' : 'Haga clic en un concepto para leerlo.'}</span>{selected && <small>← → recorrer · Esc volver</small>}</div>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onInit={instance => window.setTimeout(() => void instance.fitView({ padding: .16, duration: 260 }), 80)}
          onNodeClick={(_, node) => select(node.id)}
          onPaneClick={showWholeMap}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          fitView
          minZoom={.1}
          maxZoom={1.8}
          panOnDrag
          zoomOnScroll
          colorMode={theme}
          proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={theme === 'dark' ? '#525252' : '#DED7D1'}/>
        </ReactFlow>
      </div>

      <aside className="p2d-inspector" aria-live="polite">
        {selected ? <>
          <div className="p2d-inspector-head">
            <div className="p2d-inspector-kicker">
              <span>NODO {String(selectedIndex + 1).padStart(2, '0')}</span>
              <span>{presentationCategoryLabel(selected.data.category)}</span>
              {selected.data.critical === true && <b>CRÍTICO ✦</b>}
            </div>
            <h2>{selected.data.title}</h2>
            <div className="p2d-progress"><span style={{ width: `${presentationProgress(selectedIndex, academicNodes.length)}%` }}/></div>
            <small>{selectedIndex + 1} de {academicNodes.length} en la ruta de lectura</small>
          </div>

          <div className="p2d-inspector-scroll">
            <section className="p2d-reading-section">
              <div className="p2d-section-title">Qué expresa este nodo</div>
              <p className="p2d-description">{selected.data.description || 'Este concepto todavía no tiene una explicación desarrollada.'}</p>
            </section>

            <NodeQABlock items={selected.data.qa} title="Preguntas para trabajar"/>

            <section className="p2d-reading-section">
              <div className="p2d-section-title">Cómo se conecta</div>
              {connections.length ? <div className="p2d-connection-list">
                {connections.map(connection => <button type="button" key={connection.id} onClick={() => select(connection.otherNodeId)}>
                  <span>{connection.explanation}</span>
                  <b>Explorar «{connection.otherTitle}» <ChevronRight size={15}/></b>
                </button>)}
              </div> : <p className="p2d-empty">Este concepto no tiene conexiones dentro de esta edición.</p>}
            </section>

            <section className="p2d-reading-section">
              <div className="p2d-section-title">Fuentes y referencias</div>
              <ReferenceList references={selected.data.references}/>
            </section>
          </div>

          <nav className="p2d-stepper" aria-label="Recorrido de lectura">
            <button type="button" disabled={selectedIndex <= 0} onClick={() => step(-1)}><ArrowLeft size={16}/>Anterior</button>
            <button type="button" className="p2d-route-toggle" onClick={() => setRouteOpen(value => !value)}><ListTree size={15}/>{routeOpen ? 'Ocultar ruta' : 'Ver ruta'}</button>
            <button type="button" disabled={selectedIndex >= academicNodes.length - 1} onClick={() => step(1)}>Siguiente<ArrowRight size={16}/></button>
          </nav>
        </> : <div className="p2d-empty-inspector">
          <Network size={34}/>
          <h2>Explore el sistema</h2>
          <p>Seleccione un concepto del mapa. La explicación, preguntas, conexiones y fuentes aparecerán aquí.</p>
          {academicNodes.length > 0 && <button type="button" className="button button-primary" onClick={() => select(academicNodes[0].id)}>Comenzar por el primer concepto <ArrowRight size={16}/></button>}
        </div>}
      </aside>
    </div>

    {routeOpen && <div className="p2d-route">
      <div className="p2d-route-title">
        <div><span>LECTIO ORDINATA</span><strong>Ruta de lectura</strong></div>
        <p>Recorra el sistema concepto por concepto o salte directamente al que le interese.</p>
      </div>
      <div className="p2d-route-track">
        {academicNodes.map((node, index) => <button type="button" key={node.id} className={[
          node.id === selectedId ? 'is-current' : '',
          node.data.critical === true ? 'is-critical' : '',
        ].filter(Boolean).join(' ')} onClick={() => select(node.id)}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <b>{node.data.title}</b>
        </button>)}
      </div>
    </div>}
  </section>;
}

export function NodePresentation(props: Props) {
  return <ReactFlowProvider><PresentationInner {...props}/></ReactFlowProvider>;
}
